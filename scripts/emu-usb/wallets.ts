// The new wallet apps on the emulated maki, end to end, through the real firmware: each one
// installed (room made: maki keeps 32 apps), its account shared and compared with the address the
// test phrase's wallets publish, and one payment, made by maki desktop's own code, gone through on
// maki (the emulator's --answer says yes) and signed; the signature checked here, by the key the
// address is, over what the coin signs. That's maki-keys doing each kind of key on the firmware:
// ECDSA on secp256k1 (Tron, XRP), BIP340 (Kaspa), SLIP-10 Ed25519 (Sui) and Icarus keys through host
// API 11 (Cardano). Run the emulator with --answer, on a maki set up with the test phrase (the
// script reaches the desktop's crypto libraries in its node_modules):
//
//     npx --prefix desktop vite-node scripts/emu-usb/wallets.ts LOG
import { ed25519 } from '../../desktop/node_modules/@noble/curves/ed25519.js'
import { schnorr, secp256k1 } from '../../desktop/node_modules/@noble/curves/secp256k1.js'
import { blake2b } from '../../desktop/node_modules/@noble/hashes/blake2.js'
import { sha256, sha512 } from '../../desktop/node_modules/@noble/hashes/sha2.js'
import { keccak_256 } from '../../desktop/node_modules/@noble/hashes/sha3.js'
import { bech32, hex } from '../../desktop/node_modules/@scure/base/index.js'
import { readFileSync } from 'node:fs'
import { relay } from '../../desktop/src/main/roughtime'
import {
  ADA_ME,
  ADA_THEM,
  KAS_THEM,
  kaspaSignatureHash,
  SUI_ME,
  SUI_THEM,
  TRX_THEM,
  XRP_THEM
} from '../../desktop/src/shared/coin-stand-ins'
import {
  accountKey,
  body,
  Keys,
  request as adaRequest,
  transactionId
} from '../../desktop/src/shared/coins/cardano'
import {
  addressAt,
  accountKeys,
  request as kasRequest,
  scriptOf
} from '../../desktop/src/shared/coins/kaspa'
import { fromCoins, transactionData } from '../../desktop/src/shared/coins/sui'
import { addressText, rawData, TRON_APP } from '../../desktop/src/shared/coins/tron'
import { encodePayment, XRP_APP } from '../../desktop/src/shared/coins/xrp'
import { Link } from '../../desktop/src/shared/link'
import { TcpTransport } from '../../desktop/src/shared/test-support'
import { CARDANO_APP, KASPA_APP } from '../../desktop/src/shared/wallet-apps'
import { Log } from './emu'

const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
if (!process.argv[2]) throw new Error('give the emulator log')
const log = new Log(process.argv[2])
const FIXTURES = `${__dirname}/../../xous-core/libs/maki-wasm/tests/fixtures`

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(ok ? `PASS: ${what}` : `FAIL: ${what}`)
  if (!ok) failed++
}

const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'fake maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)

const WALLETS = [
  ['Tron', TRON_APP, 'tron'],
  ['XRP', XRP_APP, 'xrp'],
  ['Kaspa', KASPA_APP, 'kaspa'],
  ['Sui', 'com.leviathan.maki.sui', 'sui'],
  ['Cardano', CARDANO_APP, 'cardano']
] as const

// room: maki keeps 32 apps in the room it has; apps this test doesn't need go, the largest first
const KEEP = [
  'bitcoin',
  'ethereum',
  'monero',
  'solana',
  ...WALLETS.map(([, id]) => id.split('.').pop()!)
]
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
    // the bundle, the storage its manifest asks for (Kaspa's 16 KiB), and some to spare
    if (space && space.apps < space.maxApps && free > bundle.length + 24 * 1024) break
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

// Tron: ECDSA on secp256k1 over the SHA-256 of raw_data; the signature recovers to the address
if (installed.has(TRON_APP)) {
  const app = link.accountApp(TRON_APP, 'Tron')
  const a = await app.account(0, 0)
  check(
    a.address === 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH',
    `Tron's account is TronLink's (${a.approval}, ${a.address})`
  )
  const now = Date.now()
  const raw = rawData({
    refBlockBytes: Uint8Array.of(0x12, 0x34),
    refBlockHash: new Uint8Array(8).fill(7),
    timestamp: now,
    expiration: now + 600_000,
    owner: a.address,
    to: TRX_THEM,
    amount: 1_000_000n
  })
  const s = await app.sign(0, 0, raw)
  let signer = ''
  if (s.signature?.length === 65) {
    const key = secp256k1.recoverPublicKey(
      Uint8Array.of(s.signature[64] - 27, ...s.signature.subarray(0, 64)),
      sha256(raw),
      { prehash: false }
    )
    signer = addressText(
      Uint8Array.of(
        0x41,
        ...keccak_256(secp256k1.Point.fromBytes(key).toBytes(false).subarray(1)).slice(12)
      )
    )
  }
  check(
    signer === a.address,
    `Tron: maki signed 1 TRX, by its key (${s.approval}${s.reason ? `: ${s.reason}` : ''})`
  )
}

// XRP: ECDSA, DER, over SHA-512Half of the payment after STX\0
if (installed.has(XRP_APP)) {
  const app = link.accountApp(XRP_APP, 'XRP')
  const a = await app.account(0, 0)
  check(
    a.address === 'rHsMGQEkVNJmpGWs8XUBoTBiAAbwxZN5v3',
    `XRP's account is xrpl.js's (${a.approval}, ${a.address})`
  )
  const payment = encodePayment({
    account: a.address,
    destination: XRP_THEM,
    amount: 1_000_000n,
    fee: 12n,
    sequence: 7,
    lastLedgerSequence: 95_000_020,
    signingPubKey: a.publicKey
  })
  const s = await app.sign(0, 0, payment)
  const der = s.signature?.subarray(1, 1 + s.signature[0])
  const digest = sha512(Uint8Array.of(0x53, 0x54, 0x58, 0x00, ...payment)).slice(0, 32)
  check(
    !!der &&
      secp256k1.verify(der, digest, a.publicKey, {
        prehash: false,
        format: 'der'
      }),
    `XRP: maki signed 1 XRP, by its key (${s.approval}${s.reason ? `: ${s.reason}` : ''})`
  )
}

// Kaspa: BIP340 over Kaspa's signature hash, by the coin's key, x only
if (installed.has(KASPA_APP)) {
  const app = link.accountApp(KASPA_APP, 'Kaspa')
  const a = await app.account(0)
  check(
    a.address === 'kaspa:qqd6e65yefepe9wk0m9vuxdufxd80sphy67gwwd0vdaumzdt4tc9s3qt0lqeh',
    `Kaspa's account is Kastle's (${a.approval}, ${a.address})`
  )
  const shared = {
    network: 0 as const,
    index: 0,
    address: a.address,
    publicKey: hex.encode(a.publicKey)
  }
  const keys = accountKeys(shared)
  const mine = scriptOf(addressAt(keys, 0, 0, 0), 0)!
  const tx = {
    inputs: [
      {
        txid: '11'.repeat(32),
        index: 0,
        amount: 5_000_000_000n,
        script: mine,
        chain: 0 as const,
        keyIndex: 0
      }
    ],
    outputs: [
      { value: 1_250_000_000n, script: scriptOf(KAS_THEM, 0)! },
      {
        value: 3_749_796_400n,
        script: scriptOf(addressAt(keys, 0, 1, 0), 0)!,
        ours: { chain: 1 as const, index: 0 }
      }
    ]
  }
  const s = await app.sign(0, 0, kasRequest(tx))
  const hash = kaspaSignatureHash(
    tx.inputs.map((i) => ({
      txid: hex.decode(i.txid),
      index: i.index,
      sequence: 0n,
      sigOps: 1,
      amount: i.amount,
      script: i.script
    })),
    tx.outputs,
    0
  )
  check(
    s.signature?.length === 65 &&
      s.signature[64] === 1 &&
      schnorr.verify(s.signature.subarray(0, 64), hash, mine.subarray(1, 33)),
    `Kaspa: maki signed 12.5 KAS, by the coin's key (${s.approval}${s.reason ? `: ${s.reason}` : ''})`
  )
}

// Sui: Ed25519 over BLAKE2b-256 of the intent and the transaction data
if (installed.has('com.leviathan.maki.sui')) {
  const app = link.accountApp('com.leviathan.maki.sui', 'Sui')
  const a = await app.account(0, 0)
  check(a.address === SUI_ME, `Sui's account is Slush's (${a.approval}, ${a.address})`)
  const data = transactionData({
    sender: a.address,
    ...fromCoins(SUI_THEM, 1_000_000_000n, null),
    payment: [
      {
        id: `0x${'31'.repeat(32)}`,
        version: 1017n,
        digest: new Uint8Array(32).fill(0x31)
      }
    ],
    price: 1000n,
    budget: 3_000_000n,
    expiration: null
  })
  const s = await app.sign(0, 0, data)
  const message = blake2b(Uint8Array.of(0, 0, 0, ...data), { dkLen: 32 })
  check(
    !!s.signature && ed25519.verify(s.signature, message, a.publicKey),
    `Sui: maki signed 1 SUI, by its key (${s.approval}${s.reason ? `: ${s.reason}` : ''})`
  )
}

// Cardano: Icarus keys (host API 11): the payment key's witness over the body's hash
if (installed.has(CARDANO_APP)) {
  const app = link.accountApp(CARDANO_APP, 'Cardano')
  const a = await app.account(0, 0)
  check(
    a.address === ADA_ME,
    `Cardano's account is Eternl's and Lace's (${a.approval}, ${a.address})`
  )
  const keys = new Keys(
    accountKey({
      network: 0,
      index: 0,
      address: a.address,
      publicKey: hex.encode(a.publicKey)
    })
  )
  const them = bech32.fromWords(bech32.decode(ADA_THEM as `${string}1${string}`, 200).words)
  const outputs = [
    { address: them, lovelace: 12_500_000n, assets: new Map<string, bigint>() },
    {
      address: keys.baseBytes(0, 1, 0),
      lovelace: 107_324_839n,
      assets: new Map<string, bigint>(),
      change: { role: 1 as const, index: 0 }
    }
  ]
  const b = body(
    [
      {
        txid: '31'.repeat(32),
        index: 0,
        lovelace: 120_000_000n,
        assets: new Map(),
        role: 0,
        keyIndex: 0
      }
    ],
    outputs,
    175_161n,
    199_357_906n
  )
  const s = await app.sign(0, 0, adaRequest([{ role: 0, index: 0 }], outputs, b))
  const key = s.signature?.subarray(0, 32)
  const sig = s.signature?.subarray(32, 96)
  check(
    !!key &&
      !!sig &&
      hex.encode(key) === hex.encode(keys.key(0, 0)) &&
      ed25519.verify(sig, hex.decode(transactionId(b)), key),
    `Cardano: maki witnessed 12.5 ADA with its payment key (${s.approval}${s.reason ? `: ${s.reason}` : ''})`
  )
}

const trouble = log.since(0).match(/(?:panick|not responding|aborted).*$/im)
if (trouble) console.log(`maki says: ${trouble[0]}`)
await link.drop('done')
process.exit(failed ? 1 : 0)
