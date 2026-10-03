# What's new

maki's changes, newest first. It's in early development: each preview is a set of downloads built
from the repositories as they were that day, not a release anyone has audited. Before the first
one, maki was built a day at a time, and that's here too.

## Preview, 2026-10-03

maki's firmware (maki-firmware `5f3599ff5`), with maki desktop 0.1.6 and the extension 0.1.6, on the
[download page](https://maki.netslum.io/download/); maki desktop updates a maki on preview
2026-10-01 or later to it, and itself from 0.1.2 on. It has run in the emulator end to end: a
passphrase typed on maki and its wallet's accounts over the link; Shamir shares made from maki's
menu, read off its screen and put back together, and a blank maki restored from two of three typed
in on it; a disk's secret asked for while maki was locked, held for its PIN and then given; logins,
codes and a passkey imported, the passkey then signing in through FIDO; a deck studied on maki and
read back; and each new app installed and opened, Password Maker typing BIP-85's password into the
computer. Not yet on a badge.

- **Sixteen more wallets**, in the maki store, each with its card on maki desktop's Wallets page
  (what it holds, its history, receiving, and payments gone through on maki): **Litecoin**,
  **Dogecoin**, **Bitcoin Cash**, **Dash**, **DigiByte**, **Zcash** (transparent addresses),
  **Kaspa**, **XRP**, **Stellar**, **Tron**, **TON**, **Cosmos** (the Hub and the nine chains that
  share its keys, Osmosis, Celestia and Noble's USDC among them), **NEAR**, **Sui**, **Aptos** and
  **Cardano**. Each makes the account the coin's usual wallets make from the same phrase, and reads
  what it's asked to sign as the coin's own software writes it, strictly, before showing it: every
  payment, token and fee spelled out, anything that would hand the account to someone else refused.
  Dogecoin's card waits for a server: there's no free public one maki desktop can ask.
- **Ethereum on 21 networks**: maki's Ethereum app names fifteen more (Avalanche, Robinhood Chain,
  HyperEVM, Monad, Mantle, Plasma, X Layer, Arc, World Chain, Ink, Linea, Gnosis, ZKsync Era, Celo
  and Unichain) and their stablecoins, and maki desktop holds the account on all of them and BNB
  Chain. On the OP Stack networks (Optimism, Base and five more) maki now says the network's L1
  fee isn't capped: its "Max fee" had left that out, and a real Optimism transfer cost 2.8 times
  what it said.
- **Passphrase wallets**: a BIP39 passphrase, typed on maki itself, opens another wallet from the
  same phrase, as Trezor, Ledger and Coldcard make it; from maki's menu, Wallets, or at every
  unlock if you'd like. maki shows its fingerprint, wallet apps have it until maki locks, and maki
  desktop keeps its accounts apart. Passkeys, logins, apps' keys and backups don't change.
- **Password Maker**: BIP-85's passwords, made from your phrase and typed by maki itself (or shown
  on its screen), never stored and never on the computer: number N at 21 characters is a Coldcard's
  Type Passwords' number N. maki desktop says which is which.
- **Shamir backup**: your phrase as shares, any 2 of 3 (or any k of n, up to 16) of which give it
  back, written down instead of the words at setup, or made later from maki's menu once its PIN is
  entered again. They're Blockchain Commons' SSKR, so they hold the phrase itself (the same words,
  the same wallets everywhere) and seedtool reads them too; a maki restores from them typed in on
  it ([how](docs/first-boot.md#shares-instead-of-the-words)).
- **Disk unlock**: maki answers a computer that asks for a passkey or a disk's key while it's still
  locked, and keeps it waiting until you enter the PIN: a LUKS disk enrolled with
  systemd-cryptenroll unlocks at boot with maki ([how](docs/disk-unlock.md)).
- **Confirm**: a yes on maki for any script (`maki-confirm "Deploy?"`), signed so the script can
  tell it was you. **Show QR**: anything from maki desktop as a QR code on maki's screen.
- **Sudoku** (made on maki, one solution each, graded easy to expert) and **Sokoban** (David W.
  Skinner's Microban). **Flashcards**: decks from maki desktop (a CSV file, pasted text or Anki's
  export), studied on maki a card at a time, Leitner's boxes bringing back sooner what you missed
  ([how](docs/flashcards.md)).
- **maki desktop, rearranged**: the sidebar groups its pages (maki; money; what's on maki, a page
  for each app with a side here; what this computer reaches maki for), and **About** has the
  versions, the updates, the license and notices, and the links.
- **Portfolio**: what every account maki shared holds, in your currency, each coin and token's
  share, and the total day by day; its tile on the Overview.
- **Moving to maki**: logins, two-step codes and passkeys imported from Bitwarden, Proton Pass,
  LastPass, 1Password, KeePassXC, Dashlane, the browsers, Apple Passwords and more, looked over
  before anything's sent, and maki asks once; imported passkeys are marked, and come back from a
  backup ([how](docs/import.md)).
- **Macro Pad 1.1** shows the scripts maki keeps, to read and change, and asks on maki before it
  keeps, replaces or removes one (it didn't ask before); **Flashcards 1.1** shows a deck's cards,
  with each one's box, to change and send back. Notes and Contacts have pages of their own.
- **Fixes**: QR codes hold any text (some UTF-8, Japanese or Greek capitals among it, went into
  Kanji mode and scanned as other characters); the wait for a passkey's yes no longer spins (USB's
  FIDO receive timeout fired at once); maki desktop keeps Dogecoin's and Bitcoin Cash's accounts in
  files of their own (saving them replaced Bitcoin's).
- **For apps** (host API 11 and 12): a wallet on `curve = "bip32-ed25519"`, signing with Cardano's
  keys; `wallet::type_password` and `wallet::show_password`.
- The maki store has 58 apps now (Macro Pad and Flashcards at 1.1), and maki keeps 32 at a time.

## Preview, 2026-10-01.6

maki's firmware (maki-firmware `35e43eb39`), with maki desktop 0.1.5 and the extension 0.1.5, on the
[download page](https://maki.netslum.io/download/); maki desktop updates a maki on preview
2026-10-01 or later to it, and itself from 0.1.2 on. It has run in the emulator end to end: a
DuckyScript sent from maki desktop, kept by maki, run on maki, and the keystrokes — Gui+R and
Ctrl+Alt+Delete among them — out of maki's USB. Not yet on a badge.

- **Macro Pad**, in the maki store: keystrokes maki types into a computer at the press of a
  button — text, keys and DuckyScript (1.0, plus STRINGLN), which you write or load in maki
  desktop and send to maki. maki keeps each script and types it only when you run it there,
  holding maki, with "typing" in its bar: an attended tool, for demos, pentests and your own
  machine. It can press shortcuts, so it can open and run programs — run only scripts you trust.
- **For apps** (host API 10): `keyboard::chord` presses a key with Ctrl, Alt or the
  Command/Windows key held — shortcuts such as Gui+R, which maki wouldn't let an app press before.
  An app that does this says so, and maki's install warning for the keyboard permission now says
  it can press shortcuts and open programs.

## Preview, 2026-10-01.5

maki's firmware (maki-firmware `e757cd61b`), with maki desktop 0.1.4 and the extension 0.1.4, on
the [download page](https://maki.netslum.io/download/); maki desktop updates a maki on preview
2026-10-01 or later to it, and itself from 0.1.2 on. It has run in the emulator: a child seed
shown by maki, each of its words found on maki's screen beside its number, as the BIP's steps
make them on another library's keys; a name tag scanned through maki's camera, its name drawn
big and its link's QR code read back off the screen; Minesweeper flagged, played, left and
opened again as it was. Not yet on a badge.

- **Child seeds (BIP-85).** New recovery phrases made from maki's, each a wallet of its own: a
  phone's hot wallet, someone in your family's, a test's. Child Seeds, in the maki store, picks a
  number and 12, 18 or 24 words, and maki shows the words itself, a word to a page, as it shows a
  Monero wallet's: the app never sees them, and they're never in maki's log. maki makes the same
  words for the same number from the same phrase, so restoring maki restores every child seed;
  they're what any BIP-85 wallet makes (held to the BIP's own test vectors).
- **Name Tag**, in the maki store: your name as big as it fits, with a line under it, and a link
  of yours as a QR code people can scan, read from a QR code you make.
- **Minesweeper**, in the maki store: twelve mines in a field of eighty, the jog dial for up and
  down. The first step is always safe, the clock stops while you're away, and it keeps the game
  and your best time.
- **For apps** (host API 9): maki's own fonts drawn bigger, each pixel a square of up to eight,
  for a name tag or a number read across a room; and child seeds' words, shown by maki.
- **maki desktop** names Child Seeds' keys "child seeds" where it lists an app's wallets, as
  maki does (it said "coin type 39").
- The maki store has 35 apps now, and maki keeps 32 at a time: to install another, remove one
  from maki desktop's Apps page (its data goes with it).

## Preview, 2026-10-01.4

maki's firmware (maki-firmware `8acb4b03d`), with maki desktop 0.1.3 and the extension 0.1.3 as
before, on the [download page](https://maki.netslum.io/download/); maki desktop 0.1.3 updates a
maki on preview 2026-10-01 or later to it. It has run in the emulator: a Google Authenticator
export of three codes scanned through maki's camera and each time-based code checked against RFC
6238 as the browser extension gets it, busy QR codes read by the Scanner app, logins and
passkeys, codes typed from Authenticator. Not yet on a badge.

- **Bring your codes from Google Authenticator.** Its Transfer accounts screen shows QR codes
  that hold every code you pick; maki's Authenticator now takes them (Add from QR code), all the
  codes of one at a time, and says how many it got and whether there's another QR code to scan.
  Pick a few codes per QR code: maki's camera sees 256 by 240 pixels, and a code of many is dense.
- **QR codes that wouldn't scan, scan.** maki tried to decode only a picture with exactly three
  of the squares a QR code has in its corners; a dense code's own data often looks like a few
  more, and such a code, held still, never scanned. A picture with three to twelve now goes to
  the decoder, which finds the code's own.
- **After a scan, Authenticator shows the code you added.** Enrolling a site's two-factor login,
  the site asks for the code next; the list stayed on whatever it showed before. (An import shows
  the first code it brought.)
- **A code scanned again keeps its sites.** Scanning or importing a code maki already had (the
  same account, its secret perhaps new) forgot which sites it gave codes for, so the browser was
  asked again which code a site uses.
- **2048**, in the maki store: slide the tiles with left and right and the jog dial; it keeps the
  game and your best score.

## Preview, 2026-10-01.3

maki's firmware (maki-firmware `0181b4633`), with maki desktop 0.1.3 and the extension 0.1.3 as
before, on the [download page](https://maki.netslum.io/download/); maki desktop 0.1.3 updates a
maki on preview 2026-10-01 or later to it. It has run in the emulator through everything: a
blank maki set up from its phrase, all 31 store apps installed and opened, logins with a passkey
first, passkeys made and used, TOTP codes scanned, sent and typed, native apps opened and closed
again and again, backups. Not yet on a badge.

- **Apps open about a third sooner, and a backup takes a quarter of the time.** maki's 2 MiB of
  RAM is shared by everything, and the swapper, which moves what doesn't fit out to encrypted
  swap, kept a sixth of it for itself, for good: a 4 KiB table for every 4 MiB of each process
  with anything swapped out, never freed. One table for all of swap took their place, made once
  and 32 KiB, so 70 more pages are maki's: in the emulator, apps open 19 to 51% sooner (38%
  over thirty of them), Bitcoin's first open went from 37.5 to 21.5 seconds, and a backup from
  46 seconds to 12.
- **A page comes back from swap only as it went out.** Each page in swap is sealed to its
  process, its address and how many times its place in swap has been written, so another
  process's page, or an older one put back, doesn't open. The swapper now also refuses an old
  copy of the very page, which still would: a mistake in its own records fails closed.

## Preview, 2026-10-01.2

The morning's preview again, with fixes: maki's firmware (maki-firmware `0cf07cd06`), maki desktop
0.1.3 and the extension 0.1.3 (maki-desktop `d45c4dd`), on the
[download page](https://maki.netslum.io/download/). maki desktop 0.1.2 updates itself to 0.1.3,
which updates a maki on the morning's preview to this one; a maki on anything older is flashed by
hand. The fixes have run in the emulator.

- **Codes from most sites' QR codes work.** A QR code that names no algorithm, as GitHub's and
  Google's don't, means SHA1, but maki saved its code as having none and could never read it back:
  it didn't show in Authenticator, and every other code went unavailable to the browser extension
  with it. Such codes now come out SHA1, codes already saved that way read back as what they were,
  and one record maki can't read no longer hides the rest. The stock badge's vault has the same bug.
- **The clock on a question keeps time:** the bar over an ask showed the minute it appeared in.
- **maki's serial port carries only maki's link:** the log, which an app could have had mirrored
  onto it, goes there only when a console asks, and maki has none. And a scanned code that would
  add a login (not supported) no longer puts its password in maki's log.
- **A second release the same day is an update:** maki desktop read this one as the morning's
  day, and would have told a maki on the morning's preview it was ahead.
- **The emulator** waits for this computer's clock when maki is idle, so the host's bytes reach it
  at once (a store install took 12 minutes, now under a minute), keeps maki's clock running (it
  stood still), and shows maki's camera a picture: tests install every app from the store as maki
  desktop does, and scan a TOTP code's QR code and check maki's codes against RFC 6238.

## Preview, 2026-10-01

maki's firmware (maki-firmware `4375d3b32`), maki desktop 0.1.2 for Linux and the extension 0.1.2
(maki-desktop `10d5a2b`), on the [download page](https://maki.netslum.io/download/). They speak
version 3 of the link protocol, as the preview before them did. The maki store has 31 apps, ten of
them updated, and signs these releases into its index: from this preview on, maki desktop updates
maki's firmware, itself and the apps. Flash this firmware by hand the first time.

The USB fixes, passkeys by maki's PIN, the PIN's tries on the chip and the jog dial have run on a
badge; the rest of this preview has run in the emulator, where maki desktop's own code and a
FIDO2 client reach the emulated maki over its USB.

- **Apps open faster:** an app opened again shows its first screen in about half the time, and
  a big one (Bitcoin) no longer reads its whole bundle from storage first. An app stuck in a
  loop is stopped as not responding within seconds, and Exit reaches it, where drawing or QR
  codes in a loop could keep maki busy for hours.
- **A power cut can't cost you maki.** Unplugged at the moment maki recorded a right PIN, maki
  could take the next PIN, even the right one, for a copy of its storage put back, and wipe
  itself. And after five wrong PINs, maki offers to restore from your recovery phrase.
- **Passkeys:** a sign-in the browser cancels takes maki's question off its screen, rather than
  leave it up for a yes that would make a passkey the site never gets. "Sign in?" says how many
  accounts it covers when a site has more than one. maki no longer takes U2F, the older
  protocol, whose approvals any key could give.
- **Quick presses keep their order:** left then the centre, fast, picks what left moved to.
- **maki desktop's updates can't leave maki half-written:** one update at a time, no restart or
  quit while maki's firmware is copied, **Try again** if putting it on fails, and the firmware
  goes only to the maki that restarted for it, not another badge in update mode. After maki
  desktop updates itself, the browsers and maki's commands (git's signing, age, minisign) start
  the new one; they named the old one, and failed.
- **maki desktop holds up:** a page that breaks says so in its place, and the browser, ssh and
  gpg go on working (a wallet's Send panel could take the whole window down with them).
  Disconnect keeps maki unlinked until it's plugged in again. Two apps added at once both
  install. Backups and wallets are written whole, so a crash can't leave them broken.
- **The extension** asks maki for a login only when you put the cursor in the field yourself:
  a page that focuses one by itself (or a hidden one) gets a **Fill from maki** button. A
  change-password form offers maki the new password, not the old.
- **Ten app updates** (in the maki store once it's published): Tamper Log 1.1 counts every try
  of its code, paused or not; Chess Clock 1.1 keeps a turn's time when it's reopened, and a game
  through a power cut; SSH 1.3 always shows how long a certificate is good for and its key;
  Wi-Fi 1.1 shows a long password whole; Pomodoro 3.1 counts a focus that ended while it was
  closed; and fixes in Nostr, Minisign, Instruments, Notes and Life.

- **Updates through maki desktop.** Its Overview says when there's newer firmware for maki, a
  newer maki desktop, or newer apps, all from the maki store's signed index. **Update maki**
  fetches the firmware and checks it against what the store signed for. maki asks you on its
  screen whether to restart for it, and maki desktop puts it on and starts it: no button held
  while plugging in. **Update and restart** does the same for maki desktop. On Linux, for now.
  [Updates](docs/desktop.md#updates).
- **maki says which firmware it runs** (its build, `preview-2026-10-01` for a release), so maki
  desktop can tell when there's newer.
- **A passkey comes first.** On a site maki holds a passkey for, the extension no longer asks for
  the password each time the username field is focused. It says maki has a passkey, with **Use
  password** for when you want the password anyway. [Logins](docs/extension.md#logins).
- **Passkeys ask as logins do:** one question at a time on maki's screen, naming the site, "Sign
  in?" or "Save a passkey?", and whose. Only the centre answers. A site asking for a passkey while
  the extension asked for its login made the screen flash between the two, and any button but
  the dial's down approved the passkey.
- **Apps no longer go blank after the accelerometer.** A read that finished while maki's I2C
  driver was busy elsewhere left it waiting forever, and with it every app after, until maki was
  unplugged. A bug in the driver the firmware builds on, fixed.
- **maki desktop links again when maki's plugged back in,** without being restarted. A maki that's
  starting doesn't answer at once, and maki desktop took that for a stock badge.
- **No "restart it" for a browser that's been restarted:** an old Flatpak sandbox, kept only by a
  helper that outlived the browser (about:debugging's adb), counted as the browser.
- **[Privacy](docs/privacy.md):** what maki, maki desktop and the extension send anywhere, and to
  whom.
- **Passkeys for every site.** maki verifies you with its own PIN, the one you unlock it with, and
  one press on maki approves each passkey: no security key PIN to set up, nothing typed on the
  computer. GitHub, which wants verification for a passkey, turned maki down before, as Firefox
  and Zen can't set up a security key's PIN midway. [Passkeys](docs/extension.md#passkeys).
- **Long passkey replies arrive whole.** Over USB, maki sent a reply longer than one packet with a
  packet lost and the next doubled, a third of the time: a bug in the USB driver the firmware
  builds on, and a sender that didn't wait for each packet. Fixed in both.
- **The PIN's tries are counted in the chip,** on a counter that only goes up, before each PIN is
  checked. Putting back an old copy of maki's storage no longer gives the tries back.
- **The jog dial on maki's side works:** up and down step through the PIN's digits, the home
  screen's apps and a menu's items, and reach apps that say they know it (host API 8, and native
  apps built for `maki-native-2`; maki still runs those built for `maki-native-1`). The SDK's
  simulator takes it as the arrow keys. [How you use it](docs/getting-started.md#how-you-use-it).
- **Dice 2.0,** for tabletop games: dice as players say them (3d6, 1d20), the die picked with
  the jog dial, how many with left and right, the total big and each roll beneath. It needs this
  firmware.
- **Tally 2.0** counts on the dial, one up or one down; **Pomodoro 3.0** sets a focus's minutes
  on it one at a time (left and right still go in fives); and **Snake 2.0** is steered the way
  it's to go, the dial for up and down, left and right with the buttons. All need this firmware.
- **Initiative,** new, for the table beside Dice: a fight's turn order and hit points. The centre
  passes the turn, counting the rounds, and the dial takes damage off whoever's picked or heals
  them; the menu adds a player or a monster, rolls initiative, and starts a new fight. It needs
  this firmware.
- **Six more new apps,** each needing this firmware:
  - **Presenter:** a slide clicker. The dial or right and left change slides (Page Down and Page
    Up, which every presentation app takes), the centre blanks the screen, and the time left
    shows big enough to read from a stage, flashing at 5 and 2 minutes to go.
  - **Life:** a life counter for Magic and other games, 2 to 6 players, the far player's total
    upside down to read from their side, with poison and commander damage.
  - **Chess Clock:** a game clock for two, each player pressing their side's button: increments,
    delays, stages, Go's byo-yomi and Scrabble's time over, each time turned to face its player.
  - **Instruments:** a g-meter for the car or a ride, a pilot's horizon and slip ball, and a
    spirit level to a tenth of a degree.
  - **Morse:** the dial as a paddle, up a dot, down a dash; typed into the computer if you like,
    learned from the screen flashing like a signal lamp.
  - **Tamper Log:** left on your closed laptop with its screen dark, it logs every time maki's
    moved and every press, until your code shows you what happened.
- **For apps** (host API 8): keys beyond text (Page Down, the arrows, F5; never Ctrl, Alt or
  Command), the accelerometer's range up to 16 g, a dark screen, and the SDK's big seven-segment
  digits, turned to read from any side.

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
