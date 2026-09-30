# Questions

## Will maki work on my badge?

On a DEF CON 34 badge, yes: maki runs on its core module (the removable board with the screen and
three buttons). Retail baosec units have developer mode switched off for good, so they can't run
it.

## Can I go back to the stock firmware?

You can flash Baochip's firmware again, but not undo developer mode: the factory secrets are gone,
and the stock vault's contents with them. That's the one-way door.

## I lost my maki. What now?

Your recovery phrase brings everything back on another maki (or restores the wallets in any
compatible wallet: Sparrow, MetaMask, a Ledger, Phantom). Restore it, then **Restore to maki** in
maki desktop brings back your logins and codes from the last backup. Whoever has the old badge can
read what's on it in time, so move the wallets' coins, and change what matters.

## I forgot my PIN.

Five wrong in a row wipe maki. Then set it up again with **restore from phrase**, and restore the
backup from maki desktop.

## maki desktop doesn't see maki.

- Is maki unlocked? It links after its PIN is in.
- Can your user open the serial port? On Linux, add yourself to the port's group (`dialout` on
  Fedora and Debian, `uucp` on Arch), then log out and in.
- Is another program holding the port (a serial terminal, another maki desktop)? Close it.
- Try another cable: some USB-C cables carry power only.

## The time on maki is wrong, or codes won't come.

maki's clock comes from Roughtime through maki desktop, and codes wait for it to be verified. Link
maki with maki desktop running and a network connection; it tries again every six hours, or
choose **Sync time now** from the tray.

## A site's login doesn't fill.

Check the browser is connected (maki desktop, **Connections**, **Browsers**; a Flatpak browser
once restarted after that), that the page is https, and that maki is linked. The extension's
button says whether it can reach maki desktop. maki offers the logins it keeps for the site the
browser reports: a login kept for one site isn't offered on another.

## Can I use maki without maki desktop?

Passkeys, yes: maki is a FIDO2 security key, and browsers talk to it directly. Everything else
(logins, apps, wallets, SSH, sudo) goes through maki desktop, which holds the link.

## Is my phrase safe in maki desktop?

It's never there. The phrase is shown on maki and entered on maki. maki desktop never sees it,
nor any key made from it.

## Where do I report a bug?

In the repository it's about: [maki-firmware](https://github.com/KaraZajac/maki-firmware/issues)
for maki itself, [maki-desktop](https://github.com/KaraZajac/maki-desktop/issues) for maki desktop
and the extension, [maki-apps](https://github.com/KaraZajac/maki-apps/issues) for the store's apps.
A security problem shouldn't go in a public issue: see [the security model](security.md#found-something).
