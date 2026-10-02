# A disk unlocked with maki

A Linux disk encrypted with LUKS2 can be unlocked by a FIDO2 security key: systemd enrolls a
credential on the key, and at boot asks the key for a secret only that credential gives (FIDO2's
hmac-secret), which opens the disk. maki is such a key, and its secret comes from your recovery
phrase: a maki restored from the phrase opens the disk too.

## At boot

The computer asks while maki is still waiting for its PIN, so maki answers what it can without its
secrets (the computer's first hello) and keeps it waiting, saying it waits for its owner, until you
enter the PIN: then maki asks you on its own screen, as it asks before a passkey signs you in, with
the disk's name for itself, `io.systemd.cryptsetup`. Say yes and the disk opens. maki waits two
minutes for its PIN; after that the computer is told nobody answered, and asks for the disk's
passphrase instead.

## Setting it up

You need systemd 248 or later (systemd-cryptenroll), a LUKS2 disk, and maki unlocked and plugged
in. Enroll maki beside the passphrase the disk already has (keep that one: maki can be lost):

```sh
sudo systemd-cryptenroll /dev/nvme0n1p3 \
    --fido2-device=auto --fido2-with-client-pin=no --fido2-with-user-verification=yes
```

maki asks you on its screen; say yes. `--fido2-with-client-pin=no` because maki has no PIN for the
computer to send: it verifies you itself, with the PIN you unlocked it with, which is what
`--fido2-with-user-verification=yes` asks for. Then tell the boot to use it, in `/etc/crypttab`:

```
luks-…  UUID=…  none  fido2-device=auto
```

and rebuild the initramfs so it has FIDO2 support (dracut's `fido2` module, or mkinitcpio's
`sd-encrypt` hook; your distribution's documentation says which). On the next boot, enter maki's PIN
when the computer stops at the disk, and say yes on maki.

## If something's wrong

- **It asks for the passphrase at once:** maki wasn't plugged in, or the initramfs has no FIDO2
  support. Plug maki in before the computer starts, and check the initramfs.
- **It asks for the passphrase after two minutes:** nobody entered maki's PIN in time. Restart and
  enter it sooner.
- **maki was lost:** use the disk's passphrase, then `systemd-cryptenroll --wipe-slot=fido2` and
  enroll another maki, or a maki restored from your phrase, which needs no enrolling: it gives the
  same secret.
