# BAOKEY

Community firmware for the DEF CON 34 badge's core module: a security key with a screen,
and an app platform for the hacker community to build on. Flipper-style custom firmware,
for your keys.

> **Status: early development.** Our fork builds and boots in an emulator, with a BAOKEY home
> screen and the vault as its first app; nothing runs on a badge yet. Start with [RESEARCH.md](./RESEARCH.md); [DEVELOPMENT.md](./DEVELOPMENT.md)
> has the build-and-emulate loop.

## The idea

A YubiKey's touch proves you're there. It doesn't prove what you approved: you tap, and
whatever your computer asked for gets signed. The DC34 core module has a 128×128 OLED and
three buttons, so BAOKEY shows you what you're signing (the site you're logging into, the
SSH user, the commit, the transaction) and waits for you to press a button.

Planned apps:

- **Passkeys and TOTP**, building on the stock vault
- **SSH and git signing**: see the user and the commit before you approve
- **A small Bitcoin wallet**: your seed stays on a QR code you scan, never stored on the badge
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
