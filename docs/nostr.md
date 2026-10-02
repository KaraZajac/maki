# Nostr

The Nostr app keeps your Nostr key, made from your recovery phrase: maki holds it and signs with it,
so it never reaches your computer. Opened, the app shows your npub as a QR code, to share with a
phone.

Sites and Nostr apps use it two ways. Either way, maki asks before one first sees your key, naming
it, and shows each event before it signs: what kind it is and how it begins. maki works out each
event's id itself, from the fields it showed you, so what it signs is what you saw.

## Sites: the browser extension (NIP-07)

The [browser extension](extension.md) puts `window.nostr` in pages, which Nostr sites look for.
`getPublicKey` asks you on maki the first time a site calls it; `signEvent` shows the event. Checked
in real Chromium and Firefox, and against every client's way of writing an event.

## Apps: maki desktop as your bunker (NIP-46)

Nostr apps on your phone or the web that can sign in with a remote signer (Coracle and Nostrudel,
among others) can sign through maki desktop as their "bunker", over relays:

- In maki desktop, **Nostr**, turn on **Remote signing**. It shows a
  `bunker://` link, and the same as a QR code.
- In the app, sign in with a bunker, or "remote signer", and scan or paste the link. maki asks
  whether to let the app see your key, naming it.
- Or the other way round: paste the app's own `nostrconnect://` link into maki desktop, and choose
  **Connect**.

A `bunker://` link lets one app connect; once one has, maki desktop makes a new one. The apps that
have connected are listed there, each with **Remove**.

The app's requests travel over relays (relay.nsec.app and relay.damus.io, unless you pick others),
encrypted to a key maki desktop keeps for carrying them (NIP-44, or NIP-04 for older apps). That key
can't sign anything as you: each event goes to maki, which shows it and signs it with your key.

maki can't yet encrypt or decrypt messages with your key (direct messages, NIP-04 and NIP-44), and
tells an app that asks. maki desktop has to be running, with maki plugged in, for apps to sign.
