# Where the emulated maki's time goes: profiles the next LEN instructions through the emulator's
# control port (`shot --usb PORT` listens on PORT+3), after pressing PRESSES (button numbers: 5,
# the centre, opens what's chosen), and says which processes the CPU spent them in, then which
# functions in the busiest one or two. maki's log (the emulator's output, run with
# --console-live) names the processes.
#
#     python scripts/emu-usb/profile.py LOG "4 4 5" [LEN] [STEP]
#
# The functions are looked up in xous-core's build (target/riscv32imac-unknown-xous-elf/release).
import bisect, collections, os, re, socket, subprocess, sys

log = sys.argv[1]
presses = sys.argv[2].split() if len(sys.argv) > 2 else []
length = sys.argv[3] if len(sys.argv) > 3 else "2G"
step = sys.argv[4] if len(sys.argv) > 4 else "200K"
port = int(os.environ.get("MAKI_EMU_USB_PORT", "7878"))
release = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../xous-core/target/riscv32imac-unknown-xous-elf/release")

control = socket.create_connection(("127.0.0.1", port + 3))
replies = control.makefile("r")
# the presses and the profile in one write, so the profile starts with the last press
control.sendall("".join(f"press {p}\n" for p in presses).encode() + f"profile {length} {step}\n".encode())
for _ in presses:
    replies.readline()
path = replies.readline().strip().removeprefix("profile ")

names = {}
for line in open(log, errors="replace"):
    m = re.search(r"PID\s+(\d+):\s+\d+ k (\S+)", line)
    if m:
        names[int(m.group(1))] = m.group(2)
samples = [line.split() for line in open(path)]
waiting = sum(1 for s in samples if s[3] == "1")
by = collections.Counter()
for _, asid, prv, wfi, _ in samples:
    if wfi == "0":
        by[(names.get(int(asid), f"PID {asid}"), "kernel" if prv in ("1", "3") else "")] += 1
print(f"{len(samples)} samples; the CPU waited in {100 * waiting / len(samples):.0f}%")
for (who, mode), n in by.most_common(12):
    print(f"  {100 * n / len(samples):5.1f}%  {who}{' (in the kernel)' if mode else ''}")


def symbols(elf):
    out = subprocess.run(["nm", "-n", "-C", elf], capture_output=True, text=True).stdout
    return [(int(a, 16), n) for a, t, n in (l.split(maxsplit=2) for l in out.splitlines() if len(l.split(maxsplit=2)) == 3) if t in "tTwW"]


pids = {v: k for k, v in names.items()}
for (who, mode), _ in [x for x in by.most_common(4) if not x[0][1]][:2]:
    elf = os.path.join(release, who)
    if not os.path.exists(elf) or who not in pids:
        continue
    syms = symbols(elf)
    addrs = [a for a, _ in syms]
    funcs = collections.Counter()
    for _, asid, prv, wfi, pc in samples:
        if wfi == "0" and prv == "0" and int(asid) == pids[who]:
            i = bisect.bisect_right(addrs, int(pc, 16)) - 1
            funcs[syms[i][1][:100] if i >= 0 else "?"] += 1
    total = sum(funcs.values())
    print(f"{who}:")
    for f, n in funcs.most_common(8):
        print(f"  {100 * n / total:5.1f}%  {f}")
print(path)
