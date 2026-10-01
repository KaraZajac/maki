# Opens every item of the emulated maki's home screen in turn, through the emulator's control
# port (`shot --usb PORT` listens on PORT+3), and says how each did: how long its first frame
# took, whether it crashed, and a screenshot. maki's log is the emulator's output, run with
# --console-live and kept in LOG.
#
#     python scripts/emu-usb/apps.py LOG [OUT] [PORT]
#
# Each item is opened with the centre button, left a few seconds, then closed with its menu
# (left and right together, then left to Exit, its last item, then the centre). Screenshots go
# to OUT (default .emu/apps) as PNG, if Pillow is there, else as the emulator's PGM.
import os, re, socket, sys, time

LOG = sys.argv[1]
OUT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else ".emu/apps")
PORT = int(sys.argv[3]) if len(sys.argv) > 3 else 7878
CENTRE, LEFT, RIGHT = 5, 3, 4
os.makedirs(OUT, exist_ok=True)

control = socket.create_connection(("127.0.0.1", PORT + 3))
replies = control.makefile("r")


def command(line):
    control.sendall((line + "\n").encode())
    return replies.readline().strip()


def press(*buttons, gap=0.6):
    for b in buttons:
        command(f"press {b}")
    time.sleep(gap)


def together(*buttons):
    # in one write, so the emulator takes them in one step: pressed at the same moment
    control.sendall("".join(f"press {b}\n" for b in buttons).encode())
    for _ in buttons:
        replies.readline()


log_at = os.path.getsize(LOG)


def log_since(at):
    with open(LOG, errors="replace") as f:
        f.seek(at)
        return f.read()


def wait_for(pattern, at, timeout):
    end = time.time() + timeout
    while time.time() < end:
        m = re.search(pattern, log_since(at))
        if m:
            return m
        time.sleep(0.2)
    return None


def shot(name):
    path = command(f"shot {name}").removeprefix("shot ")
    try:
        from PIL import Image
        png = os.path.join(OUT, name + ".png")
        Image.open(path).save(png)
        return png
    except Exception:
        return path


seen = []
results = []
for i in range(64):
    at = os.path.getsize(LOG)
    press(CENTRE, gap=0)
    opened = wait_for(r"bringing '([^']+)' to the front", at, 30)
    if not opened:
        print("nothing opened: is maki on its home screen?")
        break
    name = opened.group(1)
    if name in seen:
        break
    seen.append(name)
    # an app of the app host's says when it runs, then when its first frame is up; maki's own
    # screens (Passkeys, say) say neither
    running = wait_for(r"running (\S+)\s", at, 15)
    first = None
    if running:
        app = re.escape(running.group(1))
        first = wait_for(app + r": first frame after (\d+) ms", at, 120)
    time.sleep(3)
    picture = shot(f"{i:02d}-{re.sub('[^A-Za-z0-9]+', '-', name).strip('-').lower()}")
    trouble = re.findall(r"(?im)^.*(?:crash|panick|not responding|aborted|trap).*$", log_since(at))
    # its menu, then Exit (the last item: left from the first), then the next item
    together(LEFT, RIGHT)
    time.sleep(1.2)
    press(LEFT, gap=0.5)
    press(CENTRE, gap=0.8)
    closed = wait_for(r"exited from its menu|returned to the home screen", at, 15)
    frame = f"{first.group(1)} ms" if first else "no frame"
    results.append((name, frame, bool(closed), trouble))
    print(f"{name}: first frame {frame}, {'closed' if closed else 'NOT CLOSED'}"
          f"{', ' + '; '.join(trouble[:2]) if trouble else ''} - {picture}")
    press(RIGHT, gap=0.8)

# maki's own screens (Passkeys, say) aren't the app host's: they log no first frame
bad = [r for r in results if not r[2] or r[3]]
print(f"{len(results)} opened, {len(bad)} with trouble")
sys.exit(1 if bad else 0)
