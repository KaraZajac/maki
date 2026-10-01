// Child Seeds on the emulated maki, set up from the BIP39 test phrase (setup.ts): number 2's 12
// words, which maki makes by BIP-85 and shows its owner itself, a word to a page, never in its
// log. The words are worked out here too, the BIP's steps on @scure/bip32's keys, and each looked
// for beside its "N/12" on maki's screen, in maki's own fonts (screenread, on the frames
// --answer-shots takes as it goes through the pages). Run the emulator with --answer
// --answer-shots, build screenread before starting it, and give the emulator's log and folder:
//
//     cargo build --release --manifest-path scripts/emu-usb/screenread/Cargo.toml
//     npx --prefix desktop vite-node scripts/emu-usb/childseeds.ts LOG OUT
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { HDKey } from '../../desktop/node_modules/@scure/bip32/index.js'
import { entropyToMnemonic, mnemonicToSeedSync } from '../../desktop/node_modules/@scure/bip39/index.js'
import { wordlist } from '../../desktop/node_modules/@scure/bip39/wordlists/english.js'
import { hmac } from '../../desktop/node_modules/@noble/hashes/hmac.js'
import { sha512 } from '../../desktop/node_modules/@noble/hashes/sha2.js'
import { CENTRE, Control, Log, RIGHT, closeFront, openItem, sleep } from './emu'

const [logPath, out] = process.argv.slice(2)
if (!out) throw new Error('give the emulator log and its folder')
const log = new Log(logPath)
const SCREENREAD = `${__dirname}/screenread/target/release/screenread`
const read = (frame: string, texts: string[]): Map<string, boolean> => {
  const lines = execFileSync(SCREENREAD, ['text', frame, ...texts], { encoding: 'utf8' }).trim().split('\n')
  return new Map(lines.map((l) => [l.split('\t')[0], l.split('\t')[1] !== 'missing']))
}

// BIP-85: the key at m/83696968'/39'/0'/12'/2', HMAC-SHA512'd under "bip-entropy-from-k", its
// first 16 bytes as words
const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const k = HDKey.fromMasterSeed(mnemonicToSeedSync(PHRASE)).derive("m/83696968'/39'/0'/12'/2'").privateKey!
const words = entropyToMnemonic(hmac(sha512, new TextEncoder().encode('bip-entropy-from-k'), k).slice(0, 16), wordlist).split(' ')

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`)
  if (!ok) failed++
}

const ctl = await Control.open(7881)
const opened = await openItem(ctl, log, 'Child Seeds')
await log.waitFor(/childseeds: first frame after/, opened, 180_000)
await sleep(3000)
// number 2, 12 words: the centre has maki ask, then show them
await ctl.press(RIGHT, 1500)
await ctl.press(RIGHT, 1500)
const at = log.size()
await ctl.press(CENTRE, 0)
// maki asks first (a stop or two), then shows the words, a page each, until its "done": where
// the emulator was at each end, for the frames between (maki's lines have a carriage return
// after the emulator's count)
const shown = await log.waitFor(
  /\[ *(\d+)\]\s*INFO:maki_launcher::ask: showing the ask from Child seed \((\d{2,}) stops\)[\s\S]*?\[ *(\d+)\]\s*INFO:maki_launcher::ask: ask from Child seed answered/,
  at,
  900_000
)
check(!!shown, `maki asked, then showed ${shown ? `an ask of ${shown[2]} stops` : 'nothing'}`)
check(log.since(at).includes('childseeds: showing a child seed'), 'the app host says it showed a child seed')
check(!log.since(0).includes(words.slice(0, 3).join(' ')), "the words aren't in maki's log")
await sleep(5000)

// every word on a page of its own, beside its number, as maki-hd's BIP-85 and @scure's agree
if (shown) {
  // to the frame --answer-shots takes after the answer
  const [from, to] = [Number(shown[1]), Number(shown[3]) + 400_000_000]
  const frames = readdirSync(out)
    .map((f) => f.match(/^shot-(\d+)\.pgm$/))
    .filter((m): m is RegExpMatchArray => !!m && Number(m[1]) > from && Number(m[1]) <= to)
    .map((m) => `${out}/${m[0]}`)
  // a word at a time: maki's screens space words apart as the canvas doesn't everywhere
  const wanted = words.flatMap((w, i) => [`${i + 1}/12`, w])
  const seen = frames.map((f) => read(f, wanted))
  words.forEach((w, i) => {
    const on = seen.some((s) => s.get(`${i + 1}/12`) && s.get(w))
    check(on, `word ${i + 1}, "${w}", on maki's screen as its own page`)
  })
}

// the app marks number 2 seen
await ctl.send('shot childseeds-after')
check(read(`${out}/childseeds-after.pgm`, ['seen before']).get('seen before') === true, 'number 2 is "seen before"')
await closeFront(ctl, log)
ctl.close()
process.exit(failed ? 1 : 0)
