# The browser extension

The extension fills logins and one-time codes that maki approves, and gives sites maki's
Ethereum, Solana and Nostr accounts. It sees the page; maki decides. Every request goes through
maki desktop to maki, which shows what's asking and waits for your press.

## Install it

The extension isn't in Chrome's or Firefox's store yet, so it's loaded by hand. Download it from
the [download page](https://maki.netslum.io/download/) (or build it: `npm run build:extension` in
maki-desktop).

### Chrome, Chromium, Brave, Edge, Vivaldi, Opera

Unzip it, open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked** and pick
the unzipped folder. Its ID is pinned by the key in its manifest, so it's the one maki desktop's
registration allows, wherever you unzip it.

### Firefox, Zen and the others made from Firefox

Open `about:debugging`, **This Firefox**, **Load Temporary Add-on**, and pick the `.xpi` (or the
`manifest.json` inside it). It lasts until the browser restarts. To keep it for good, the browser
has to let you install one Mozilla hasn't signed: Firefox Developer Edition and Nightly do, and so
does Zen. Turn `xpinstall.signatures.required` off in `about:config`, then in `about:addons` choose
**Install Add-on From File** and pick the `.xpi`.

### Connect it to maki desktop

In maki desktop, **Connections**, **Browsers** lists the browsers on this computer: Chrome,
Chromium, Brave, Edge, Vivaldi, Opera, Thorium, Firefox, Zen, Floorp and LibreWolf, installed the
usual way or as a Flatpak. **Connect** each one you use the extension in, so it can reach maki
desktop; **Disconnect** takes that away again.

- **A Firefox that keeps its profile in `~/.config/mozilla`** (new installs since Firefox 147)
  reads the registration only from a system folder, so for that one maki desktop asks for your
  admin password once. Zen and Floorp read Firefox's registration, so they connect with it.
- **A browser installed as a Flatpak** (Zen from Flathub, say) runs in a sandbox that can't reach
  maki desktop by itself. Connecting it shares one folder with that sandbox, where maki desktop
  answers the extension and nothing else, and puts a small relay inside it. Restart the browser
  once: maki desktop says when it's waiting for that. maki desktop has to be running for a Flatpak
  browser's extension to reach maki: from in its sandbox, it can't start maki desktop.
- **A browser that isn't listed:** choose **Another browser…**, give its name, say whether it takes
  Chrome's extension or Firefox's, and pick its folder (such as `~/.config/thorium`), or the one it
  looks for browser helpers in.

## Logins

Click into a login field and the extension asks maki. maki shows the site and the login it would
fill; press, and it fills. More than one login for the site? maki shows each, and you pick. Submit
a login maki doesn't have, or a new password on a change-password form, and maki offers to keep
it.

A field the page puts the cursor in by itself (most login pages do, as they open) gets a **Fill
from maki** button instead: maki is asked only once you click it, or click into the field. A
page's script can focus any field, a hidden one too, so the extension waits for you, and asks
for fields you can see only.

A site maki holds a passkey for gets no question about its password: the passkey is the way in,
and the extension says so ("maki has a passkey for this site"). **Use password** asks maki for
the password anyway.

The site maki names is the hostname the browser reports for the frame that's asking, never
something the page says about itself. The extension works on https pages only (and localhost).

## One-time codes

The same for TOTP code fields; the first time, you pick which of maki's entries is the site's.
Codes wait for a verified clock (see [maki desktop](desktop.md#the-time)).

## Passkeys

Passkeys need no extension and no maki software: maki is a FIDO2 security key over USB, and the
browser talks to it directly, phones included. Their keys come from the recovery phrase, so a
restored maki still opens every site it signed you up for.

maki verifies you itself, with its own PIN: the one you enter to unlock it. There's no second PIN
to set up and nothing to type on the computer. When a site makes or uses a passkey, maki asks: the
site, "Sign in?" or "Save a passkey?", and whose it is. The centre approves it, as it does a
login's question, and maki shows one question at a time. Sites that insist on verification, as GitHub and most passkey sites do,
take that, in every browser (Firefox and Zen included, which can't set up a security key's PIN
midway). A press counts for the one request it answered, and while maki is locked it answers
nothing. Unplugging it locks it.

## Ethereum, Solana and Nostr for sites

With the matching app from the store on maki, the extension puts maki's accounts in pages:

- **Ethereum**: an EIP-1193 provider (`window.ethereum` when no other wallet has it, and announced
  the EIP-6963 way). A site connects only when you allow it on maki; messages, typed data and
  transactions are shown on maki and signed there. See [Wallets](wallets.md#ethereum).
- **Solana**: a wallet called maki, registered the Wallet Standard's way, which Solana sites list.
  See [Wallets](wallets.md#solana).
- **Nostr**: `window.nostr` (NIP-07). maki asks before a site first sees your key, and shows each
  event before it signs. See [Nostr](nostr.md).
