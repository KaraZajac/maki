# BAOKEY — feasibility brief

> Can the DEF CON 34 baosec-lite core module be turned into something that behaves
> like a YubiHSM 2, but with a screen and buttons?

Compiled 2026-09-25. Hardware facts come from the local `xous-core` @ `da252db56` and
the `baochip-1x` RTL checkout in `~/Projects/BAOSEC`; protocol facts come from Yubico's
docs and from third-party implementations of the wire protocol. Nothing here has been
run against a badge yet — see §8 for what's still unknown.

Prior hardware/security work on this same module lives in
[`~/Projects/BAOSEC/RESEARCH.md`](../BAOSEC/RESEARCH.md); this brief assumes it and
doesn't repeat it.

**Short answer: yes, and the protocol is the easy half.** The wire protocol is a
three-byte header plus SCP03, the host ecosystem can be reached without touching
Yubico's USB IDs, and the chip has more storage and better crypto hardware than a real
YubiHSM 2. The two things that will actually cost time are that *nobody has written a
driver for the public-key accelerator yet*, and that the USB controller has barely
enough endpoints left. Both are tractable. Neither is a weekend.

---

## 1. What a YubiHSM 2 actually is

Worth being precise, because "HSM" covers a lot of ground and a YubiHSM 2 is a much
smaller thing than the name suggests.

It is a USB device that holds keys and performs operations on them without ever
releasing the private material. It has **no screen, no buttons, and no user presence
check of any kind** — authorization is entirely "do you know the password for an
authentication key". It is designed to live permanently in a server's USB port.

- **Storage**: 128 KB, ~256 objects.
- **Auth model**: objects are owned by *domains* (16 of them) and gated by *capabilities*
  (a 64-bit bitmask: `sign-ecdsa`, `delete-asymmetric-key`, `export-wrapped`, …).
  An authentication key has a capability set and a set of delegated capabilities it can
  grant to objects it creates.
- **Session**: SCP03 — the GlobalPlatform smartcard secure-channel protocol. A static
  K-ENC/K-MAC pair derived from the auth key password (PBKDF2), a challenge exchange,
  then three session keys (S-ENC, S-MAC, S-RMAC) protecting every subsequent message.
  Newer firmware adds a P-256 ECDH asymmetric auth option.
- **Audit log**: a hash-chained log of every operation, readable and (optionally)
  blocking when full.

The product's real value is not the silicon; it's that **the host ecosystem is good**.
PKCS#11 module, `yubihsm-shell`, a Go library, a Python library, a pure-Rust client,
KSP/CNG on Windows, and integrations in Vault, PKI stacks and code-signing tooling.
That ecosystem is what we want to inherit, and §5 is about inheriting it cheaply.

### 1.1 The wire protocol

Dead simple at the outer layer. Every message is:

```
  Tc (1 byte)  command code
  Lc (2 bytes) big-endian payload length
  Vc (Lc bytes) payload
```

The response echoes the command code with the top bit set (`0x03` → `0x83`), or returns
`0x7f` for an error. A handful of commands are unauthenticated; everything else is
wrapped inside `SESSION_MESSAGE` and encrypted/MAC'd under SCP03.

Command codes we'd care about, from Yubico's reference:

| Cmd | Code | Cmd | Code |
|---|---|---|---|
| Echo | `0x01` | Generate Asymmetric Key | `0x46` |
| Create Session | `0x03` | Sign ECDSA | `0x56` |
| Authenticate Session | `0x04` | Derive ECDH | `0x57` |
| Session Message | `0x05` | Delete Object | `0x58` |
| Device Info | `0x06` | Decrypt OAEP | `0x59` |
| Put Asymmetric Key | `0x45` | Encrypt AES ECB | `0x70` |
| Decrypt PKCS1 | `0x49` | Encrypt AES CBC | `0x72` |
| Export Wrapped | `0x4a` | Blink Device | `0x6b` |

Session setup is two round trips:

```
  CREATE SESSION        →  auth key id (2)  +  host challenge (8)
                        ←  session id (1)   +  card challenge (8)  +  card cryptogram (8)
  AUTHENTICATE SESSION  →  session id (1)   +  host cryptogram (8)
                        ←  (empty)
```

Sixteen concurrent sessions, 30-second inactivity timeout, refreshed by any valid
command. All of this is ordinary GlobalPlatform SCP03 and there are clean Rust crates
for the AES-CMAC and key-derivation pieces.

### 1.2 The USB layer

| | |
|---|---|
| VID:PID | `1050:0030` |
| Interface | `0` |
| Bulk OUT | `0x01` |
| Bulk IN | `0x81` |
| Speed | full-speed, 64-byte packets |

No HID, no CCID, no class driver — raw bulk, WinUSB-bound on Windows via an `MSFT100`
descriptor. That's it. Which is why third-party implementations exist and work:
`qpernil/virtual-yubihsm` implements the whole device protocol in Rust over FunctionFS
and passes real Yubico host tooling, including SCP03, P-256 ECDH auth, the capability
model, and the hash-chained audit log. **It is the single most useful reference we have
and we should read it before writing a line of firmware.**

### 1.3 YubiKey is a different animal — and mostly not what we want

The user's question mentioned the YubiKey SDK, so, to close it out: a YubiKey is a
*smartcard*. It exposes CCID interfaces running applets (PIV, OpenPGP, OATH) addressed
by ISO 7816 APDUs, plus a FIDO2 HID interface. The tooling (`ykman`, `libykpiv`,
`yubikey-piv-tool`) talks APDUs through PC/SC.

That matters for us in two ways:

- **It's a separate, additive target.** PIV over CCID would make the module work as a
  smartcard for SSH, TLS client auth and code signing, on every OS, with no custom
  connector. That's arguably a *better* first deliverable than the HSM protocol.
- **The badge already does the FIDO half.** `apps-baosec/dc34-vault` is an OpenSK-derived
  CTAP2 implementation with `ctap-crypto`, `cbor` and `persistent_store`, running over
  a `RawFido` HID interface. We would not be starting from zero on FIDO2.

The two do not conflict at the protocol level, but they do conflict at the *endpoint
budget* level — see §4.2.

---

## 2. Does the chip have the crypto?

This is where I stopped trusting marketing copy and read the RTL and the drivers.

### 2.1 What the silicon has — confirmed in RTL

`hw/baochip-1x/rtl/modules/crypto_top/rtl/` contains `pke.sv`, `aes.sv`, `combohasha.sv`,
`hashcore*.sv`, `trng.sv`, all hanging off an `sce` (Secure Crypto Engine) DMA fabric.

**Public key engine** (`pke.sv`, 1580 lines) is genuinely capable. Its function decode
selects between three modes:

```systemverilog
    assign cr_func_ec  = ( cr_func[7:4] == 4'h0 );   // short Weierstrass
    assign cr_func_rsa = ( cr_func[7:4] == 4'h1 );
    assign cr_func_ed  = ( cr_func[7:4] == 4'h2 );   // twisted Edwards
```

with segment allocations sized for **RSA up to 4096 bits** (the comment on the `H`
segment reads *"H is higher by 2 word for lenght=4096 the H will need 4097 bit"*) and
separate Edwards-curve point representation including a `T` coordinate — i.e. extended
projective coordinates, which is the Ed25519 formulation. There's also a `maskseed`
register feeding operand masking, so side-channel countermeasures were designed in.

So: **RSA-2048/3072/4096, P-256/P-384-class prime curves, and Ed25519 are all in scope
for hardware acceleration.** That covers essentially the whole YubiHSM 2 algorithm list.

**Hashing** (`libs/bao1x-api/src/sce/combohash.rs`) is the one block with a software API
already defined, and it's generous: SHA-256, SHA-512, RIPEMD, BLAKE2s, BLAKE2b, BLAKE3,
SHA-3, plus HMAC-256 and HMAC-512 as first-class hardware modes.

**AES** on this target does *not* go through the SCE `aes.sv` block. `services/aes`
routes bao1x builds to `zkn.rs` — the **RISC-V Zkn scalar crypto extension**, i.e. AES
instructions in the VexRiscv core itself — with a `chaffing` variant that injects decoy
operations for side-channel resistance. (The older `vex.rs` custom-instruction path is
explicitly excluded on bao1x: `not(feature = "bao1x")`.) This is fine; it's real
acceleration, and it's already in use.

**TRNG** is driven and working (`libs/bao1x-hal/src/sce/trng.rs`, plus `services/trng`).

Alongside: a hardware key store, monotonic one-way counters (anti-rollback and
usage-limit counters for free), glitch sensors, ECC-protected RAM, and a secure mesh.
A real YubiHSM 2 is a smartcard MCU with none of the introspection story — this chip is
IRIS-inspectable against published RTL, which for a security device is a genuinely
better position than the thing we're cloning.

### 2.2 What the software has — and this is the gap

> **`libs/bao1x-hal/src/sce/` contains exactly one file: `trng.rs`.**
> **`libs/bao1x-api/src/sce/` contains exactly one file: `combohash.rs`.**
>
> Verified against upstream `main` via the GitHub API today, not just the local
> checkout. As of 2026-09-25 **there is no PKE driver in Xous.** The hardware is there,
> the RTL is public, and nobody has written the software to drive it.

That is the headline finding of this brief. Everything the badge currently does with
asymmetric crypto — the FIDO2/CTAP2 P-256 work in `dc34-vault` — runs in **software**,
via the OpenSK-derived `ctap-crypto` library.

Two consequences:

1. **A software-only BAOKEY is possible today.** RustCrypto (`p256`, `p384`, `ed25519`,
   `rsa`) on a 350 MHz RV32-IMAC with an MMU and 2 MiB of SRAM will work. It'll be slow
   — an RSA-4096 signature is plausibly seconds, not milliseconds — and constant-time
   behaviour is on us. But it unblocks the entire protocol stack immediately, and it
   means the PKE driver is an *optimization*, not a prerequisite.
2. **Writing the PKE driver is the highest-value contribution this project could make**,
   and it's useful to the whole Baochip ecosystem, not just us. It's also the riskiest
   item: driving an undocumented-from-software crypto DMA engine from SystemVerilog
   plus the auto-generated register docs at `ci.betrusted.io/bao1x/` is real work, and
   getting it *wrong* in a way that's subtly non-constant-time is worse than not doing
   it. Budget it as its own project phase with its own test vectors.

### 2.3 Storage

A YubiHSM 2 gives you 128 KB and 256 objects. We have **4 MiB of RRAM** plus external
SPI flash behind the swap mechanism, and — importantly — `services/pddb`, an existing
encrypted, authenticated object database with an established API, already a dependency
of the vault app.

The hardware key store itself is small: `KEY_SLOTS` on baosec is 7–8 entries. That's
the right size for *root* keys, not for user objects. The architecture that falls out
of this is the same one a real HSM uses: a device master key lives in the hardware
keystore, and it wraps a PDDB-backed object store holding everything else. Object count
and total storage stop being meaningful limits.

---

## 3. The differentiator: screen and buttons

This is the part that isn't a clone, and it's worth designing deliberately rather than
bolting on.

A YubiHSM 2 cannot tell you what it's doing. If a host is compromised, it will sign
whatever it's told to sign, forever, silently — the password lives in the host's config
file. The entire security model is "the key can't be extracted", not "the key can't be
misused".

With a 128×128 OLED and three buttons we can add:

- **Per-operation confirmation.** Hold-to-approve on a signature, with the digest (or a
  decoded summary, for structured payloads like an X.509 CSR or an SSH certificate)
  shown on screen. This is the Ledger model and it defeats host compromise.
- **Policy per key, set at creation.** "Always confirm", "confirm once per session",
  "rate-limit to N/hour", "never confirm" (for the server-in-a-rack use case). Expressed
  as an extension to the capability bitmask, which has spare bits.
- **Out-of-band unlock.** A PIN entered on the device, not typed into the host. The
  device password stops being the only thing standing between an attacker and the keys.
- **Trustworthy attestation of what happened.** The audit log is only as good as your
  trust in the device; a screen lets the device *show* you the log entry as it's written.
- **Usage counters in hardware.** The one-way counters mean "this key may be used 100
  times, ever" is enforceable in silicon, not policy.

Protocol-wise these fit cleanly: an operation that needs confirmation returns a
"pending / touch required" error that existing clients already know how to retry on, or
simply blocks until the timeout. Clients that don't know about the feature still work;
they just see a slow HSM. **Compatibility should be the default and every extension
should degrade to standard behaviour.**

---

## 4. Risks and hard constraints

### 4.1 Flashing is a one-way door

Loading our own firmware puts the module into developer mode: irreversible, erases the
provisioned secrets, increments a permanent counter. `THE_FLAG_1` and the light-exchange
key are gone for good.

The post-con Bird Challenge deadline (~2026-09-20) has passed, so that's no longer a
reason to wait. But **`THE_FLAG_1` has been extracted by others and its value was
deliberately withheld — it is still findable, and flashing forfeits it.** If that matters,
extract it first via the sealed-mode route documented in
`~/Projects/BAOSEC/research/dc34badge`.

**We have two core modules, which largely defuses this.** One becomes the dev unit and
gets flashed; the other stays sealed as a reference — for diffing behaviour, for
verifying that a stock badge still interoperates with whatever we build, and as the
fallback if the dev unit gets bricked. Restocking is not an option on any useful
timescale: the `dabao` breakout is pre-order only, shipping 2026-12-15 at $12 plus
$10–18 postage, and Baochip-1x chips themselves aren't generally available until Q4
2026. **Treat both modules as irreplaceable for the duration of this project.**

Either way, phases 0–3 don't need hardware at all: `cargo xtask baosec-emu` runs the UX
hosted on x86, and the whole protocol stack can be developed and tested there against
real Yubico client tooling. Don't spend the door earlier than necessary.

### 4.2 The USB endpoint budget is nearly exhausted

From the SoC docs (`docs/src/ch05-00-usb.md`):

> Supports 5 endpoints: EP0 supports Control Transfer; EP1/2/3/4 support Bulk and
> Interrupt Transfer.

`CRG_EP_NUM = 8` in the driver counts directions (four physical endpoints, IN and OUT
each). The current baosec-lite composite device spends them on an NKRO keyboard, the
RawFido HID pair, and CDC-ACM serial (notification + bulk IN + bulk OUT). There's a
comment in `services/usb-bao1x/src/hw.rs` making the squeeze explicit:

> there are not enough endpoints availbale to concurrently add that in - you have to
> kick out one of the interfaces above to add mass storage!

A YubiHSM bulk pair needs two more. **We can have the HSM interface, but not while also
keeping everything the vault ships with.** That's an argument for BAOKEY being its own
firmware image rather than an app added to the DC34 vault — and it means "HSM + FIDO2 +
PIV/CCID all at once" is probably not on the table. Pick two, or make the interface set
configurable at build time.

### 4.3 High speed vs. full speed

The badge's USB is HS-capable and the serial interface uses 512-byte packets. A real
YubiHSM 2 is full-speed with 64-byte bulk packets. Whether Yubico's host libraries care
is **untested** — a well-behaved libusb client reads the max packet size from the
descriptor, but "well-behaved" is an assumption, and Yubico had no reason to test
against a HS device. Declaring the interface as full-speed is the conservative move and
costs us nothing at HSM message sizes. Flag this as a thing to verify early against
`yubihsm-shell`, because it's cheap to test and expensive to discover late.

### 4.4 Don't claim Yubico's USB IDs

`1050:0030` is Yubico's. Shipping a device that presents those IDs is trademark
infringement, will confuse host software about what it's talking to, and would make the
project un-publishable. See §5 for the way around it, which turns out to be better
anyway.

### 4.5 This is a security device built by us

Worth saying plainly. A clone of an HSM protocol with a home-grown SCP03 implementation,
software RSA, and a hand-written crypto driver is a research artifact. It should carry
an unambiguous "not audited, not for production key material" warning, and we should
resist the temptation to soften that later just because it works well.

---

## 5. Proposed architecture

The insight that makes this cheap: **`yubihsm-connector` is a trivially reimplementable
HTTP shim.**

Yubico's own tooling doesn't have to talk to USB. The connector is a small daemon that
listens on `localhost:12345` and exposes `POST /connector/api` with
`Content-Type: application/octet-stream`, passing raw protocol frames through to the
device, plus a `/connector/status` endpoint. `yubihsm-shell`, the PKCS#11 module,
python-yubihsm, yubihsm.rs and the Go library can all be pointed at an arbitrary
connector URL.

So we write **`baokey-connector`**: same HTTP API, our own USB transport, our own
VID/PID under the OpenMoko `1d50` space the Baochip devices already use. Every piece of
Yubico host software then works **unmodified**, we never touch their USB IDs, and we get
a natural place to put host-side extensions the standard protocol has no room for.

```
  ┌───────────────────────────────────────────────┐
  │ unmodified Yubico ecosystem                   │
  │ yubihsm-shell · PKCS#11 · python · Go · Rust  │
  └────────────────────┬──────────────────────────┘
                       │ HTTP POST /connector/api
                       │ application/octet-stream
  ┌────────────────────┴──────────────────────────┐
  │ baokey-connector        (host, Rust)          │
  │  · yubihsm-connector-compatible HTTP API      │
  │  · USB bulk transport, VID 1d50 / our PID     │
  └────────────────────┬──────────────────────────┘
                       │ USB bulk  ·  T(1) L(2) V framing
  ┌────────────────────┴──────────────────────────┐
  │ BAOKEY firmware         (Xous, baosec-lite)   │
  │  ┌─────────────────────────────────────────┐  │
  │  │ transport    bulk EP pair, TLV framing  │  │
  │  │ session      SCP03 · 16 sessions        │  │
  │  │ dispatch     command table · caps · ACL │  │
  │  │ policy   ◄── OLED + buttons ── NEW      │  │
  │  │ objects      PDDB, wrapped by keystore  │  │
  │  │ crypto       RustCrypto → PKE driver    │  │
  │  └─────────────────────────────────────────┘  │
  └───────────────────────────────────────────────┘
```

Suggested phasing, each phase independently useful:

| Phase | Deliverable | Where it runs |
|---|---|---|
| 0 | Protocol crate: TLV framing, SCP03, command/response types, capability model. Tested against `virtual-yubihsm` and real Yubico clients. | host only |
| 1 | `baokey-connector` + a software device backend. Proves the ecosystem accepts us. | host only |
| 2 | Firmware: bulk transport, session layer, object store on PDDB, software crypto. | `baosec-emu` |
| 3 | Screen/button policy engine. The actual point of the project. | `baosec-emu` |
| 4 | Flash real hardware. ← the one-way door | badge |
| 5 | PKE hardware driver. Upstreamable to xous-core on its own merits. | badge |

Phases 0–3 need no badge and cost no secrets. That's most of the project.

---

## 6. The alternative worth considering

If the goal is "a useful key device" rather than "a YubiHSM-compatible device",
**PIV over CCID** beats the HSM protocol on almost every axis:

- It's an actual standard (NIST SP 800-73), not one vendor's protocol.
- OpenSC gives you PKCS#11 for free, already packaged on every distro.
- It works with no connector daemon, no custom host software, nothing to install.
- SSH, TLS client auth, code signing, and Windows login all work out of the box.
- `ykman`/`yubikey-piv-tool` become usable management tools.

The catch is that PIV is *small*: four key slots in the base spec (plus retired slots),
no domains, no capability model, no wrapping, no audit log. It's a smartcard, not an
HSM. And it needs a CCID interface, which is another endpoint pair (§4.2).

SmartCard-HSM / Nitrokey HSM sits in between — APDU-based like PIV, with a real
key-management model, and an open PKCS#11 in OpenSC — but its own docs concede it's
"not a cryptographic accelerator", asymmetric-only.

My read: **YubiHSM 2 compatibility is the right primary target.** It has the richest
authorization model to hang the screen-and-buttons features off, its host ecosystem is
reachable through a connector we control, and the protocol is small enough to implement
correctly. PIV is the right *second* target if we want everyday usefulness, and the
object store from phase 2 would back both.

---

## 7. What this buys us over the real thing

Not a rhetorical question — worth being able to answer it.

| | YubiHSM 2 | BAOKEY |
|---|---|---|
| Object storage | 128 KB / 256 objects | 4 MiB RRAM + external flash |
| User presence | none | OLED + 3 buttons, per-key policy |
| Shows what it signs | no | yes |
| Auth | host-held password | password + on-device PIN |
| Usage limits | none | hardware one-way counters |
| Firmware | closed | open, reproducible (`baobit`) |
| Silicon | opaque | IRIS-inspectable against public RTL |
| Audited | yes, FIPS options | **no** |
| Costs you | ~$650 | a badge you already own, and its secrets |

The last two rows are the honest ones.

---

## 8. Open questions

1. **Which of the two modules becomes the dev unit?** Resolved that we have two (§4.1),
   so one gets flashed and one stays sealed. Worth labelling them physically before the
   first flash, because once dev mode is set there is no way to tell them apart from the
   host except by what they no longer know.
2. **Do we want `THE_FLAG_1` off the sacrificial module first?** Extracting it via the
   sealed-mode route in `~/Projects/BAOSEC/research/dc34badge` costs nothing but time,
   and it's the last chance for that specific unit.
3. **Primary target: HSM protocol, or PIV?** §6. This determines phase ordering.
4. **How compatible is "compatible"?** Pass Yubico's own test suites and the
   `virtual-yubihsm` qualification harness, or just "works with `yubihsm-shell` and
   PKCS#11"? The first is a much bigger commitment.
5. **Public or private long-term?** A clean-room YubiHSM-protocol implementation is
   publishable and interesting. It also invites scrutiny we'd need to be ready for.

---

## 9. Links

**Protocol**
- Command reference (authoritative): https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/hsm2-cmd-reference.html
- User guide: https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/
- Connector: https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/hsm2-tools-connector.html

**Reference implementations**
- `virtual-yubihsm` — full device protocol in Rust, the key reference: https://github.com/qpernil/virtual-yubihsm
- `yubihsm.rs` — pure-Rust client, USB constants: https://github.com/iqlusioninc/yubihsm.rs
- `python-yubihsm`: https://developers.yubico.com/python-yubihsm/
- `yubihsm-connector` (Go, the shim we're reimplementing): https://github.com/Yubico/yubihsm-connector
- `yubihsm-shell` + PKCS#11: https://github.com/Yubico/yubihsm-shell

**Hardware**
- Baochip-1x RTL (`rtl/modules/crypto_top/rtl/pke.sv`): https://github.com/baochip/baochip-1x
- Coder's guide: https://baochip.github.io/baochip-1x/
- Peripheral register docs: https://ci.betrusted.io/bao1x/
- Xous: https://github.com/betrusted-io/xous-core

**Adjacent**
- SmartCard-HSM in OpenSC: https://github.com/OpenSC/OpenSC/wiki/SmartCardHSM
- PIV (NIST SP 800-73): https://csrc.nist.gov/pubs/sp/800/73/4/final
