// Shamir backup on the emulated maki, set up from the BIP39 test phrase (setup.ts): shares made
// from maki's menu (2 of 3, maki's PIN asked again), each share's words read off maki's screen as
// it shows them (screenread, every ByteWords word looked for on each page, ordered by where it
// is), maki's check of them passed (a demo build offers the right word first), and then the shares
// put back together here (maki-sskr's combine, a small tool in the scratch space): any two of
// them, and all three, must give the test phrase's entropy. The words never go to maki's log.
//
//     npx --prefix desktop vite-node scripts/emu-usb/shamir.ts LOG OUT COMBINE
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { CENTRE, Control, LEFT, Log, RIGHT, sleep } from './emu'

const [logPath, out, combine] = process.argv.slice(2)
if (!combine) throw new Error('give the emulator log, its folder and the combine tool')
const log = new Log(logPath)
const SCREENREAD = `${__dirname}/screenread/target/release/screenread`
// the test phrase's entropy: sixteen zeros
const ENTROPY = '00'.repeat(16)

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`)
  if (!ok) failed++
}

// ByteWords' 256 words, from maki-sskr's own list
const WORDS = [
  ...readWords()
]
function readWords(): string[] {
  const src = readFileSync(`${__dirname}/../../xous-core/libs/maki-sskr/src/bytewords.rs`, 'utf8')
  const list = src.slice(src.indexOf('WORDS'), src.indexOf('];', src.indexOf('WORDS')))
  const words = [...list.matchAll(/"([a-z]{4})"/g)].map((m) => m[1])
  if (words.length !== 256) throw new Error(`ByteWords: ${words.length} words read`)
  return words
}

/** The share words on a page of maki's, in order: each word's place on the screen, row by row
 * (they're 18 pixels apart; a word with a descender is found a pixel or two lower than its
 * neighbour), left to right, in the fixed-width font the words are drawn in. */
const readPage = async (ctl: Control, name: string): Promise<string[]> => {
  await ctl.send(`shot ${name}`)
  const lines = execFileSync(SCREENREAD, ['text', `${out}/${name}.pgm`, ...WORDS], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  })
  const found: [number, number, string][] = []
  for (const line of lines.trim().split('\n')) {
    const [word, where] = line.split('\t')
    if (!where || where === 'missing') continue
    for (const m of where.matchAll(/Mono x1 at (\d+),(\d+)/g)) found.push([Number(m[2]), Number(m[1]), word])
  }
  const row = (y: number): number => Math.round(y / 18)
  found.sort((a, b) => row(a[0]) - row(b[0]) || a[1] - b[1])
  return found.map((f) => f[2])
}

const enterPin = async (ctl: Control): Promise<void> => {
  for (let i = 0; i < 6; i++) await ctl.press(CENTRE, 700)
  await ctl.press(LEFT, 500)
  await ctl.press(CENTRE, 0)
}

const ctl = await Control.open(7881)
// maki's menu: Lock, Wallets, Shares
await ctl.press('3+4', 1500)
await ctl.press(RIGHT, 800)
await ctl.press(RIGHT, 800)
await ctl.press(CENTRE, 3000) // the Shares page
await ctl.press(CENTRE, 3000) // make shares: 2 of 3
await ctl.press(CENTRE, 1500) // how many it takes: 2
await ctl.press(CENTRE, 3000) // of 3: make them
const at = log.size()
await enterPin(ctl)
const made = await log.waitFor(/the phrase as 2 of 3 shares/, at, 300_000)
check(!!made, 'maki made 2 of 3 shares, once its PIN was entered again')
await sleep(6000)

// three shares, four pages each (29 words: eight a page)
const shares: string[][] = [[], [], []]
for (let share = 0; share < 3; share++) {
  for (let page = 0; page < 4; page++) {
    const words = await readPage(ctl, `share-${share + 1}-${page + 1}`)
    shares[share].push(...words)
    await ctl.press(CENTRE, 3500)
  }
}
for (const [i, s] of shares.entries())
  check(s.length === 29 && s.slice(0, 4).join(' ') === 'tuna next keep gyro', `share ${i + 1} read whole: ${s.length} words`)
// the check: a word of each, the right one first in a demo build
for (let i = 0; i < 3; i++) await ctl.press(CENTRE, 3000)
check(log.since(at).includes('the phrase as 2 of 3 shares'), 'maki says it made them')
// three words of each share's value, together, never in maki's log
check(shares.every((s) => s.length < 12 || !log.since(0).includes(s.slice(9, 12).join(' '))), "the words aren't in maki's log")
await ctl.press(CENTRE, 3000) // Shares made: continue

const together = (which: number[]): string =>
  execFileSync(combine, { input: which.map((i) => shares[i].join(' ')).join('\n'), encoding: 'utf8' }).trim()
for (const which of [[0, 1], [1, 2], [0, 2], [0, 1, 2]])
  check(together(which) === ENTROPY, `shares ${which.map((i) => i + 1).join(' and ')} give the test phrase back`)
// and one alone gives nothing
let one = ''
try {
  one = together([1])
} catch (e) {
  one = String((e as { stdout?: string }).stdout ?? e)
}
check(one.includes('error'), `one share alone gives nothing (${one.slice(0, 60)})`)

ctl.close()
process.exit(failed ? 1 : 0)
