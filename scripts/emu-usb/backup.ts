// A backup of the emulated maki, and the same restored onto it, over its virtual USB: maki seals
// what it holds, then opens and reads it back, adding nothing it has already. Run the emulator
// with --answer: maki asks before it restores.
//
//     npx --prefix desktop vite-node scripts/emu-usb/backup.ts
import { MakiClient } from '../../desktop/src/shared/client'
import { TcpTransport } from '../../desktop/src/shared/test-support'

// the emulated maki runs a tenth as fast as a badge when it's busy: wait that much longer
const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)

const t = await TcpTransport.open(7878)
const c = new MakiClient(t, SLOW)
let t0 = Date.now()
const b = await c.backup()
console.log(`backup: ${b.status}, ${b.data.length} bytes, ${((Date.now() - t0) / 1000).toFixed(1)} s`)
let failed = b.status !== 'approved' || b.data.length === 0
if (!failed) {
  t0 = Date.now()
  const r = await c.restore(b.data)
  console.log(
    `restore: ${r.approval}, ${r.logins} logins, ${r.codes} codes, ${r.passkeys} passkeys new, ` +
      `${((Date.now() - t0) / 1000).toFixed(1)} s`
  )
  // all of it is maki's already: nothing comes back new
  failed = r.approval !== 'approved' || r.logins + r.codes + r.passkeys !== 0
}
await t.close()
process.exit(failed ? 1 : 0)
