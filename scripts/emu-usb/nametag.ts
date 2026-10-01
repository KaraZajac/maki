// Name Tag on the emulated maki: a tag read from a QR code shown to maki's camera (patch 0014),
// the name drawn as big as it fits in maki's own font (host API 9's text_scaled), and the centre
// turning to the link as a QR code, read back off maki's screen (screenread). Run the emulator
// with --answer, build screenread before starting it, and give the emulator's log and folder:
//
//     npx --prefix desktop vite-node scripts/emu-usb/nametag.ts LOG OUT
import { execFileSync } from 'node:child_process'
import { CENTRE, Control, Log, closeFront, openItem, qrPicture, sleep } from './emu'

const [logPath, out] = process.argv.slice(2)
if (!out) throw new Error('give the emulator log and its folder')
const log = new Log(logPath)
const SCREENREAD = `${__dirname}/screenread/target/release/screenread`
/** Where each text is on the frame: its font and scale, or nothing. */
const find = (frame: string, texts: string[]): Map<string, string[]> => {
  const lines = execFileSync(SCREENREAD, ['text', `${out}/${frame}.pgm`, ...texts], { encoding: 'utf8' })
  return new Map(
    lines
      .trim()
      .split('\n')
      .map((l) => [l.split('\t')[0], l.split('\t')[1] === 'missing' ? [] : l.split('\t')[1].split('; ')])
  )
}
const qrOn = (frame: string): string | null => {
  try {
    return execFileSync(SCREENREAD, ['qr', `${out}/${frame}.pgm`], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

const [NAME, UNDER, LINK] = ['Ada Lovelace', 'maki tester', 'https://maki.netslum.io']
// drawn before anything's opened on maki, so a test that can't start leaves it as it was
const picture = qrPicture(`${NAME}\n${UNDER}\n${LINK}`)
if (!picture) throw new Error('no mask gives the tag three finders, as bao-video looks')

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`)
  if (!ok) failed++
}

const ctl = await Control.open(7881)
const opened = await openItem(ctl, log, 'Name Tag')
await log.waitFor(/nametag: first frame after/, opened, 180_000)
await sleep(3000)
console.log(`camera: ${await ctl.send(`camera ${picture}`)}`)
const at = log.size()
await ctl.press('3+4', 1500)
await ctl.press(CENTRE, 0) // Scan your tag
const scanned = await log.waitFor(/nametag: scanned (a QR code|nothing)/, at, 300_000)
console.log(`camera back to its test card: ${await ctl.send('camera')}`)
check(scanned?.[1] === 'a QR code', 'maki read the tag off its camera')
await sleep(8000)

await ctl.send('shot nametag-name')
const name = find('nametag-name', ['Ada', 'Lovelace', UNDER])
const big = (where: string[] | undefined): boolean => !!where?.some((w) => !/ x1 /.test(w))
check(big(name.get('Ada')) && big(name.get('Lovelace')), `the name, bigger than maki's fonts: ${name.get('Lovelace')}`)
check(!!name.get(UNDER)?.length, `the line under it: ${name.get(UNDER)}`)

await ctl.press(CENTRE, 8000)
await ctl.send('shot nametag-link')
check(qrOn('nametag-link') === LINK, `the centre shows the link as a QR code that reads "${qrOn('nametag-link')}"`)
check(!!find('nametag-link', [LINK]).get(LINK)?.length, 'and the link under it')

await ctl.press(CENTRE, 8000)
await ctl.send('shot nametag-back')
check(big(find('nametag-back', ['Lovelace']).get('Lovelace')), 'and back to the name')
await closeFront(ctl, log)
ctl.close()
process.exit(failed ? 1 : 0)
