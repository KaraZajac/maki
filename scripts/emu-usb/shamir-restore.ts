// A blank emulated maki set up from Shamir shares of the BIP39 test phrase, through the control
// port: "restore from phrase", PIN 000000, then "shares", and two of a 2-of-3 split typed in on
// maki's own screen, a word at a time, as an owner would (each word's letters until a few words
// are left, then the word; the shares made here by maki-sskr, a small tool in the scratch space).
// Then the phrase maki restored is held to the test phrase's: its wallet's fingerprint, over the
// link (WALLET_STATUS). For a MAKI_DEMO build, started blank with --realtime-from 1G:
//
//     npx --prefix desktop vite-node scripts/emu-usb/shamir-restore.ts LOG TOOL
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relay } from '../../desktop/src/main/roughtime'
import type { MakiClient } from '../../desktop/src/shared/client'
import { Link } from '../../desktop/src/shared/link'
import { TcpTransport } from '../../desktop/src/shared/test-support'
import { CENTRE, Control, LEFT, Log, RIGHT, sleep } from './emu'

const [logPath, tool] = process.argv.slice(2)
if (!tool) throw new Error('give the emulator log and the sskr tool')
const log = new Log(logPath)
const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
const GAP_MS = 2500
// the test phrase's fingerprint, as wallets write it
const TEST_FINGERPRINT = '73c5da0a'

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`)
  if (!ok) failed++
}

const src = readFileSync(`${__dirname}/../../xous-core/libs/maki-sskr/src/bytewords.rs`, 'utf8')
const WORDS = [...src.slice(src.indexOf('WORDS'), src.indexOf('];', src.indexOf('WORDS'))).matchAll(/"([a-z]{4})"/g)].map(
  (m) => m[1]
)
if (WORDS.length !== 256) throw new Error(`ByteWords: ${WORDS.length} words read`)

// two of a 2-of-3 split of the test phrase's entropy (sixteen zeros)
const shares = execFileSync(tool, ['split', '00'.repeat(16), '2', '3'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .map((l) => l.split(' '))
const typing = [shares[2], shares[0]]

const ctl = await Control.open(7881)
const press = (button: number, gap = GAP_MS): Promise<void> => ctl.press(button, gap)

/** One share typed in, as the launcher's share entry (shares.rs) takes it: its options are the
 * next letters of the words that begin as typed (or, once eight or fewer are left, those words),
 * then back, once something's typed; the choice starts at the first each time. */
const typeShare = async (words: string[]): Promise<void> => {
  let typedWords = 0
  for (const word of words) {
    let prefix = ''
    for (;;) {
      const matching = WORDS.filter((w) => w.startsWith(prefix))
      const pickWords = prefix !== '' && matching.length <= 8
      const options: string[] = pickWords
        ? [...matching]
        : [...new Set(matching.map((w) => w[prefix.length]))]
      if (prefix !== '' || typedWords > 0) options.push('<back>')
      const target = pickWords ? word : word[prefix.length]
      const to = options.indexOf(target)
      if (to < 0) throw new Error(`${target} isn't offered for ${word} after "${prefix}"`)
      const n = options.length
      const [button, steps] = to <= n / 2 ? [RIGHT, to] : [LEFT, n - to]
      for (let i = 0; i < steps; i++) await ctl.press(button, 300)
      await ctl.press(CENTRE, 600)
      if (pickWords) break
      prefix += target
    }
    typedWords++
  }
}

if (!(await log.waitFor(/the screen is PID/, 0, 900_000))) throw new Error('maki never showed its first screen')
await sleep(15_000)
await press(RIGHT)
await press(CENTRE) // restore from phrase
for (let i = 0; i < 6; i++) await press(CENTRE) // PIN 000000
await press(LEFT)
await press(CENTRE)
for (let i = 0; i < 6; i++) await press(CENTRE) // again
await press(LEFT)
let at = log.size()
await press(CENTRE, 0)
if (!(await log.waitFor(/PIN set; secret basis/, at, 900_000))) throw new Error('the PIN was never set')
await sleep(8000)
await press(RIGHT)
await press(RIGHT)
await press(CENTRE) // shares
await sleep(3000)
await typeShare(typing[0])
await sleep(6000)
await press(CENTRE, 4000) // "Share 1 read": next share
at = log.size()
await typeShare(typing[1])
const restored = await log.waitFor(/recovery phrase restored from shares/, at, 900_000)
check(!!restored, 'maki restored its phrase from two of the three shares, typed in on it')
await sleep(10_000)
await press(CENTRE, 8000) // "Phrase restored": continue, to the home screen

const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'fake maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)
const s = await (link as unknown as { client: MakiClient }).client.walletStatus()
check(
  s?.kind === 'standard' && s.fingerprint === TEST_FINGERPRINT,
  `the restored phrase is the test phrase: its wallet is ${s?.fingerprint} (want ${TEST_FINGERPRINT})`
)
check(!log.since(0).includes(typing[0].slice(9, 12).join(' ')), "the shares' words aren't in maki's log")
ctl.close()
process.exit(failed ? 1 : 0)
