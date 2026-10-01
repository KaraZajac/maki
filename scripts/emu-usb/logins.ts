// Logins on the emulated maki, as the browser extension asks for them through maki desktop's
// link: one offered to keep, then asked for back; then, once maki has a passkey for the site too
// (fido.py --keep, as a site would make one), a passkey is the way in and the password isn't
// offered, unless the owner asks for it. Run the emulator with --answer (it says yes on maki).
//
//     MAKI_FIDO_PYTHON=venv/bin/python npx --prefix desktop vite-node scripts/emu-usb/logins.ts
//
// (a Python with python-fido2, for fido.py)
import { execFileSync } from 'node:child_process'
import { relay } from '../../desktop/src/main/roughtime'
import { Link } from '../../desktop/src/shared/link'
import { TcpTransport } from '../../desktop/src/shared/test-support'

const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
const PYTHON = process.env.MAKI_FIDO_PYTHON ?? 'python3'
// fido.py's made-up site
const SITE = 'maki-test.example'
const [USER, PASSWORD] = ['alice', 'correct horse battery staple']

const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'fake maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)

let failed = 0
function check(what: string, ok: boolean, got: unknown): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${ok ? '' : `: ${JSON.stringify(got)}`}`)
  if (!ok) failed++
}

type Login = { approval?: string; username?: string; password?: string }
const ask = (evenWithPasskey = false): Promise<Login> =>
  link.fromBrowser({ id: 0, type: 'getLogin', site: SITE, evenWithPasskey }) as Promise<Login>

const saved = (await link.fromBrowser({
  id: 0,
  type: 'saveLogin',
  site: SITE,
  username: USER,
  password: PASSWORD
})) as Login
check('maki keeps a login offered to it', saved.approval === 'approved', saved)

let got = await ask()
check(
  'and gives it back',
  got.approval === 'approved' && got.username === USER && got.password === PASSWORD,
  got
)

// a passkey for the same site, made as a site makes one: through FIDO2
console.log(
  execFileSync(PYTHON, [`${__dirname}/fido.py`, '7879', '--keep'], { encoding: 'utf8' }).trim()
)

got = await ask()
check(
  'with a passkey for the site, the password is not offered',
  got.approval === 'passkey' && !got.password,
  got
)
got = await ask(true)
check(
  'unless the owner asks for it',
  got.approval === 'approved' && got.password === PASSWORD,
  got
)

await link.drop('done')
process.exit(failed ? 1 : 0)
