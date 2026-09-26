# Development

How to build BAOKEY firmware and run it without a badge. Everything here was run
on 2026-09-25 on Fedora 44 with Rust 1.96.0.

## Layout

```
BAOKEY/
├── xous-core/          our fork: upstream betrusted-io/xous-core `dev`, branch `baokey`   (gitignored clone)
├── tools/baomulator/   zst123/dc34_baomulator, full-system badge emulator            (gitignored clone)
├── patches/baomulator/ our changes to the emulator, applied on top of the clone
├── scripts/emu.sh      build → emulate → PNG screenshots, in one command
└── .emu/               emulator build output and screenshots                         (gitignored)
```

## One-time setup

```sh
# firmware source (reuses BAOSEC's objects, so it's quick)
git clone --reference ~/Projects/BAOSEC/xous-core --dissociate --branch dev \
    https://github.com/betrusted-io/xous-core.git xous-core
git -C xous-core switch -c baokey

# emulator
git clone https://github.com/zst123/dc34_baomulator.git tools/baomulator
git -C tools/baomulator apply "$PWD"/patches/baomulator/*.patch
```

The Xous toolchain (`riscv32imac-unknown-xous-elf`) must match your `rustc` exactly;
see `~/Projects/BAOSEC/SETUP.md`. Tags are required for image creation, and a normal
clone has them.

## The loop

```sh
cd xous-core && cargo xtask baosec-lite vault2 && cd ..   # ~6 min cold, faster warm
scripts/emu.sh 3G,4G,5G,10G --press 1@4.1G                 # ~5 min for 10G instructions
```

Screenshots land in `.emu/shots/*.png`. Buttons for `--press N@T`: `0` Down,
`1` Select, `2` Up, `3` Right, `4` Left, `5` Center. The emulator runs at roughly
30 million instructions per second, so `1G` ≈ 30 s of wall clock.

First boot of a fresh image, as observed:

| Instructions | What happens |
|---|---|
| ~3G | PDDB finds blank flash and prompts (screen shows a masked field, see below) |
| press Select | Cryptographic format runs, 0→100% |
| ~5G | PDDB mounts, swap encryption on, `vault2` menu on screen |

The first cold build signs with the post-quantum developer key (SLH-DSA), which is
slow; later builds reuse `devkey/dev-pq.cache`.

## Two emulators

- **Baomulator** (`scripts/emu.sh`) runs the real RISC-V images, loader onward:
  signatures, MMU, swap encryption, PDDB, OLED, buttons, camera. Use it to test
  exactly what would be flashed.
- **Hosted mode** (`cargo xtask baosec-emu`) runs each service as a native x86 process
  with the OLED in a desktop window. Much faster to iterate on UI, but it isn't the
  real binary.

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
- **The masked-field screen** at ~3G on first boot is not identified yet. The PDDB's
  format prompt says a PIN will be created, so it is probably PIN entry, which would
  mean one Select press accepted a default. Needs checking before anything real is
  stored.
- **Licensing.** Baomulator has no license file, so all rights are reserved: use it
  locally, don't vendor or redistribute it. Our patch is ours and could be offered
  upstream.
