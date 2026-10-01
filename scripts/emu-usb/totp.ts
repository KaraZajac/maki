// TOTP on the emulated maki, end to end: a code's QR code shown to maki's camera and scanned in
// Authenticator; a code asked for as the browser extension asks, through maki desktop's own link,
// with maki's clock verified through Roughtime; and a code typed from Authenticator, over USB.
// Each is checked against RFC 6238 worked out here. Run the emulator with --answer (it says yes
// to "Code from?") and give its log:
//
//     npx --prefix desktop vite-node scripts/emu-usb/totp.ts LOG
//
import { relay } from '../../desktop/src/main/roughtime'
import { Link } from '../../desktop/src/shared/link'
import { TcpTransport, expectedTotp } from '../../desktop/src/shared/test-support'
import { CENTRE, Control, Log, closeFront, openItem, qrPicture, sleep } from './emu'

const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
if (!process.argv[2]) throw new Error('give the emulator log')
const log = new Log(process.argv[2])
// RFC 6238's own example key ("Hello!\xde\xad\xbe\xef"), for a made-up account
const SECRET = 'JBSWY3DPEHPK3PXP'
// short, for big modules
const URI = `otpauth://totp/maki-test:alice?secret=${SECRET}`

let failed = 0
// a code is right if it's RFC 6238's for a time between `from` and `to`, give or take a step
function check(what: string, code: string, from: number, to: number): void {
  const expected = new Set<string>()
  for (let t = from - 30; t <= to + 30; t += 15) expected.add(expectedTotp(SECRET, t))
  const now = expectedTotp(SECRET, to)
  if (expected.has(code))
    console.log(`PASS: ${what}: ${code}, RFC 6238's${code === now ? ' for this very step' : ', a step off'}`)
  else {
    console.log(`FAIL: ${what}: ${code}, but RFC 6238 says ${[...expected].join(' or ')}`)
    failed++
  }
}

const ctl = await Control.open(7881)

// 1. maki's clock, verified as maki desktop has it verified
const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'fake maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)
const sync = await link.syncNow()
console.log(`clock verified: ${sync?.verified}`)

// 2. Authenticator, in front
await openItem(ctl, log, 'Authenticator')
await sleep(3000)

// 3. the code's QR code before the camera, and Authenticator's menu: Add from QR code (its
// first item; a press on an empty list scans too, but on a code it types the code)
const unreadable = log.since(0).match(/Couldn't deserialize TOTP.*$/m)
console.log(`codes maki couldn't read: ${unreadable ? unreadable[0] : 'none'}`)
console.log(`camera: ${await ctl.send(`camera ${qrPicture(URI)}`)}`)
let at = log.size()
await ctl.press('3+4', 1500)
await ctl.press(CENTRE, 0)
// scanning keeps maki busy, so its time crawls: give it a few minutes
const scanned = await log.waitFor(/QR code metadata: (.*)/, at, 300_000)
await sleep(5000)
await ctl.send('shot totp-list')
console.log(`scanned: ${scanned ? scanned[1] : 'nothing'}`)
console.log(`camera back to its test card: ${await ctl.send('camera')}`)
const trouble = log.since(at).match(/(?:error|panick|internal).*$/im)
if (trouble) console.log(`maki says: ${trouble[0]}`)
if (!scanned) throw new Error("maki's camera didn't read the code")

// 4. a code for a site, as the browser extension asks: maki asks "Code from?" and --answer
// says yes
let from = Math.floor(Date.now() / 1000)
const r = (await link.fromBrowser({ id: 0, type: 'getTotp', site: 'example.com' })) as { code?: string }
check('the code the extension gets', r.code ?? '', from, Math.floor(Date.now() / 1000))

// 5. Authenticator's own "type code": the keystrokes maki types over USB
at = log.size()
from = Math.floor(Date.now() / 1000)
await ctl.press(CENTRE, 0)
const typed = await log.waitForTyped(at, 6, 120_000)
check('the code Authenticator types', typed, from, Math.floor(Date.now() / 1000))

await closeFront(ctl, log)
await link.drop('done')
ctl.close()
process.exit(failed ? 1 : 0)
