// Flashcards on the emulated maki, through the real firmware: a deck sent by maki desktop's own
// code and listed back; the app opened from the home screen and the deck studied there, each front
// and back read off maki's screen (screenread), one card answered "again" and the others "knew
// it"; then what maki kept of it read back over the link, as Leitner's boxes have it: the two known
// in box 2, the one missed in box 1, none new. Run the emulator with --answer on a maki set up with
// the test phrase and Flashcards installed (newapps.ts with MAKI_FLASHCARDS=1), and build
// screenread first; give the emulator's log and folder:
//
//     npx --prefix desktop vite-node scripts/emu-usb/flashcards.ts LOG OUT
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { relay } from '../../desktop/src/main/roughtime'
import {
  deckBytes,
  FLASHCARDS_APP,
  listMessage,
  readList,
  removeMessage,
  sendDeck,
  type Listing
} from '../../desktop/src/shared/flashcards'
import { Link } from '../../desktop/src/shared/link'
import { TcpTransport } from '../../desktop/src/shared/test-support'
import { CENTRE, closeFront, Control, LEFT, Log, openItem, RIGHT, sleep } from './emu'

const [logPath, out] = process.argv.slice(2)
if (!out) throw new Error('give the emulator log and its folder')
const log = new Log(logPath)
const SLOW = Number(process.env.MAKI_EMU_SLOW ?? 10)
const SCREENREAD = `${__dirname}/screenread/target/release/screenread`
const NAME = 'Capitals'
const CARDS = [
  { front: 'France', back: 'Paris' },
  { front: 'Japan', back: 'Tokyo' },
  { front: 'Kenya', back: 'Nairobi' }
]

let failed = 0
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`)
  if (!ok) failed++
}

/** Whether each of `texts` is on maki's screen now: lit, or drawn dark on light (a chosen line). */
const onScreen = async (ctl: Control, name: string, texts: string[]): Promise<boolean> => {
  await ctl.send(`shot ${name}`)
  const found = (frame: string): boolean[] =>
    execFileSync(SCREENREAD, ['text', frame, ...texts], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((l) => l.split('\t')[1] !== 'missing')
  const lit = found(`${out}/${name}.pgm`)
  if (lit.every(Boolean)) return true
  const frame = readFileSync(`${out}/${name}.pgm`)
  const pixels = frame.length - 128 * 128
  writeFileSync(
    `${out}/${name}-inverted.pgm`,
    Buffer.concat([frame.subarray(0, pixels), frame.subarray(pixels).map((v) => 255 - v)])
  )
  const dark = found(`${out}/${name}-inverted.pgm`)
  return lit.every((f, i) => f || dark[i])
}

/** Waits up to `ms` for `texts` to be on maki's screen, looking every second and a half: how long
 * it took, or null. The app keeps a deck's progress after each answer, which the emulator does
 * slowly: how long the next card takes to show is worth knowing. */
const waitScreen = async (ctl: Control, name: string, texts: string[], ms = 60_000): Promise<number | null> => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await onScreen(ctl, name, texts)) return Date.now() - t0
    await sleep(1500)
  }
  return null
}
const took = (t: number | null): string => (t === null ? 'not seen in a minute' : `${(t / 1000).toFixed(1)} s`)

const link = new Link(relay)
link.autoSync = false
link.slow = SLOW
if (!(await link.attach(await TcpTransport.open(7878), 'fake maki')))
  throw new Error(`maki did not link: ${link.log.join('; ')}`)
if (!(await link.appList()).apps.some((a) => a.id === FLASHCARDS_APP))
  throw new Error('install Flashcards first: MAKI_FLASHCARDS=1 MAKI_ONLY=flashcards newapps.ts')
const send = (m: Uint8Array): Promise<{ status: string; answer: Uint8Array }> =>
  link.appMessage(FLASHCARDS_APP, m, 120_000)
const list = async (): Promise<Listing | null> => readList((await send(listMessage())).answer)

// a fresh deck: any from an earlier run removed, then this one sent
for (const d of (await list())?.decks ?? []) if (d.name === NAME) await send(removeMessage(d.id))
const t0 = Date.now()
const sent = await sendDeck(send, 0, deckBytes(NAME, CARDS))
check(sent.ok && sent.cards === 3, `the deck sent and kept (${JSON.stringify(sent)}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`)
const before = (await list())?.decks.find((d) => d.name === NAME)
check(before?.cards === 3 && before.new === 3 && before.study === 3, `listed: 3 cards, all new (${JSON.stringify(before)})`)

// studied on maki: the list, the deck, then each card (the app may be running already: the link's
// messages start it, and opening it brings it to the front)
const ctl = await Control.open(7881)
const opened = await openItem(ctl, log, 'Flashcards')
const front = await log.waitFor(/: first frame after (\d+) ms|bringing 'Flashcards' to the front/, opened, 180_000)
check(!!front, 'Flashcards opened from the home screen')
let t = await waitScreen(ctl, 'fc-list', [NAME])
check(t !== null, `the deck is on its list (${took(t)})`)
await ctl.press(CENTRE, 1000) // the deck
t = await waitScreen(ctl, 'fc-deck', ['study'])
check(t !== null, `the deck's page (${took(t)})`)
const at = log.size()
await ctl.press(CENTRE, 1000) // study it
t = await waitScreen(ctl, 'fc-front-1', ['France'])
check(t !== null, `the first card's front: France (${took(t)})`)
await ctl.press(CENTRE, 1000) // turn it over
t = await waitScreen(ctl, 'fc-back-1', ['Paris', 'again'])
check(t !== null, `turned over: Paris, and what the buttons say (${took(t)})`)
await ctl.press(RIGHT, 1000) // knew it
t = await waitScreen(ctl, 'fc-front-2', ['Japan'])
check(t !== null, `knew it, its progress kept: the next card's front, Japan (${took(t)})`)
await ctl.press(CENTRE, 1000)
t = await waitScreen(ctl, 'fc-back-2', ['Tokyo'])
check(t !== null, `turned over: Tokyo (${took(t)})`)
await ctl.press(LEFT, 1000) // again
t = await waitScreen(ctl, 'fc-front-3', ['Kenya'])
check(t !== null, `again, its progress kept: the next card, Kenya; Japan comes round later (${took(t)})`)
await ctl.press(CENTRE, 1000)
await waitScreen(ctl, 'fc-back-3', ['Nairobi'])
await ctl.press(RIGHT, 1000) // knew it
t = await waitScreen(ctl, 'fc-again', ['Japan'])
check(t !== null, `Japan again, in the same sitting (${took(t)})`)
await ctl.press(CENTRE, 1000)
await waitScreen(ctl, 'fc-back-4', ['Tokyo'])
await ctl.press(RIGHT, 1000) // knew it this time: only its first answer moves it
t = await waitScreen(ctl, 'fc-done', ['Done', 'tomorrow'])
check(t !== null, `the sitting done: "Done for today", more tomorrow (${took(t)})`)
check(!log.since(at).includes('panicked'), 'the app ran the sitting through')
await closeFront(ctl, log)
ctl.close()

// what maki kept, as the desktop reads it
const after = (await list())?.decks.find((d) => d.name === NAME)
check(
  after?.new === 0 && JSON.stringify(after.boxes) === JSON.stringify([1, 2, 0, 0, 0, 0, 0]),
  `kept: none new, the two known in box 2 and the one missed in box 1 (${JSON.stringify(after?.boxes)})`
)
check(after?.due === 0, `nothing due again today (${after?.due})`)
if (after) await send(removeMessage(after.id))
process.exit(failed ? 1 : 0)
