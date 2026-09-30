# Flashing maki

maki replaces the badge's loader, kernel and apps: three files, `loader.uf2`, `xous.uf2` and
`swap.uf2`. It leaves Baochip's `boot1` alone, which is the one part that could really brick the
module. You copy the files onto the badge like onto a USB stick, in its update mode.

## Read this first

- **It's a one-way door.** maki is signed with the developer key, so it runs in the badge's
  developer mode. The first time a developer-signed image boots, the badge crosses into developer
  mode for good: its factory secrets and the stock vault's contents (TOTP codes, passwords,
  passkeys) are erased, and it can't go back. Move them somewhere else before you start. Label
  your badges if you have two: after flashing they look the same.
- **It's not a vault.** In developer mode anyone holding the badge can flash their own firmware
  and read what's stored. See [the security model](security.md).
- **Unaudited.** This is hobby firmware in early development.

## Get the files

Download the three files from the [download page](https://maki.netslum.io/download/), or build
them (below). Check them against the SHA-256 sums published beside them:

```sh
sha256sum -c SHA256SUMS
```

## Update mode

Hold one of the badge's buttons while you press its reset button (or while you plug it in). It
comes up as a USB drive called **BAOCHIP**, and a computer sees a `Baochip-1x` device (USB ID
`1d50:6196`) rather than maki.

## Copy the three files

Copy all three onto the BAOCHIP drive, and make sure each is written before the next: on Linux,
`sync` after each. Then eject the drive. An update written but not flushed is the most common cause
of a failed flash.

```sh
cp loader.uf2 /run/media/$USER/BAOCHIP/ && sync
cp xous.uf2   /run/media/$USER/BAOCHIP/ && sync
cp swap.uf2   /run/media/$USER/BAOCHIP/ && sync
udisksctl unmount -b /dev/sda1     # whichever device BAOCHIP is
```

Then press a button on the badge: it leaves update mode and boots maki.

## The first boot

On the very first boot of a developer-signed image, the badge crosses into developer mode and may
ask for a reboot. Then: Baochip's loader logo, maki's boot image (a maki roll), a "Cryptographic
wipe" progress bar while maki formats its encrypted storage, and setup. [First
boot](first-boot.md) goes on from there.

## Updating later

Flash a newer maki the same way. Your PIN, recovery phrase, name and apps stay: they're in maki's
encrypted storage, which flashing doesn't touch. maki desktop and maki speak a versioned protocol,
so update maki desktop to the release that goes with the firmware (the download page pairs them).

## Building the files yourself

The firmware is a fork of Xous; building it needs Rust and the Xous toolchain that matches it:

```sh
git clone https://github.com/KaraZajac/maki-firmware xous-core
cd xous-core
cargo xtask install-toolkit
cargo xtask baosec-lite maki-launcher~flash maki-keys vault2 maki-link maki-apps maki-app-host
ls target/riscv32imac-unknown-xous-elf/release/*.uf2
```

[DEVELOPMENT.md](../DEVELOPMENT.md) has the rest, including running a build in the emulator before
it goes near a badge.
