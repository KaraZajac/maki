// Macro Pad on the emulated maki, end to end: a DuckyScript sent from maki desktop's side (the
// same scriptMessage the renderer uses), kept by maki, then run on maki — and the keystrokes come
// out of maki's USB. STRING shows as the emulator's typed text; the chords (Gui+R, Ctrl+Alt+Del)
// show in maki's own log as key presses with their modifiers, which is the whole point: Ctrl, Alt
// and Gui reaching the computer. Run the emulator with --answer (it approves the install), and
// give its log:
//
//     npx --prefix desktop vite-node scripts/emu-usb/macropad.ts LOG
import { readFileSync } from 'node:fs'
import { relay } from '../../desktop/src/main/roughtime'
import { Link } from '../../desktop/src/shared/link'
import {
  getMessage,
  listMessage,
  MACROPAD_APP,
  readPad,
  readText,
  removeMessage,
  scriptMessage
} from '../../desktop/src/shared/macropad'
import { TcpTransport } from '../../desktop/src/shared/test-support'
import { CENTRE, Control, Log, closeFront, openItem, sleep } from './emu'

const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
if (!process.argv[2]) throw new Error('give the emulator log')
const log = new Log(process.argv[2])
const FIXTURE = `${__dirname}/../../xous-core/libs/maki-wasm/tests/fixtures/macropad.maki`

const NAME = 'Demo'
const SCRIPT = ['STRING maki macro test', 'ENTER', 'DELAY 100', 'GUI r', 'CTRL ALT DELETE'].join('\n')
const message = scriptMessage(NAME, SCRIPT)
if (!message) throw new Error("the script doesn't fit a message")

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(ok ? `PASS: ${what}` : `FAIL: ${what}`)
  if (!ok) failed++
}

const ctl = await Control.open(7881)
const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'fake maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)

// room on the pad: maki keeps 32 apps, so free one if the Macro Pad isn't on yet
let apps = (await link.appList()).apps
if (!apps.some((a) => a.id === MACROPAD_APP)) {
  if (apps.length >= 32) {
    const spare = apps.find((a) => a.id === 'com.leviathan.maki.eightball') ?? apps[apps.length - 1]
    console.log(`making room: remove ${spare.name}: ${await link.appRemove(spare.id, spare.name)}`)
  }
  const r = await link.appInstall('Macro Pad', new Uint8Array(readFileSync(FIXTURE)))
  console.log(`install: ${r.approval}${r.reason ? ` (${r.reason})` : ''}`)
  check(r.approval === 'approved', 'the Macro Pad installed')
}

// maki desktop sends the script; maki keeps it and answers (no prompt: it just stores it)
const sent = await link.appMessage(MACROPAD_APP, message)
const reply = new TextDecoder().decode(sent.answer)
check(sent.status === 'approved' && /^ok \d+$/.test(reply), `maki kept the script (${sent.status}, "${reply}")`)

// open it on maki and run it: list -> the script -> type it
const opened = await openItem(ctl, log, 'Macro Pad')
await log.waitFor(/macropad: first frame after/, opened, 180_000)
await sleep(3000)
const at = log.size()
await ctl.press(CENTRE, 2000) // open the script
await ctl.press(CENTRE, 0) // run it
// the run types; give maki time (it naps for the DELAY, then presses the chords)
const pressedGui = await log.waitFor(/macropad: pressed key 0x15 with GUI: done/, at, 180_000)
const pressedChord = await log.waitFor(/macropad: pressed key 0x4c with Ctrl\+Alt: done/, at, 60_000)
await sleep(3000)

check(log.typed(at).includes('maki macro test'), `maki typed the STRING ("${log.typed(at)}")`)
check(log.since(at).includes('pressed key 0x28'), 'it pressed Enter')
check(!!pressedGui, 'it pressed Gui+R — the Gui modifier reached the computer')
check(!!pressedChord, 'it pressed Ctrl+Alt+Delete')

const trouble = log.since(0).match(/(?:panick|not responding|aborted).*$/im)
if (trouble) console.log(`maki says: ${trouble[0]}`)
await closeFront(ctl, log)

// Macro Pad 1.1: the script listed, read back as it was sent, and removed (maki asks first: the
// emulator's --answer says yes), the way maki desktop's Macro Pad page does it
const pad = readPad((await link.appMessage(MACROPAD_APP, listMessage())).answer)
if (!pad) console.log('(Macro Pad 1.0: no list to check)')
else {
  const listed = pad.scripts.find((x) => x.name === NAME)
  check(!!listed && listed.kind === 'ducky', `listed on maki: “${NAME}”, DuckyScript (${JSON.stringify(listed)})`)
  if (listed) {
    const text = readText((await link.appMessage(MACROPAD_APP, getMessage(listed.id))).answer)
    check(text === SCRIPT, 'read back as it was sent')
    const gone = await link.appMessage(MACROPAD_APP, removeMessage(listed.id), 120_000)
    const after = readPad((await link.appMessage(MACROPAD_APP, listMessage())).answer)
    check(
      gone.status === 'approved' && gone.answer[0] === 0 && !after?.scripts.some((x) => x.name === NAME),
      'removed, once maki asked, and gone from the list'
    )
  }
}
await link.drop('done')
ctl.close()
process.exit(failed ? 1 : 0)
