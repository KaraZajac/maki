// Google Authenticator's export on the emulated maki: a "Transfer accounts" QR code
// (`otpauth-migration://`) with three codes, shown to maki's camera and scanned in Authenticator;
// then each time-based one asked for as the browser extension asks, through maki desktop's link
// with maki's clock verified, against RFC 6238 worked out here: SHA1 with 6 digits, SHA256 with 8.
// The third is counter-based (HOTP), which the link doesn't give. Run the emulator with --answer
// and give its log:
//
//     npx --prefix desktop vite-node scripts/emu-usb/import.ts LOG
import { createHmac } from 'node:crypto'
import { relay } from '../../desktop/src/main/roughtime'
import { Link } from '../../desktop/src/shared/link'
import { TcpTransport } from '../../desktop/src/shared/test-support'
import { CENTRE, Control, Log, closeFront, openItem, qrPicture, sleep } from './emu'

const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
if (!process.argv[2]) throw new Error('give the emulator log')
const log = new Log(process.argv[2])

// protobuf, as Google Authenticator writes its export (google_auth.proto)
function varint(v: number): number[] {
  const out: number[] = []
  for (; v > 0x7f; v = Math.floor(v / 128)) out.push((v & 0x7f) | 0x80)
  return [...out, v]
}
const bytes = (n: number, b: number[]): number[] => [...varint((n << 3) | 2), ...varint(b.length), ...b]
const int = (n: number, v: number): number[] => [...varint(n << 3), ...varint(v)]
const utf8 = (s: string): number[] => [...Buffer.from(s)]

// short, so the export's QR code has modules big enough for maki's camera (a real export of many
// codes is denser: Google Authenticator can export a few codes a QR code)
const CODES = [
  { secret: Buffer.from('Hello!\xde\xad\xbe\xef', 'latin1'), name: 'al', issuer: 'GitHub', algorithm: 1, digits: 1, hotp: false },
  { secret: Buffer.from('maki-bank!'), name: 'al', issuer: 'Bank', algorithm: 2, digits: 2, hotp: false },
  { secret: Buffer.from('maki-vpn-1'), name: 'vpn', issuer: '', algorithm: 1, digits: 1, hotp: true }
]
const payload = [
  ...CODES.flatMap((c) =>
    bytes(1, [
      ...bytes(1, [...c.secret]),
      ...bytes(2, utf8(c.name)),
      ...(c.issuer ? bytes(3, utf8(c.issuer)) : []),
      ...int(4, c.algorithm),
      ...int(5, c.digits),
      ...int(6, c.hotp ? 1 : 2)
    ])
  ),
  ...int(2, 1),
  ...int(3, 1),
  ...int(4, 0)
]
const URI = `otpauth-migration://offline?data=${encodeURIComponent(Buffer.from(payload).toString('base64'))}`

// RFC 6238
function totp(secret: Buffer, unixS: number, hash: 'sha1' | 'sha256', digits: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(unixS / 30)))
  const h = createHmac(hash, secret).update(counter).digest()
  const o = h[h.length - 1] & 0x0f
  return String((h.readUInt32BE(o) & 0x7fffffff) % 10 ** digits).padStart(digits, '0')
}

// drawn before anything's opened on maki, so a test that can't start leaves it as it was. As
// dense codes are, it's busy: its data looks like a fourth finder pattern or more to bao-video,
// which once decoded only frames with exactly three
let picture: string | null = null
for (let finders = 4; finders <= 8 && !picture; finders++) picture = qrPicture(URI, finders, 'low')
if (!picture) throw new Error('no mask gives the export 4 to 8 finders, as bao-video looks')

let failed = 0
function check(what: string, code: string, ok: (t: number) => string, from: number, to: number): void {
  const expected = new Set<string>()
  for (let t = from - 30; t <= to + 30; t += 15) expected.add(ok(t))
  const pass = expected.has(code)
  console.log(pass ? `PASS: ${what}: ${code}` : `FAIL: ${what}: ${code}, but RFC 6238 says ${[...expected].join(' or ')}`)
  if (!pass) failed++
}

const ctl = await Control.open(7881)
const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'fake maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)
console.log(`clock verified: ${(await link.syncNow())?.verified}`)

await openItem(ctl, log, 'Authenticator')
await sleep(3000)
console.log(`camera: ${await ctl.send(`camera ${picture}`)}`)
let at = log.size()
await ctl.press('3+4', 1500)
await ctl.press(CENTRE, 0) // Add from QR code
const imported = await log.waitFor(
  /imported (\d+) codes from a Google Authenticator export \((\d+) it can't use\), QR code (\d+) of (\d+)/,
  at,
  300_000
)
console.log(`camera back to its test card: ${await ctl.send('camera')}`)
if (!imported) throw new Error("maki didn't import the export")
const counts = imported.slice(1).join(' ')
console.log(counts === '3 0 1 1' ? 'PASS: three codes imported, none skipped, QR code 1 of 1' : `FAIL: imported ${counts}`)
if (counts !== '3 0 1 1') failed++
await sleep(5000)
await ctl.send('shot import-note')
await ctl.press(CENTRE, 3000) // the note
await ctl.send('shot import-list')

for (const [site, code, hash, digits] of [
  ['github.example', CODES[0], 'sha1', 6],
  ['bank.example', CODES[1], 'sha256', 8]
] as const) {
  const from = Math.floor(Date.now() / 1000)
  const r = (await link.fromBrowser({ id: 0, type: 'getTotp', site })) as { code?: string }
  check(`${code.issuer}'s code, for ${site}`, r.code ?? '', (t) => totp(code.secret, t, hash, digits), from, Math.floor(Date.now() / 1000))
}

await closeFront(ctl, log)
await link.drop('done')
ctl.close()
process.exit(failed ? 1 : 0)
