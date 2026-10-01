// What the emulator tests share: the emulated maki's control port (patch 0011: presses, shots,
// the camera), its log as `shot --console-live` writes it, QR codes drawn for maki's camera
// (patch 0014), and opening a home screen item by name.
import { createConnection, Socket } from 'node:net'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import encodeQR from '../../desktop/node_modules/@paulmillr/qr/index.js'

export const [LEFT, RIGHT, CENTRE] = [3, 4, 5]
export const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms))

// the emulator's control port: a line each way
export class Control {
  private replies: string[] = []
  private waiting: ((line: string) => void)[] = []
  private buffered = ''
  constructor(private s: Socket) {
    s.setEncoding('utf8')
    s.on('data', (d: string) => {
      this.buffered += d
      let i: number
      while ((i = this.buffered.indexOf('\n')) >= 0) {
        const line = this.buffered.slice(0, i)
        this.buffered = this.buffered.slice(i + 1)
        const w = this.waiting.shift()
        if (w) w(line)
        else this.replies.push(line)
      }
    })
  }
  static open(port: number): Promise<Control> {
    return new Promise((ok, fail) => {
      const s = createConnection(port, '127.0.0.1', () => ok(new Control(s)))
      s.once('error', fail)
    })
  }
  send(line: string): Promise<string> {
    this.s.write(line + '\n')
    const ready = this.replies.shift()
    if (ready !== undefined) return Promise.resolve(ready)
    return new Promise((ok) => this.waiting.push(ok))
  }
  /** Press a button (or `3+4`, two together), then wait `after` ms. */
  async press(button: number | string, after = 800): Promise<void> {
    await this.send(`press ${button}`)
    await sleep(after)
  }
  close(): void {
    this.s.end()
  }
}

/** The emulator's console log, as it grows. */
export class Log {
  constructor(private path: string) {}
  size(): number {
    return statSync(this.path).size
  }
  since(at: number): string {
    return readFileSync(this.path).subarray(at).toString('utf8')
  }
  async waitFor(pattern: RegExp, at: number, ms: number): Promise<RegExpMatchArray | null> {
    const end = Date.now() + ms
    while (Date.now() < end) {
      const m = this.since(at).match(pattern)
      if (m) return m
      await sleep(200)
    }
    return null
  }
  /** What maki has typed over USB since `at`: the emulator logs it a piece at a time. */
  typed(at: number): string {
    return [...this.since(at).matchAll(/usb: typed "((?:[^"\\]|\\.)*)"/g)]
      .map((m) => JSON.parse(`"${m[1]}"`) as string)
      .join('')
  }
  /** Wait until maki has typed `length` characters since `at`, or `ms` have gone. */
  async waitForTyped(at: number, length: number, ms: number): Promise<string> {
    const end = Date.now() + ms
    while (Date.now() < end && this.typed(at).length < length) await sleep(200)
    await sleep(1000)
    return this.typed(at)
  }
}

// bao-video decodes a frame only when its own finder search (qr.rs, `find_finders`) sees
// exactly three finder patterns: the same search, to count them. A runs 1:1:3:1:1 (loosely), in
// a row and in a column through the same point.
export function finderCount(img: Uint8Array, w: number, h: number): number {
  const thresh = img.reduce((a, b) => a + b, 0) / img.length
  const search = (seq: [number, number, boolean][]): number | null => {
    if (seq.length < 5) return null
    const [a, b, c, d, e] = seq.slice(-5)
    if (!a[2]) return null
    const r = [b, c, d, e].map((s) => Math.floor((s[0] << 4) / a[0]))
    const one = (x: number): boolean => x >= 8 && x <= 32
    return one(r[0]) && r[1] >= 32 && r[1] <= 64 && one(r[2]) && one(r[3])
      ? c[1] - Math.floor(c[0] / 2) - 1
      : null
  }
  const scan = (len: number, at: (i: number) => number, found: (pos: number) => void): void => {
    const seq: [number, number, boolean][] = []
    let [last, run] = [at(0) <= thresh, 1]
    for (let i = 1; i < len; i++) {
      const dark = at(i) <= thresh
      if (dark === last) run++
      else {
        seq.push([run, i, last])
        ;[last, run] = [dark, 1]
        const pos = search(seq)
        if (pos !== null) found(pos)
      }
    }
  }
  const rows = new Set<string>()
  for (let y = 0; y < h; y++) scan(w, (x) => img[y * w + x], (x) => rows.add(`${x},${y}`))
  let count = 0
  for (let x = 0; x < w; x++)
    scan(h, (y) => img[y * w + x], (y) => (count += rows.has(`${x},${y}`) ? 1 : 0))
  return count
}

// the QR code as maki's camera should see it: at the size it captures, so nothing's resampled,
// with square modules a whole number of pixels wide, dark on white, in the middle. maki's
// camera sees it still, as a real one never would: of the eight masks, the first in which
// bao-video finds `finders` finder-like patterns (3, the code's own, unless a test wants a code
// whose data looks like more); null if no mask gives that many. `ecc`: the code's error correction,
// lower for a long text (bigger modules: maki's camera sees 256 by 240 pixels)
export function qrPicture(
  text: string,
  finders = 3,
  ecc: 'low' | 'medium' | 'quartile' | 'high' = 'medium'
): string | null {
  const [w, h] = [256, 240]
  for (let mask = 0; mask < 8; mask++) {
    const modules = encodeQR(text, 'raw', { mask, ecc }) // with a quiet zone of its own
    const scale = Math.floor(Math.min(w, h) / modules.length)
    const [ox, oy] = [(w - modules.length * scale) >> 1, (h - modules.length * scale) >> 1]
    const pixels = Buffer.alloc(w * h, 0xff)
    modules.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (!dark) return
        for (let dy = 0; dy < scale; dy++) {
          const line = (oy + y * scale + dy) * w + ox
          pixels.fill(0, line + x * scale, line + (x + 1) * scale)
        }
      })
    )
    const found = finderCount(pixels, w, h)
    if (found === finders) {
      const path = join(tmpdir(), `maki-qr-${process.pid}-${mask}.pgm`)
      writeFileSync(path, Buffer.concat([Buffer.from(`P5\n${w} ${h}\n255\n`), pixels]))
      return path
    }
  }
  return null
}

/** The home screen's items, as maki orders them: by name, whatever the case. */
export function homeItems(log: Log): string[] {
  const names = new Set([...log.since(0).matchAll(/registered app '([^']+)'/g)].map((m) => m[1]))
  return [...names].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
}

/**
 * Bring the home screen item `name` to the front. Opening what's chosen says where on the home
 * screen it is; if it's another, it's closed, and the steps to `name` counted from there (an app
 * can take a minute to open in the emulator: opening each on the way would take an age). Returns
 * where the log stood when `name` opened.
 */
export async function openItem(ctl: Control, log: Log, name: string): Promise<number> {
  let last = ''
  for (let tries = 0; tries < 4; tries++) {
    const at = log.size()
    await ctl.press(CENTRE, 0)
    const opened = await log.waitFor(/bringing '([^']+)' to the front/, at, 30_000)
    if (!opened) throw new Error('nothing opened: is maki on its home screen?')
    last = opened[1]
    if (last === name) return at
    await log.waitFor(/first frame after|returned to the home screen/, at, 180_000)
    await closeFront(ctl, log)
    const items = homeItems(log)
    const [from, to] = [items.indexOf(last), items.indexOf(name)]
    if (from < 0 || to < 0) throw new Error(`${name} isn't on maki's home screen`)
    const right = (to - from + items.length) % items.length
    const [button, steps] = right <= items.length / 2 ? [RIGHT, right] : [LEFT, items.length - right]
    for (let i = 0; i < steps; i++) await ctl.press(button, 700)
    await sleep(1000)
  }
  throw new Error(`couldn't find ${name} (last: ${last})`)
}

/** Close what's in front through its menu (Exit is its last item), back to the home screen. */
export async function closeFront(ctl: Control, log: Log): Promise<void> {
  const at = log.size()
  await ctl.press('3+4', 1200)
  await ctl.press(LEFT, 500)
  await ctl.press(CENTRE, 800)
  await log.waitFor(/exited from its menu|returned to the home screen/, at, 15_000)
  await sleep(2000)
}
