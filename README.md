# maki

Community firmware for the DEF CON 34 badge's core module: a security key with a screen,
and an app platform for the hacker community to build on. Flipper-style custom firmware,
for your keys.

> **Status: early development.** maki builds and boots in an
> emulator: a boot PIN, a recovery phrase, a home screen, the vault, a Bitcoin wallet and a serial
> link. A desktop app in the tray ([maki-desktop](https://github.com/KaraZajac/maki-desktop)) keeps
> it linked, its clock verified with Roughtime and its backups encrypted on the computer; a browser
> extension asks maki for logins and TOTP codes, which you approve on maki's screen, and gives
> sites maki's Ethereum account; and Bitcoin wallet software (Sparrow, Bitcoin Core) sends
> transactions through it for maki to show you and sign. Apps anyone can write (in Rust, for
> WebAssembly or as native code maki's kernel confines) install from a signed `.maki` file, or
> from the maki store ([maki-apps](https://github.com/KaraZajac/maki-apps): reviewed, and rebuilt
> from their source), after maki shows you what they are and who signed them, and run below maki's
> own bar. The desktop side is tested against a stand-in for maki that runs maki's own code; the
> screens below are maki's firmware in the emulator. Nothing runs on a badge yet.
> [ARCHITECTURE.md](./ARCHITECTURE.md) is the plan, [RESEARCH.md](./RESEARCH.md) the background,
> [DEVELOPMENT.md](./DEVELOPMENT.md) the build loop.

![maki's screens in the emulator: the home screen on Bitcoin; asks to keep a login for github.com, to pick which login to fill on gist.github.com, and to keep one for a long hostname cut at the start so its end still shows; a Bitcoin transaction's payment, fee and sign pages; and a receiving address as a QR code](docs/screens.png)

![maki's app screens in the emulator: the install screen for Dice, a sideloaded example app (its name, version and ID); Dice running below maki's bar, which marks it as sideloaded; its menu, on App info; and App info's pages: the app, where it's from, its developer's key, whether its data is in the backup (with "leave it out"), and Remove](docs/apps.png)

![maki desktop's Apps page: maki's room for apps as a bar (131 KiB of 2 MiB, room for 29 more apps), a segment each for Pomodoro, SSH and Dice; the three installed, from the maki store, Pomodoro marked native; and the maki store's apps in a grid by category, fetched from KaraZajac/maki-apps](docs/desktop.png)

## The idea

A YubiKey's touch proves you're there. It doesn't prove what you approved: you tap, and
whatever your computer asked for gets signed. The DC34 core module has a 128×128 OLED and
buttons, so maki shows you what you're signing (the site you're logging into, the SSH
user, the commit, the transaction) and waits for you to press a button.

Planned apps:

- **Passkeys, passwords and TOTP**, building on the stock vault, with the browser extension
  filling logins and codes once you approve them on maki; passkeys come from the same recovery
  phrase as everything else, so a restored maki still opens every site
- **SSH and git signing** (working in the emulator and against the stand-in): an SSH key from
  your recovery phrase, in maki's SSH app; maki desktop is the SSH agent ssh and git use, and
  every sign-in (with the user, and the server's host key when ssh passes it on) and every git
  signature waits for your yes on maki. Not yet: the commit itself on maki's screen (git hands
  the agent only its hash)
- **A small Bitcoin wallet** (working in the emulator): keys on maki behind the boot PIN, from a
  recovery phrase you write down; every payment, the change and the fee shown on maki's screen
  before a transaction is signed; receiving addresses as QR codes that never touch the computer
- **An Ethereum account** (working in the emulator and in the browser): sites connect only when
  you allow them on maki, and every message and transaction is shown on maki before it's signed,
  token transfers and approvals spelled out
- **Community apps** (working in the emulator): signed `.maki` bundles, installed through maki
  desktop after maki shows you the app, where it's from, its developer's key and what it asks
  to do, and run in a WebAssembly sandbox that reaches nothing it wasn't given. With your
  permission, an app can ask you things on maki's own screen, have secrets of its own from your
  phrase, type into your computer, and talk to software on it. Native apps too, machine code
  in a process of its own that maki's kernel confines. An SDK with a simulator and example apps,
  and the maki store, reviewed and rebuilt from source, in maki desktop: Pomodoro (a focus timer
  whose circle shrinks while you work), Dice, Tally, Sensors and SSH so far

## Who it's for

DEF CON 34 badge owners. maki runs in the badge's developer mode, which retail baosec
units ship with permanently disabled.

## Read this before you flash

**Flashing is a one-way door.** Developer mode permanently erases the badge's factory
secrets: the light-exchange key, `THE_FLAG_1`, and everything the stock vault was storing,
including TOTP codes, passwords and passkeys. Move those somewhere else first.

**It's not a vault.** maki protects your keys from malware on your computer: nothing is
signed without a button press, with the details on screen. It does **not** protect them from
someone who has your badge. In developer mode anyone can flash their own firmware and read
what's on it. Treat it like a Flipper, and don't keep anything on it you can't afford to lose.

This is unaudited firmware from a hobby project.

## Background

Research on the silicon, the boot chain and the published attacks lives in
`~/Projects/BAOSEC`, and the brief links the public sources.

## License

BSD 3-Clause for now; under review, see [RESEARCH.md §8](./RESEARCH.md#8-open-questions).
