# Getting started

maki is firmware for the DEF CON 34 badge's core module. It turns the badge into a security key
with a screen: whatever your computer asks it to sign, approve or type (a login, an SSH sign-in, a
git commit, a payment, a command run as root) is shown on maki's own screen first, and nothing
happens until you press a button there. Malware on your computer can ask; it can't press.

It's early. maki runs on a badge and in an emulator, and it's tested against a stand-in that runs
its own code, but it's hobby firmware that nobody has audited. Read [the security
model](security.md) before you trust it with anything you'd miss.

## What you need

- **A DEF CON 34 badge**, or just its core module: maki runs on the removable module with the
  screen and three buttons, over USB-C. Retail baosec units can't run it: their developer mode is
  switched off for good.
- **A computer running Linux** for maki desktop, the tray app that links maki to your computer.
  macOS and Windows builds are made from the same source, but aren't tried yet.
- **A USB-C cable**, and about twenty minutes.
- **Paper and a pen** for the recovery phrase.

## Before anything else

Flashing maki crosses a **one-way door**: the badge goes into developer mode, which erases its
factory secrets and everything the stock vault holds (TOTP codes, passwords, passkeys). Move those
somewhere else first. Developer mode can't be turned off again.

And maki protects your keys from software on your computer, not from someone holding your badge: in
developer mode, anyone with the badge can flash their own firmware. Treat it like a Flipper, and
keep the wallets to pocket money.

## The order of things

- **Flash maki** onto the badge: three files, copied in the badge's update mode.
  [Flashing maki](flashing.md) goes through it.
- **Set it up** on the badge itself: a PIN, then a recovery phrase you write down (or one you
  already have, to restore), and maki picks a name. [First boot](first-boot.md).
- **Install maki desktop** and plug maki in: it links by itself, sets maki's clock, and keeps
  encrypted backups. [maki desktop](desktop.md).
- **Add what you want:** the browser extension for logins and codes, apps from the maki store
  (wallets, SSH, Nostr, sudo and more), each one approved on maki before it installs.

Everything to download is on the [download page](https://maki.netslum.io/download/).

## How you use it

maki has three buttons, left, centre and right, and a jog dial on its side. The centre confirms
whatever the bottom line of the screen names (open, allow, sign, the digit under the cursor); left
and right move, to the next app, the next page of a transaction, from allow to deny. Both together
open the menu. The dial moves too, up and down: through the PIN's digits, the apps on the home
screen and a menu's items, and in apps that use it (Dice's die, Pomodoro's minutes). Going back,
cancelling and refusing are always something the screen offers and the centre confirms, so a press
never does something the screen didn't say.

When something on your computer wants maki (a site's login, `git commit -S`, `sudo`, a wallet
sending), maki shows what it is, a page at a time, and waits. Say yes with the centre, or move to
the other answer and say no. If you don't answer, the answer is no.

## If you want to build it yourself

Everything is public: the firmware ([maki-firmware](https://github.com/KaraZajac/maki-firmware)),
maki desktop and the extension ([maki-desktop](https://github.com/KaraZajac/maki-desktop)), the
store ([maki-apps](https://github.com/KaraZajac/maki-apps)) and the design
([maki](https://github.com/KaraZajac/maki)). [DEVELOPMENT.md](../DEVELOPMENT.md) is the build loop,
emulator included.
