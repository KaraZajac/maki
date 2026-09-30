# Updating maki

Three things update on their own schedule, and they keep your stuff to different degrees. The
short version: **updating maki's firmware keeps your PIN, recovery phrase, name, apps and their
data.** Your storage isn't in the firmware, so flashing new firmware doesn't touch it.

## The three pieces

- **maki desktop** — the tray app on your computer. Update it from the
  [download page](https://maki.netslum.io/download/). It holds no keys, so nothing of yours is at
  stake. maki desktop and maki speak a versioned protocol, so run the release that pairs with your
  firmware (the download page lists them together).
- **maki's firmware** — the three files you flash (`loader.uf2`, `xous.uf2`, `swap.uf2`). This is
  what you update to get new features and fixes. It's covered below.
- **The badge's boot stages** — Baochip's `boot1` underneath maki. maki leaves these alone; you
  don't update them in normal use.

## Updating the firmware keeps your data

Flash a newer maki exactly the way you flashed the first one ([Flashing maki](flashing.md)):
update mode, copy the three files, eject, reboot. Your **PIN, recovery phrase, name, installed
apps and all their data stay.**

That's because maki keeps two things in two separate places:

- **The firmware** — maki itself, its built-in screens and services — lives in the chip's internal
  memory. Flashing overwrites this.
- **Your storage** — the PIN-locked, encrypted database with your logins, codes, passkeys, wallet
  keys, and your installed apps and their data — lives in a separate flash chip, in its own region
  that flashing never writes to.

So a firmware update replaces maki without disturbing your storage. When the new maki boots, it
unlocks the same storage with your PIN, and everything is where you left it. (This is unlike some
hardware wallets, which have to remove and reinstall your apps to make room when their firmware
changes. maki doesn't: firmware and apps don't share the same space.)

Two firmware updates in a row are fine. There's no downgrade lock in normal use, though an app
that stored data in a newer maki may want that version or later.

## When your storage *is* cleared

- **The first flash into developer mode.** The very first developer-signed image erases the
  factory secrets and the stock vault. That's the one-way door in [Flashing maki](flashing.md),
  and it happens once, before maki is ever set up.
- **Five wrong PINs.** maki wipes its storage after five wrong PINs in a row. The count is kept in
  the chip, so pulling the plug doesn't reset it, and neither does an update.

In both cases your **recovery phrase** rebuilds your wallet, SSH, signing and app keys, and a
**backup** (below) brings back the rest.

## Backups, and why apps come back a little differently

maki desktop can take an encrypted **backup** of your storage, and restore it later — onto the
same badge, or a fresh one set up from the same recovery phrase.

A backup holds your logins, codes, resident passkeys, and the data of each app you chose to
include — plus a note of which apps were installed (their name, version and developer). It does
**not** hold the apps' code. maki builds the whole backup in its own memory, which the apps
themselves would quickly outgrow, so the apps aren't in it.

So a restore brings your **data** back, and the **apps reinstall** from the store or their `.maki`
files — and the data drops back into place as each app returns. An app's data only ever goes back
into the same developer's app of that name, never a different one.

Keys made from the recovery phrase (wallets, SSH, and so on) come back from the phrase, not the
backup.

## How much fits

Installed apps share a **2 MiB** room of their own, up to **32 apps**, separate from your logins,
codes and passkeys. maki refuses an install that won't fit and tells you what it needs and what's
free; maki desktop shows it as a bar. Taking an app away frees its space (App info, or the Apps
page in maki desktop).

## See also

- [Flashing maki](flashing.md) — the first flash, update mode, and building the files.
- [maki desktop](desktop.md) — where backups and app management live.
- [Security model](security.md) — what maki protects, and what it doesn't.
