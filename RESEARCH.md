# BAOKEY — design brief

> Community firmware for the DEF CON 34 badge's core module: a security key with a
> screen, and an app platform for the hacker community to build on. Flipper-style custom
> firmware, for your keys.

Rewritten 2026-09-25, replacing the earlier YubiHSM feasibility brief (its research is
kept in Appendix A). Hardware facts come from `xous-core` @ `da252db56` and the
`baochip-1x` RTL in `~/Projects/BAOSEC`. Anything marked *verified* was read in source,
not recalled. Nothing has run on a badge yet.

## At a glance

- **What:** custom firmware for the DC34 core module. Passkeys, TOTP, SSH and git
  signing, a small Bitcoin wallet, and a catalog of community apps installed from the
  browser over USB.
- **The one idea:** *a key that shows you what you're signing.* A YubiKey's touch proves
  you're present, not what you approved. A screen fixes that.
- **How it runs:** in developer mode, on Baochip's stock `boot1`. Anyone can build it,
  fork it and flash it, which is the point.
- **What it isn't:** a vault. Malware on your computer can't use your keys without you
  seeing it; someone holding your badge can read everything on it. Treat it like a Flipper.
- **Who can run it:** DC34 badge owners. Retail baosec units ship with the developer key
  revoked, which permanently rules out developer mode, so the audience is the badges
  already out there.

---

## 1. Decisions, and why

### Personal key, not an HSM

The first version of this brief targeted YubiHSM 2 compatibility. Set aside: a screen and
buttons are a human-in-the-loop feature, and an HSM exists to serve software with no human
around, like a CA server or a build box. The differentiator would be switched off in the
HSM's main job. A personal key is where the gap is: you tap a YubiKey without knowing what
you approved, so malware that sends its own request at the moment you expect one gets it
signed.

### Developer mode, not a Baochip-signed `boot1`

Baochip offers a path where they sign a third party's `boot1`, after which only that
party's images run (Appendix B). That's real secure boot, and it's exactly wrong here: it
turns the device into a walled garden where only we can sign code. Community firmware needs
everyone to be able to build, fork and flash.

What developer mode costs, precisely:

| Threat | Protected? |
|---|---|
| Malware on your computer using your keys silently | **Yes.** Every use needs a button press with the details on screen, and keys never leave the badge |
| A catalog app reading another app's keys | **Yes, once §5.2 is built** |
| Someone who takes your badge | **No.** Anyone can flash a developer-signed image and read the keys |
| A code-execution bug in BAOKEY itself | **No.** See §3.3 |

The screen's protection never depended on secure boot, so it survives developer mode
intact. What's lost is resistance to physical access, which is exactly the Flipper
situation. An optional passphrase (§3.4) buys some of it back.

It's also how this badge was meant to be hacked. bunnie's framing for DC34: cheaters get to
run arbitrary code, but they forfeit the in-game secrets.

### Leave `boot1` alone

Developer mode only needs us to replace the loader, kernel and apps (`loader.uf2`,
`xous.uf2`, `swap.uf2`). Replacing `boot1` is the one operation that can genuinely brick
the module, it needs the two-step `alt-boot1` procedure, and without Baochip's signature it
buys nothing. Keeping the stock `boot1` also means users keep getting Baochip's `boot1`
hardening.

One consequence, which corrects earlier advice: the `collateral` key bank (Appendix B) is
erased by `boot0` on every boot whenever `boot1` carries Baochip's keys, and the stock
`boot1` does (*verified*, `bao1x-boot/boot0/src/main.rs`). Collateral is unusable in this
configuration, so the key hierarchy shouldn't be designed around it.

### Apps are isolated even though the device isn't locked

Developer mode means anyone *holding* the badge can replace the firmware. It says nothing
about what an app you *installed* can do. Those are different threats, and for a community
catalog the second is the likely one. On a Flipper, apps run with access to the whole
device. BAOKEY apps each get their own address space from the MMU, and that's worth
protecting (§5.2).

---

## 2. The hardware

The DC34 badge is two boards. BAOKEY targets the removable **core module** (T6 Torx, two
screws), which works standalone over USB-C. Background on the silicon, the boot chain and
the published attacks is in `~/Projects/BAOSEC/RESEARCH.md`.

| | |
|---|---|
| CPU | Baochip-1x: VexRiscv RV32-IMAC @ 350 MHz, **with an MMU** |
| Coprocessors | 4× PicoRV32 "BIO" cores for I/O |
| Display | 128×128 mono OLED |
| Input | 3 buttons, plus reset |
| Camera | GC2145 sensor; the video service works on 256×240 frames. The stock vault already reads QR codes with it |
| Clock | RTC runs while powered. No battery on the module, so it forgets the time when unplugged |
| USB | 2.0 high-speed device: EP0 plus **4 endpoints** (§2.3) |

### 2.1 Storage (*verified*, `libs/bao1x-api/src/offsets/`)

| Where | Size | Holds |
|---|---|---|
| On-chip RRAM | 4 MiB | `boot0`, `boot1`, loader, kernel image (2.8 MB, ~570 KB free), key slots |
| SPI flash: app region | 4 MiB | App code. The stock DC34 vault uses **1.1 MiB** |
| SPI flash: PDDB | 4 MiB | Encrypted, authenticated database: keys, TOTP seeds, passkeys |
| PSRAM | 8 MiB | Encrypted swap |
| SRAM | 2 MiB | Working memory |

For scale, a Ledger Nano S Plus has 1.5 MB for apps and a Nano X has 2 MB. Secrets are tiny
(a wallet seed is 64 bytes, a TOTP entry about 100), so storage limits nothing planned
here. Code size is the budget that matters, and there's about 2.9 MiB of headroom.

### 2.2 Crypto hardware: present in silicon, mostly undriven

| Block | In silicon | Driven today |
|---|---|---|
| Public key engine (`pke.sv`) | RSA up to 4096-bit; short-Weierstrass curves with the curve parameters loaded as operands (P-256, secp256k1, …); twisted Edwards (Ed25519); operand masking | **No.** No driver exists upstream (checked via the GitHub API, 2026-09-25) |
| Hash engine (`combohash`) | SHA-256/512, SHA-3, BLAKE2s/2b, BLAKE3, RIPEMD-160, HMAC-SHA256/512 | The bootloader's SHA-2 (`bao1x-boot/sha2-bao1x`); userland coverage unverified |
| AES | RISC-V Zkn instructions in the CPU, with a "chaffing" side-channel mode | Yes (`services/aes`, `zkn.rs`) |
| TRNG, key slots, one-way counters | | Yes |

All asymmetric crypto today, the vault's passkeys included, runs in software. That's fine
for P-256 and Ed25519 and slow for RSA. A PKE driver would be the most useful low-level
contribution this project could make, and it's worth upstreaming on its own.

The hash list reads like a wallet spec: RIPEMD-160's main real-world use today is Bitcoin
addresses, and HMAC-SHA512 is the primitive under BIP32 key derivation and BIP39 seeds.

### 2.3 USB endpoints

EP0 plus four endpoints, per the SoC docs. The stock vault spends them on a keyboard (for
autotyping), a FIDO HID pair, and USB serial (CDC-ACM), and a comment in
`services/usb-bao1x/src/hw.rs` notes there's no room for another interface without dropping
one. BAOKEY needs nothing new: passkeys use FIDO HID, and everything else (signing
requests, setting the time, installing apps) rides the vault's existing vendor-command
channel over FIDO HID, or the serial port.

---

## 3. Security model

### 3.1 What the screen protects

Every key operation shows what it's about to do and waits for a button press, and keys
never leave the badge over USB. That defeats the common attack on hardware keys: host
malware triggering an operation the user didn't intend.

### 3.2 The rule that makes it real

**Show only what the badge verified itself, or mark it as unverified.** A screen that
displays whatever the host claims is decoration.

The stock vault slips here (*verified*, `vault2/src/ctap/mod.rs:845,862`). On passkey
registration it shows `rp.name` when the site sets one, which is free text the website
chooses, instead of `rp.id`, the domain the browser checked. A phishing page on `evil.com`
can make the screen say "GitHub". The impact is low because the passkey is still bound to
`evil.com`, but it's the pattern to avoid, and fixing it upstream is about one line.

The same rule shapes every app in §4: the badge must receive the *whole* message, not a
hash, and derive what it displays from the same bytes it signs.

### 3.3 The hardware can't stop code already running on the badge

`~/Projects/BAOSEC/research/dc34badge/docs/05-fetch-acl-bypass.md` documents a silicon bug:
every access-control check in the RRAM controller is gated on `data_op`, which is always
zero during an instruction fetch. Fetching from the key and data slots returns their real
contents in any privilege mode, and it can't be fixed in firmware on this die.

So there's no hardware backstop, and any code-execution bug in BAOKEY is a full key
compromise. Keep the exposed surface small: the USB parsers, the signing-request decoders
and the app loader should be `#![forbid(unsafe_code)]` and fuzzed.

> **Embargo.** That writeup is marked unpatched and privately disclosed, under the same
> embargo as the rest of its repo. Before BAOKEY goes public, clear it with bunnie, or
> describe the constraint without the mechanism.

### 3.4 Optional passphrase

For people who want some theft resistance: mix a passphrase, entered on the badge, into the
key that encrypts the PDDB. A thief who reflashes then faces an offline brute force, which
only helps with a real passphrase, not a 6-digit PIN (the lesson of the early Trezors).

The stock baosec vault has no user PIN or passphrase at all (*verified*). The PDDB's password
code (`pw_check`, `pddb_change_pin` in `services/pddb/src/backend/hw.rs`) is compiled only for
`gen1`, the Precursor generation. On baosec (`gen2`) a change-PIN request hits
`unimplemented!("Not available in gen2 targets")`, and in the emulator first boot formats and
mounts with no prompt. The format prompt's text mentions creating a PIN, but that string is
shared with Precursor. So this section is entirely new work. (maki adds a boot PIN of its own,
over a PDDB secret basis: ARCHITECTURE.md, "On maki".)

---

## 4. Apps

In build order. Every app uses the same pipeline (full message in, parse, display, button,
sign) at rising stakes.

### 4.1 Passkeys and TOTP: already exists

`apps-baosec/vault2`, the upstream vault without the DEF CON game code, already does FIDO2
passkeys with the site on screen, TOTP and password storage, on an OpenSK-derived CTAP2
stack. BAOKEY forks it rather than rebuilding.

Two changes:

- **Set the time over USB.** The vault reads the time from a QR code because the module has
  no battery. Its `set_time()` is a single message to the RTC service, so a USB command is
  a few lines. But the host now controls the clock: it could wind it forward to harvest
  future codes, which matters because the vault can autotype them. Show the time on screen
  when it's set, and require a button press for large jumps. If we ever want it airtight,
  Roughtime gives signed time the host can relay but can't forge.
- **Fix the `rp.name` display** (§3.2).

### 4.2 SSH and git signing

- **SSH:** a host-side ssh-agent that forwards to the badge. The agent protocol hands over
  the full login message, so the badge can show the username and key from the bytes it
  signs. It can't verify *which server*, and shouldn't pretend to.
- **git:** a helper set as git's `gpg.ssh.program`. It sends the whole commit, and the badge
  hashes it itself and shows the author and subject.
- **Zero-install fallback:** `ssh-keygen -t ecdsa-sk` should already work through the FIDO
  interface (untested), but that way the badge only sees a hash and has nothing to show.

### 4.3 Bitcoin wallet, for pocket money

The natural end state of a key that shows what it signs, and the highest stakes.

- **Don't store the seed.** Keep it as a SeedQR (a QR code of the 12 or 24 words) and scan it
  with the camera for each signing session; the badge forgets it on unplug. This is
  SeedSigner's model, and it makes §3.3 irrelevant for the wallet's most important secret.
  *Superseded 2026-09-26:* Kara chose to keep the seed on maki behind a boot PIN, Ledger-style,
  with a recovery phrase and encrypted backups; see ARCHITECTURE.md, "On maki". The trade-off
  above still holds, and is why the wallet stays pocket money.
- **Bitcoin only, at first.** Its transaction format (PSBT, BIP174) can be decoded and shown
  honestly. Ethereum contract calls are opaque blobs, the "blind signing" problem Ledger
  still fights.
- **Build it after §4.2.** The transaction decoder is the most dangerous parser we'd write,
  so the pipeline should be proven on something low-stakes first.
- **Camera:** SeedQR codes are 21×21 to 29×29 modules, easy at 256×240. The dense animated
  QR codes that air-gapped wallets use for transactions are plausible but untested.

### 4.4 Community apps

Whatever people build: things that use the camera, the BIO coprocessors (already
programmable over serial with `dc34-bio`), games, anything that's fun on a small screen with
three buttons. §5.2 keeps them away from the keys.

### 4.5 Later, maybe

- **YubiHSM 2 protocol**, as an app for a homelab CA or signing box (Appendix A).
- **PIV / OpenPGP card.** Standard and widely supported, but they hand the device a 32-byte
  hash, so there's nothing to show, and they'd need CCID endpoints we don't have.

---

## 5. The app platform

### 5.1 What exists

**The BAOKEY launcher exists** (`apps-baosec/baokey-launcher` in the fork, 2026-09-26): boot
image, home screen with a status bar (name, clock), and the owner of input focus. Keys are
routed only to the app in front, which is enforced; apps only drawing while in front is
cooperative for now. Apps are still compiled into the image.

**Upstream Xous already has a runtime app loader, for Precursor** (`apps/app-loader`; an
earlier version of this brief wrongly said nobody had built one). It starts a small spawn stub
with `xous::create_process()` and streams it an ordinary Xous ELF, built separately with
`cargo xtask compile-apps` and fetched over WiFi from a host-side `tools/app_server.py`. Its
limits are the ones we'd have to fix: it's behind an `unsafe-app-loading` feature (no
signatures), loaded apps don't survive a reboot, and Xous couldn't destroy processes when it was
written. Nobody has done this for Baochip. The plan is the same two-stage mechanism with the USB
cable in place of WiFi, plus signatures and persistence.

Prior art to copy:

- **Flipper Lab**, Flipper's official store at lab.flipper.net, installs apps over Web
  Serial with no drivers, and lists about 419 apps. Chromium browsers only. The catalog
  behind it is a GitHub repo of app manifests.
- **Ledger:** apps declare in signed metadata which keys they may use, and the OS derives
  only those. The Bitcoin app can't compute your Ethereum keys even if it asks.

### 5.2 Isolation, the part to get right first

Stock Xous trusts every process, which is reasonable while one author signs one image.
Three findings (*verified*) that matter once strangers write apps:

1. The keystore registers with unlimited connections, and its app-key call reads and
   writes slots by index without checking the caller.
2. The kernel maps raw physical memory, executable included, for any process that asks, as
   long as no other process has claimed that page (`kernel/src/syscall.rs`, `MapMemory`).
3. A process can install its own exception handler, and an illegal-instruction exception
   delivers the faulting instruction's bits to it.

Together, 2 and 3 give an ordinary app the §3.3 read primitive. Not verified: whether every
key page is already claimed while the system runs. The platform shouldn't depend on it.

Requirements:

- **Apps get no raw hardware.** The loader launches catalog apps with physical mappings
  disabled, which is a small kernel change.
- **Apps never talk to the keystore.** A broker service derives per-app keys from the device
  key and the app's identity, which the loader records at launch. The raw keystore only
  accepts connections from the broker and system services.
- **The system owns a strip of the screen** that names the app asking, so one app can't fake
  another's confirmation screen.

### 5.3 Distribution

- **Catalog:** a GitHub repo of app manifests pinned to source commits, built by CI, as
  Flipper does. Trust comes from reviewable source and reproducible builds.
- **Installer:** a web page that talks to the badge over Web Serial.
- **On-device confirmation.** Any website you grant serial access can talk to the badge, so
  the badge shows the app's name, publisher key and requested permissions, and waits for a
  button before installing. That's §3.2 applied to code.
- **Sideloading** unreviewed apps sits behind an on-device developer switch with a permanent
  indicator.

---

## 6. Plan

| Step | What | Where |
|---|---|---|
| 0 | Set up the build: fork `vault2`, pin `xous-core` (layout per §8, question 4); run it in `baosec-emu` | emulator |
| 1 | Flash badge A with an unmodified developer-key build of the vault. Proves the flash path and crosses the one-way door deliberately | badge A |
| 2 | Time over USB; the `rp.name` fix | both |
| 3 | Isolation: broker, loader, no-raw-hardware flag, screen strip | emulator first |
| 4 | SSH and git signing | both |
| 5 | Web Serial installer and catalog | host + badge |
| 6 | Bitcoin wallet | both |
| 7 | PKE driver | badge |

Badge B stays sealed throughout, as a reference.

## 7. Before flashing badge A

- **Label both badges.** After the flash they look identical.
- **Everything stored on badge A is lost.** Developer mode erases the keys its storage is
  encrypted under. Move its TOTP codes to another authenticator (re-enrol from each site),
  and make sure every site using it as a passkey has another way in. Passkeys can't be
  exported, by design.
- **`THE_FLAG_1`:** last chance for this unit. The sealed-mode extraction route is in
  `~/Projects/BAOSEC/research/dc34badge`. Skip it if you don't care.
- **Build from the known-good tree** (`~/Projects/BAOSEC/xous-core`), pin the commit, and
  flash all three of `loader.uf2`, `xous.uf2` and `swap.uf2` the first time.
- **The flash:** hold a button while pressing reset to reach "Update mode" (it enumerates as
  `Baochip_1x`), copy the three files, `sync` and unmount (the most common cause of failed
  updates on Linux), then press a button to commit. The first boot erases the old keys and
  asks for a reboot. Don't touch `boot1`.

## 8. Open questions

1. **License.** `xous-core` is Apache-2.0, and `vault2`'s CTAP stack is Google's OpenSK, also
   Apache-2.0. This repo is BSD-3-Clause. Forked files stay Apache-2.0 regardless; switching
   BAOKEY to Apache-2.0, or Rust's usual MIT/Apache-2.0, would let code move to and from
   upstream without friction. There's no code yet, so changing now is free.
2. **Going public.** A community firmware has to be public eventually, and §3.3's embargo has
   to be cleared or worked around first.
3. **Upstream first?** The PKE driver and the `rp.name` fix belong in `xous-core`. The kernel
   changes for §5.2 might too, so it's worth asking bunnie early whether he'd take them.
4. ~~**Out-of-tree or fork?**~~ Settled: a fork, kept private for now at
   `KaraZajac/baokey-firmware` (see `DEVELOPMENT.md`).

---

## Appendix A: YubiHSM 2 (set aside)

Kept for a possible future app.

- **Wire protocol:** `T(1) L(2, big-endian) V`. Responses echo the command with the top bit
  set, or `0x7f` on error. Sessions use GlobalPlatform SCP03: two round trips (Create Session
  `0x03`, Authenticate Session `0x04`), then everything is wrapped in Session Message `0x05`.
  16 sessions, 30-second inactivity timeout.
- **USB:** `1050:0030`, interface 0, bulk OUT `0x01` and IN `0x81`, full-speed, 64-byte
  packets.
- **Don't clone the USB IDs.** `yubihsm-connector` is just `POST /connector/api`
  (`application/octet-stream`) on `localhost:12345`, and every Yubico tool can be pointed at
  a connector URL. A connector we write for our own device gets the whole ecosystem (PKCS#11,
  `yubihsm-shell`, the Python/Go/Rust clients) unmodified.
- **Reference implementation:** `qpernil/virtual-yubihsm`, the full device side in Rust.

## Appendix B: the Baochip-signed `boot1` path (set aside)

For a possible future locked edition. Source: `README-baochip.md`, "Third Party Firmware".

- Baochip will sign a third party's `boot1` whose key manifest carries the third party's
  keys. That party then signs everything downstream and can run `lockdown` to revoke the
  developer key.
- `boot1` refuses to lock down while it's developer-signed ("Refusing to lockdown, as that
  would brick the chip"), so there's no secure boot without Baochip's signature.
- A bank of 4×256-bit `collateral` keys (slots 261–264) survives only when `boot1`'s keys all
  differ from Baochip's. Third-party firmware must mix it into its master key, so swapping a
  Baochip-signed image back in destroys the third party's data.
- Baochip's four conditions for signing are mechanical: a distinct manifest, collateral that
  is demonstrably populated, demonstrated data loss after a swap-and-revert, and a changed
  inspection value afterwards.
- Even then, §3.3 means a code-execution bug is still a full compromise.

## Links

**Baochip / Xous**
- xous-core (start at `README-baochip.md`): https://github.com/betrusted-io/xous-core
- Baochip-1x RTL: https://github.com/baochip/baochip-1x
- Coder's guide: https://baochip.github.io/baochip-1x/
- Register docs: https://ci.betrusted.io/bao1x/
- Out-of-tree app pattern: https://github.com/bunnie/dabao-console

**Prior art**
- Flipper Lab: https://lab.flipper.net/apps
- Flipper app catalog: https://github.com/flipperdevices/flipper-application-catalog
- Ledger app isolation: https://developers.ledger.com/docs/device-app/explanation/psd/application-isolation
- SeedQR spec: https://github.com/SeedSigner/seedsigner/blob/dev/docs/seed_qr/README.md
- Roughtime: https://datatracker.ietf.org/doc/draft-ietf-ntp-roughtime/

**YubiHSM (Appendix A)**
- Command reference: https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/hsm2-cmd-reference.html
- Connector: https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/hsm2-tools-connector.html
- virtual-yubihsm: https://github.com/qpernil/virtual-yubihsm
