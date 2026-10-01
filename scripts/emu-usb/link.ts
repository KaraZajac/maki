// The emulated maki over its pipe: maki desktop's own client, as against a real maki.
import { MakiClient } from '../../desktop/src/shared/client'
import { TcpTransport } from '../../desktop/src/shared/test-support'

// the emulated maki runs a tenth as fast as a badge when it's busy: wait that much longer
const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)

// maki answers once it has started: ask until it does
let t = await TcpTransport.open(7878)
let c = new MakiClient(t, SLOW)
const t0 = Date.now()
for (;;) {
  try {
    console.log('hello:', await c.hello(5000), `after ${Date.now() - t0} ms`)
    break
  } catch (e) {
    if (Date.now() - t0 > 600_000) throw e
    await t.close()
    t = await TcpTransport.open(7878)
    c = new MakiClient(t, SLOW)
  }
}
const t1 = Date.now()
await c.status()
console.log('a round trip:', `${Date.now() - t1} ms`)
console.log('status:', await c.status())
console.log('time unverified:', await c.timeUnverified(Date.now(), -14400))
const apps = await c.appList()
console.log('apps:', apps.status, apps.apps.map((a) => `${a.name} ${a.label}`))
console.log('space:', JSON.stringify(await c.appSpace()))
// a login: nothing saved for this site, so no question on maki
console.log('login:', await c.getLogin('example.com'))
await t.close()
