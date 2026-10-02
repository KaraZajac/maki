// TON, Dash, DigiByte and Zcash on the emulated maki, end to end, through the real firmware: each
// app installed (room made: maki keeps 32 apps), its account shared and held to what the coin's own
// wallets make from the test phrase, and payments made by maki desktop's own code, gone through on
// maki (the emulator's --answer says yes) and signed, then taken by maki desktop's stand-in for the
// coin's server only if every signature checks out. That's maki-keys doing each of these on the
// firmware: SLIP-10 Ed25519 at TON's six-level path, and ECDSA over Bitcoin's legacy sighash
// (Dash, a Dash Platform payout's coin among them), BIP143 and BIP341's Schnorr (DigiByte's SegWit
// and taproot accounts) and ZIP-244 (Zcash). Run the emulator with --answer, on a maki set up with
// the test phrase (the script reaches the desktop's code and its node_modules):
//
//     npx --prefix desktop vite-node scripts/emu-usb/coins4.ts LOG
import { schnorr, secp256k1 } from '../../desktop/node_modules/@noble/curves/secp256k1.js'
import { hex } from '../../desktop/node_modules/@scure/base/index.js'
import * as btc from '../../desktop/node_modules/@scure/btc-signer/index.js'
import { hash160 } from '../../desktop/node_modules/@scure/btc-signer/utils.js'
import { readFileSync } from 'node:fs'
import { relay } from '../../desktop/src/main/roughtime'
import type { AccountChain } from '../../desktop/src/shared/account-chain'
import { BtcWallet, DASH, DIGIBYTE, parseDescriptor } from '../../desktop/src/shared/btc-wallet'
import type { CoinFetch, SharedAccount } from '../../desktop/src/shared/coin-servers'
import { TON_THEM, TON_V4, tonStandIn, ZEC_ME, ZEC_THEM, zecblockStandIn } from '../../desktop/src/shared/coin-stand-ins'
import { TON } from '../../desktop/src/shared/coins/ton'
import { ZCASH } from '../../desktop/src/shared/coins/zcash'
import { insightEsplora } from '../../desktop/src/shared/insight-esplora'
import { readBundle } from '../../desktop/src/shared/bundle'
import { Link } from '../../desktop/src/shared/link'
import { BtcAccount, Network, type BtcAccountValue } from '../../desktop/src/shared/protocol'
import { DashInsight, pretendChain } from '../../desktop/src/shared/stand-ins'
import { TcpTransport } from '../../desktop/src/shared/test-support'
import { DASH_APP, DIGIBYTE_APP, TON_APP, ZCASH_APP } from '../../desktop/src/shared/wallet-apps'

const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
if (!process.argv[2]) throw new Error('give the emulator log')
const FIXTURES = `${__dirname}/../../xous-core/libs/maki-wasm/tests/fixtures`

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(ok ? `PASS: ${what}` : `FAIL: ${what}`)
  if (!ok) failed++
}
/** Runs `step`, a failure in it a FAIL, not the end of the run. */
const attempt = async (what: string, step: () => Promise<void>): Promise<void> => {
  try {
    await step()
  } catch (e) {
    check(false, `${what}: ${(e as Error).message}`)
  }
}

const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'fake maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)

const WALLETS = [
  ['TON', TON_APP, 'ton'],
  ['Dash', DASH_APP, 'dash'],
  ['DigiByte', DIGIBYTE_APP, 'digibyte'],
  ['Zcash', ZCASH_APP, 'zcash']
] as const

// room: maki keeps 32 apps in the room it has; apps this test doesn't need go, the largest first
const KEEP = ['bitcoin', 'ethereum', 'monero', 'solana', 'tron', 'passwords', ...WALLETS.map(([, id]) => id.split('.').pop()!)]
const installed = new Set<string>()
let apps = (await link.appList()).apps
for (const [name, id, file] of WALLETS) {
  if (apps.some((a) => a.id === id)) {
    installed.add(id)
    continue
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

/** A stand-in for a coin's server, as the coin's wallet code fetches. */
const fetchFrom =
  (standIn: { answer: (method: string, path: string, body: string) => Promise<[number, string]> | [number, string] }): CoinFetch =>
  async (_network, method, path, body) => {
    const [status, text] = await standIn.answer(method, path, body ?? '')
    return { status, text }
  }

/** The account maki's app for `chain` shares, as the Wallets page keeps it. */
const shared = async (chain: AccountChain): Promise<SharedAccount> => {
  const r = await link.accountApp(chain.app, chain.name, chain.appChain).account(0, 0)
  return { network: 0, index: 0, address: r.address, publicKey: hex.encode(r.publicKey) }
}

/** One payment through `chain`'s card's own steps: made here, signed on maki, submitted. */
const pay = async (
  chain: AccountChain,
  fetch: CoinFetch,
  account: SharedAccount,
  to: string,
  amount: bigint,
  memo: string
): Promise<string> => {
  const state = await chain.look(fetch, account)
  const p = await chain.pay(fetch, account, state, to, amount, null, memo)
  const t0 = Date.now()
  const r = await link.accountApp(chain.app, chain.name, chain.appChain).sign(0, account.index, p.payload)
  if (!r.signature) throw new Error(`maki didn't sign: ${r.approval} ${r.reason ?? ''}`)
  console.log(`  ${chain.name}: maki signed in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  return chain.submit(fetch, account, p, r.signature)
}

// TON: Ed25519 by SLIP-10 at m/44'/607'/0'/0'/0'/0', its v4R2 wallet's address as @ton/ton has it
if (installed.has(TON_APP))
  await attempt('TON', async () => {
    const account = await shared(TON)
    check(account.address === TON_V4, `TON's account is Ledger Live's and Tonkeeper's v4R2 (${account.address})`)
    const standIn = tonStandIn()
    const id = await pay(TON, fetchFrom(standIn), account, TON_THEM, 1_250_000_000n, 'maki emulator')
    const sent = standIn.sent[0]
    check(
      standIn.sent.length === 1 &&
        sent.wallet === 'v4R2' &&
        sent.messages.length === 1 &&
        sent.messages[0].value === 1_250_000_000n &&
        sent.messages[0].comment === 'maki emulator',
      `TON: 1.25 TON with a comment, signed on maki, taken by the stand-in (${id.slice(0, 16)}…)`
    )
  })

// Zcash: ECDSA over ZIP-244's digest, a coin on a receiving address and one on a change address
if (installed.has(ZCASH_APP))
  await attempt('Zcash', async () => {
    const account = await shared(ZCASH)
    check(account.address === ZEC_ME, `Zcash's account is Zashi's and Ledger's (${account.address})`)
    const standIn = zecblockStandIn()
    const id = await pay(ZCASH, fetchFrom(standIn), account, ZEC_THEM, 160_000_000n, '')
    check(
      standIn.sent.length === 1 &&
        standIn.sent[0].inputs.length === 2 &&
        standIn.sent[0].outputs[0].address === ZEC_THEM &&
        standIn.sent[0].outputs[0].value === 160_000_000n,
      `Zcash: 1.6 ZEC from both coins, each signed on maki, taken by the stand-in (${id.slice(0, 16)}…)`
    )
  })

// Dash: legacy ECDSA, a plain coin and one Dash Platform paid out (its payload in the PSBT whole)
if (installed.has(DASH_APP))
  await attempt('Dash', async () => {
    const info = parseDescriptor((await link.dash.account(Network.BITCOIN, BtcAccount.LEGACY)).descriptor, 'dash')
    const keys = new BtcWallet(info, async () => '').keys
    check(
      info.xpub ===
        'xpub6CYEjsU6zPM3sADS2ubu2aZeGxCm3C5KabkCpo4rkNbXGAH9M7rRUJ4E5CKiyUddmRzrSCopPzisTBrXkfCD4o577XKM9mzyZtP1Xdbizyk' &&
        keys.address(0, 0).address === 'XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5',
      `Dash's account is Dash Core's and Ledger's (${keys.address(0, 0).address})`
    )
    const insight = new DashInsight(DASH)
    insight.fund('XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5', 150_000_000n)
    insight.withdraw('XbctnEsgWTn5j1co3emZynemxSFPqkLRKZ', 25_000_000n)
    const esplora = insightEsplora(async (path, json) => {
      const [status, text] = await insight.answer(json === undefined ? 'GET' : 'POST', path, json ?? '')
      return { status, text }
    })
    const wallet = new BtcWallet(info, (_network, path, body) => esplora(path, body))
    const state = await wallet.scan()
    const payee = 'XtNTcJBRDXN6xLh8o56kAMSvgFpxwVh4rJ'
    const { psbt } = await wallet.send(state, payee, 160_000_000n, 1)
    const t0 = Date.now()
    const r = await link.dash.sign(Network.BITCOIN, psbt)
    if (!r.signed) throw new Error(`maki didn't sign: ${r.approval} ${r.reason}`)
    console.log(`  Dash: maki signed in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
    const txid = await wallet.broadcast(r.signed)
    check(
      insight.sent.length === 1 && insight.sent[0].inputs.length === 2 && insight.sent[0].outputs[0].value === 160_000_000n,
      `Dash: both coins, the Platform payout's too, signed on maki, taken by the stand-in (${txid.slice(0, 16)}…)`
    )
  })

// DigiByte: one payment from each of its accounts, each signature as that kind of account signs
if (installed.has(DIGIBYTE_APP))
  for (const [kind, value, first] of [
    ['native SegWit', BtcAccount.SEGWIT, 'dgb1q9gmf0pv8jdymcly6lz6fl7lf6mhslsd72e2jq8'],
    ['taproot', BtcAccount.TAPROOT, 'dgb1pcevt23hht82rkdrjdpwzstmqyj4ngyy42r9cu73rl4n9h5vu6hgsx5tm5q'],
    ['legacy', BtcAccount.LEGACY, 'DG1KhhBKpsyWXTakHNezaDQ34focsXjN1i']
  ] as [string, BtcAccountValue, string][])
    await attempt(`DigiByte ${kind}`, async () => {
      const info = parseDescriptor((await link.digibyte.account(Network.BITCOIN, value)).descriptor, 'digibyte')
      const receive = new BtcWallet(info, async () => '').keys.address(0, 0)
      check(receive.address === first, `DigiByte's ${kind} account is its wallets' (${receive.address})`)
      const chain = pretendChain(receive.address, 50_000_000, DIGIBYTE)
      const wallet = new BtcWallet(info, chain.esplora)
      const state = await wallet.scan()
      const rates = await wallet.feeRates()
      const payee = 'dgb1q50rtrmj2f8vl9tem8qpfw36ylw5jg9j2jzs696'
      const made = await wallet.send(state, payee, 20_000_000n, rates.halfHourFee)
      const t0 = Date.now()
      const r = await link.digibyte.sign(Network.BITCOIN, made.psbt)
      if (!r.signed) throw new Error(`maki didn't sign: ${r.approval} ${r.reason}`)
      console.log(`  DigiByte ${kind}: maki signed in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
      await wallet.broadcast(r.signed)
      // what the stand-in took, its signature checked here over what DigiByte's nodes hash
      const tx = btc.Transaction.fromRaw(hex.decode(chain.broadcast[0]), { allowUnknownInputs: true })
      let verified = false
      if (value === BtcAccount.SEGWIT) {
        const [sig, pub] = tx.getInput(0).finalScriptWitness!
        const code = btc.OutScript.encode({ type: 'pkh', hash: hash160(pub) })
        const digest = tx.preimageWitnessV0(0, code, btc.SigHash.ALL, 50_000_000n)
        verified = secp256k1.verify(sig.slice(0, -1), digest, pub, { prehash: false, format: 'der' })
      } else if (value === BtcAccount.TAPROOT) {
        const [sig] = tx.getInput(0).finalScriptWitness!
        const digest = tx.preimageWitnessV1(0, [receive.script], sig.length === 65 ? sig[64] : btc.SigHash.DEFAULT, [
          50_000_000n
        ])
        verified = schnorr.verify(sig.slice(0, 64), digest, receive.script.slice(2))
      } else {
        const [sig, pub] = btc.Script.decode(tx.getInput(0).finalScriptSig!) as Uint8Array[]
        const legacy = tx as unknown as { preimageLegacy(i: number, script: Uint8Array, hashType: number): Uint8Array }
        const digest = legacy.preimageLegacy(0, receive.script, btc.SigHash.ALL)
        verified =
          hex.encode(pub) === hex.encode(receive.publicKey) &&
          secp256k1.verify(sig.slice(0, -1), digest, pub, { prehash: false, format: 'der' })
      }
      check(
        verified && btc.Address(DIGIBYTE).encode(btc.OutScript.decode(tx.getOutput(0).script!)) === payee,
        `DigiByte ${kind}: 0.2 DGB, signed on maki, sent`
      )
    })

process.exit(failed ? 1 : 0)
