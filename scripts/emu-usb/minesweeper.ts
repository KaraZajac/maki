// Minesweeper on the emulated maki: a square flagged from the menu before the first step, the
// first step opening the field around it, the clock running, and the game as it was left when
// it's opened again: its count of mines and its clock read off maki's screen (screenread). Run
// the emulator with --answer, build screenread before starting it, and give the emulator's log
// and folder:
//
//     npx --prefix desktop vite-node scripts/emu-usb/minesweeper.ts LOG OUT
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { CENTRE, Control, LEFT, Log, RIGHT, closeFront, openItem, sleep } from './emu'

const [logPath, out] = process.argv.slice(2)
if (!out) throw new Error('give the emulator log and its folder')
const log = new Log(logPath)
const SCREENREAD = `${__dirname}/screenread/target/release/screenread`
const shown = (frame: string, texts: string[]): string[] =>
  execFileSync(SCREENREAD, ['text', `${out}/${frame}.pgm`, ...texts], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((l) => !l.endsWith('\tmissing'))
    .map((l) => l.split('\t')[0])
const SECONDS = Array.from({ length: 300 }, (_, i) => `${i} s`)
// the clock's seconds: the longest that's there ("1 s" is in "11 s" too)
const seconds = (frame: string): number | null => {
  const found = shown(frame, SECONDS).sort((a, b) => b.length - a.length)
  return found.length ? parseInt(found[0]) : null
}

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`)
  if (!ok) failed++
}

const ctl = await Control.open(7881)
let opened = await openItem(ctl, log, 'Minesweeper')
await log.waitFor(/minesweeper: first frame after/, opened, 180_000)
await sleep(3000)
await ctl.send('shot mines-fresh')
check(shown('mines-fresh', ['mines 12']).length === 1, 'twelve mines, none flagged')

// two squares right of the start, flagged from the menu; then back, and the first step
await ctl.press(RIGHT, 1500)
await ctl.press(RIGHT, 1500)
await ctl.press('3+4', 1500)
await ctl.press(CENTRE, 5000) // Flag
await ctl.send('shot mines-flag')
check(shown('mines-flag', ['mines 11']).length === 1, 'one flagged: "mines 11"')
await ctl.press(LEFT, 1500)
await ctl.press(LEFT, 1500)
await ctl.press(CENTRE, 8000)
await ctl.send('shot mines-step')
const step = readFileSync(`${out}/mines-step.pgm`)
check(!step.equals(readFileSync(`${out}/mines-flag.pgm`)), 'the first step opened the field')
const clock = seconds('mines-step')
check(clock !== null, `the clock starts: ${clock} s`)
await sleep(5000)
await ctl.send('shot mines-later')
const later = seconds('mines-later')
check(later !== null && clock !== null && later > clock, `and goes on: ${later} s`)

// left, and opened again: the same game, flag and all
await closeFront(ctl, log)
opened = await openItem(ctl, log, 'Minesweeper')
await log.waitFor(/minesweeper: first frame after/, opened, 180_000)
await sleep(3000)
await ctl.send('shot mines-again')
check(shown('mines-again', ['mines 11']).length === 1, 'opened again, the game is as it was left')
await closeFront(ctl, log)
ctl.close()
process.exit(failed ? 1 : 0)
