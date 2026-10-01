// Installs bundles on the emulated maki over its virtual USB, as maki desktop does: each is
// approved on maki, so run the emulator with --answer.
//
//     npx --prefix desktop vite-node scripts/emu-usb/install.ts BUNDLE.maki...
import { readFileSync } from 'node:fs'
import { MakiClient } from '../../desktop/src/shared/client'
import { TcpTransport } from '../../desktop/src/shared/test-support'

const t = await TcpTransport.open(7878)
const c = new MakiClient(t)
let failed = 0
for (const path of process.argv.slice(2).filter((a) => a.endsWith('.maki'))) {
  const t0 = Date.now()
  const r = await c.appInstall(new Uint8Array(readFileSync(path)))
  if (r.approval !== 'approved') failed++
  const name = path.split('/').pop()
  console.log(`${name}: ${r.approval}${r.reason ? ` (${r.reason})` : ''}, ${((Date.now() - t0) / 1000).toFixed(1)} s`)
}
const { apps } = await c.appList()
console.log(`${apps.length} apps on maki`)
await t.close()
process.exit(failed ? 1 : 0)
