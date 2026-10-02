// Passphrase wallets on the emulated maki, set up from the BIP39 test phrase (setup.ts), with the
// Tron app installed (wallets.ts): a passphrase typed on maki's own screen (maki's menu, Wallets),
// the wallet opened, WALLET_STATUS saying so over the link with its fingerprint, and the Tron app's
// account the passphrase wallet's; then back to the phrase's own wallet, and maki forgetting the
// passphrase when it locks; and "ask at unlock". Every fingerprint and account is worked out here
// too, from @scure's BIP39 and BIP32. Run the emulator with --answer (its yes to the Tron app's
// question), build screenread first, and give the emulator's log and folder:
//
//     npx --prefix desktop vite-node scripts/emu-usb/passphrase.ts LOG OUT
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { secp256k1 } from '../../desktop/node_modules/@noble/curves/secp256k1.js'
import { keccak_256 } from '../../desktop/node_modules/@noble/hashes/sha3.js'
import { HDKey } from '../../desktop/node_modules/@scure/bip32/index.js'
import { mnemonicToSeedSync } from '../../desktop/node_modules/@scure/bip39/index.js'
import { relay } from '../../desktop/src/main/roughtime'
import type { MakiClient } from '../../desktop/src/shared/client'
import { addressText, TRON_APP } from '../../desktop/src/shared/coins/tron'
import { Link } from '../../desktop/src/shared/link'
import { TcpTransport } from '../../desktop/src/shared/test-support'
import { CENTRE, Control, LEFT, Log, RIGHT, sleep } from './emu'

const [logPath, out] = process.argv.slice(2)
if (!out) throw new Error('give the emulator log and its folder')
const log = new Log(logPath)
const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
const SCREENREAD = `${__dirname}/screenread/target/release/screenread`
const [DOWN, UP] = [0, 2]
const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const PASSPHRASE = 'maki 1!'

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`)
  if (!ok) failed++
}
const onScreen = async (ctl: Control, name: string, texts: string[]): Promise<boolean> => {
  await ctl.send(`shot ${name}`)
  const found = (frame: string): boolean[] =>
    execFileSync(SCREENREAD, ['text', frame, ...texts], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((l) => l.split('\t')[1] !== 'missing')
  const lit = found(`${out}/${name}.pgm`)
  if (lit.every(Boolean)) return true
  // a chosen option is drawn dark on light: what's missing is looked for in the frame inverted too
  const frame = readFileSync(`${out}/${name}.pgm`)
  const pixels = frame.length - 128 * 128
  writeFileSync(`${out}/${name}-inverted.pgm`, Buffer.concat([frame.subarray(0, pixels), frame.subarray(pixels).map((v) => 255 - v)]))
  const dark = found(`${out}/${name}-inverted.pgm`)
  return lit.every((f, i) => f || dark[i])
}

// what each wallet is, worked out here: its master key's fingerprint (as wallets write it) and
// its Tron account
const wallet = (passphrase: string): { fp: string; tron: string } => {
  const root = HDKey.fromMasterSeed(mnemonicToSeedSync(PHRASE, passphrase))
  const key = root.derive("m/44'/195'/0'/0/0").publicKey!
  const flat = secp256k1.Point.fromBytes(key).toBytes(false).subarray(1)
  return {
    fp: root.fingerprint.toString(16).padStart(8, '0'),
    tron: addressText(Uint8Array.of(0x41, ...keccak_256(flat).slice(12)))
  }
}
const standard = wallet('')
const hidden = wallet(PASSPHRASE)

const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'fake maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)
const client = (link as unknown as { client: MakiClient }).client
const status = async (): Promise<string> => {
  const s = await client.walletStatus()
  return s ? `${s.kind} ${s.fingerprint}` : 'not answered'
}
const tron = async (): Promise<string> => (await link.accountApp(TRON_APP, 'Tron').account(0, 0)).address ?? ''

const ctl = await Control.open(7881)

/** maki's menu, then its Wallets page. */
const walletsPage = async (): Promise<void> => {
  await ctl.press('3+4', 1500)
  await ctl.press(RIGHT, 800) // Lock, then Wallets
  await ctl.press(CENTRE, 5000)
}

/** Types `text` on maki's passphrase screen, as its own key handling goes (the launcher's
 * passphrase.rs): each set keeps its place; after its characters, delete and done (once there's
 * something), the next set, cancel. Then done. */
const typePassphrase = async (text: string): Promise<void> => {
  const SETS = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '0123456789',
    ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
  ]
  let set = 0
  const at = [0, 0, 0, 0]
  let typed = 0
  const move = async (to: number): Promise<void> => {
    const n = SETS[set].length + (typed > 0 ? 2 : 0) + 2
    const right = (to - at[set] + n) % n
    const [button, steps] = right <= n / 2 ? [RIGHT, right] : [LEFT, n - right]
    for (let i = 0; i < steps; i++) await ctl.press(button, 350)
    at[set] = to
  }
  for (const c of text) {
    const want = SETS.findIndex((s) => s.includes(c))
    while (set !== want) {
      await ctl.press(DOWN, 400)
      set = (set + 1) % SETS.length
    }
    await move(SETS[set].indexOf(c))
    await ctl.press(CENTRE, 500)
    typed++
  }
  await move(SETS[set].length + 1) // done, after delete
  await ctl.press(CENTRE, 2000)
}

const enterPin = async (): Promise<void> => {
  // a demo build's pad starts each digit at 0: 000000, then left round to "done"
  for (let i = 0; i < 6; i++) await ctl.press(CENTRE, 700)
  await ctl.press(LEFT, 500)
  await ctl.press(CENTRE, 0)
}

check((await status()) === `standard ${standard.fp}`, `WALLET_STATUS: the phrase's own wallet (${await status()})`)
check((await tron()) === standard.tron, `the Tron app's account is the phrase's (${standard.tron})`)

// open a passphrase wallet, typed on maki
await walletsPage()
check(await onScreen(ctl, 'pp-wallets', ['Wallets', 'passphrase']), "maki's Wallets page")
await ctl.press(CENTRE, 2500) // type a passphrase
check(await onScreen(ctl, 'pp-entry', ['Passphrase', 'abc']), 'the passphrase screen')
await typePassphrase(PASSPHRASE)
check(await onScreen(ctl, 'pp-check', ['Open', 'maki·1!']), 'maki shows the passphrase whole, a space as a dot')
const at = log.size()
await ctl.press(CENTRE, 0) // open it
const opened = await log.waitFor(/a passphrase wallet is open/, at, 300_000)
check(!!opened, 'maki opened it')
await sleep(5000)
check(await onScreen(ctl, 'pp-opened', [hidden.fp]), `maki says its fingerprint, ${hidden.fp}`)
check(!log.since(0).includes(PASSPHRASE), "the passphrase isn't in maki's log")
await ctl.press(CENTRE, 3000) // continue
check(await onScreen(ctl, 'pp-home', [hidden.fp]), 'the home screen shows it in place of the name')
check((await status()) === `passphrase ${hidden.fp}`, `WALLET_STATUS: a passphrase wallet (${await status()})`)
check((await tron()) === hidden.tron, `the Tron app's account is the passphrase wallet's (${hidden.tron})`)

// back to the phrase's own
await walletsPage()
await ctl.press(CENTRE, 3000) // phrase's own wallet
await ctl.press(CENTRE, 2000) // continue
check((await status()) === `standard ${standard.fp}`, `back to the phrase's own (${await status()})`)
check((await tron()) === standard.tron, "and the Tron app's account with it")

// open it again, then lock: maki forgets it
await walletsPage()
await ctl.press(CENTRE, 2500)
await typePassphrase(PASSPHRASE)
const again = log.size()
await ctl.press(CENTRE, 0)
await log.waitFor(/a passphrase wallet is open/, again, 300_000)
await sleep(5000)
await ctl.press(CENTRE, 3000)
check((await status()).startsWith('passphrase'), 'opened again')
await ctl.press('3+4', 1500)
await ctl.press(CENTRE, 5000) // Lock
check((await status()).startsWith('none'), `locked: no wallet (${await status()})`)
const unlocking = log.size()
await enterPin()
await log.waitFor(/maki_keys: unlocked|unlocked/, unlocking, 300_000)
await sleep(8000)
check((await status()) === `standard ${standard.fp}`, `unlocked: the phrase's own, the passphrase forgotten (${await status()})`)

// ask at unlock: on, then maki asks which wallet after the PIN
await walletsPage()
await ctl.press(RIGHT, 800) // ask at unlock: off
await ctl.press(CENTRE, 4000) // now on, and still chosen: its new state shows
check(await onScreen(ctl, 'pp-ask-on', ['unlock:', 'on']), '"ask at unlock" is on')
await ctl.press(RIGHT, 800) // close, after it
await ctl.press(CENTRE, 2000)
await ctl.press('3+4', 1500)
await ctl.press(CENTRE, 5000) // Lock
const asked = log.size()
await enterPin()
await log.waitFor(/unlocked/, asked, 300_000)
await sleep(8000)
check(await onScreen(ctl, 'pp-which', ['Which', 'wallet']), 'after the PIN, maki asks which wallet')
await ctl.press(RIGHT, 800) // phrase's own
await ctl.press(CENTRE, 3000)
// and off again, as it was
await walletsPage()
await ctl.press(RIGHT, 800)
await ctl.press(CENTRE, 4000)
check(await onScreen(ctl, 'pp-ask-off', ['unlock:', 'off']), '"ask at unlock" off again')
await ctl.press(RIGHT, 800)
await ctl.press(CENTRE, 2000)
check((await status()) === `standard ${standard.fp}`, 'the phrase\'s own wallet at the end')

ctl.close()
process.exit(failed ? 1 : 0)
