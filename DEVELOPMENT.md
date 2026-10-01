# Development

How to build maki's firmware and run it without a badge. Everything here was run
on 2026-09-25 on Fedora 44 with Rust 1.96.0.

## Layout

```
maki/
├── xous-core/          our fork: KaraZajac/maki-firmware, branch `maki`                   (gitignored clone)
├── desktop/            the desktop app: KaraZajac/maki-desktop                           (gitignored clone)
├── apps/               the maki store: KaraZajac/maki-apps                               (gitignored clone)
├── tools/baomulator/   zst123/dc34_baomulator, full-system badge emulator            (gitignored clone)
├── patches/baomulator/ our changes to the emulator, applied on top of the clone
├── scripts/emu.sh      build → emulate → PNG screenshots, in one command
└── .emu/               emulator build output and screenshots                         (gitignored)
```

## One-time setup

```sh
# firmware source: our fork, whole (the build needs upstream's tags). With a clone of
# xous-core already on the machine, `--reference PATH --dissociate` saves the download.
git clone --branch maki https://github.com/KaraZajac/maki-firmware.git xous-core
git -C xous-core remote add upstream https://github.com/betrusted-io/xous-core.git
git -C xous-core fetch upstream --tags

# emulator
git clone https://github.com/zst123/dc34_baomulator.git tools/baomulator
git -C tools/baomulator apply "$PWD"/patches/baomulator/*.patch

# the desktop app, and the maki store
git clone https://github.com/KaraZajac/maki-desktop.git desktop
git clone https://github.com/KaraZajac/maki-apps.git apps
```

The Xous toolchain (`riscv32imac-unknown-xous-elf`) must match your `rustc` exactly:
`cargo xtask install-toolkit`, in `xous-core`, installs the betrusted-io/rust release that
does (after a `rustup update`, run it again). The build stamps its version from upstream's git tags
and fails without them, which is why the fork is its own repo rather than a folder in
this one.

## The fork

`KaraZajac/maki-firmware` holds upstream's full history and has two branches: `dev`, an
untouched mirror of upstream `dev`, and `maki`, where our work goes. **GitHub Actions is
switched off on it**: upstream's workflows would otherwise run on every push (two of them
trigger on any branch), building upstream's targets rather than ours. Turn it back on
deliberately if we want our own CI.

Syncing with upstream:

```sh
cd xous-core
git fetch upstream --tags
git switch dev && git merge --ff-only upstream/dev && git push origin dev --tags
git switch maki && git merge dev
```

## The loop

```sh
cd xous-core && cargo xtask baosec-lite maki-launcher~flash maki-keys vault2 maki-link maki-apps maki-app-host && cd ..   # ~6 min cold, ~2 warm
scripts/emu.sh 3G,4G                                                             # ~2 min for 4G instructions
```

`~flash` builds the launcher into the kernel's image in RRAM, beside the PDDB and the
display, rather than into swap: code there runs in place, so the launcher, which wakes for
every press, never pages its code through RAM. The RRAM holds about 3.38 MB for that image, and
it's 3.06 MB with the launcher; nothing else of ours fits (the app host is 1.46 MB).

What's where in the fork:

| Path | What |
|---|---|
| `apps-baosec/maki-launcher` | boot image, the home carousel, input focus, menus, the PIN and setup screens, and asks (`Launcher::ask`, `Launcher::review` with pages) shown over whatever is in front |
| `apps-baosec/maki-app-host` | apps you install (ARCHITECTURE.md, "Apps you can install"): checks `.maki` bundles and asks the owner before installing or removing one, keeps them and their data in the secret basis (`maki.apps`, `maki.app.<id>`, `maki.data.<id>`), puts them on the home screen, and runs the one in front, below maki's bar: in `maki-wasm`, or a native app in a process of its own, served over IPC (`src/native.rs`); App info in each app's menu |
| `apps-baosec/maki-spawn` | the stub a native app's process starts as: loads the app's ELF, connects to the app service, the ticktimer and the log, confines itself and jumps to the app. Built apart by `build-stub.sh` into `maki-app-host/src/spawn.bin`, which is checked in (a rebuild gives the same bytes) |
| `libs/maki-native` | native apps: the ELF check, the stub's load request, the app service's operations and the drawing a native app sends |
| `libs/maki-app-host-api` | how maki-link asks the app host to install, list and remove apps |
| `libs/maki-bundle` | the `.maki` format, host-tested and fuzzed: manifest, code, icon, Ed25519 signature; permissions and their warnings; who may update an app |
| `libs/maki-wasm` | the WebAssembly host core, host-tested: wasmi, maki's functions for apps (API 1: drawing in maki's fonts, events, storage, time, randomness; and behind their permissions, asks, keys, typing and messages from the computer; API 2: BIP340 Schnorr and X25519 keys; API 3: the wallet permission's keys, locked to the manifest's paths, and reviews with pages, whose yes allows the signatures it names; API 4: Monero's keys and subaddresses, and backup words maki shows its owner itself; API 5: spending Monero, the view key after a yes, key images with their proofs, and whole transactions made and signed by maki; API 6: Ed25519 wallets, Solana's, a key by SLIP-10 and signatures over whole messages, a wallet held to its manifest's curve) in `Session`, which native apps' requests go through too, fuel, memory and storage limits, `admit` (what maki takes, of either kind); the same code runs in the SDK's simulator and the fake maki |
| `sdk/` | its own workspace: `maki-app` (the crate apps are written with), the `maki` tool (keygen, build, pack, inspect, run in a terminal simulator, store records, reproduce), twenty-five example apps (Hello, Dice, Tally; Signer, which asks, signs and types; Sensors; SSH, maki's SSH key and certificate authority for maki desktop's SSH agent and `maki-ssh-keygen`; Nostr; Age, maki's age key for maki desktop's `age-plugin-maki`; OpenPGP, for `maki-gpg`; Minisign, for `maki-minisign`; Notes; Contacts; Scanner; Wi-Fi; Passphrase; Snake, Marble and Breakout; Status; Bitcoin, Ethereum, Monero and Solana, maki's wallets; Hello Native and Pomodoro, built as native apps); see `sdk/README.md` |
| `apps-baosec/maki-apps` | maki's own apps, sharing one process to spare memory: now just Passkeys (the passkeys the vault's authenticator holds, listed, and deleted with the owner's yes). The wallets are store apps (`sdk/examples/bitcoin`, `ethereum`, `monero`, `solana`) |
| `libs/maki-fido` | the FIDO store's records as maki reads them (credential IDs, sites, users): for backups and the Passkeys app |
| `libs/maki-eth` | Ethereum, for the Ethereum app, host-tested: the BIP44 account (its keys through `maki-hd`), EIP-55, strict RLP, EIP-1559 and EIP-155 transactions, EIP-191 messages and EIP-712 typed data, reviewed and signed; tested against alloy |
| `libs/maki-sol` | Solana, for the Solana app, host-tested and fuzzed: base58 addresses; a transaction's message (legacy and version 0) read as Solana's runtime reads it and refused where it would refuse it; the pages its owner reads (SOL and tokens sent, a token's recipient as their own address when the transaction proves the token account is theirs, new accounts, approvals and handing over flagged, memos, durable nonces, the most the fee can be, any other program flagged with whether it's given the account's signature) and a message's (Sign In With Solana checked against the site); held to transactions @solana/web3.js and @solana/spl-token made (`tests/fixtures/make.mjs`), maki's signatures to theirs byte for byte |
| `libs/maki-ui` | the keys and drawing every maki screen shares: status bar, action bar, arrows, icons, QR codes |
| `libs/maki-btc` | Bitcoin, for the Bitcoin app, host-testable: the BIP84 (native SegWit) and BIP86 (taproot) accounts (their keys through `maki-hd`), addresses, descriptors, PSBT parsing (BIP174, BIP371), the checks before signing, signing (ECDSA, BIP340 Schnorr); tested against rust-bitcoin, miniscript and Bitcoin Core's consensus code |
| `libs/maki-hd` | the wallets' keys: BIP32 paths, and the `Keys` a wallet signs with (public keys, ECDSA with RFC 6979, BIP340 Schnorr with the BIP86 tweak); `seed` (a feature) derives them from the seed, which only maki-keys holds, Monero's from its coin type's key (through `maki-xmr`), and Ed25519 keys by SLIP-10 (Solana's), signing whole messages; apps reach it through the app host, on their manifest's paths alone; tested against rust-bitcoin, and SLIP-10's own vectors |
| `libs/maki-xmr` | Monero, for the Monero app, host-tested: Monero's base58 addresses and subaddresses (integrated ones too); `request`, what maki is asked to sign and the pages its owner reads; `tx`, a transaction's bytes and hashes, held to a mainnet transaction. With `keys`, the account Ledger's Monero app makes from the phrase (the key at `m/44'/128'/0'/0/0`, hashed), its subaddresses and its 25-word backup (English list, Monero's checksum), for maki-keys; tested against monero-rs, and against Ledger's and monero-python's vectors for the test phrase. `sign`: Monero's hash onto the curve, key derivations, view tags, outputs' one-time keys, amounts and commitments, key images and CLSAG, held to Monero's own test vectors (`tests/monero-crypto.txt`), monero-rs and monero-oxide's verifier; `bulletproof`, the range proof (Bulletproofs+); `spend`, the whole transaction from a request, as wallet2 makes one, held to monero-oxide (its hash, the message signed, every CLSAG and range proof, the balance) and monero-rs (each payment found by whoever it pays) |
| `apps-baosec/vault2` | the upstream vault, registered with the launcher; `src/link.rs` answers the browser's requests for logins and codes |
| `services/maki-link` | the serial end of the desktop link: time sync, link state, and handing requests to the vault |
| `libs/maki-proto` | the protocol (framing, messages, device logic) and `PROTOCOL.md`; `examples/fake_maki.rs` |
| `libs/maki-vault-api` | how maki-link asks the vault (one connection only, made at boot) |
| `services/maki-keys` | the boot PIN: the secret basis's key, wrapped under the PIN's, the wrong-try count and the wipe; the recovery phrase, backups (passkeys included), the FIDO keys, and the wallets' keys (`KeysOp::Wallet`, answered to the app host alone) |
| `libs/maki-icons` | the home screen's icons, drawn by `icons.py` |
| `apps-baosec/maki-launcher/assets/splash.py` | the boot image (a maki roll, and the name in the tall font); writes `src/splash.rs` |
| `libs/roughtime` | draft-19 request builder and verifier, tested against live server answers |

Host-side tests need no badge: `cargo test -p roughtime -p maki-proto -p maki-seed -p maki-hd -p maki-xmr -p maki-btc -p maki-fido -p maki-eth -p maki-sol -p maki-bundle -p maki-wasm -p maki-native -p maki-store -p maki-app-host-api -p maki-launcher-api-tests`.
The kernel's own tests run hosted (`cd kernel && cargo test`), confinement and `TerminateChild`
among them. The workspace builds against the fork's `xous-rs` (`[patch.crates-io.xous]` in
`Cargo.toml`), since maki's syscalls aren't in the published crate; `cargo xtask`'s check that
crates match crates.io skips patched ones.
The SDK builds apart (`cd sdk && cargo build -p maki && cargo build --release --target wasm32-unknown-unknown -p hello -p dice -p tally`); `libs/maki-wasm/tests/fixtures` holds the examples as `maki build` packs them, for the tests, the fake maki and the emulator demo. The desktop app's tests
drive the real protocol logic through `fake_maki`; see its README.

The emulator has no USB, so maki-link sits idle there; the link is exercised end to end against
`fake_maki` instead. On a badge, keys typed at the log server's serial console press maki's
buttons only in a build with `--feature bao1x-hal-service/key-injection` (the keyboard's
`keyboard_bouncer`); maki's own builds take presses from the buttons alone. Two build-time switches make the emulator easier to drive; neither is
compiled in unless set, so rebuild without them before flashing:

- `MAKI_DEMO=1`: every PIN position starts at 0 instead of a random digit (so a script can type
  a PIN blind), and asks wait six hours instead of seconds (`maki_launcher::ask_timeout`): the
  emulator skips through idle time, the faster the quieter maki is, so many device minutes can
  pass between two scripted presses.
- `MAKI_DEMO_ASKS=1`: maki-link queues four requests at boot as if the desktop had sent them
  (keep two logins for github.com, fill one for gist.github.com, keep one for a long hostname).
  They wait until maki is unlocked.
- `MAKI_DEMO_BACKUP=1`: once maki has its PIN and phrase, maki-link takes a backup through
  maki-keys and restores it, logging `demo backup: N bytes sealed` and `demo restore: ...`.
  The only way to exercise the backup's encryption on firmware without USB. With no USB there's
  no passkey either, so the backup gets a made-up one for demo.maki, taken out once sealed: the
  restore asks to bring it back (a page, then "restore"), and the Passkeys app then lists it.
- `MAKI_DEMO_APP=1`: once maki has its PIN and phrase, maki-link hands the app host two of the
  SDK's examples (Dice and Tally, from `libs/maki-wasm/tests/fixtures`) as if the desktop had
  sent them, each asking the owner to install it, then a copy of Hello changed after it was
  signed, which maki refuses, and logs `demo app ...` lines along the way.
- `MAKI_DEMO_PERMS=1`: once maki has its PIN and phrase, maki-link installs the SDK's Signer
  and SSH examples (each asks, with a page for each permission), then does what maki desktop's
  SSH agent does: asks the SSH app for its key (maki starts the app without the screen) and to
  sign a sign-in, which the app asks the owner about first. It logs `demo perms ...` lines.
- `MAKI_DEMO_SENSORS=1`: once maki has its PIN and phrase, maki-link installs the SDK's
  Sensors example (camera and motion). Opened, its level shows what the emulated accelerometer
  reads (flat: `0,0,1000`; our third Baomulator patch answers for the LIS2DH12), and its centre
  scans the QR code the emulator's camera shows (`test://baomulator`).
- `MAKI_DEMO_STORE=1`: once maki has its PIN and phrase, maki-link does what maki desktop does
  with the development store (below, "The maki store"): sets maki's clock and calls it verified
  (standing in for Roughtime, which needs the desktop's network), hands over root 2, installs
  Sensors from the store ("maki store" on the install screen) and Tally sideloaded, then hands
  over the revocation list, which revokes Tally. It logs `demo store ...` lines, among them
  Tally refused when it's sent again (`the maki store revoked it`).
- `MAKI_DEMO_CLOCK=1`: maki-link sets maki's clock at boot, as maki desktop would (Sunday 27
  September 2026, 22:38 at UTC-4), and calls it verified: the bar shows 22:38, and the
  screensaver has a time to show.
- `MAKI_DEMO_SAVER=1`: the screensaver, which the demos otherwise leave out (the emulator's clock
  runs far ahead while everything waits, so a minute goes by between scripted presses and each
  would only wake the screen). With `MAKI_DEMO_CLOCK`, the welcome screen gives way to 22:38 a
  moment after it appears, and a press brings it back (the launcher logs `resting: the clock`).
- `MAKI_DEMO_NATIVE=1`: once maki has its PIN and phrase, maki-link installs the SDK's Hello
  Native (Hello built as a native app, from `libs/maki-native/tests/fixtures`). Opened, it runs
  in a process of its own, and the app host logs `running in PID N, confined`.
- `MAKI_DEMO_EXAMPLES=1`: once maki has its PIN and phrase, maki-link installs the SDK's Status
  and Passphrase (each asks, with two pages for its permission): a sign in big letters, and
  diceware words, the second one starting at two pages of memory (below).
- `MAKI_DEMO_WALLET=1`: once maki has its PIN and phrase, maki-link installs the SDK's Bitcoin,
  Ethereum, Monero and Solana apps (each asks, with a page for each permission and one naming the
  wallet's accounts), then does what maki desktop does with them: shares the Bitcoin account, shows
  receive address #0 to compare, and sends the fixture PSBT (`libs/maki-btc/tests/fixtures`) to
  review and sign; the same for the taproot account; then connects a site, demo.maki, to the
  Ethereum app, which signs a message, a transaction (0.05 ETH on Ethereum) and typed data (a
  permit to spend 1 USDC), checked against `libs/maki-eth/tests/fixtures`; then the Monero app
  shows three addresses to compare, checked against Ledger's and monero-python's, and spends as
  maki desktop has it: it lets the computer watch the wallet (the view key, checked), makes an
  output's key image, and makes and signs a transaction of two of the test phrase's outputs,
  1.5 XMR paid and the change back (`libs/maki-xmr/tests/fixtures`); then connects demo.maki to
  the Solana app (Phantom's account for the test phrase) and has it sign a USDC payment
  @solana/web3.js made (`libs/maki-sol/tests/fixtures`), checked against web3.js's signature.
  It logs `demo wallet ...`
  lines, `as expected: true` where a signature is the one maki's wallet code makes on a computer
  (taproot's take fresh randomness, so there it's `as expected: false, but for fresh signatures:
  true`; a Monero transaction's are all fresh). The fixtures belong to the BIP39 test phrase:
  restore that at setup (below).
- `MAKI_DEMO_XMR_BENCH=1`: 20 s after it starts, maki-keys times the curve work spending Monero
  takes (`maki_xmr::sign`), the range proof and a whole transaction (`maki_xmr::spend`: two
  inputs, a payment and change), on made-up keys, and logs `xmr bench: ...` in maki's own time. No
  setup needed: run to 24G. In the emulator (10 ns an instruction): the hash onto the curve
  65 ms, a scalar multiplication 36 ms, a key image 126 ms, a CLSAG over a ring of 16 about 3.0 s,
  the range proof for two outputs 14.3 s (its 256 generators 10.9 s more, the first time after
  maki unlocks: maki-keys keeps them), the whole transaction 21.8 s. On a computer, for
  comparison (`cargo run --release -p maki-xmr --features keys --example bench`): 0.30 ms,
  0.10 ms, a CLSAG 9.5 ms, the range proof 22.3 ms, the transaction 36.4 ms. To measure on a
  badge. The range proof is also what maki-keys' heap is sized for (`tests/memory.rs`): about
  280 KiB at its peak for two outputs, 1.7 MiB for sixteen, where Xous gives a process 512 KiB
  unless it asks for more; maki-keys asks for 2.5 MiB.
- `MAKI_DEMO_SUDO=1`: once maki has its PIN and phrase, maki-link installs the Sudo and Bitcoin
  apps, then does what maki desktop's sudo plugin and its Bitcoin page do: asks about a command
  (`/usr/bin/systemctl restart nginx`, with an `LD_PRELOAD` set on its command line, which maki
  shows on a page of its own), adds the fixture 2-of-3 multisig wallet (`libs/maki-btc/tests/fixtures`,
  maki's key among its three: every key on a page, maki's marked) and has its PSBT signed, the
  wallet named on the first page. It logs `demo sudo approve: status Some(0), signed: true`,
  `demo sudo multisig add: status Some(0)` and `demo sudo multisig sign: status Some(0), as
  expected: true` (the very PSBT maki-btc signs on a computer). With `--answer --answer-shots`,
  every page of the three reviews is on file.
- `MAKI_DEMO_MANY=1`: once maki has its PIN and phrase, maki-link installs all twenty-three
  WebAssembly examples in `libs/maki-wasm/tests/fixtures` (each asks), more than one answer to a
  list holds, then lists them, and asks for the last as maki desktop's Apps page does. It logs
  `demo many list: result 0, 23 of 23 apps, as expected: true`. It found a leak in swap: a page
  unmapped while it was out in swap kept its swap page, a few dozen pages with every install, and
  the fifteenth filled swap, which the swapper can't survive in a hard OOM. Now the kernel says
  which pages those were (`SwapAbi::TakeFreed`) and the swapper frees them, and swap holds at
  about 1,750 of its 2,040 pages with all twenty-three installed. The swapper can't print (its
  UART is compiled out): its panics come out through the kernel, as `swapper: panicked at
  xous-swapper/src/main.rs:LINE`.
- `MAKI_DEMO_UPDATE=1`: once maki is unlocked, maki-link asks to restart into update mode as maki
  desktop would (UPDATE_MODE, for `preview-2026-10-01`), so maki-keys' question can be seen and
  answered. A yes logs `update mode: 0` and `restarting into update mode`; the emulator ignores
  the restart itself (`SYSCTRL reset requested (ignored)`) and has no boot1 to wait in update
  mode, so the rest is the badge's.

Screenshots land in `.emu/shots/*.png`. Buttons for `--press N@T`: `3` is maki's left, `4` its
right and `5` the centre; `3` and `4` together are the menu. (Baomulator names `3` and `4` the
other way round, as Right and Left.) The emulator runs at
roughly 30 million instructions per second, so `1G` ≈ 30 s of wall clock.

For RAM and CPU questions, our second Baomulator patch adds two `shot` options, which
`scripts/emu.sh` passes through: `--sample FROM:TO:STEP` notes which process is running every
STEP instructions (`samples.txt`: instructions, PID, privilege, waiting for an interrupt, PC;
`nm` on the ELFs in `target/` turns PCs into functions), and `--rpt AT` dumps the kernel's page
ownership table at AT instructions (`rpt.txt`: page, PID, flags with wired as bit 0, virtual
address, and the kernel's page clock), which shows who holds RAM, and what's wired.

Our fourth patch has `shot` answer maki's asks itself. With `--answer [GAP]`, from when the
launcher logs `showing the ask from ...` until it logs the ask answered, `shot` presses the
centre every GAP instructions (100M if not given): through the ask's pages to its first answer
(install, sign, share, the first login offered). Presses the launcher ignores, coming too soon
after the ask appeared (it lets an ask settle first, so a press meant for what was there before
can't answer it), or that a busy maki misses, just mean one more. `--answer-shots` takes a frame
just before each of those presses, and one after the answer, so every page of every ask is on
file. A demo with many asks needs no timings measured then, only setup's presses.

First boot of a fresh image, as observed: the PDDB finds blank flash, formats and mounts
**with no prompt**, swap encryption comes on, and maki's home screen is up by ~3G.
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

When the first screen appears depends on how many processes boot and how big the image is:
with maki-apps in the image it's about 2.8G rather than 2.3G, and with maki-app-host too about
4.1G (`OFFSET=2.0` for the script below). Take a few screenshots early to find it, and shift the
presses to match.

`scripts/presses-test-phrase.sh` prints the presses that restore the BIP39 test phrase
("abandon" eleven times, then "about") with PIN 000000 in a `MAKI_DEMO` build: restore from
phrase, the PIN twice, 12 words, each word typed a letter at a time until it can be picked.
`OFFSET` shifts them all (in G). It ends at 10.0G + `OFFSET` on "Phrase restored". Asks wait
until setup is over, so the centre first continues to the home screen. With `MAKI_DEMO_WALLET`,
`--answer` does the rest, installing the four apps and saying yes to everything they ask:

```sh
MAKI_DEMO=1 MAKI_DEMO_WALLET=1 cargo xtask baosec-lite maki-launcher~flash maki-keys vault2 maki-link maki-apps maki-app-host
bash -c 'mapfile -t P < <(OFFSET=2.0 scripts/presses-test-phrase.sh); P+=(--press 5@12.3G+2M)
  scripts/emu.sh 80G "${P[@]}" --answer --answer-shots --console-final 900000' | grep "demo wallet"
```

Setup is over by 12.3G. Bitcoin's install screen is up by 13.3G, Ethereum's by 15.8G and Monero's
by 18.0G (Solana's, fourth, puts what follows about 2.5G later than this says); Bitcoin's reviews
follow from 21.8G (the account, the address, the PSBT; taproot's from
28.7G), then, once the Bitcoin app has given way, Ethereum's from 36.4G (connect, the message, the
transaction, the permit), then Monero's from about 47.1G (three addresses, logged as
`network/index`: network 0 is Monero's own and 2 its stagenet; index 0 is the primary address and
1 the first subaddress), then watching from 50.8G (Watch only, and the address), and the
transaction from 53.1G (Send 1.5 XMR and where to, the change back to you, the fee, then the total
to sign and spend). From the yes at 53.6G maki is back at its home screen while it makes and signs
the transaction, about 3.3G more (a third of it the range proof's generators, the first time): done
by about 57G. Then Solana's, from about 73G (the app takes a while to start: some 10 s of maki's
time for its 95 KB of code): connect, then the USDC payment (who asked, the recipient's new token
account for it, the payment and whose account it goes to, the most the fee can be, then sign and
send), signed by about 77G. Among the `demo wallet` lines:

```
demo wallet btc signed: 1048 bytes, as expected: true, but for fresh signatures: true
demo wallet btc taproot signed: 702 bytes, as expected: false, but for fresh signatures: true
demo wallet eth message: status Some(0), as expected: true
demo wallet eth signed: 117 bytes, as expected: true
demo wallet eth typed: status Some(0), as expected: true
demo wallet xmr address 0/0: status Some(0), as expected: true
demo wallet xmr address 2/0: status Some(0), as expected: true
demo wallet xmr address 0/1: status Some(0), as expected: true
demo wallet xmr watch: status Some(0), the view key as expected: true
demo wallet xmr key image: status Some(0), 97 bytes
demo wallet xmr signed: 2273 bytes, a transaction of two inputs: true
demo wallet sol account: status Some(0), Phantom's: true
demo wallet sol sign: status Some(0) [], as web3.js signs it: true
```

For the Monero backup words as well, open the app once the demo is done, to the right three times
and the centre (`--press 4@80G+2M --press 4@80.1G+2M --press 4@80.2G+2M --press 5@80.4G+2M`),
then its menu, left and right together, and the centre for its first item, Backup words (`--press
3@84G+2M --press 4@84G+2M --press 5@84.4G+2M`), and run to 88G. maki asks first, then shows the
words a page each: the 25 Ledger's Monero app shows for the test phrase, `tavern judge beyond
bifocals ... cunning doing jobs`. (Before Solana joined the demo, these came 20G sooner.)

`MAKI_DEMO_APP=1` installs Dice and Tally and opens Dice. With the test phrase's presses
(`OFFSET=2.0`, for the app host): continue to the home screen at 12.3G; five presses of the
centre go through each install screen (the app, where it's from, the developer key, what it
needs, then install); two to the right and the centre open Dice. (The launcher logs `showing
the ask from Dice (6 stops)`: an install takes one press fewer than its stops, the last being
cancel.)

```sh
MAKI_DEMO=1 MAKI_DEMO_APP=1 cargo xtask baosec-lite maki-launcher~flash maki-keys vault2 maki-link maki-apps maki-app-host
bash -c 'mapfile -t P < <(OFFSET=2.0 scripts/presses-test-phrase.sh); P+=(--press 5@12.3G+2M)
  for t in 14.7 14.8 14.9 15.0 15.1 17.3 17.4 17.5 17.6 17.7; do P+=(--press 5@${t}G+2M); done
  P+=(--press 4@19.5G+2M --press 4@19.6G+2M --press 5@19.7G+2M)
  scripts/emu.sh 14.6G,17.2G,21.0G "${P[@]}" --console-final 400000' | grep "demo app\|first frame"
```

Dice's install screen is up by 14.6G and Tally's by 17.2G. The log shows both installs
(`result 0`), the altered Hello refused (`result 3 'the signature doesn't match: changed since
it was signed'`), the list, and `first frame after 6689 ms` for Dice, up by about 20.5G.

`MAKI_DEMO_PERMS=1` shows the permissions: Signer's install takes nine presses of the centre
(the app, where it's from, the developer key, a page for each of its three permissions, one of
them running on to a second, what it needs, install) and SSH's ten. The SSH app's sign-in ask
then comes up on the home screen, under the app's own bar; four to the right and the centre open
Signer, whose centre asks before it signs, and whose menu item types (the emulator's USB takes
the keystrokes):

```sh
MAKI_DEMO=1 MAKI_DEMO_PERMS=1 cargo xtask baosec-lite maki-launcher~flash maki-keys vault2 maki-link maki-apps maki-app-host
bash -c 'mapfile -t P < <(OFFSET=2.0 scripts/presses-test-phrase.sh); P+=(--press 5@12.3G+2M)
  for i in $(seq 0 8); do P+=(--press 5@$(echo "14.7 + 0.1*$i" | bc)G+2M); done     # install Signer
  for i in $(seq 0 9); do P+=(--press 5@$(echo "17.3 + 0.1*$i" | bc)G+2M); done     # install SSH
  P+=(--press 5@21.5G+2M)                                                           # SSH: sign
  for t in 22.5 22.7 22.9 23.1; do P+=(--press 4@${t}G+2M); done; P+=(--press 5@23.3G+2M)  # open Signer
  P+=(--press 5@24.8G+2M --press 5@25.8G+2M)                                        # ask, sign
  P+=(--press 3@26.5G+2M --press 4@26.5G+2M --press 5@27.0G+2M)                     # menu, type
  scripts/emu.sh 21.4G,24.7G,25.7G,26.2G,28.0G "${P[@]}" --console-final 400000' | grep "demo perms\|typed"
```

The log shows both installs, `demo perms ssh keys: result 0` with the key, and `demo perms ssh
sign: result 0, 88 bytes, a signature: true`; the SSH app then ends by itself after 30 s with
nothing to do. Signer shows the same key as `maki run` in the SDK (both from the BIP39 test
phrase): `21b3e138b1d4cf60…`; the host logs `typed 16 characters: done`.

`MAKI_DEMO_SENSORS=1` installs Sensors (seven presses), then one to the left and the centre
open it: its level shows `x 0 y 0 z 1000`, and the centre scans. The camera's view fills the
screen, the emulator's camera shows a QR code, and Sensors shows what it says,
`test://baomulator`:

```sh
MAKI_DEMO=1 MAKI_DEMO_SENSORS=1 cargo xtask baosec-lite maki-launcher~flash maki-keys vault2 maki-link maki-apps maki-app-host
bash -c 'mapfile -t P < <(OFFSET=2.0 scripts/presses-test-phrase.sh); P+=(--press 5@12.3G+2M)
  for i in $(seq 0 6); do P+=(--press 5@$(echo "14.7 + 0.1*$i" | bc)G+2M); done     # install Sensors
  P+=(--press 3@15.8G+2M --press 5@16.0G+2M --press 5@17.5G+2M)                    # open it, scan
  scripts/emu.sh 14.6G,17.4G,18.5G "${P[@]}" --console-final 400000' | grep "demo sensors\|first frame\|scanned"
```

`MAKI_DEMO_STORE=1` installs Sensors from the development store and Tally sideloaded, with the
store's revocation list between them and opening Tally: Sensors' install says where from,
"maki store", in seven presses; Tally's, up by 17.2G, takes five; one to the left and the
centre then open Tally, and maki asks first: a page with the store's reason ("Revoked by the
maki store"), then "Open it anyway?" ("open anyway" or "don't"):

```sh
MAKI_DEMO=1 MAKI_DEMO_STORE=1 cargo xtask baosec-lite maki-launcher~flash maki-keys vault2 maki-link maki-apps maki-app-host
bash -c 'mapfile -t P < <(OFFSET=2.0 scripts/presses-test-phrase.sh); P+=(--press 5@12.3G+2M)
  for i in $(seq 0 6); do P+=(--press 5@$(echo "14.7 + 0.1*$i" | bc)G+2M); done     # Sensors, from the store
  for i in $(seq 0 4); do P+=(--press 5@$(echo "17.3 + 0.1*$i" | bc)G+2M); done     # Tally, sideloaded
  P+=(--press 3@18.0G+2M --press 5@18.2G+2M)                                       # open Tally
  scripts/emu.sh 14.8G,17.2G,19.0G "${P[@]}" --console-final 400000' | grep "demo store\|revoked"
```

The log shows root 2 taken (`root now 2`), both installs, the list taken (`list 1`) and not
again (`older than what maki has`), Tally refused when it's sent again (`the maki store revoked
it: ...`), and the list of apps with where each is from.

`MAKI_DEMO_NATIVE=1` installs Hello Native in five presses; two to the right and the centre
open it (the home screen is in name order), and its counter goes up each second. Left and right
together bring up its menu, and right, then the centre, choose Exit: the app sees Exit when it
next waits, returns, and its process ends:

```sh
MAKI_DEMO=1 MAKI_DEMO_NATIVE=1 cargo xtask baosec-lite maki-launcher~flash maki-keys vault2 maki-link maki-apps maki-app-host
bash -c 'mapfile -t P < <(OFFSET=2.0 scripts/presses-test-phrase.sh); P+=(--press 5@12.3G+2M)
  for i in $(seq 0 4); do P+=(--press 5@$(echo "14.7 + 0.1*$i" | bc)G+2M); done     # install
  P+=(--press 4@15.5G+2M --press 4@15.6G+2M --press 5@15.8G+2M)                    # open it
  P+=(--press 3@17.6G+2M --press 4@17.6G+2M --press 4@18.0G+2M --press 5@18.2G+2M)  # menu, Exit
  scripts/emu.sh 17.4G,17.8G,18.4G "${P[@]}" --console-final 400000' | grep "confined\|first frame\|exited\|stopped"
```

`MAKI_DEMO_EXAMPLES=1` installs Status and Passphrase, seven presses each (a page for each's
permission running on to a second); on the home screen, in name order, one to the left opens
Status. Right goes to the next sign, the centre lights the screen; left and right together, then
right twice and the centre, choose Exit from its menu; two to the left and the centre open
Passphrase, and right adds a word:

```sh
MAKI_DEMO=1 MAKI_DEMO_EXAMPLES=1 MAKI_DEMO_CLOCK=1 cargo xtask baosec-lite maki-launcher~flash maki-keys vault2 maki-link maki-apps maki-app-host
bash -c 'mapfile -t P < <(OFFSET=2.0 scripts/presses-test-phrase.sh); P+=(--press 5@12.3G+2M)
  for i in $(seq 0 6); do P+=(--press 5@$(echo "14.7 + 0.1*$i" | bc)G+2M); done     # install Status
  for i in $(seq 0 6); do P+=(--press 5@$(echo "17.5 + 0.1*$i" | bc)G+2M); done     # install Passphrase
  P+=(--press 3@19.0G+2M --press 5@19.2G+2M)                                       # open Status
  P+=(--press 4@21.2G+2M --press 4@22.0G+2M --press 5@22.8G+2M)                    # Busy, On a call; light
  P+=(--press 3@23.6G+2M --press 4@23.6G+2M --press 4@24.0G+2M --press 4@24.2G+2M --press 5@24.4G+2M)  # Exit
  P+=(--press 3@25.5G+2M --press 3@25.7G+2M --press 5@25.9G+2M)                    # open Passphrase
  P+=(--press 4@28.2G+2M)                                                          # a word more
  scripts/emu.sh 21.0G,21.8G,22.6G,23.4G,25.2G,28.0G "${P[@]}" --console-final 400000' | grep "demo examples\|first frame"
```

Both install (`result 0`); Status's first frame is up after about 8 s, Passphrase's after about
15 (its word list). The app host logs `heap up to 3072 KiB (from 512)` as it starts ("Known
issues", below).

With `MAKI_DEMO_ASKS` instead, the vault's four requests come after "continue"; space the
answers 0.7G apart (the vault saves each login before it sends the next request), then left and
right go round the home screen.



The launcher logs `bringing 'Authenticator' to the front` and `'Authenticator' exited from
its menu` as apps come and go, and maki-keys logs `PIN set`, `locked` and `unlocked`. Reading screenshots: the vault's TOTP view with no codes stored
shows `✕✕✕✕✕✕` in the code box, with the white bar under it as the 30-second countdown.

The first cold build signs with the post-quantum developer key (SLH-DSA), which is
slow; later builds reuse `devkey/dev-pq.cache`.

## The maki store

The store's design is in ARCHITECTURE.md ("The store"); its records are `libs/maki-store` in the
fork, and the `maki store` commands in the SDK make them. A store is a directory of files to
publish anywhere maki desktop can fetch them: `roots/1.bin`, `roots/2.bin`, ... (each root signed
to replace the one before), `revocations.bin`, `index.json` with `index.sig`, and the stamped
bundles under `apps/`.

**The maki store's repository** is [KaraZajac/maki-apps](https://github.com/KaraZajac/maki-apps),
cloned at `apps/`: each app's developer-signed bundle with an `app.toml` naming the commit it's
built from (the SDK's examples name this fork's), and the published store in `store/`, which is
where maki desktop fetches it from by default (on GitHub's file server). `scripts/lint.sh` checks
the rules for a submission (the files an app may have, its `app.toml`, its bundles' IDs, versions
and developer key), and `scripts/check.sh` rebuilds every app from its source and checks it with
`maki reproduce`, both with the maki tool `scripts/sdk.sh` builds from the commit
`scripts/sdk.txt` pins; its CI runs them on each pull request, for the apps it touches, and on
every app weekly. `scripts/publish.sh CATALOGUE.key DAYS` stamps each app's newest bundle, signs
the revocation list again if `revocations.txt` changed, and signs a new index, whose version is
the hour (UTC, YYYYMMDDHH) so it always goes up. It has 31 apps, the SDK's examples (all but
Hello, Hello Native and Signer); it's signed with the development keys, for ten years, as the
development store is. maki desktop reads it straight from GitHub; a store
in a private repository needs a token, `MAKI_STORE_TOKEN=$(gh auth token) npm --prefix desktop
run dev`. Its README says how an app gets in.

**The development store.** Until the real store opens, the firmware and maki desktop both start
from the development store's root: `xous-core/libs/maki-store/dev-store`, made by its `make.sh`
from keys that are never committed (they live outside the repos; anyone can make a new set and
run it again, since nothing flashed trusts them yet). Its root 2 replaces root 1's catalogue key,
so maki and maki desktop have to follow the chain before anything else checks out; its apps are
the SDK's examples, stamped; its revocation list revokes Tally up to version 2, which isn't in
it, to show a revocation covering a sideloaded app. Try it with the fake maki:

```sh
(cd xous-core && cargo run -p maki-proto --features fake --example fake_maki -- --clock-verified) &
MAKI_STORE=$PWD/xous-core/libs/maki-store/dev-store npm --prefix desktop run dev   # "connect to fake maki"
```

maki desktop hands the fake maki root 2 and the list as it links (its log says so), lists the
store's apps under Apps, and installs them as the store's. `MAKI_STORE` also takes an address
(`https://`, or `http://localhost` for a local server); without it maki desktop reads the maki
store's repository (above).

**The store's keys.** Before the store opens, Kara makes its real keys, offline:

1. On a computer that stays offline, with the SDK's `maki` built for it: three root keys and a
   catalogue key, `maki store keygen root1.key` and so on. Each prints its public key and 24
   words: write each root key's words on paper, and keep the three papers in different places.
   `maki store recover FILE` makes a key again from its words.
2. Root 1: `maki store root --version 1 --threshold 2 --keys root1.key,root2.key,root3.key
   --catalogue catalogue.key --expires-days 365 --sign root1.key,root2.key -o roots/1.bin`.
   Then delete the root key files, keeping their public keys (later roots name them); the
   catalogue key goes to wherever the store is run from.
3. The firmware and maki desktop carry root 1 in place of the development store's:
   `FIRST_ROOT` in `apps-baosec/maki-app-host/src/store.rs` (and the fake maki's, in
   `libs/maki-proto/examples/fake_maki.rs`), and `FIRST_ROOT` in `desktop/src/shared/store.ts`
   (base64). maki desktop's store address is `STORE` in `desktop/src/main/store-source.ts`.
4. The maki store's repository is published again with the real catalogue key
   (`apps/scripts/publish.sh`), its roots replaced by the real ones, and a short life: 30 days
   for the index, a few weeks for the revocation list, signed again before they run out.

Running it: `maki reproduce BUNDLE SOURCE` checks that a developer's bundle is what its source
builds to (with the Rust the source pins; the tool maps the paths a build would leave in the
code, the source's own, downloaded crates' and Rust's standard library's, to ones that are the
same on every machine, so a bundle reproduces anywhere); `maki store add DIR BUNDLE --catalogue
catalogue.key` stamps a reviewed bundle into the store and signs a new index; `maki store index
DIR --catalogue catalogue.key` signs the index again, which it needs within 30 days (maki desktop
won't use an expired one); `maki store revoke` signs a new revocation list, with a higher
`--version` than the last. Before the catalogue key expires, or if it's lost or stolen, a new
root names a new one: `maki store root --version N+1` with the next catalogue key, signed by two
root keys of the current root (recovered from paper, offline) and two of its own; then every
bundle is stamped again with the new catalogue key, and the revocation list and index signed
again. maki and maki desktop take a new root only when it's signed so.

**Releases in the index.** maki desktop updates maki's firmware and itself from the releases the
store signs into its index: `maki store index --releases releases.toml` (from the SDK at
`12547b8f6` or later). `releases.toml`, in the store's repository beside `revocations.txt`, names
the newest of each, `[firmware]` and `[desktop]`: its name (the tag, `preview-2026-10-01` or
`0.1.3`), its whole commit, its date, an https `notes` address, and its files under
`[[firmware.files]]` (exactly `loader.uf2`, `xous.uf2` and `swap.uf2`) or `[[desktop.files]]`
(each with a `platform`, `linux-x86_64`), each with its https `url` (the GitHub release's), its
`bytes` and its `sha256`. The tool checks it and `publish.sh` passes it when the file is there.
maki desktop takes a file only if it's that size and hash. A firmware release is tagged in the
fork (`git tag preview-2026-10-01`) before it's built, so the firmware names itself after it.

## The browser extension in the stores

The extension goes to addons.mozilla.org (listed: Firefox, Zen and the other Firefox browsers
install it from there and keep it up to date) and to the Chrome Web Store (Chrome, Brave, Vivaldi
and Edge install from it). Edge's and Opera's own stores aren't worth it: Edge takes wallets only
from verified companies, and Opera's reviews take months.

`desktop/scripts/extension-release.sh` builds what they take from a commit: the Firefox package,
a Chrome package for Load unpacked, one for the Chrome Web Store (no `key`: the store keeps its
own), and the source archive reviewers rebuild it from (with BUILD.md). It rebuilds the extension
from that archive and checks it comes out the same, byte for byte, and lints it with web-ext.
With an addons.mozilla.org API key in `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`, it also sends it
to Mozilla, with the source and `extension/amo-metadata.json` (the listing: its text, Privacy &
Security, MIT, needs extra hardware, desktop Firefox only, and notes for the reviewers), and
saves the signed package. The manifest declares, as Mozilla requires, what the extension hands
maki desktop, which Firefox counts as data leaving the browser: authentication info, browsing
activity, financial info and communications. The privacy policy both stores ask for is
[Privacy](docs/privacy.md), `https://maki.netslum.io/docs/privacy.html`.

Kara's part, once:

1. **Mozilla:** a Mozilla account with two-step sign-in; accept the developer agreement on
   addons.mozilla.org; make an API key (Tools, Manage API Keys). Then run the script with it.
   The first version goes through review, and is live on addons.mozilla.org once it passes.
2. **Chrome Web Store:** register as a developer (a one-time fee, two-step verification, the
   trader or non-trader declaration), then upload `maki-extension-VERSION-chrome-store.zip` by
   hand, with the listing (the icon, a screenshot, the description), the privacy tab (single
   purpose: the browser's side of maki; why it needs native messaging and its content scripts;
   no remote code; the data it handles), and the privacy policy's address. Reviews take days to
   weeks.
3. **After Chrome's first upload,** its dashboard shows the store's public key: it goes in
   `manifest.chrome.json` as `key` (so a Load unpacked build has the store's ID), and that ID
   goes into maki desktop's native messaging manifests beside the current one
   (`CHROME_EXTENSION_ID` in `desktop/src/main/browsers.ts` becomes a list).

## Two emulators

- **Baomulator** (`scripts/emu.sh`) runs the real RISC-V images, loader onward:
  signatures, MMU, swap encryption, PDDB, OLED, buttons, camera. Use it to test
  exactly what would be flashed.
  - **From boot0** (`bootrom`, patch 0005): with the IFR fuse region modelled, the emulator
    also runs the factory boot stages, so it can exercise the trust chain (reference-key check,
    developer mode, the collateral-key policy) without a badge. Give it the published boot
    images and factory blobs (`ci.betrusted.io/releases/latest/baochip/{bootloader,blobs}`):
    ```sh
    BAO_BOOT=/path/to/bootloader BAO_BLOBS=xous-core/bao1x-boot/blobs FW=.emu/fw \
      .emu/target/release/bootrom 1500000000
    ```
    With the v0.10.0 factory stages it reaches PDDB-mounted and logs `Collateral erased`
    (the boot1 manifest carries Baochip keys). maki's own countersigned boot1 (no Baochip
    keys) is what would preserve collateral instead — the point of the collateral work.
  - **The flash between runs** (patch 0009): `shot --flash-out FILE` keeps the external flash
    (the swap and the PDDB) at the end of a run, and `--flash-in FILE` starts from it
    (`FILE@0x400000` takes only the PDDB, keeping this build's swap: the whole flash would bring
    back the other build's swap-resident services too);
    `--owc SLOT=VAL` presets a one-way counter and `--show-owc SLOT` prints one at the end.
    Together they play someone putting an old copy of the flash back while the chip keeps its
    counters: that's how the PIN's on-chip try counter was tested (a `MAKI_DEMO` build, set up
    with `scripts/presses-test-phrase.sh`, PINs typed as presses).
- **Hosted mode** (`cargo xtask baosec-emu`) runs each service as a native x86 process
  with the OLED in a desktop window. Much faster to iterate on UI, but it isn't the
  real binary.

## The badge on this machine

A DC34 badge running stock firmware may be plugged in here (as `/dev/ttyACM0`). It shares
maki's USB IDs. The desktop app sends it at most one inert HELLO per session (no line ending, so the
stock console never runs anything) and then leaves it alone. Don't flash it: that's the one-way door.

## Known issues (firmware)

- **The app host's heap (fixed).** Xous starts a process with 512 KiB of heap at most, and a
  WebAssembly app's memory is the app host's heap, beside its compiled code and the bundle being
  checked. Passphrase, whose word list makes it start at two pages of memory, couldn't install
  in the emulator (`can't start: failed to instantiate memory: tried to allocate more virtual
  memory than available on the system`), though an app may have 1 MiB. The app host raises its
  limit to 3 MiB as it starts (`heap up to 3072 KiB (from 512)` in the log), as the PDDB raises
  its own; the swapper pages it like any other memory. The simulator and the tests don't have
  the limit, so an app that asks for more than a page of memory to start is worth a run in the
  emulator.

- **Swapper handler stack.** With the launcher's boot image and clock in the image, the
  swapper overflowed its 8 KiB private handler stack during boot, faulting inside the panic
  printer (which alone needs ~20 KiB, so at 8 KiB no swapper panic can ever be reported). The
  fork raises it to 32 KiB in `loader/src/phase2.rs`. Deterministic in the emulator: 2 pages
  always faults, 8 never does. Why the handler needed more than 8 KiB is not yet understood.
  Worth an upstream issue once we know more.

- **Out of memory at boot: a panic in the swapper (fixed).** With one more process in the image,
  boot stopped at `PANIC in PID 2: panicked at kernel/src/swap.rs:773: Nesting should not
  happen`. Traced with `--kernel-feature debug-swap` and progress markers in the swapper: the
  swapper made its hard-OOM handler's heap only after waiting for the log server, and a boot
  with many processes ran out of RAM first. The handler's `expect` on the missing heap panicked;
  the panic's logging made syscalls that let other processes run in the middle of the hard OOM;
  one page-faulted into swap, and the kernel, finding a swap operation already in progress,
  panicked. The fork's swapper now makes the heap, and does its boot dry run, before anything
  else, and if a hard OOM ever finds no heap it evicts in table order instead of panicking. An
  image with three extra idle processes boots. maki's own apps still share one process
  (`maki-apps`), which spares RAM. Worth sending upstream. (The swapper's `oom-doom` feature,
  which evicts ahead of time, doesn't compile in this version.)

- **The swapper's own server at boot (fixed).** Some images stopped at boot: the log server
  printed `PANIC in PID 2:` with no message after it (the swapper's report cut off), then the
  kernel panicked in `map_page_to_swapper` (no swapper left to page anything in). The swapper
  makes its server at boot, and the kernel gives a server a page with `map_zeroed_page`, which
  chose the page's address before finding it a physical page. Finding one could run the
  swapper, which maps memory of its own as it goes; when it was the swapper's own server, it
  could take the very address chosen, and mapping it then failed (`MemoryInUse`). Whether a
  boot ran out of memory at that moment depended on the image. The kernel now checks the
  address again once it has the page, and takes another if it's gone. Traced with a panic hook
  in the swapper that reported its panic's place through the kernel's console. Worth sending
  upstream.

- **Native apps and the kernel (fixed).** A native app is the first process started after
  boot, and ends while maki runs; three things went wrong once one ran:
  - The swapper records where each process's evicted pages went in page tables of its own, made
    by the loader for the processes in the image; one started later had none. Evicting one of
    its pages indexed past the end, the swapper panicked mid-OOM, and the kernel after it
    (`Nesting should not happen`). The fork's swapper makes a process's tables the first time
    it evicts one of its pages, and the kernel tells it which processes ended (`SwapAbi::
    TakeEnded`, new), so before it next evicts anything it frees what they had in swap and
    empties their tables for whatever gets the PID next. Keeping native apps' pages in RAM
    instead doesn't fit: about 300 of the 512 pages are wired already, and an app may ask for
    up to 256 more (1 MiB).
  - The kernel starts the swapper by making a syscall itself, as the process that ran out of
    memory or touched a swapped page. For a confined process that call was refused like any
    other it may not make, and the kernel retried it forever: maki froze the first time a native
    app needed a page while RAM was full. Calls made from supervisor mode are the kernel's, and
    confinement no longer applies to them.
  - A process slot could be used only once: ending a process left the slot naming its page
    tables, which went with its memory, so the next process given the PID was refused
    (`InternalError`), and the slot stayed allocated to nothing. An app opened a second time
    couldn't start. Ending a process now clears the slot.

- **RAM, and paging.** The badge has 2 MiB of RAM, 512 pages, and in the app demo about 295
  are wired for good: the kernel's 41; the swapper's 120, mostly shadow page tables (one for
  each 4 MiB of a process that has pages swapped out, and a root per process); and 8 to 10 for
  each process's own page tables and kernel pages. So every process costs pages before it does
  anything, and maki's share the other ~215. Measured in the emulator (`shot --sample` and
  `--rpt`, in our Baomulator patch):
  - Wake-ups were the worst of it. Anything that wakes on a timer pages its process back in and
    pushes out whatever runs, and there were plenty: vault2's TOTP pump (four times a second from
    boot, on screen or not), the keyboard's chord timer (every 40 ms), three vault2 threads
    polling maki-keys until unlock, the app host polling the lock through maki-keys (which read
    the PDDB each time), the launcher's clock (every second). An app, once opened, never drew
    its first frame. Now they all wait for something to happen, and new code should too: block
    on a message rather than poll, and don't tick while nothing's on screen.
  - The kernel handed out addresses for new mappings next-fit and never went back, so a process
    that maps and frees buffers (a memory message each time it calls a server) walked through
    its 256 MiB area, and each 4 MiB cost a page table, wired, for good: maki-keys got to 32.
    Fixed in the fork's kernel (freed addresses are used again, lowest first). Worth sending
    upstream.
  - The kernel dates a page by when it came in, not when it was last used, so hot pages go
    oldest first, and every eviction re-encrypts the page to a new swap slot, even code that
    never changed. Swapper time is mostly AES-GCM-SIV: POLYVAL in software (45%) and AES (29%).
    The fork's swapper takes other processes' pages before the needy one's, 12 at a time rather
    than 24. Next, and upstream-worthy: keep the swap copy of pages that can't have changed
    instead of re-encrypting them (needs the kernel to track writes), and something closer to
    least-recently-used.
  - Where it stands, in the app demo: the swapper does about 18% of the work from setup to the
    app; opening Dice costs it about 0.6 G instructions, paging the app host's code back in,
    and Dice's first frame comes 6.7 s after it's opened, in the emulator's time (10 ns an
    instruction). The badge runs at 700 MHz, so expect less there, but swap goes through the
    PSRAM, which the emulator doesn't time. To measure on a badge.
  - The wallet apps (1 MiB of memory each) feel it most. In `MAKI_DEMO_WALLET`, from the Bitcoin
    app's first ask (sharing the account) to its third (the transaction) takes about 3.5G
    instructions; with four logins saved first (`MAKI_DEMO_ASKS` too), about 11.5G, the same
    work paging against the vault's. To measure on a badge, with a real owner's logins and codes.
  - The preemption timer interrupts 100 times a second through bao1x-hal-service, even with
    nothing to run. A page or two of RAM, but most of what the CPU does while idle; on a
    battery it would matter.
  - Thread stacks aren't a problem: the kernel maps them on demand.

- **The app host is big.** Its code is 1.46 MB, most of it wasmi (the interpreter and its
  validator), against 1 MB for vault2 and 0.2 to 0.5 MB for maki's other processes; the swap
  image holding them is 3.47 MB of its 4 MiB. Release builds already optimise for size
  (`opt-level = "s"` for the whole workspace, which is why a per-crate override changed
  nothing), and it can't run from RRAM (0.3 MB left there). Worth a look: leaner wasmi features,
  and compiling an app's code eagerly at install, so opening it needs wasmi's executor but not
  its translator.

## Boot sequence

Baochip's loader logo ("bao", with a progress bar) → maki's boot image, a maki roll (at least
1.5 s) → on first boot only, the PDDB's "Cryptographic wipe" progress → setup, or the PIN → the
home screen. The boot image is drawn by `apps-baosec/maki-launcher/assets/splash.py`; rerun it
after editing. The loader is part of our build, so its logo could be replaced too.

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
- **Time while idle.** "10 ns an instruction" holds while something runs. While every process
  waits, maki's clock runs far faster than the instructions: Pomodoro's 25-minute focus ran out
  in under 0.8G, a minute or more of maki's time going by in each 0.05G. For anything timed,
  take screenshots close together, or go by the log.
- **Licensing.** Baomulator has no license file, so all rights are reserved: use it
  locally, don't vendor or redistribute it. Our patch is ours and could be offered
  upstream.
