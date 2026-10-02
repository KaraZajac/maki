# Security model

A YubiKey's touch proves you're there. It doesn't prove what you approved: you tap, and whatever
your computer asked for gets signed. maki's badge has a screen and buttons, so maki shows you what
you're signing and waits for you to press. That's the whole idea, and it decides what maki can and
can't protect you from.

## What maki protects you from

**Software on your computer using your keys behind your back.** Everything that holds or uses a
secret runs on maki; your computer only asks. maki shows each request on its own screen (the site,
the server, the commit, the command, every payment) and nothing is signed, filled, typed or
decrypted without a press, with the details in front of you.

- **The screen is maki's.** Its top line, and every ask, are drawn by maki's own firmware, which no
  app and no computer can draw over. maki never asks for the PIN while an app is open.
- **What maki shows is what it signs.** maki reads each request itself: it hashes a Nostr event
  from the fields it showed you, signs a git commit from the bytes it showed the subject of, checks
  a Bitcoin input against the transaction it spends, and names a site by the hostname the browser
  reports, never by what the page says.
- **Keys don't leave.** Wallet, SSH, signing and app keys stay on maki. Passkeys are made on maki.
- **A passkey takes a press.** maki verifies you with its own PIN, entered on maki to unlock it,
  and each passkey it makes or uses takes a press on maki for that one request: nothing on the
  computer gets a verified passkey signature from maki without one.
  Backups leave encrypted with a key from the recovery phrase, and a computer can't read them.
- **Apps are confined.** An app reaches only what its permissions give it, which you saw before it
  installed; no permission gives an app your phrase, another app's keys, the vault or the PIN. See
  [Apps and the store](apps.md#permissions).
- **Updates to apps are signed twice.** A store app carries its developer's signature and the
  store's, and the store rebuilds each one from public source before stamping it.

## What it doesn't

**Someone who has your badge.** maki runs in the badge's developer mode, in which anyone holding it
can flash their own firmware and read what's stored. The PIN and its five-try wipe stop someone
guessing at maki's own screen, not someone with a firmware of their own and time. Treat maki like a
Flipper: keep the wallets to pocket money, and your recovery phrase on paper, somewhere safe.

**Passwords and codes, once sent.** A passkey or a signature never leaves maki. A password or a
one-time code does: once you press, it's on the computer, where malware can read it. What maki stops
is quiet extraction, since nothing leaves without a press for that site. Where a site offers
passkeys, use them.

**Being fooled on maki's own screen.** maki shows what it's asked in full, but you have to read it.
An address you didn't check, a command you didn't read, is still approved when you press.

**A bug in maki.** maki is written in Rust, apps are sandboxed, and its signatures are checked
against reference implementations. But it's unaudited hobby firmware, in early development. A
code-execution bug in maki itself would get past all of the above.

## The PIN and the phrase

- The PIN unlocks maki's encrypted storage at each boot. It's entered a digit at a time, each
  position starting on a random digit, so the number of presses says nothing. Five wrong in a row
  wipe maki. Each try is counted in the chip, on a one-way counter, before its PIN is checked:
  neither pulling the plug mid-check nor putting back an older copy of the flash gives a try back,
  and once they're used up maki wipes without checking the PIN at all.
- The recovery phrase (24 words from the hardware random number generator) is the root of every
  key that can't be made again. It's shown on maki and goes back in on maki, never through a
  computer. Shares of it (Shamir's, SSKR) are the same: shown on maki, at setup or from the menu
  once the PIN is entered again, and typed back in on maki.
- A passphrase wallet's passphrase is typed on maki too, and kept only in maki's memory until it
  locks: never stored, never in a backup.
- Backups are encrypted with a key from the phrase. The PIN is never in one: a backup file is
  exactly what someone would try PINs against.

## Time

One-time codes, the store's revocation list and parts of the store's checks need the time.
maki's clock is set through Roughtime: maki builds the requests, and checks the signed answers from
three public servers itself, needing two that agree. A clock taken from the computer is marked
unverified, and never used for codes.

## sudo, Nostr apps and the other bridges

maki desktop connects maki to your computer, and it holds no keys. Where it passes a yes on to
something else, the yes is maki's signature, checked by the other side: sudo's plugin checks maki's
signature against a key only root can change, and talks only to your own user's maki desktop. See
[sudo](sudo.md) and [Nostr](nostr.md).

## Found something?

Please don't put the details of a security problem in a public issue. Open an
[issue](https://github.com/KaraZajac/maki/issues) saying you have a security report, without the
details, and a private way to send it will be arranged.

The full design, threats included, is in [ARCHITECTURE.md](../ARCHITECTURE.md) and
[RESEARCH.md](../RESEARCH.md).
