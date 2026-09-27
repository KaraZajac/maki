# BAOKEY

Community firmware for the DEF CON 34 badge's core module: a security key with a screen,
and an app platform for the hacker community to build on. Flipper-style custom firmware,
for your keys.

> **Status: early development.** The custom firmware is named **maki**. It builds and boots in an
> emulator: a boot PIN, a recovery phrase, a home screen, the vault, a Bitcoin wallet and a serial
> link. A desktop app in the tray ([maki-desktop](https://github.com/KaraZajac/maki-desktop)) keeps
> it linked, its clock verified with Roughtime and its backups encrypted on the computer; a browser
> extension asks maki for logins and TOTP codes, which you approve on maki's screen; and Bitcoin
> wallet software (Sparrow, Bitcoin Core) sends transactions through it for maki to show you and
> sign. The desktop side is tested against a stand-in for maki that runs maki's own code; the
> screens below are maki's firmware in the emulator. Nothing runs on a badge yet.
> [ARCHITECTURE.md](./ARCHITECTURE.md) is the plan, [RESEARCH.md](./RESEARCH.md) the background,
> [DEVELOPMENT.md](./DEVELOPMENT.md) the build loop.

![maki's screens in the emulator: the home screen on Bitcoin; asks to keep a login for github.com, to pick which login to fill on gist.github.com, and to keep one for a long hostname cut at the start so its end still shows; a Bitcoin transaction's payment, fee and sign pages; and a receiving address as a QR code](docs/screens.png)

## The idea

A YubiKey's touch proves you're there. It doesn't prove what you approved: you tap, and
whatever your computer asked for gets signed. The DC34 core module has a 128×128 OLED and
buttons, so BAOKEY shows you what you're signing (the site you're logging into, the SSH
user, the commit, the transaction) and waits for you to press a button.

Planned apps:

- **Passkeys, passwords and TOTP**, building on the stock vault, with the browser extension
  filling logins and codes once you approve them on maki; passkeys come from the same recovery
  phrase as everything else, so a restored maki still opens every site
- **SSH and git signing**: see the user and the commit before you approve
- **A small Bitcoin wallet** (working in the emulator): keys on maki behind the boot PIN, from a
  recovery phrase you write down; every payment, the change and the fee shown on maki's screen
  before a transaction is signed; receiving addresses as QR codes that never touch the computer
- **Community apps**, installed from the browser over USB, each isolated from your keys

## Who it's for

DEF CON 34 badge owners. BAOKEY runs in the badge's developer mode, which retail baosec
units ship with permanently disabled.

## Read this before you flash

**Flashing is a one-way door.** Developer mode permanently erases the badge's factory
secrets: the light-exchange key, `THE_FLAG_1`, and everything the stock vault was storing,
including TOTP codes, passwords and passkeys. Move those somewhere else first.

**It's not a vault.** BAOKEY protects your keys from malware on your computer: nothing is
signed without a button press, with the details on screen. It does **not** protect them from
someone who has your badge. In developer mode anyone can flash their own firmware and read
what's on it. Treat it like a Flipper, and don't keep anything on it you can't afford to lose.

This is unaudited firmware from a hobby project.

## Background

Research on the silicon, the boot chain and the published attacks lives in
`~/Projects/BAOSEC`, and the brief links the public sources.

## License

BSD 3-Clause for now; under review, see [RESEARCH.md §8](./RESEARCH.md#8-open-questions).
