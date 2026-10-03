// Importing from another password manager, on the emulated maki over its virtual USB: logins, a
// code and a passkey whose private key this script made, handed over as maki desktop hands an
// export (IMPORT_PUT, in pieces), then each used as maki uses its own: a login given back to a
// browser's request (GET_LOGIN), a passkey's site answered "passkey" for its login, the code given
// to a site (GET_TOTP, checked against RFC 6238, when Roughtime can verify maki's clock), and the
// passkey signing sign-ins through FIDO (vault-import.py, python-fido2), each signature checked
// with the passkey's public key. VAULT_STATUS counts it all, the passkey as imported; the same
// import again adds nothing, and one with a bad record is refused with the reason. Everything is
// named afresh each run, so it runs again on the same storage. Run the emulator with --answer (it
// says yes on maki) on a maki set up with a phrase:
//
//     MAKI_FIDO_PYTHON=fido-venv/bin/python npx --prefix desktop vite-node scripts/emu-usb/vault-import.ts
//
// (MAKI_LINK_PORT, 7878 by default, and MAKI_FIDO_PORT, 7879, say where maki's link and FIDO are.)
import { execFileSync } from 'node:child_process'
import { createHmac, generateKeyPairSync, randomBytes } from 'node:crypto'
import { relay } from '../../desktop/src/main/roughtime'
import { MakiClient, syncTime } from '../../desktop/src/shared/client'
import { Reader, Writer } from '../../desktop/src/shared/protocol'
import { TcpTransport } from '../../desktop/src/shared/test-support'

const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
const PYTHON = process.env.MAKI_FIDO_PYTHON ?? 'python3'
const [LINK_PORT, FIDO_PORT] = [
  process.env.MAKI_LINK_PORT ?? '7878',
  process.env.MAKI_FIDO_PORT ?? '7879'
]
// PROTOCOL.md: the messages, and an import's pieces
const [VAULT_STATUS, IMPORT_PUT, PIECE] = [0x13, 0x22, 4096]
const APPROVALS = [
  'approved',
  'denied',
  'no match',
  'timed out',
  'unavailable',
  'clock not verified',
  'locked',
  'not yours',
  'no phrase',
  'refused',
  'passkey'
]

let failed = 0
function check(what: string, ok: boolean, got?: unknown): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${ok ? '' : `: ${JSON.stringify(got)}`}`)
  if (!ok) failed++
}

// this run's own names: a fresh label each time, so nothing is "had already" from a run before
const run = randomBytes(3).toString('hex')
const LOGIN_SITE = `login-${run}.import.example`
const PASSKEY_SITE = `passkey-${run}.import.example`
const CODE_SITE = `code-${run}.example`
const [USER, PASSWORD] = ['alice', `imported password ${run}`]
// a key of this run's own: maki skips a code whose secret it has already (an earlier run's, or the
// Authenticator test's example key), and GET_TOTP would give that one
const SECRET = Buffer.from(`maki import ${run}`.padEnd(20, '.').slice(0, 20), 'latin1')

// the passkey's key, made here: what maki is given, and what its signatures are checked with
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = privateKey.export({ format: 'jwk' }) as { d: string; x: string; y: string }
const [d, x, y] = [jwk.d, jwk.x, jwk.y].map((v) => Buffer.from(v, 'base64url'))
const CRED_ID = randomBytes(32)
const HANDLE = randomBytes(16)

/** An import in maki's format (PROTOCOL.md, "Importing from other password managers"). */
function importOf(source: string, records: Uint8Array[]): Uint8Array {
  const head = new Writer().str8(source).u32(records.length).finish()
  return Buffer.concat([Buffer.from('MAKIIMP1'), head, ...records])
}
const login = (site: string, user: string, password: string, title = ''): Uint8Array =>
  new Writer().u8(1).str8(site).str8(user).str8(password).str8(title).finish()
const code = (issuer: string, account: string, secret: Uint8Array): Uint8Array =>
  new Writer().u8(2).str8(issuer).str8(account).bytes16(secret).u8(1).u8(6).u16(30).finish()
const passkey = (): Uint8Array =>
  new Writer()
    .u8(3)
    .str8(PASSKEY_SITE)
    .bytes16(CRED_ID)
    .bytes16(HANDLE)
    .str8(USER)
    .str8('Alice')
    .bytes16(d)
    .finish()

type Outcome = {
  approval: string
  logins: number
  codes: number
  passkeys: number
  skipped: number
  reason: string
}

/** IMPORT_PUT, a piece at a time: the reply that's done. */
async function put(c: MakiClient, data: Uint8Array): Promise<Outcome> {
  for (let offset = 0; offset < data.length; offset += PIECE) {
    const piece = data.subarray(offset, offset + PIECE)
    const last = offset + piece.length >= data.length
    const body = new Writer().u32(data.length).u32(offset).bytes16(piece).finish()
    // the last piece waits for maki to read its vault, for the owner, and for what's written
    const r = new Reader((await c.request(IMPORT_PUT, body, last ? 180_000 : 10_000)).body)
    const done = r.u8() === 1
    const out = {
      approval: APPROVALS[r.u8()] ?? 'unknown',
      logins: r.u16(),
      codes: r.u16(),
      passkeys: r.u16(),
      skipped: r.u16(),
      reason: r.str8()
    }
    r.end()
    if (done) return out
  }
  throw new Error('maki never said the import was done')
}

async function vaultStatus(c: MakiClient): Promise<number[]> {
  const r = new Reader((await c.request(VAULT_STATUS, new Uint8Array(), 30_000)).body)
  const out = [r.u8(), r.u32(), r.u32(), r.u32(), r.u32()]
  r.end()
  return out
}

function totp(secret: Uint8Array, unixS: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(unixS / 30)))
  const h = createHmac('sha1', secret).update(counter).digest()
  return String((h.readUInt32BE(h[h.length - 1] & 0x0f) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

const t = await TcpTransport.open(Number(LINK_PORT))
const c = new MakiClient(t, SLOW)
console.log(`maki: ${(await c.hello()).name}`)

const before = await vaultStatus(c)
check('VAULT_STATUS answers (approved)', before[0] === 0, before)
console.log(
  `maki holds ${before[1]} logins, ${before[2]} codes, ${before[3]} passkeys (${before[4]} imported)`
)

// a login, the passkey and a login for its site, the code; and the first login again (skipped)
const records = [
  login(LOGIN_SITE, USER, PASSWORD, 'Imported (test)'),
  passkey(),
  login(PASSKEY_SITE, USER, 'a password for a passkey site'),
  code(`code-${run}`, USER, SECRET),
  login(LOGIN_SITE, USER, 'a newer password, which maki mustn’t take')
]
// and ten long ones, so it takes more than one piece (and few, so runs on the same storage don't
// soon fill maki's room for 500 logins)
for (let i = 0; i < 10; i++)
  records.push(
    login(
      `long-${run}-${i}.import.example`,
      `user${i}`,
      `${i}`.repeat(200),
      'a long title '.repeat(15)
    )
  )
const data = importOf('maki test', records)
let t0 = Date.now()
const added = await put(c, data)
console.log(
  `import of ${data.length} bytes: ${JSON.stringify(added)}, ${((Date.now() - t0) / 1000).toFixed(1)} s`
)
check(
  'the import is approved: 12 logins, 1 code, 1 passkey, the login sent twice skipped',
  added.approval === 'approved' &&
    added.logins === 12 &&
    added.codes === 1 &&
    added.passkeys === 1 &&
    added.skipped === 1 &&
    added.reason === '',
  added
)

const after = await vaultStatus(c)
check(
  'VAULT_STATUS counts them, the passkey as imported',
  after[0] === 0 &&
    after[1] === before[1] + 12 &&
    after[2] === before[2] + 1 &&
    after[3] === before[3] + 1 &&
    after[4] === before[4] + 1,
  { before, after }
)

t0 = Date.now()
const again = await put(c, data)
check(
  'the same import again: nothing new, nothing asked, every record skipped',
  again.approval === 'approved' &&
    again.logins + again.codes + again.passkeys === 0 &&
    again.skipped === records.length,
  again
)
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`)
const bad = await put(
  c,
  importOf('maki test', [
    login(`ok-${run}.example`, USER, 'fine'),
    login(`bad-${run}.example`, USER, 'two\nlines')
  ])
)
check(
  'a password with a control character: the whole import refused, with the reason',
  bad.approval === 'refused' && bad.reason === 'record 2: a password with a control character',
  bad
)
const still = await vaultStatus(c)
check('and nothing of it kept', still.join() === after.join(), { after, still })

const got = await c.getLogin(LOGIN_SITE)
check(
  'GET_LOGIN finds the imported login, and its first password',
  got.approval === 'approved' && got.username === USER && got.password === PASSWORD,
  got
)
const pk = await c.getLogin(PASSKEY_SITE)
check(
  'the imported passkey comes first for its site, as one made on maki does',
  pk.approval === 'passkey',
  pk
)

const sync = await syncTime(c, relay).catch(() => null)
if (sync?.verified) {
  const from = Math.floor(Date.now() / 1000)
  const r = await c.getTotp(CODE_SITE)
  const to = Math.floor(Date.now() / 1000)
  const expected = new Set<string>()
  for (let s = from - 30; s <= to + 30; s += 15) expected.add(totp(SECRET, s))
  check(
    `GET_TOTP gives the imported code, RFC 6238's (${r.code})`,
    r.approval === 'approved' && expected.has(r.code),
    r
  )
} else console.log("SKIP: GET_TOTP: Roughtime could not verify maki's clock (no network?)")

// the passkey, through FIDO: by its site, by its ID among others, without a press; signatures
// checked with its public key, and the public key maki's credential management reports
const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex')
try {
  console.log(
    execFileSync(
      PYTHON,
      [
        `${__dirname}/vault-import.py`,
        FIDO_PORT,
        PASSKEY_SITE,
        hex(CRED_ID),
        hex(HANDLE),
        hex(x),
        hex(y)
      ],
      {
        encoding: 'utf8'
      }
    ).trim()
  )
} catch (e) {
  console.log(((e as { stdout?: string }).stdout ?? '').trim())
  console.log('FAIL: the passkey through FIDO (vault-import.py)')
  failed++
}

await t.close()
console.log(failed ? `${failed} failed` : 'all passed')
process.exit(failed ? 1 : 0)
