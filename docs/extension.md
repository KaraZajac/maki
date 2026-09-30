# The browser extension

The extension fills logins and one-time codes that maki approves, and gives sites maki's
Ethereum, Solana and Nostr accounts. It sees the page; maki decides. Every request goes through
maki desktop to maki, which shows what's asking and waits for your press.

## Install it

The extension isn't in Chrome's or Firefox's store yet, so it's loaded by hand. Download it from
the [download page](https://maki.netslum.io/download/) (or build it: `npm run build:extension` in
maki-desktop).

### Chrome, Chromium, Brave, Edge, Vivaldi

Unzip it, open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked** and pick
the unzipped folder. Its ID is pinned by the key in its manifest, so it's the one maki desktop's
registration allows, wherever you unzip it.

### Firefox

Open `about:debugging`, **This Firefox**, **Load Temporary Add-on**, and pick the `.xpi` (or the
`manifest.json` inside it). It lasts until Firefox restarts: keeping it for good needs Mozilla to
sign it, or Firefox Developer Edition or Nightly with `xpinstall.signatures.required` turned off in
`about:config`.

### Connect it to maki desktop

In maki desktop, **Connections**, **Browsers**: **Set up** registers maki desktop with each
browser you have, so the extension can reach it. A Firefox that keeps its profile in
`~/.config/mozilla` (new installs since Firefox 147) reads the registration only from a system
folder, so for that one maki desktop asks for your admin password once.

## Logins

Click into a login field and the extension asks maki. maki shows the site and the login it would
fill; press, and it fills. More than one login for the site? maki shows each, and you pick. Submit
a login maki doesn't have, and maki offers to keep it.

The site maki names is the hostname the browser reports for the frame that's asking, never
something the page says about itself. The extension works on https pages only (and localhost).

## One-time codes

The same for TOTP code fields; the first time, you pick which of maki's entries is the site's.
Codes wait for a verified clock (see [maki desktop](desktop.md#the-time)).

## Passkeys

Passkeys need no extension and no maki software: maki is a FIDO2 security key over USB, and the
browser talks to it directly, phones included. Their keys come from the recovery phrase, so a
restored maki still opens every site it signed you up for.

## Ethereum, Solana and Nostr for sites

With the matching app from the store on maki, the extension puts maki's accounts in pages:

- **Ethereum**: an EIP-1193 provider (`window.ethereum` when no other wallet has it, and announced
  the EIP-6963 way). A site connects only when you allow it on maki; messages, typed data and
  transactions are shown on maki and signed there. See [Wallets](wallets.md#ethereum).
- **Solana**: a wallet called maki, registered the Wallet Standard's way, which Solana sites list.
  See [Wallets](wallets.md#solana).
- **Nostr**: `window.nostr` (NIP-07). maki asks before a site first sees your key, and shows each
  event before it signs. See [Nostr](nostr.md).
