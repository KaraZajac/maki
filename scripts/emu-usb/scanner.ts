// The Scanner app on the emulated maki: QR codes shown to maki's camera (patch 0014) read
// through an app's camera permission, then typed from the app's menu over USB, and the keystrokes
// checked against what each code says. Two codes: a plain one, and a busy one, whose data looks
// like a fourth finder pattern to bao-video's search (which decoded only when it saw exactly
// three, so a code like that never scanned while held still). Run the emulator with --answer and
// give its log:
//
//     npx --prefix desktop vite-node scripts/emu-usb/scanner.ts LOG
//
import { CENTRE, Control, Log, closeFront, openItem, qrPicture, sleep } from './emu'

if (!process.argv[2]) throw new Error('give the emulator log')
const log = new Log(process.argv[2])

// what a keyboard types without a second thought: no shifted keys a layout might move; and a
// busy code, drawn before anything's opened on maki, so a test that can't start leaves it be
const plain = 'hello from the emulated maki 0123'
const picture = qrPicture(plain)
if (!picture) throw new Error('no mask gives the code three finders, as bao-video looks')
let busy: [string, string] | null = null
for (let i = 0; i < 200 && !busy; i++) {
  const text = `a busy code ${i} from the emulated maki`
  const p = qrPicture(text, 4)
  if (p) busy = [text, p]
}
if (!busy) throw new Error('no text gives a code bao-video sees four finders in')

const ctl = await Control.open(7881)
// a store app: wait for its first screen
const opened = await openItem(ctl, log, 'Scanner')
await log.waitFor(/scanner: first frame after/, opened, 180_000)
await sleep(3000)

let failed = 0
async function scanAndType(what: string, text: string, picture: string): Promise<void> {
  console.log(`camera: ${await ctl.send(`camera ${picture}`)}`)
  await ctl.press(CENTRE, 0)
  // the scan keeps maki busy: its time crawls
  await sleep(60_000)
  console.log(`camera back to its test card: ${await ctl.send('camera')}`)
  // its menu's first item types what it read
  const at = log.size()
  await ctl.press('3+4', 1500)
  await ctl.press(CENTRE, 0)
  const got = await log.waitForTyped(at, text.length, 180_000)
  const ok = got === text
  console.log(ok ? `PASS: Scanner read ${what} and typed "${got}"` : `FAIL: ${what}: typed "${got}", want "${text}"`)
  if (!ok) failed++
}

await scanAndType('the code', plain, picture)
await scanAndType('a code bao-video sees four finders in', ...busy)

const trouble = log.since(0).match(/(?:panick|not responding|aborted).*$/im)
if (trouble) console.log(`maki says: ${trouble[0]}`)
await closeFront(ctl, log)
ctl.close()
process.exit(failed ? 1 : 0)
