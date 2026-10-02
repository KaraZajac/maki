// The 2026-10-02 batch's apps on the emulated maki, through the real firmware: each installed
// (room made: maki keeps 32 apps, in the room it has), opened from the home screen, and seen to
// draw. Password Maker further: an entry added over the link (maki asks: the emulator's --answer says
// yes), then typed by maki itself, the password held to BIP-85's, worked out here from the test
// phrase. An app installed under another name (an older build) is removed and installed again.
// MAKI_ONLY=passwords,sudoku (fixtures' names) runs just those. Run the emulator with --answer on a
// maki set up with the test phrase:
//
//     npx --prefix desktop vite-node scripts/emu-usb/newapps.ts LOG
import { readFileSync } from 'node:fs'
import { hmac } from '../../desktop/node_modules/@noble/hashes/hmac.js'
import { sha512 } from '../../desktop/node_modules/@noble/hashes/sha2.js'
import { HDKey } from '../../desktop/node_modules/@scure/bip32/index.js'
import { mnemonicToSeedSync } from '../../desktop/node_modules/@scure/bip39/index.js'
import { relay } from '../../desktop/src/main/roughtime'
import { readBundle } from '../../desktop/src/shared/bundle'
import { Link } from '../../desktop/src/shared/link'
import { addMessage, listMessage, PASSWORDS_APP, readList } from '../../desktop/src/shared/passwords'
import { TcpTransport } from '../../desktop/src/shared/test-support'
import { CENTRE, closeFront, Control, Log, openItem, sleep } from './emu'

const [logPath] = process.argv.slice(2)
if (!logPath) throw new Error('give the emulator log')
const log = new Log(logPath)
const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
const FIXTURES = `${__dirname}/../../xous-core/libs/maki-wasm/tests/fixtures`
const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`)
  if (!ok) failed++
}

// the apps: home screen name, id, fixture
const APPS: [string, string, string][] = [
  ['Password Maker', PASSWORDS_APP, 'passwords'],
  ['Confirm', 'com.leviathan.maki.confirm', 'confirm'],
  ['Show QR', 'com.leviathan.maki.showqr', 'showqr'],
  ['TON', 'com.leviathan.maki.ton', 'ton'],
  ['Dash', 'com.leviathan.maki.dash', 'dash'],
  ['DigiByte', 'com.leviathan.maki.digibyte', 'digibyte'],
  ['Zcash', 'com.leviathan.maki.zcash', 'zcash'],
  ['Sudoku', 'com.leviathan.maki.sudoku', 'sudoku'],
  ['Sokoban', 'com.leviathan.maki.sokoban', 'sokoban'],
  ...(process.env.MAKI_FLASHCARDS ? [['Flashcards', 'com.leviathan.maki.flashcards', 'flashcards'] as [string, string, string]] : [])
]
const ONLY = process.env.MAKI_ONLY?.split(',')
const RUN = ONLY ? APPS.filter(([, , file]) => ONLY.includes(file)) : APPS
// what stays: the wallets the other tests use, and these
const KEEP = ['bitcoin', 'ethereum', 'monero', 'solana', 'tron', ...APPS.map(([, id]) => id.split('.').pop()!)]

const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'fake maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)

let apps = (await link.appList()).apps
const installed = new Set<string>()
for (const [name, id, file] of RUN) {
  const have = apps.find((a) => a.id === id)
  if (have?.name === name) {
    installed.add(id)
    continue
  }
  if (have) {
    console.log(`replacing ${have.name}, an older build: ${await link.appRemove(have.id, have.name)}`)
    apps = (await link.appList()).apps
  }
  const bundle = new Uint8Array(readFileSync(`${FIXTURES}/${file}.maki`))
  for (;;) {
    const { space } = await link.appSpace()
    const free = space ? space.space - space.taken : 0
    // the bundle, the storage its manifest asks for, and some to spare
    const storage = readBundle(bundle).manifest.storageKib * 1024
    if (space && space.apps < space.maxApps && free > bundle.length + storage + 8 * 1024) break
    const spare = apps
      .filter((a) => !KEEP.includes(a.id.split('.').pop()!))
      .sort((a, b) => b.bundle + b.storage * 1024 - (a.bundle + a.storage * 1024))[0]
    if (!spare) break
    console.log(`making room: remove ${spare.name}: ${await link.appRemove(spare.id, spare.name)}`)
    apps = (await link.appList()).apps
  }
  const t0 = Date.now()
  const r = await link.appInstall(name, bundle)
  check(
    r.approval === 'approved',
    `${name} installed (${r.approval}${r.reason ? `: ${r.reason}` : ''}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`
  )
  if (r.approval === 'approved') installed.add(id)
  apps = (await link.appList()).apps
}

// Password Maker: an entry from maki desktop (maki asks first), then maki types its password
const PASSWORD = (() => {
  const k = HDKey.fromMasterSeed(mnemonicToSeedSync(PHRASE)).derive("m/83696968'/707764'/21'/0'").privateKey!
  return Buffer.from(hmac(sha512, new TextEncoder().encode('bip-entropy-from-k'), k)).toString('base64').slice(0, 21)
})()
if (installed.has(PASSWORDS_APP)) {
  const add = addMessage({ alphabet: 'base64', length: 21, number: 0, enter: true, site: 'example.com', user: 'kara' })!
  const r = await link.appMessage(PASSWORDS_APP, add, 330_000)
  check(r.status === 'approved' && r.answer[0] === 0, `an entry added, once maki asked (${r.status}, ${r.answer[0]})`)
  const l = await link.appMessage(PASSWORDS_APP, listMessage(0))
  check(readList(l.answer)?.entries[0]?.site === 'example.com', 'and kept')
}

const ctl = await Control.open(7881)
for (const [name, id] of RUN) {
  if (!installed.has(id)) continue
  const opened = await openItem(ctl, log, name)
  const drew = await log.waitFor(/: first frame after (\d+) ms/, opened, 180_000)
  check(!!drew, `${name} opened and drew${drew ? ` (${drew[1]} ms)` : ''}`)
  await sleep(3000)
  if (id === PASSWORDS_APP) {
    // the entry, then its password: maki asks (--answer's yes), then types it, then Enter
    const at = log.size()
    await ctl.press(CENTRE, 2000)
    await ctl.press(CENTRE, 0)
    const typed = await log.waitForTyped(at, PASSWORD.length, 300_000)
    check(typed.startsWith(PASSWORD), `maki typed number 0's password, as BIP-85 makes it (${typed.length} characters)`)
    // the emulator logs what maki types over USB; maki's own lines must never say it
    const makis = log.since(0).split('\n').filter((l) => !l.includes('usb: typed')).join('\n')
    check(!makis.includes(PASSWORD.slice(0, 12)), "maki's own log doesn't say the password")
    check(log.since(at).includes('typed a password'), 'the app host says it typed a password')
  }
  await ctl.send(`shot newapp-${id.split('.').pop()}`)
  await closeFront(ctl, log)
}
ctl.close()
process.exit(failed ? 1 : 0)
