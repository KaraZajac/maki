// How much maki's vault takes, on the emulated maki: logins and codes imported (IMPORT_PUT, as maki
// desktop sends an export) until the vault holds what maki says is its most, 500 logins and 250
// codes; then one more refused, with why. And the vault still works full: maki's Passwords and
// Authenticator lists opened on its screen (they're loaded whole into vault2's memory), the
// imports shown there (they were written behind vault2's back: it reloads them as it comes to the
// front), and nothing in maki's log panicking. Run the emulator with --answer on a maki set up
// with a phrase, screenread built; give the emulator's log and its folder:
//
//     npx --prefix desktop vite-node scripts/emu-usb/vault-limits.ts LOG OUT
import { execFileSync } from 'node:child_process'
import { relay } from '../../desktop/src/main/roughtime'
import { encodeImport, type ImportRecord } from '../../desktop/src/shared/import'
import { Link } from '../../desktop/src/shared/link'
import { TcpTransport } from '../../desktop/src/shared/test-support'
import { closeFront, Control, Log, openItem, sleep } from './emu'

const [logPath, out] = process.argv.slice(2)
if (!out) throw new Error('give the emulator log and its folder')
const log = new Log(logPath)
const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
const SCREENREAD = `${__dirname}/screenread/target/release/screenread`
const MOST_LOGINS = 500
const MOST_CODES = 250

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`)
  if (!ok) failed++
}
const onScreen = async (ctl: Control, name: string, texts: string[]): Promise<boolean> => {
  await ctl.send(`shot ${name}`)
  const lines = execFileSync(SCREENREAD, ['text', `${out}/${name}.pgm`, ...texts], { encoding: 'utf8' })
  return lines.trim().split('\n').every((l) => l.split('\t')[1] !== 'missing')
}

const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'fake maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)

const before = await link.vaultStatus()
if (!before || before.status !== 'approved') throw new Error(`VAULT_STATUS: ${JSON.stringify(before)}`)
console.log(`the vault holds ${before.logins} logins, ${before.codes} codes, ${before.passkeys} passkeys`)

// fill it: logins named for this run, so a rerun adds its own; codes with secrets of their own
const run = Date.now().toString(36)
const logins = Math.max(0, MOST_LOGINS - before.logins)
const codes = Math.max(0, MOST_CODES - before.codes)
const records: ImportRecord[] = []
for (let i = 0; i < logins; i++)
  records.push({
    kind: 'login',
    site: `l${String(i).padStart(3, '0')}-${run}.example.com`,
    username: `user${i}`,
    password: `pw-${run}-${i}-${'x'.repeat(16)}`,
    title: `Login ${i}`
  })
for (let i = 0; i < codes; i++) {
  const secret = new Uint8Array(20)
  new DataView(secret.buffer).setUint32(0, i)
  secret.set(new TextEncoder().encode(run.slice(0, 8)), 4)
  records.push({ kind: 'code', issuer: `Code ${i}`, account: run, secret, algorithm: 1, digits: 6, period: 30 })
}
const bytes = encodeImport('Limits test', records)
console.log(`importing ${logins} logins and ${codes} codes: ${bytes.length} bytes`)
const t0 = Date.now()
const r = await link.importPut(bytes)
const took = ((Date.now() - t0) / 1000).toFixed(0)
check(
  r.approval === 'approved' && r.logins === logins && r.codes === codes,
  `the import taken whole (${JSON.stringify(r)}, ${took} s)`
)
const after = await link.vaultStatus()
check(
  after?.logins === MOST_LOGINS && after.codes === MOST_CODES,
  `the vault now holds ${after?.logins} logins and ${after?.codes} codes (want ${MOST_LOGINS} and ${MOST_CODES})`
)

// one more: refused, with why, and nothing asked
const more = await link.importPut(
  encodeImport('Limits test', [
    { kind: 'login', site: `one-more-${run}.example.com`, username: 'one', password: 'more', title: '' }
  ])
)
check(more.approval !== 'approved' && !!more.reason, `one more login refused: ${more.approval}, “${more.reason}”`)

// the vault on maki's screen, full: its lists, loaded whole, and the imports in them
const ctl = await Control.open(7881)
for (const [item, shot, count] of [
  ['Passwords', 'limits-passwords', after?.logins ?? 0],
  ['Authenticator', 'limits-codes', after?.codes ?? 0]
] as const) {
  const at = log.size()
  await openItem(ctl, log, item)
  await sleep(20_000)
  // its first entry, “1 of N”: N the whole vault's, imports and all (written behind vault2's back,
  // reloaded as it came to the front)
  const shown = await onScreen(ctl, shot, ['of', String(count)])
  check(shown, `${item} opened full: “1 of ${count}”, the imports among them`)
  check(!/panicked|out of memory|alloc/i.test(log.since(at)), `${item}: nothing panicked`)
  await closeFront(ctl, log)
}
ctl.close()
process.exit(failed ? 1 : 0)
