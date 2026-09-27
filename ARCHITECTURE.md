# maki — how the pieces fit

Written 2026-09-26 from Kara's plan: an always-running desktop app linked to maki, browser
extensions for the web, and maki's screen and button as the approval for everything.

## The pieces

```
  browser ──FIDO2 over USB HID────────────────────────────────┐   passkeys: no maki software
     │                                                          │   needed, phones included
  extension (Chrome, Firefox)                                   │
     │  native messaging                                        ▼
  maki desktop (Electron, tray) ──USB serial, maki protocol──▶ maki
     │  UDP                                                     ├─ launcher (home screen, focus)
  Roughtime servers                                             ├─ vault (TOTP, passwords, passkeys)
                                                                ├─ maki-link (the serial end)
                                                                ├─ maki-keys (PIN, phrase, wallets)
                                                                └─ app host (.maki apps, next)
```

- **maki** runs everything that holds or uses a secret. Its screen and buttons are the only
  interface in the system that the computer can't fake.
- **maki desktop** is the only thing on the computer that talks to maki over serial (a serial port
  has one owner). It carries the time, will host the app store, and bridges the extensions.
- **Extensions** see web pages: which site you're on, where the login and code fields are. They
  talk to maki desktop through the browser's native messaging, never to maki directly.

## Flows

| Flow | Path | Status |
|---|---|---|
| **Link** | desktop ⇄ maki over serial; heartbeat every 10 s; a dot on maki's home screen while linked | **built** |
| **Time** | maki builds Roughtime requests, desktop relays them, maki verifies two agreeing signed answers | **built** |
| **Passkeys** | browser ⇄ maki over FIDO2 directly; maki shows the site, you press | works in the stock vault |
| **Passwords** | page → extension → desktop → maki: "*site* — Fill login?" → press → credential back to the page; a login typed and submitted → "Keep new login?" | **built**, tested against the fake maki in real Chromium and Firefox; on maki, built and emulated |
| **TOTP** | extension spots the code field → "*site* — Send code?" → press → filled; the first time, the owner picks which entry is the site's | **built**, as above; needs a Roughtime-verified clock |
| **Wallets** | dApp → extension (a wallet provider) or wallet software → maki switches to that wallet, shows the decoded transaction → press → signature back | planned: Bitcoin first, keys from the recovery phrase (below) |
| **Apps** | maki desktop installs `.maki` apps over serial, from the store or a file; maki shows what each may do before installing | designed (below); WebAssembly apps first |

## What each flow can and can't protect

The computer is untrusted: the desktop app, the extension and the browser all run on it. What
maki adds differs by flow, and it's worth being exact.

- **Passkeys and wallets: the secret never leaves maki.** maki signs; only the signature crosses
  the computer. For passkeys the browser binds the site cryptographically (`rp.id`), so a phishing
  page can't borrow your GitHub passkey. This is the strong case, and why passkeys should skip the
  extension entirely: the browser already does it better.
- **Passwords and TOTP codes: the secret is released to the computer.** After you press, the
  password or code exists on the computer, and malware there can read it. And maki can't verify
  the site name; it shows what the extension claims. What maki still prevents is *silent*
  extraction: nothing leaves without a press for that site, so malware can't quietly dump the vault.
  That's a real gain over a password manager on the computer, but it's weaker than passkeys, and
  the app should nudge toward passkeys wherever a site offers them.
- **The extension ⇄ desktop channel isn't paired.** Native messaging only lets the maki extension
  start the host, but the host talks to the tray app over a user-only local socket, which other
  software running as you can reach and name any site on. maki's screen, which shows the site
  every time, stays the final gate; pairing would narrow who can ask.
- **Codes need verified time.** A host that could set maki's clock could collect codes for later,
  so GET_TOTP waits for Roughtime; the host's own clock is only good for display.

## On maki: three buttons, a boot PIN, one recovery phrase

Decided 2026-09-26 with Kara.

### Three buttons: the model every screen follows

Like a Ledger, which manages with two buttons; maki has three: **left**, **right**, and the
**centre**. The jog dial on the side isn't used: the badge usually lies on a desk, and a normal
day is plug in, enter the PIN, and confirm prompts with the centre as they come.

- **Centre: confirm** whatever the screen is offering: open, allow, deny, sign, exit, the digit
  under the cursor.
- **Left and right together: the menu.** On the home screen, maki's own (lock, change PIN,
  backup, about); in an app, that app's menu, which always ends with Exit. (Ledger's gesture.
  A long press of the centre was the first idea, but the keypad reports presses more reliably
  than how long a key was held.)
- **Left and right: move** to the next app, the next item, the next page of a transaction, or the
  next of the choices a screen offers (from allow to deny).
- **There is no back button.** Going back, cancelling, refusing and leaving are always
  something the screen offers and the centre confirms.

What it looks like:

- **Every screen's bottom line** names what the centre will do, boxed, with arrows at the sides
  when left and right have somewhere to go.
- **Home**: one app at a time, a big icon and its name; the centre opens it.
- **Menus** (maki's and apps'): one item at a time; left and right go through them, the centre
  picks. An app says what's in its menu; the launcher draws it and adds Exit, so every app is
  left the same way, even one that misbehaves.
- **Asks** (a site wants a login): the request, offering "allow"; right offers "deny"; the
  centre does what's offered. With a choice (two logins for a site), left and right go through
  them and then Cancel.
- **Transactions**: left and right page through the details (each output, the fee), ending on
  Sign and Reject; the centre does what's shown.
- **Keys underneath:** the keyboard service holds a left or right press for 150 ms to see
  whether the other side joins it. If it does, it sends the menu key (`MENU`) and neither
  arrow, so a menu never also moves; if not, the arrow. Left and right don't auto-repeat.

### Boot PIN

Set at first boot, asked at every boot, and maki stays unlocked until it's unplugged. One PIN
covers everything: passwords, codes, passkeys, the wallet.

- **Entry, one digit at a time.** Each position starts on a random digit, underlined, so the
  number of presses gives nothing away. Left and right step down and up through 0–9, then ⌫
  (back one digit) and ✓ (done); the centre confirms and moves to the next position. Entered
  digits show as dots. The PIN 000000 is six confirms of 0, then ✓. At least six digits.
- **Five wrong PINs in a row wipe** everything the PIN protects, and maki goes back to first-boot
  setup, restorable from the recovery phrase and the backup (below). The count survives
  unplugging: it's raised before each try and cleared on success.
- **Until it's unlocked**, maki answers the desktop's requests with a new approval, "locked".
- **Changing it**, from maki's menu: the new PIN twice, then the current one, which counts toward
  the wipe like any other try. The new record is written beside the old before replacing it, so
  pulling the plug mid-change leaves whichever PIN is entered next working.
- **How:** the secrets live in a PDDB secret basis, whose 32-byte key (the gen2 API takes one
  directly) comes from the PIN through a deliberately slow key derivation. The counter lives
  outside that basis.
- **What it protects against.** Someone who picks the badge up can't use it. Someone who takes
  it home and reflashes it can: in developer mode any firmware can read the storage and try all
  million six-digit PINs offline, skipping the counter, and the slow derivation only makes that
  take hours instead of seconds (RESEARCH.md §3.4). So the wallet stays pocket money, and
  nothing that leaves maki is protected by the PIN alone.

### One recovery phrase

Made at setup: 24 BIP39 words from the TRNG, shown one word per screen to write down, then
checked by asking for a few of them back. It's the root of everything that can't be made again:

- **the Bitcoin wallet's keys**, derived the standard way (BIP32, BIP84), so the phrase also
  works in other wallets;
- **the key that encrypts maki's backup**;
- **passkeys**: the FIDO authenticator's master keys come from the phrase (HKDF over the
  BIP39 seed, "fido v1"): the key that encrypts and the key that authenticates the credential
  IDs maki gives sites (which carry each credential's private key, sealed), and hmac-secret's
  CredRandom. A maki restored from the phrase opens every credential ID it gave out before.
  Discoverable passkeys, which live on maki, travel in the backup. The vault's FIDO thread, the
  only process maki-keys gives these to, waits until there's a phrase (during setup the PIN
  comes first) and answers nothing while maki is locked. A CTAP reset from a browser deletes
  the passkeys stored on maki, but credentials held by sites keep working until the phrase
  changes.

**Backups.** maki desktop keeps an encrypted copy of the passwords, codes and discoverable
passkeys (with the signature counter, which a restore only ever raises), refreshed when they
change. A restore adds what maki doesn't have, matching passkeys by credential ID. The key comes from the recovery phrase, never the PIN: a backup
file is exactly what an attacker gets to try PINs against offline.

**Restore.** A new or wiped maki: set a PIN, enter the recovery phrase on maki, and maki desktop
sends the backup back. The phrase goes in on maki itself, word by word with the buttons (each
word picked letter by letter, finished from the BIP39 list) or as a SeedQR through the camera;
it's never typed into the computer, which is what a hardware key defends against.

## Apps you can install: `.maki` bundles

Decided 2026-09-27 with Kara. There's a store, which is reviewed and trusted, and anyone can
build an app and sideload it without flashing firmware; it just isn't in the store. Every app,
from either, gets only the permissions it was given. Every maki is in developer mode anyway, so
the audience is hackers, and sideloading is an ordinary path, not a hidden switch.

### One bundle, two kinds of code

A `.maki` file is one app: a manifest, the code, a 64×64 icon and the developer's signature.
The code is one of two kinds; installing, permissions, storage, backups, the store and the menu
work the same for both.

- **WebAssembly**, run by maki's app host: one process that interprets the app's module with
  wasmi, a WebAssembly interpreter written in Rust. First.
- **Native**: an ordinary Xous program, started as a process of its own the way Precursor's app
  loader does it. Once the kernel can confine it (below).

Speed isn't the only difference between the two, or the biggest:

- **Who enforces the permissions.** A WebAssembly app can only call the functions the host
  gives it; nothing else exists for it. A native app is machine code with the whole kernel to
  call, and today any process can map hardware nobody has claimed, connect to any server whose
  address is fixed or that takes unlimited connections, open any dictionary in an unlocked
  basis, and press maki's buttons (RESEARCH.md §5.2). Confining it takes changes to the kernel
  and to services, and all of them have to be right.
- **What a bug costs.** On this chip, code that runs can read the keys unless the MMU keeps it
  away from them (RESEARCH.md §3.3), so for a native app one missed mapping or one kernel bug is
  the whole device. A WebAssembly app's code never runs on the CPU; getting out takes a bug in
  the interpreter, a much smaller target: it checks every module before running it, turns
  "can't happen" into a stop rather than undefined behaviour (wasmi's `extra-checks`), and
  earlier versions have been audited twice.
- **Firmware updates.** A WebAssembly app keeps working on any maki whose host has the
  functions it uses (the manifest names the API version). A native app is built against one
  version of Xous and its services, and an update can break it, so its manifest names the
  firmware it was built for and other firmware refuses it.
- **Tools.** WebAssembly: any stable compiler for wasm32 (Rust, C, Zig, TinyGo,
  AssemblyScript), and an app can be tried on a computer against a simulated screen and
  buttons. Native: Xous's own Rust toolchain, pinned to the firmware's version, and Baomulator
  or a badge to try it on.
- **Speed and memory.** Interpreted code is ten or more times slower (to measure on the
  badge): plenty for menus, games and anything else at 128×128, and the heavy work (hashes,
  signatures, QR codes) runs natively in the host. WebAssembly apps share the host's process,
  one at a time, each with a memory cap; a native app gets its own process, with threads, at
  full speed.
- **Hardware.** A WebAssembly app reaches hardware only through the host's functions (camera
  frames, the accelerometer). A confined native app could later be granted pieces of hardware
  directly.

Anything that needs the whole device is firmware, not an app: every maki is in developer mode,
so anyone can build and flash their own. A `.maki` bundle is always confined.

### The manifest

Written as `maki.toml` and packed into the bundle by the `maki` tool:

- **id**, reverse-DNS (`org.example.dice`); **name**, as the home screen shows it; **version**,
  a number that only goes up, and a label to show; **kind**, with the host **api** version
  (WebAssembly) or the **firmware** (native) it needs.
- **permissions**, each with a line saying why, which the install screen shows as the
  developer's words.
- **storage** and **memory**: what it needs, within limits maki sets.
- **backup**: whether its data goes in maki's backup unless the owner says otherwise.

The bundle is a small container of length-prefixed sections, read on maki by a
`#![forbid(unsafe_code)]` crate that's fuzzed like the other parsers (RESEARCH.md §3.3), and
signed with Ed25519 over everything before the signature. Developers make a key once
(`maki keygen`) and the tool signs every build, so there are no unsigned bundles to handle.

### Installing, updating, removing

- **From maki desktop**: its Apps page, or `maki install app.maki`, sends the bundle over
  serial. maki checks the signature and the manifest before showing anything.
- **The install screen** is gone through with left and right, like a transaction: the name and
  version; where it's from, "maki store" or "Sideloaded: nobody has reviewed it"; the
  developer's key, as a fingerprint to compare with the one maki desktop shows; each permission
  it wants, a page each, with the developer's reason and, for the sensitive ones, what it could
  do with it; then Install or Cancel.
- **Where it's kept**: bundles and app data live in the secret basis, so they're there only once
  maki is unlocked, and the five-try wipe takes them with everything else.
- **On the home screen** an app is one more icon, in the same alphabetical order.
- **Updates** need the same ID, the same developer key and a higher version. Permissions it
  didn't have before are asked for, only those. An app from the store updates only from the
  store; putting a sideloaded version over it says so first.
- **The same ID with a different key** is refused: remove the old app first. The new one never
  sees the old one's data or keys either way.
- **Removing** is in App info, or on maki desktop's Apps page with maki's yes. The app's data
  goes with it, and maki says so first if the data isn't in a backup.

### Permissions

Every app has, without asking: the screen below maki's strip and the buttons while it's in
front (left+right stay maki's), its own storage, the time and whether it's verified, random
numbers, and timers.

Asked for at install; sideloaded apps can ask for all of these too, and the warnings say what
each one could do:

- **ask**: maki's own ask screen, naming the app, even while the app isn't open.
- **link**: messages with software on the computer, through maki desktop, on a channel of its
  own; the computer sees what it sends. maki desktop can wake an app with link to handle a
  request, and the app then runs without the screen, reaching the owner through ask.
- **keys**: secrets of its own from the recovery phrase (HKDF over the BIP39 seed, with the
  app's ID and developer key in the info), the same on any maki restored from the phrase,
  different for every app and useless for anything else: for SSH, signing, encryption. A
  developer who loses their key can't update the app, and a new key means new app keys.
- **keyboard**: typing into the computer as a USB keyboard, only while the app is in front,
  with a mark in the strip while it types. The strongest warning: it could type commands.
- **camera**: frames from the camera while the app is in front, with a mark in the strip.
- **motion**: the accelerometer, which can pick up typing nearby.

No permission gives an app: the recovery phrase; the vault's logins, codes and passkeys; the
wallets' keys; the PIN; other apps' storage and keys; maki's settings; raw hardware; pressing
buttons; drawing over maki's strip, or while it isn't in front.

### The strip and App info

While an app is open, the top bar is maki's: the app's name, a mark on sideloaded apps that
never goes away, the typing and camera marks, and the clock. The app draws below it. Since no
app can draw the bar, none can pass for maki's own screens (the PIN, asks, backups), and maki
never asks for the PIN while an app is open.

Left+right in an app shows its own items, then App info (where it's from, the version, the
developer key, its permissions, the storage it uses, whether its data goes in the backup, and
Remove), then Exit.

### Storage and backups

Each app has its own key-value storage in the secret basis, which only the host touches, with a
quota.

Whether it goes in the backup is a choice. The manifest sets the default (yes for data you'd
miss; no for caches, or secrets that should never leave maki), and the owner can change it for
each app in App info. For each app kept in the backup, the backup holds its record (ID,
version, developer key, the owner's choice) and its data, but not the app itself: maki builds
the whole backup in its RAM, which apps would soon outgrow, so an app goes back on from its
`.maki` file (or the store). A restore brings the data back into the same developer's app,
whether it's installed then or later, and never into another developer's app of the same ID,
which starts empty. Keys from **keys** come back from the phrase, not the backup.

### The host

`maki-app-host` is one process. It registers each installed app with the launcher (as
`maki-apps` does for Bitcoin and Passkeys) and runs the one in front in wasmi, with a cap on its
memory, and fuel metering so an app that stops yielding is stopped ("not responding") rather
than freezing maki.

Apps call a versioned set of functions: drawing (clear, pixels, text, rectangles, 1-bit
bitmaps, QR codes, then present), waiting for an event (a button, a timer, a message from the
computer), storage, time, randomness, the app's menu items, and a set for each permission. An
SDK (a Rust crate, a C header, examples) wraps them, and a simulator runs the same `.wasm` on a
computer, maki desktop included.

### Native apps: what confinement takes

Until all of this is done, maki refuses native bundles and says why:

- **The kernel** gives processes the loader starts no physical mappings, no interrupts, no new
  processes, no shutdown, no raising their own memory limit, and connections only to the
  servers the loader names: the app services, the ticktimer and the log. Stock Xous lets every
  process do all of these.
- **The loader**, Precursor's with the ELF read from the PDDB instead of WiFi, can stop an app
  that hangs. That takes letting a parent end its child; today a process can only end itself.
- **The app services** offer native apps the host's functions over IPC, so one SDK builds
  either kind.
- **Key injection** (`InjectKey`, and `keyboard_bouncer`) only from the log server's serial
  console, and only in debug builds.

### The store

The best practice for distributing software that has to survive a stolen key or a hostile
server is The Update Framework's (TUF): offline root keys, short-lived online keys, and
versions and expiry dates that the device checks itself. maki takes the parts that fit a
device:

- **Root keys, offline.** Three Ed25519 keys, any two of which sign the store's root: the root
  keys, how many must sign, and the current catalogue key with its expiry. Each is kept in a
  different place (a 24-word phrase on paper) and used rarely, on an offline computer. The
  firmware carries the first root; a new root must be signed by two keys of the old and two of
  the new, and maki keeps the newest it's seen, so the keys can change without a firmware
  update and can't be rolled back.
- **The catalogue key** does the everyday signing and expires within a year. It signs a
  **stamp** for each reviewed bundle (ID, version, bundle hash, developer key, permissions),
  which is what makes an app "from the maki store", and the **revocation list**, whose version
  only goes up and which expires after a few weeks, checked against verified time: an old list
  can't be replayed, and a stale one shows.
- **Two signatures on store apps.** The developer signs the bundle and the store stamps it. A
  stolen catalogue key can't update an existing app, which needs its developer's key, and a
  stolen developer key can't get an update into the store.
- **Revocation.** The list can name store apps, versions and developer keys, sideloaded ones
  too (malware found in the wild). maki marks a revoked app, warns each time it's opened, and
  offers to remove it; the owner decides.
- **Reviewable and reproducible.** The store is a Git repository of manifests pinned to source
  commits and built by CI, as Flipper's is, so anyone can check that what was reviewed is what
  was stamped.
- **maki checks it all itself.** maki desktop fetches the store and passes things along, and is
  as untrusted as the rest of the computer. Installing from the store needs verified time, as
  codes do.

## Order of work

1. ~~Link and verified time~~ — done: protocol, maki-link, desktop app in the tray.
2. ~~Approval screens on maki~~ — done: the launcher asks over whatever is in front;
   `GET_LOGIN`, `GET_TOTP`, `SAVE_LOGIN` go through the vault.
3. ~~Native messaging host and a Chrome/Firefox extension~~ — done: fills logins and codes,
   offers typed logins to maki.
4. ~~Home screen entries for the vault~~ — done: Authenticator and Passwords.
5. ~~Three-button UI~~ — done: the icon carousel home, menus on left+right, asks that offer
   one action at a time, and the vault's screens one entry at a time.
6. ~~Boot PIN and first-boot setup~~ — done: welcome, choose and confirm a PIN, the secret basis
   (maki-keys), Lock and Change PIN in maki's menu, the five-try wipe, "locked" answers to the
   desktop. Asks wait until setup is over.
7. ~~Recovery phrase and backups~~ — done: made, shown and checked at setup, or typed in to
   restore; maki desktop keeps the encrypted backup (hourly, and after a login is saved) and
   sends it back on request, with the owner's yes on maki.
8. ~~Bitcoin wallet~~ — done: the BIP84 account from the phrase (`libs/maki-btc`), handed to
   wallet software as a descriptor with the owner's yes; addresses shown on maki to compare, and
   as QR codes in the Bitcoin app; PSBTs checked (every input maki's, with the transaction it
   spends), gone through page by page (each payment, change, fee) and signed, through maki
   desktop. Signatures match rust-bitcoin's and pass Bitcoin Core's consensus code. Not yet:
   taproot, multisig, and a run against Sparrow with real coins on a badge.
9. ~~Passkeys from the phrase, and a Passkeys screen~~ — done: the authenticator's keys from
   the phrase (above), passkeys in the backup, and a Passkeys app that lists them (site and
   user) and deletes one with the owner's yes, telling the vault to re-read its store. It shares
   a process with the Bitcoin app (`maki-apps`), which spares RAM. The
   emulator has no USB, so FIDO itself hasn't run there: the key hand-off, backup, restore and
   the app have.
10. ~~Ethereum~~ — done: an account from the phrase (BIP44, `libs/maki-eth`), given to sites
    through an EIP-1193 provider the extension puts in pages (and announces the EIP-6963 way).
    A site sees the account once the owner connects it on maki; messages (EIP-191) and
    transactions (EIP-1559, EIP-155) are shown on maki page by page (network, recipient and
    amount, ERC-20 transfers and approvals spelled out, any other call flagged as unreadable, the
    most the fee can be) and signed there; maki desktop fills in nonce, gas and fees and
    broadcasts through public servers. Signatures match alloy's, byte for byte. Not yet: typed
    data (EIP-712), which maki can't show; token names and decimals, which maki can't verify.
11. **Apps** (above), each step emulated first:
    1. ~~WebAssembly apps, sideloaded~~ — done in the emulator: the bundle format and the `maki`
       tool; the host, with drawing, buttons, storage and menus; installing over serial with the
       install screen (an altered bundle refused); App info; maki desktop's Apps page; app data
       in backups; the SDK, a simulator, example apps. Opening an app is slow while RAM is this
       short (DEVELOPMENT.md, "Known issues"); not yet on a badge.
    2. The other permissions: ask, link (and waking), keys, keyboard, camera, motion.
    3. The store: root and catalogue keys, stamps, revocations, the store in maki desktop, CI
       builds.
    4. Native apps: confinement in the kernel and services, then the loader. The out-of-memory
       panic one more process used to cause at boot is fixed (DEVELOPMENT.md, "Known issues"),
       and three more boot.

## Constraints to design around

- **One serial owner.** maki desktop holds the port; the extension and the app store go through it.
- **USB interfaces are fixed**: FIDO HID (passkeys), serial (everything else), keyboard (typing codes
  where there's no extension). Enough for all of the above.
- **Replies carry the request's ID** (protocol v2), so a request waiting on the owner doesn't hold
  up heartbeats or time sync, and a late reply to a request the host gave up on is dropped.
- **maki and a stock DC34 badge share USB IDs.** maki names itself `maki` over USB; the desktop app
  sends one inert HELLO to anything with the IDs and leaves non-answering devices alone.
