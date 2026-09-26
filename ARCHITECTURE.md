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
| **Passwords** | page → extension → desktop → maki: "log in to *site*?" → press → credential back to the page | next |
| **TOTP** | extension spots the code field → "code for *site*?" → press → filled | next |
| **Wallets** | dApp → extension (a wallet provider) or wallet software → maki switches to that wallet, shows the decoded transaction → press → signature back | later |
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
- **The extension ⇄ desktop channel should be paired**, so other software on the computer can't
  pose as the extension. maki's button stays the final gate either way.

## Order of work

1. ~~Link and verified time~~ — done: protocol, maki-link, desktop app in the tray.
2. **Home screen entries for the vault**: Authenticator and Passwords, then a new Passkeys screen
   (passkeys have no screen of their own today).
3. **Approval screens on maki** and the protocol messages behind them: `GET_LOGIN(site)`,
   `GET_TOTP(site)`, each answered only after a press on a screen naming the site.
4. **Native messaging host and a Chrome/Firefox extension** that find login and code fields and fill them.
5. **Wallets**: Bitcoin first (PSBT, decoded on-device), Ethereum later (EIP-1193 provider).
6. **App store** over serial, building on Xous's Precursor app loader.

## Constraints to design around

- **One serial owner.** maki desktop holds the port; the extension and the app store go through it.
- **USB interfaces are fixed**: FIDO HID (passkeys), serial (everything else), keyboard (typing codes
  where there's no extension). Enough for all of the above.
- **Replies carry no request ID yet.** One request at a time works; a request that times out and
  then gets a late reply costs the next request one failure. Add IDs before the extension shares
  the link with the time sync.
- **maki and a stock DC34 badge share USB IDs.** maki names itself `maki` over USB; the desktop app
  sends one inert HELLO to anything with the IDs and leaves non-answering devices alone.
