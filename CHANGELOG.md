# What's new

maki's changes, newest first. It's in early development: each preview is a set of downloads built
from the repositories as they were that day, not a release anyone has audited. Before the first
one, maki was built a day at a time, and that's here too.

## Coming in the next preview

- **Passkeys for every site.** maki verifies you with its own PIN, the one you unlock it with, and
  one press on maki approves each passkey: no security key PIN to set up, nothing typed on the
  computer. GitHub, which wants verification for a passkey, turned maki down before, as Firefox
  and Zen can't set up a security key's PIN midway. [Passkeys](docs/extension.md#passkeys).
- **Long passkey replies arrive whole.** Over USB, maki sent a reply longer than one packet with a
  packet lost and the next doubled, a third of the time: a bug in the USB driver the firmware
  builds on, and a sender that didn't wait for each packet. Fixed in both.
- **The PIN's tries are counted in the chip,** on a counter that only goes up, before each PIN is
  checked. Putting back an old copy of maki's storage no longer gives the tries back.
- **The jog dial on maki's side reaches apps** (host API 8): turning it up or down is an event
  for apps that say they know it, and the SDK's simulator takes it as the arrow keys.
- **Dice 2.0,** for tabletop games: dice as players say them (3d6, 1d20), the die picked with
  the jog dial, how many with left and right, the total big and each roll beneath. It needs this
  firmware.

## maki desktop 0.1.1, 2026-09-29

maki desktop and the extension 0.1.1, on the [download page](https://maki.netslum.io/download/),
with the preview's firmware: they speak the same version of the link protocol.

- **maki desktop manages the extension's browsers.** Connections lists every browser it knows on
  the computer (Chrome, Chromium, Brave, Edge, Vivaldi, Opera, Thorium, Firefox, Zen, Floorp,
  LibreWolf), each connected and disconnected on its own, and adds any other by its folder.
- **Browsers installed as Flatpaks connect too:** Zen, Firefox, Chrome, Brave and the others from
  Flathub. maki desktop shares one folder with the browser's sandbox, where it answers the
  extension and nothing else, and puts a small relay inside. [The extension](docs/extension.md).
- **Licenses:** maki's own code is under the MIT License now, in every repository: maki desktop,
  the extension, the store, and maki's crates and SDK in the firmware. The files of Xous that maki
  changed stay Apache-2.0 and say they were changed. Every download carries the licenses and
  notices of the code of others in it (`THIRD-PARTY-NOTICES.md`), the preview's too.
- **On a badge:** the preview's firmware boots, links, sets its clock through Roughtime, and
  installs a store app, over USB with a yes on maki.

## Preview, 2026-09-29

The first downloads: maki's firmware (maki-firmware `a998b9a9e`), maki desktop 0.1.0 for Linux and
the browser extension 0.1.0 (maki-desktop `ab323a6`), on the [download page](https://maki.netslum.io/download/).
They speak version 3 of the link protocol, so they go together. The maki store has 24 apps.

maki has run on a DEF CON 34 badge since 2026-09-28: setup, and the link to maki desktop over USB
with its clock set through Roughtime. The rest has run in the emulator, and against the stand-in
for maki that runs its own code; it's still to be tried on a badge.

### New that day

- **sudo, with a yes on maki.** The Sudo app, and an approval plugin for sudo 1.9 in maki desktop:
  every command sudoers says yes to waits for maki, which shows it whole (what it runs, what it's
  given to run with, who asked where) and signs its yes. [sudo](docs/sudo.md).
- **Bitcoin multisig.** maki as one of a multisig wallet's keys (Sparrow, Nunchuk, Specter, Bitcoin
  Core): add the wallet on maki, key by key, and maki checks what spends from it against it.
- **Nostr apps sign through maki desktop,** as their bunker (NIP-46), every event shown on maki.
  [Nostr](docs/nostr.md).
- **Solana:** an account from the phrase, Phantom's and Solflare's, that reads its transactions as
  Solana does, in the Solana app, maki desktop's wallets and the extension.
- **Monero sending:** maki makes and signs the whole transaction, from maki desktop's wallet or as
  the Monero GUI's cold wallet.
- **Signing without a cable:** Bitcoin by QR codes with Sparrow, Ethereum with MetaMask.
- **SSH 1.2:** a certificate authority, and git's commits read on maki before they're signed,
  through `maki-ssh-keygen`. **OpenPGP** (a key for gpg and git, through `maki-gpg`) and
  **Minisign** (signing files, through `maki-minisign`).
- **Apps:** Notes (secrets read on maki, never on the computer again), Contacts (a signed card to
  swap at the con), Scanner, Marble and Breakout (steered by tilting maki), and a Magic 8-Ball.
- **Host API 7:** an app can ask with pages before the question, as Sudo does.

### Fixed

- A page freed while it was out in swap never gave its swap back, so installing apps one after
  another filled swap by the fifteenth. The swapper frees them now, and two dozen apps install.
- An app's review pages lost their last line under the action bar; they fit maki's screen now. A
  multisig wallet's pages wrap by words, not in the middle of one.

## Before the first preview

### 2026-09-28

- **maki on a badge,** for the first time: setup, the link to maki desktop, and its clock through
  Roughtime. Two bugs in the badge's USB serial, which the emulator can't show, found there and
  fixed: a write could send a packet twice, and a second packet in could overwrite the first.
- **Wallets become apps:** Bitcoin and Ethereum move out of the firmware into store apps; maki
  keeps the keys, and lets each app reach only the accounts it names (protocol 3).
- **The store's CI** rebuilds every app it's sent, and every app each week, byte for byte.
- **maki desktop is a wallet:** balances, receiving and sending, a waiting Bitcoin payment sped up,
  Ethereum to ENS names, values in money if you ask.
- **Monero:** the wallet's addresses, and its 25-word backup shown on maki.
- **Nostr for sites** through the extension's `window.nostr`; **Age**, whose plugin asks maki to
  open each file; **Wi-Fi**, **Passphrase**, **Snake** and **Status** in the store.
- **The clock** in maki's bar, and a clock the size of the screen after a minute untouched.
- Tokens shown as "1.5 USDC", not "1500000", for the tokens maki knows by their contracts.

### 2026-09-27

- **Apps:** signed `.maki` bundles, a WebAssembly app host, the SDK and its simulator; permissions
  to ask, to have keys, to type, to talk to the computer, to scan QR codes and read the
  accelerometer.
- **Native apps,** each in a process maki's kernel confines; Pomodoro is the first.
- **The maki store:** each app signed twice, by its developer and the store, and rebuilt from its
  source before it's stamped; its first five apps. maki desktop browses it and installs from it.
- **SSH** through maki desktop's agent, host-bound; each maki picks a name, a maki roll.
- Ethereum's typed data (EIP-712) read on maki; Bitcoin's taproot account.

### 2026-09-26

- **The firmware becomes maki:** a home screen for three buttons, a boot PIN (five wrong and it
  wipes), the recovery phrase, and backups the computer can't read.
- **maki desktop:** a tray app that links maki over USB and keeps its clock verified with Roughtime.
- **The browser extension:** logins and one-time codes approved on maki.
- **Bitcoin** (accounts, addresses as QR codes, transactions reviewed page by page, checked with
  Bitcoin Core's consensus code), **passkeys** from the phrase, and an **Ethereum** account for
  sites.
- What maki reads from the computer is fuzzed.

### 2026-09-25

- The idea, written down: a security key that shows you what you're signing, on the DEF CON 34
  badge's core module. Xous, forked, boots in the emulator.
