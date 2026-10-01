// Installs apps from the maki store onto the emulated maki, as maki desktop's Apps page does:
// linked with maki desktop's own Link, maki's clock verified through Roughtime (from this
// computer, as maki desktop relays it), the store's newest root and revocation list handed to
// maki, then each app's stamped bundle, which maki checks against the store's root. Run the
// emulator with --answer.
//
//     npx --prefix desktop vite-node scripts/emu-usb/store-install.ts [STORE] [NAME...]
//
// STORE is a store's folder or address (default: the maki-apps checkout's store/); without
// NAMEs, every app the store has that maki hasn't.
import { relay } from '../../desktop/src/main/roughtime'
import { storeSource } from '../../desktop/src/main/store-source'
import { Link } from '../../desktop/src/shared/link'
import { Store } from '../../desktop/src/shared/store'
import { TcpTransport } from '../../desktop/src/shared/test-support'

// the emulated maki runs a tenth as fast as a badge when it's busy: wait that much longer
const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)

const args = process.argv.slice(2)
const where = args[0] && !args[0].match(/^[A-Z]/) ? args.shift()! : `${__dirname}/../../apps/store`
const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
link.store = new Store(storeSource(where))
await link.storeCheck()
if (link.store.problem) throw new Error(`the store: ${link.store.problem}`)
if (!(await link.attach(await TcpTransport.open(7878), 'emulated maki')))
  throw new Error('maki did not link')
const report = await link.syncNow()
console.log(`clock: ${report ? JSON.stringify(report).slice(0, 120) : 'not synced'}`)
await link.storeNow()
for (const line of link.log.slice(0, 6).reverse()) console.log(`  ${line}`)
const { apps: installed } = await link.appList()
const have = new Set(installed.map((a) => a.id))
const wanted = link.store.index!.apps.filter((a) => (args.length ? args.includes(a.name) : !have.has(a.id)))
let failed = 0
for (const app of wanted) {
  const t0 = Date.now()
  const r = await link.storeInstall(app)
  if (r.approval !== 'approved') failed++
  console.log(`${app.name} ${app.version}: ${r.approval}${r.reason ? ` (${r.reason})` : ''}, ${((Date.now() - t0) / 1000).toFixed(0)} s`)
}
const { apps } = await link.appList()
console.log(`${apps.length} apps on maki, ${apps.filter((a) => a.fromStore).length} from the store`)
await link.drop('done')
process.exit(failed ? 1 : 0)
