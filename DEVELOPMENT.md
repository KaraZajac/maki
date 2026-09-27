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
| `apps-baosec/maki-app-host` | apps you install (ARCHITECTURE.md, "Apps you can install"): checks `.maki` bundles and asks the owner before installing or removing one, keeps them and their data in the secret basis (`maki.apps`, `maki.app.<id>`, `maki.data.<id>`), puts them on the home screen, and runs the one in front in `maki-wasm`, below maki's bar; App info in each app's menu |
| `libs/maki-app-host-api` | how maki-link asks the app host to install, list and remove apps |
| `libs/maki-bundle` | the `.maki` format, host-tested and fuzzed: manifest, code, icon, Ed25519 signature; permissions and their warnings; who may update an app |
| `libs/maki-wasm` | the WebAssembly host core, host-tested: wasmi, maki's functions for apps (API 1: drawing in maki's fonts, events, storage, time, randomness; and behind their permissions, asks, keys, typing and messages from the computer), fuel, memory and storage limits, `admit` (what maki takes); the same code runs in the SDK's simulator and the fake maki |
| `sdk/` | its own workspace: `maki-app` (the crate apps are written with), the `maki` tool (keygen, build, pack, inspect, run in a terminal simulator), example apps (Hello, Dice, Tally; Signer, which asks, signs and types; SSH, maki's SSH key for maki desktop's SSH agent); see `sdk/README.md` |
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
| `apps-baosec/maki-launcher/assets/splash.py` | the boot image (a maki roll, and the name in the tall font); writes `src/splash.rs` |
| `libs/roughtime` | draft-19 request builder and verifier, tested against live server answers |

Host-side tests need no badge: `cargo test -p roughtime -p maki-proto -p maki-seed -p maki-btc -p maki-fido -p maki-eth -p maki-bundle -p maki-wasm`.
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
- `MAKI_DEMO_BTC=1`: once maki has its PIN and phrase, maki-link does what the desktop's
  Bitcoin section does: asks to share the account, shows receive address #0 to compare, and
  sends the fixture PSBT (`libs/maki-btc/tests/fixtures`) to review and sign, then logs
  `demo btc signed: N bytes, as expected: true` if the signature is the one maki-btc makes on a
  computer. The PSBT belongs to the BIP39 test phrase, so restore that at setup (below).

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

When the first screen appears depends on how many processes boot and how big the image is:
with maki-apps in the image it's about 2.8G rather than 2.3G, and with maki-app-host too about
4.1G (`OFFSET=2.0` for the script below). Take a few screenshots early to find it, and shift the
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
  for t in 10.9 11.8 12.6 13.1 13.3 13.5 13.7; do P+=(--press 5@${t}G+2M); done
  scripts/emu.sh 12.5G,13.0G,14.0G "${P[@]}"' | grep "demo btc"
```

The times follow the work maki does after a restore (the passkeys' keys and store come first),
measured by screenshots every 0.2G: the account ask is up by 11.75G, the address by 12.5G, the
transaction's first page by 13.0G. A press before its screen is up lands on whatever is there
(on the home screen, it opens Authenticator), so when something changes what maki does after
setup, measure again.

`MAKI_DEMO_ETH=1` does the same for Ethereum, for a site called demo.maki: connect, sign a
message, sign a transaction (0.05 ETH on Ethereum), checked against `libs/maki-eth/tests/fixtures`
(`demo eth signed: 117 bytes, as expected: true`). Deriving the account the first time is slow in
the emulator, so space the presses: continue at 10.9G, then 12.3 (connect), 12.8 and 13.1 (the
message: next, sign), 13.6, 13.8 and 14.0 (the transaction's pages) and 14.2 (sign), with
`OFFSET=0.6` as above.

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
it was signed'`), the list, and `first frame after 6220 ms` for Dice, up by about 20.5G.

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

**The development store.** Until the real store opens, the firmware and maki desktop both start
from the development store's root: `xous-core/libs/maki-store/dev-store`, made by its `make.sh`
from keys that are never committed (they live outside the repos; anyone can make a new set and
run it again, since nothing flashed trusts them yet). Its root 2 replaces root 1's catalogue key,
so maki and maki desktop have to follow the chain before anything else checks out; its apps are
the SDK's examples, stamped; its revocation list revokes Tally 1, which isn't in it, to show a
revocation covering a sideloaded app. Try it with the fake maki:

```sh
(cd xous-core && cargo run -p maki-proto --features fake --example fake_maki -- --clock-verified) &
MAKI_STORE=$PWD/xous-core/libs/maki-store/dev-store npm --prefix desktop run dev   # "connect to fake maki"
```

maki desktop hands the fake maki root 2 and the list as it links (its log says so), lists the
store's apps under Apps, and installs them as the store's. `MAKI_STORE` also takes an address
(`https://`, or `http://localhost` for a local server); without it maki desktop says the store
isn't open yet.

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
   (base64). maki desktop's store address goes where `storeWhere` looks
   (`desktop/src/main/store-source.ts`).

Running it: `maki reproduce BUNDLE SOURCE` checks that a developer's bundle is what its source
builds to (with the Rust the source pins); `maki store add DIR BUNDLE --catalogue
catalogue.key` stamps a reviewed bundle into the store and signs a new index; `maki store index
DIR --catalogue catalogue.key` signs the index again, which it needs within 30 days (maki
desktop won't use an expired one); `maki store revoke` signs a new revocation list, with a
higher `--version` than the last. Before the catalogue key expires, or if it's lost or stolen,
a new root names a new one: `maki store root --version N+1` with the next catalogue key, signed
by two root keys of the current root (recovered from paper, offline) and two of its own; then
every bundle is stamped again with the new catalogue key, and the revocation list and index
signed again. maki and maki desktop take a new root only when it's signed so.

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
    and Dice's first frame comes 6.2 s after it's opened, in the emulator's time (10 ns an
    instruction). The badge runs at 700 MHz, so expect less there, but swap goes through the
    PSRAM, which the emulator doesn't time. To measure on a badge.
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
- **Licensing.** Baomulator has no license file, so all rights are reserved: use it
  locally, don't vendor or redistribute it. Our patch is ours and could be offered
  upstream.
