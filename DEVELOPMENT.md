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
cd xous-core && cargo xtask baosec-lite maki-launcher maki-keys vault2 maki-link maki-apps && cd ..   # ~6 min cold, ~2 warm
scripts/emu.sh 3G,4G                                                             # ~2 min for 4G instructions
```

What's where in the fork:

| Path | What |
|---|---|
| `apps-baosec/maki-launcher` | boot image, the home carousel, input focus, menus, the PIN and setup screens, and asks (`Launcher::ask`, `Launcher::review` with pages) shown over whatever is in front |
| `apps-baosec/maki-apps` | maki's own apps, sharing one process to spare memory: Bitcoin (receiving addresses and the account key as QR codes and text) and Passkeys (the passkeys the vault's authenticator holds, listed, and deleted with the owner's yes) |
| `libs/maki-fido` | the FIDO store's records as maki reads them (credential IDs, sites, users): for backups and the Passkeys app |
| `libs/maki-eth` | the Ethereum account, host-tested: BIP44 keys, EIP-55, strict RLP, EIP-1559 and EIP-155 transactions and EIP-191 messages, reviewed and signed; tested against alloy |
| `libs/maki-ui` | the keys and drawing every maki screen shares: status bar, action bar, arrows, icons, QR codes |
| `libs/maki-btc` | the Bitcoin wallet, host-testable: BIP32/BIP84 keys, addresses, descriptors, PSBT parsing, the checks before signing, signing; tested against rust-bitcoin and Bitcoin Core's consensus code |
| `apps-baosec/vault2` | the upstream vault, registered with the launcher; `src/link.rs` answers the browser's requests for logins and codes |
| `services/maki-link` | the serial end of the desktop link: time sync, link state, and handing requests to the vault |
| `libs/maki-proto` | the protocol (framing, messages, device logic) and `PROTOCOL.md`; `examples/fake_maki.rs` |
| `libs/maki-vault-api` | how maki-link asks the vault (one connection only, made at boot) |
| `services/maki-keys` | the boot PIN: the secret basis's key, wrapped under the PIN's, the wrong-try count and the wipe; the recovery phrase, backups (passkeys included), the FIDO keys, and the Bitcoin account (`src/bitcoin.rs`) |
| `libs/maki-icons` | the home screen's icons, drawn by `icons.py` |
| `libs/roughtime` | draft-19 request builder and verifier, tested against live server answers |

Host-side tests need no badge: `cargo test -p roughtime -p maki-proto -p maki-seed -p maki-btc -p maki-fido -p maki-eth`. The desktop app's tests
drive the real protocol logic through `fake_maki`; see its README.

The emulator has no USB, so maki-link sits idle there; the link is exercised end to end against
`fake_maki` instead. Two build-time switches make the emulator easier to drive; neither is
compiled in unless set, so rebuild without them before flashing:

- `MAKI_DEMO=1`: every PIN position starts at 0 instead of a random digit (so a script can type
  a PIN blind), and asks wait 600 s instead of 30 (the emulator skips through idle time, so 30
  device seconds pass in a moment).
- `MAKI_DEMO_ASKS=1`: maki-link queues four requests at boot as if the desktop had sent them
  (keep two logins for github.com, fill one for gist.github.com, keep one for a long hostname).
  They wait until maki is unlocked.
- `MAKI_DEMO_BACKUP=1`: once maki has its PIN and phrase, maki-link takes a backup through
  maki-keys and restores it, logging `demo backup: N bytes sealed` and `demo restore: ...`.
  The only way to exercise the backup's encryption on firmware without USB. With no USB there's
  no passkey either, so the backup gets a made-up one for demo.maki, taken out once sealed: the
  restore asks to bring it back (a page, then "restore"), and the Passkeys app then lists it.
- `MAKI_DEMO_BTC=1`: once maki has its PIN and phrase, maki-link does what the desktop's
  Bitcoin section does: asks to share the account, shows receive address #0 to compare, and
  sends the fixture PSBT (`libs/maki-btc/tests/fixtures`) to review and sign, then logs
  `demo btc signed: N bytes, as expected: true` if the signature is the one maki-btc makes on a
  computer. The PSBT belongs to the BIP39 test phrase, so restore that at setup (below).

Screenshots land in `.emu/shots/*.png`. Buttons for `--press N@T`: `0` Down,
`1` Select, `2` Up, `3` Right, `4` Left, `5` Center. The emulator runs at roughly
30 million instructions per second, so `1G` ≈ 30 s of wall clock.

First boot of a fresh image, as observed: the PDDB finds blank flash, formats and mounts
**with no prompt**, swap encryption comes on, and the BAOKEY home screen is up by ~3G.
Every emulator run starts from blank flash, so every run is a first boot.

Every emulator run is a first boot, so it starts with PIN setup. With `MAKI_DEMO=1`, typing
000000 is six presses of the centre, left (to ✓), the centre; then the same again. Space the
presses 0.1G apart, and in zsh expand a variable holding several `--press` options as `${=P}`,
or they arrive as one argument and are ignored. This walks through setup, locks from maki's
menu, enters a wrong PIN, then the right one:

```sh
P="--press 5@2.3G+2M"; for t in 2.4 2.5 2.6 2.7 2.8 2.9; do P="$P --press 5@${t}G+2M"; done
P="$P --press 3@3.0G+2M --press 5@3.1G+2M"
for t in 3.2 3.3 3.4 3.5 3.6 3.7; do P="$P --press 5@${t}G+2M"; done
P="$P --press 3@3.8G+2M --press 5@3.9G+2M --press 5@4.7G+2M"                  # set, continue
P="$P --press 3@5.0G+2M --press 4@5.0G+2M --press 5@5.2G+2M"                  # menu, Lock
for t in 5.4 5.5 5.6 5.7 5.8; do P="$P --press 5@${t}G+2M"; done
P="$P --press 4@5.9G+2M --press 5@6.0G+2M --press 3@6.1G+2M --press 5@6.2G+2M" # 000001
for t in 6.9 7.0 7.1 7.2 7.3 7.4; do P="$P --press 5@${t}G+2M"; done
P="$P --press 3@7.5G+2M --press 5@7.6G+2M"                                     # 000000
scripts/emu.sh 4.9G,5.1G,5.3G,6.15G,6.3G,6.8G,7.55G,8.2G ${=P}
```

Presses: 3 is left (`←`), 4 is right (`→`): the emulator's labels have them the other way
round. Hold a tap for 2M instructions (`+2M`): the emulator's default of 20M is long enough
to count as a hold.

When the first screen appears depends on how many processes boot: with maki-apps in the
image it's about 2.8G rather than 2.3G. Take a few screenshots early to find it, and shift the
presses to match.

`scripts/presses-test-phrase.sh` prints the presses that restore the BIP39 test phrase
("abandon" eleven times, then "about") with PIN 000000 in a `MAKI_DEMO` build: restore from
phrase, the PIN twice, 12 words, each word typed a letter at a time until it can be picked.
`OFFSET` shifts them all (in G). It ends at 10.0G + `OFFSET` on "Phrase restored". Asks wait
until setup is over, so the centre first continues to the home screen. With `MAKI_DEMO_BTC`, the
Bitcoin asks follow: the centre answers the account and the address, then goes through the
transaction (Send, Change, Fee) and signs:

```sh
MAKI_DEMO=1 MAKI_DEMO_BTC=1 cargo xtask baosec-lite maki-launcher maki-keys vault2 maki-link maki-apps
bash -c 'mapfile -t P < <(OFFSET=0.6 scripts/presses-test-phrase.sh)
  for t in 10.9 11.8 12.2 12.6 12.8 13.0 13.2; do P+=(--press 5@${t}G+2M); done
  scripts/emu.sh 11.7G,12.1G,12.5G,13.5G "${P[@]}"' | grep "demo btc"
```

`MAKI_DEMO_ETH=1` does the same for Ethereum, for a site called demo.maki: connect, sign a
message, sign a transaction (0.05 ETH on Ethereum), checked against `libs/maki-eth/tests/fixtures`
(`demo eth signed: 117 bytes, as expected: true`). Deriving the account the first time is slow in
the emulator, so space the presses: continue at 10.9G, then 12.3 (connect), 12.8 and 13.1 (the
message: next, sign), 13.6, 13.8 and 14.0 (the transaction's pages) and 14.2 (sign), with
`OFFSET=0.6` as above.

With `MAKI_DEMO_ASKS` instead, the vault's four requests come after "continue"; space the
answers 0.7G apart (the vault saves each login before it sends the next request), then left and
right go round the home screen.



The launcher logs `bringing 'Authenticator' to the front` and `'Authenticator' exited from
its menu` as apps come and go, and maki-keys logs `PIN set`, `locked` and `unlocked`. Reading screenshots: the vault's TOTP view with no codes stored
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

- **Out of memory at boot: a kernel panic in the swapper.** With one more process in the image
  (the Passkeys app on its own), boot stopped at `PANIC in PID 2: panicked at
  kernel/src/swap.rs:773: Nesting should not happen`, after `Nesting HardOomSyscall(9, 8)
  false`: a hard out-of-memory request reached the kernel while the swapper was still busy with
  another, a case the kernel's comment calls vestigial. Every process carries its own runtime and
  stacks, and the badge is near its limit at boot, so maki's own small apps share one process
  (`maki-apps`). Reproduced with an idle process of a few lines added to the image, so it's the
  count, not what runs. With `--kernel-feature debug-swap` the sequence is: PID 8 (the HAL
  service) runs out of RAM and the kernel starts the swapper's hard-OOM eviction (`SwapOp(4)`,
  "hard_oom - userspace activate"); before it completes, PID 16 runs and page-faults on a page in
  swap (`SwapOp(3)`, RetrievePage), whose swapper call finds the first still marked in progress.
  The swapper's handler assumes nothing else runs until it finishes, and the IRQs are masked, so
  how PID 16 got scheduled is the open question. The swapper's proactive eviction (feature
  `oom-doom`, a thread that evicts below 48 free pages) would keep boot out of the hard-OOM path,
  but doesn't compile in this version (a `*mut u32` that isn't `Send`). Worth an upstream issue
  with this reproduction, and a fix before the app store adds processes.

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
