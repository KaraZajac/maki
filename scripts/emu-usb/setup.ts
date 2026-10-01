// Sets up a blank emulated maki from the BIP39 test phrase ("abandon" x11, "about") with PIN
// 000000, through the control port: the presses of presses-test-phrase.sh, made in real time and
// waiting on maki's log where it's slow (the PIN's key, the phrase), so they land however long
// boot takes. For a MAKI_DEMO build (PIN digits start at 0), run with --realtime-from early (1G)
// and no presses of its own; give its log. Never use this phrase for real coins.
//
//     npx --prefix desktop vite-node scripts/emu-usb/setup.ts LOG
import { CENTRE, Control, LEFT, Log, RIGHT, sleep } from './emu'

if (!process.argv[2]) throw new Error('give the emulator log')
const log = new Log(process.argv[2])
// a press, then time for maki to take it: the emulated maki is slow when busy
const GAP_MS = 2500

const ctl = await Control.open(7881)
if (!(await log.waitFor(/the screen is PID/, 0, 900_000))) throw new Error('maki never showed its first screen')
await sleep(15_000)
const press = (button: number, gap = GAP_MS): Promise<void> => ctl.press(button, gap)

await press(RIGHT)
await press(CENTRE) // restore from phrase
for (let i = 0; i < 6; i++) await press(CENTRE) // PIN 000000
await press(LEFT)
await press(CENTRE) // the check mark
for (let i = 0; i < 6; i++) await press(CENTRE) // again
await press(LEFT)
let at = log.size()
await press(CENTRE, 0) // the check mark: the PIN's key takes a while
if (!(await log.waitFor(/PIN set; secret basis/, at, 900_000))) throw new Error('the PIN was never set')
await sleep(8000)
await press(RIGHT)
await press(CENTRE) // 12 words
for (let word = 0; word < 11; word++) for (let i = 0; i < 4; i++) await press(CENTRE) // abandon: a, b, a, the word
for (const b of [CENTRE, CENTRE, RIGHT, RIGHT, RIGHT, CENTRE]) await press(b) // about: a, b, o
at = log.size()
await press(CENTRE, 0) // the word
if (!(await log.waitFor(/recovery phrase restored/, at, 900_000))) throw new Error('the phrase was never restored')
// "Phrase restored": continue, to the home screen (maki holds asks until then)
await sleep(10_000)
await press(CENTRE, 5000)
console.log('set up: the test phrase, PIN 000000')
ctl.close()
