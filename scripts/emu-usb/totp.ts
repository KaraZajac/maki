// TOTP on the emulated maki, end to end: a code's QR code shown to maki's camera and scanned in
// Authenticator, then a code asked for as the browser extension asks, through maki desktop's
// own link, with maki's clock verified through Roughtime, and checked against RFC 6238 worked
// out here. Run the emulator with --answer (it says yes to "Code from?") and give its log:
//
//     npx --prefix desktop vite-node scripts/emu-usb/totp.ts LOG
//
import { createConnection, Socket } from 'node:net'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import encodeQR from '../../desktop/node_modules/@paulmillr/qr/index.js'
import { relay } from '../../desktop/src/main/roughtime'
import { Link } from '../../desktop/src/shared/link'
import { TcpTransport, expectedTotp } from '../../desktop/src/shared/test-support'

const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
const LOG = process.argv[2]
if (!LOG) throw new Error('give the emulator log')
// RFC 6238's own example key ("Hello!\xde\xad\xbe\xef"), for a made-up account
const SECRET = 'JBSWY3DPEHPK3PXP'
// short, for big modules
const URI = `otpauth://totp/maki-test:alice?secret=${SECRET}`
const [LEFT, RIGHT, CENTRE] = [3, 4, 5]

// the emulator's control port: a line each way
class Control {
  private replies: string[] = []
  private waiting: ((line: string) => void)[] = []
  private buffered = ''
  constructor(private s: Socket) {
    s.setEncoding('utf8')
    s.on('data', (d: string) => {
      this.buffered += d
      let i: number
      while ((i = this.buffered.indexOf('\n')) >= 0) {
        const line = this.buffered.slice(0, i)
        this.buffered = this.buffered.slice(i + 1)
        const w = this.waiting.shift()
        if (w) w(line)
        else this.replies.push(line)
      }
    })
  }
  static open(port: number): Promise<Control> {
    return new Promise((ok, fail) => {
      const s = createConnection(port, '127.0.0.1', () => ok(new Control(s)))
      s.once('error', fail)
    })
  }
  send(line: string): Promise<string> {
    this.s.write(line + '\n')
    const ready = this.replies.shift()
    if (ready !== undefined) return Promise.resolve(ready)
    return new Promise((ok) => this.waiting.push(ok))
  }
  close(): void {
    this.s.end()
  }
}

const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms))
const logSize = (): number => statSync(LOG).size
const logSince = (at: number): string => readFileSync(LOG).subarray(at).toString('utf8')
async function waitFor(pattern: RegExp, at: number, ms: number): Promise<RegExpMatchArray | null> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const m = logSince(at).match(pattern)
    if (m) return m
    await sleep(200)
  }
  return null
}

// bao-video decodes a frame only when its own finder search (qr.rs, `find_finders`) sees
// exactly three finder patterns: the same search, to count them. A runs 1:1:3:1:1 (loosely), in
// a row and in a column through the same point.
function finderCount(img: Uint8Array, w: number, h: number): number {
  const thresh = img.reduce((a, b) => a + b, 0) / img.length
  const search = (seq: [number, number, boolean][]): number | null => {
    if (seq.length < 5) return null
    const [a, b, c, d, e] = seq.slice(-5)
    if (!a[2]) return null
    const r = [b, c, d, e].map((s) => Math.floor((s[0] << 4) / a[0]))
    const one = (x: number): boolean => x >= 8 && x <= 32
    return one(r[0]) && r[1] >= 32 && r[1] <= 64 && one(r[2]) && one(r[3])
      ? c[1] - Math.floor(c[0] / 2) - 1
      : null
  }
  const scan = (len: number, at: (i: number) => number, found: (pos: number) => void): void => {
    const seq: [number, number, boolean][] = []
    let [last, run] = [at(0) <= thresh, 1]
    for (let i = 1; i < len; i++) {
      const dark = at(i) <= thresh
      if (dark === last) run++
      else {
        seq.push([run, i, last])
        ;[last, run] = [dark, 1]
        const pos = search(seq)
        if (pos !== null) found(pos)
      }
    }
  }
  const rows = new Set<string>()
  for (let y = 0; y < h; y++) scan(w, (x) => img[y * w + x], (x) => rows.add(`${x},${y}`))
  let count = 0
  for (let x = 0; x < w; x++)
    scan(h, (y) => img[y * w + x], (y) => (count += rows.has(`${x},${y}`) ? 1 : 0))
  return count
}

// the QR code as maki's camera should see it: at the size it captures, so nothing's resampled,
// with square modules a whole number of pixels wide, dark on white, in the middle. maki's
// camera sees it still, as a real one never would: of the eight masks, the first whose data
// doesn't look like a fourth finder to bao-video
function qrPicture(text: string): string {
  const [w, h] = [256, 240]
  let pixels = Buffer.alloc(0)
  for (let mask = 0; mask < 8; mask++) {
    const modules = encodeQR(text, 'raw', { mask }) // with a quiet zone of its own
    const scale = Math.floor(Math.min(w, h) / modules.length)
    const [ox, oy] = [(w - modules.length * scale) >> 1, (h - modules.length * scale) >> 1]
    pixels = Buffer.alloc(w * h, 0xff)
    modules.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (!dark) return
        for (let dy = 0; dy < scale; dy++) {
          const line = (oy + y * scale + dy) * w + ox
          pixels.fill(0, line + x * scale, line + (x + 1) * scale)
        }
      })
    )
    const finders = finderCount(pixels, w, h)
    if (finders === 3) {
      console.log(`QR code with mask ${mask}`)
      break
    }
    console.log(`QR code with mask ${mask}: ${finders} finders as bao-video looks`)
  }
  const path = join(tmpdir(), `maki-totp-${process.pid}.pgm`)
  writeFileSync(path, Buffer.concat([Buffer.from(`P5\n${w} ${h}\n255\n`), pixels]))
  return path
}

const ctl = await Control.open(7881)
const press = async (button: number | string, after = 800): Promise<void> => {
  await ctl.send(`press ${button}`)
  await sleep(after)
}

// 1. maki's clock, verified as maki desktop has it verified
const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'emulated maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)
const sync = await link.syncNow()
console.log(`clock verified: ${sync?.verified}`)

// 2. Authenticator, in front: the home screen is in name order, so step towards it
let name = ''
for (let tries = 0; tries < 12; tries++) {
  const at = logSize()
  await press(CENTRE, 0)
  const opened = await waitFor(/bringing '([^']+)' to the front/, at, 30_000)
  if (!opened) throw new Error('nothing opened: is maki on its home screen?')
  name = opened[1]
  if (name === 'Authenticator') break
  // not it: wait for it to start (an app can take a minute in the emulator), then close it
  await waitFor(/first frame after|returned to the home screen/, at, 180_000)
  await press('3+4', 1200)
  await press(LEFT, 500)
  await press(CENTRE, 800)
  await waitFor(/exited from its menu|returned to the home screen/, at, 15_000)
  await sleep(2000)
  await press(name.toLowerCase() > 'authenticator' ? LEFT : RIGHT)
}
if (name !== 'Authenticator') throw new Error(`couldn't find Authenticator (last: ${name})`)
await sleep(3000)

// 3. the code's QR code before the camera, and Authenticator's menu: Add from QR code (its
// first item; a press on an empty list scans too, but on a code it types the code)
const unreadable = logSince(0).match(/Couldn't deserialize TOTP.*$/m)
console.log(`codes maki couldn't read: ${unreadable ? unreadable[0] : 'none'}`)
console.log(`camera: ${await ctl.send(`camera ${qrPicture(URI)}`)}`)
let at = logSize()
await press('3+4', 1500)
await press(CENTRE, 0)
// scanning keeps maki busy, so its time crawls: give it a few minutes
const scanned = await waitFor(/QR code metadata: (.*)/, at, 300_000)
await sleep(5000)
await ctl.send('shot totp-list')
console.log(`scanned: ${scanned ? scanned[1] : 'nothing'}`)
console.log(`camera back to its test card: ${await ctl.send('camera')}`)
const trouble = logSince(at).match(/(?:error|panick|internal).*$/im)
if (trouble) console.log(`maki says: ${trouble[0]}`)
if (!scanned) throw new Error("maki's camera didn't read the code")

// 4. a code for a site, as the browser extension asks: maki asks "Code from?" and --answer
// says yes; the code should be RFC 6238's for the time maki answered, give or take a step
at = logSize()
const asked = Math.floor(Date.now() / 1000)
const r = await link.fromBrowser({ type: 'getTotp', site: 'example.com' })
const answered = Math.floor(Date.now() / 1000)
console.log(`code: ${JSON.stringify(r)}`)
const expected = new Set<string>()
for (let t = asked - 30; t <= answered + 30; t += 15) expected.add(expectedTotp(SECRET, t))
const code = (r as { code?: string }).code ?? ''
const now = expectedTotp(SECRET, answered)
console.log(
  expected.has(code)
    ? `PASS: ${code} is RFC 6238's for maki's time${code === now ? ' (this very step)' : ' (a step off)'}`
    : `FAIL: ${code}, but RFC 6238 says ${[...expected].join(' or ')}`
)
await link.drop('done')
ctl.close()
process.exit(expected.has(code) ? 0 : 1)
