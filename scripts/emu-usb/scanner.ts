// The Scanner app on the emulated maki: a QR code shown to maki's camera (patch 0014) read
// through an app's camera permission, then typed from the app's menu over USB, and the keystrokes
// checked against what the code says. Run the emulator with --answer and give its log:
//
//     npx --prefix desktop vite-node scripts/emu-usb/scanner.ts LOG
//
import { CENTRE, Control, Log, closeFront, openItem, qrPicture, sleep } from './emu'

if (!process.argv[2]) throw new Error('give the emulator log')
const log = new Log(process.argv[2])
// what a keyboard types without a second thought: no shifted keys a layout might move
const TEXT = 'hello from the emulated maki 0123'

const ctl = await Control.open(7881)
// a store app: wait for its first screen
let at = await openItem(ctl, log, 'Scanner')
await log.waitFor(/scanner: first frame after/, at, 180_000)
await sleep(3000)

console.log(`camera: ${await ctl.send(`camera ${qrPicture(TEXT)}`)}`)
at = log.size()
await ctl.press(CENTRE, 0)
// the scan keeps maki busy: its time crawls
await sleep(60_000)
await ctl.send('shot scanner-read')
console.log(`camera back to its test card: ${await ctl.send('camera')}`)

// its menu's first item types what it read
at = log.size()
await ctl.press('3+4', 1500)
await ctl.press(CENTRE, 0)
const got = await log.waitForTyped(at, TEXT.length, 180_000)
const ok = got === TEXT
console.log(ok ? `PASS: Scanner read the code and typed "${got}"` : `FAIL: typed "${got}", want "${TEXT}"`)
const trouble = log.since(0).match(/(?:panick|not responding|aborted).*$/im)
if (trouble) console.log(`maki says: ${trouble[0]}`)
await closeFront(ctl, log)
ctl.close()
process.exit(ok ? 0 : 1)
