# Development

How to build BAOKEY firmware and run it without a badge. Everything here was run
on 2026-09-25 on Fedora 44 with Rust 1.96.0.

## Layout

```
BAOKEY/
├── xous-core/          our fork: KaraZajac/baokey-firmware (private), branch `baokey`     (gitignored clone)
├── desktop/            the desktop app: KaraZajac/maki-desktop (private)                 (gitignored clone)
├── tools/baomulator/   zst123/dc34_baomulator, full-system badge emulator            (gitignored clone)
├── patches/baomulator/ our changes to the emulator, applied on top of the clone
├── scripts/emu.sh      build → emulate → PNG screenshots, in one command
└── .emu/               emulator build output and screenshots                         (gitignored)
```

## One-time setup

```sh
# firmware source: our private fork. --reference reuses BAOSEC's objects so it's quick;
# drop those two flags on a machine without ~/Projects/BAOSEC.
git clone --reference ~/Projects/BAOSEC/xous-core --dissociate --branch baokey \
    https://github.com/KaraZajac/baokey-firmware.git xous-core
git -C xous-core remote add upstream https://github.com/betrusted-io/xous-core.git
git -C xous-core fetch upstream --tags

# emulator
git clone https://github.com/zst123/dc34_baomulator.git tools/baomulator
git -C tools/baomulator apply "$PWD"/patches/baomulator/*.patch
```

The Xous toolchain (`riscv32imac-unknown-xous-elf`) must match your `rustc` exactly;
see `~/Projects/BAOSEC/SETUP.md`. The build stamps its version from upstream's git tags
and fails without them, which is why the fork is its own repo rather than a folder in
this one.

## The fork

`KaraZajac/baokey-firmware` is private, holds upstream's full history, and has two
branches: `dev`, an untouched mirror of upstream `dev`, and `baokey`, where our work
goes. **GitHub Actions is switched off on it**: upstream's workflows would otherwise run
on every push (two of them trigger on any branch) and spend private-repo minutes. Turn
it back on deliberately if we want our own CI.

Syncing with upstream:

```sh
cd xous-core
git fetch upstream --tags
git switch dev && git merge --ff-only upstream/dev && git push origin dev --tags
git switch baokey && git merge dev
```

## The loop

```sh
cd xous-core && cargo xtask baosec-lite maki-launcher vault2 maki-link && cd ..   # ~6 min cold, ~3 warm
scripts/emu.sh 3G,4G                                                             # ~2 min for 4G instructions
```

What's where in the fork:

| Path | What |
|---|---|
| `apps-baosec/maki-launcher` | boot image, home screen (name, link dot, clock), input focus |
| `apps-baosec/vault2` | the upstream vault, registered with the launcher |
| `services/maki-link` | the serial end of the desktop link: time sync, link state |
| `libs/maki-proto` | the protocol (framing, messages, device logic) and `PROTOCOL.md`; `examples/fake_maki.rs` |
| `libs/roughtime` | draft-19 request builder and verifier, tested against live server answers |

Host-side tests need no badge: `cargo test -p roughtime -p maki-proto`. The desktop app's tests
drive the real protocol logic through `fake_maki`; see its README.

The emulator has no USB, so maki-link sits idle there; the link is exercised end to end against
`fake_maki` instead.

Screenshots land in `.emu/shots/*.png`. Buttons for `--press N@T`: `0` Down,
`1` Select, `2` Up, `3` Right, `4` Left, `5` Center. The emulator runs at roughly
30 million instructions per second, so `1G` ≈ 30 s of wall clock.

First boot of a fresh image, as observed: the PDDB finds blank flash, formats and mounts
**with no prompt**, swap encryption comes on, and the BAOKEY home screen is up by ~3G.
Every emulator run starts from blank flash, so every run is a first boot.

Launcher regression check (home → Vault → Vault Menu → Home screen → home → Vault):

```sh
scripts/emu.sh 3G,3.6G,4.1G,5G,5.6G,6.4G --press 1@3.1G --press 1@3.7G \
  --press 0@4.2G --press 0@4.35G --press 0@4.5G --press 0@4.65G --press 0@4.8G \
  --press 1@5.1G --press 1@5.8G
scripts/montage.py flow.png 3 .emu/shots/*.pgm   # the six frames as one image
```

The launcher logs `bringing 'Vault' to the front` and `'Vault' returned to the home
screen` on each change. Reading screenshots: the vault's TOTP view with no codes stored
shows `✕✕✕✕✕✕` in the code box, with the white bar under it as the 30-second countdown.

The first cold build signs with the post-quantum developer key (SLH-DSA), which is
slow; later builds reuse `devkey/dev-pq.cache`.

## Two emulators

- **Baomulator** (`scripts/emu.sh`) runs the real RISC-V images, loader onward:
  signatures, MMU, swap encryption, PDDB, OLED, buttons, camera. Use it to test
  exactly what would be flashed.
- **Hosted mode** (`cargo xtask baosec-emu`) runs each service as a native x86 process
  with the OLED in a desktop window. Much faster to iterate on UI, but it isn't the
  real binary.

## The badge on this machine

A DC34 badge is usually plugged in here (serial `K402TS`, stock firmware, `/dev/ttyACM0`). It shares
maki's USB IDs. The desktop app sends it at most one inert HELLO per session (no line ending, so the
stock console never runs anything) and then leaves it alone. Don't flash it: that's the one-way door.

## Known issues (firmware)

- **Swapper handler stack.** With the launcher's boot image and clock in the image, the
  swapper overflowed its 8 KiB private handler stack during boot, faulting inside the panic
  printer (which alone needs ~20 KiB, so at 8 KiB no swapper panic can ever be reported). The
  fork raises it to 32 KiB in `loader/src/phase2.rs`. Deterministic in the emulator: 2 pages
  always faults, 8 never does. Why the handler needed more than 8 KiB is not yet understood.
  Worth an upstream issue once we know more.

## Boot sequence

Baochip's loader logo ("bao", with a progress bar) → the BAOKEY boot image (at least 1.5 s)
→ on first boot only, the PDDB's "Cryptographic wipe" progress → the home screen. The boot
image is drawn by `apps-baosec/baokey-launcher/assets/splash.py`; rerun it after editing.
The loader is part of our build, so its logo could be replaced too.

## Emulator fidelity notes

- **Developer mode.** Baomulator starts at the loader and never runs `boot1`, so it
  can't cross the developer-mode door itself, and a developer-signed build dies with
  *"Kernel is devkey signed, but system is not in developer mode."* Our patch adds
  `emu_set_owc()` and `shot --dev-mode`, which presets one-way counter 85
  (`DEVELOPER_MODE`) before the first instruction. The loader's check is in
  `xous-core/loader/src/main.rs` (it also accepts an erase proof or an uninitialized
  counter 84).
- **Collateral.** The keystore logs *"Collateral is not erased - protocol error for
  Baochip firmwares!"* On hardware, `boot0` erases the collateral bank on every boot
  under a Baochip-signed `boot1`; the emulator never runs `boot0`. Harmless for now;
  modelling it means pre-filling slots 261–264 with the erase value.
- **Licensing.** Baomulator has no license file, so all rights are reserved: use it
  locally, don't vendor or redistribute it. Our patch is ours and could be offered
  upstream.
