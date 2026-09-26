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
                                                                └─ future: wallets, QR scanner…
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
| **App store** | desktop lists apps, installs them over serial | later (see RESEARCH.md §5) |

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
- later, **passkeys**: FIDO credential keys derived from the phrase, as Trezor does, so they
  survive a restore.

**Backups.** maki desktop keeps an encrypted copy of the passwords, codes and passkey store,
refreshed when they change. The key comes from the recovery phrase, never the PIN: a backup
file is exactly what an attacker gets to try PINs against offline.

**Restore.** A new or wiped maki: set a PIN, enter the recovery phrase on maki, and maki desktop
sends the backup back. The phrase goes in on maki itself, word by word with the buttons (each
word picked letter by letter, finished from the BIP39 list) or as a SeedQR through the camera;
it's never typed into the computer, which is what a hardware key defends against.

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
   (maki-keys), Lock in maki's menu, the five-try wipe, "locked" answers to the desktop.
7. **Recovery phrase and backups**: make, show and check the phrase; the encrypted backup kept
   by maki desktop; restore on maki.
8. **Bitcoin wallet**: keys from the phrase; receive addresses shown on maki to check against
   the computer; PSBTs reviewed screen by screen and signed through maki desktop.
9. **Passkeys from the phrase**, and a Passkeys screen. Passkeys live in OpenSK's store, owned
   by the vault's FIDO thread, which blocks on USB; listing them needs a way into that thread.
10. **Ethereum** (an EIP-1193 provider in the extension), then the **app store** over serial,
    building on Xous's Precursor app loader.

## Constraints to design around

- **One serial owner.** maki desktop holds the port; the extension and the app store go through it.
- **USB interfaces are fixed**: FIDO HID (passkeys), serial (everything else), keyboard (typing codes
  where there's no extension). Enough for all of the above.
- **Replies carry the request's ID** (protocol v2), so a request waiting on the owner doesn't hold
  up heartbeats or time sync, and a late reply to a request the host gave up on is dropped.
- **maki and a stock DC34 badge share USB IDs.** maki names itself `maki` over USB; the desktop app
  sends one inert HELLO to anything with the IDs and leaves non-answering devices alone.
