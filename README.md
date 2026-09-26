# BAOKEY

Turning the DEF CON 34 `baosec-lite` core module into an open hardware security module
that speaks the YubiHSM 2 protocol — and then does the things a YubiHSM 2 can't, because
it has a screen and three buttons.

> **Status: research.** No firmware yet. Nothing here has run against hardware.
> Start with [RESEARCH.md](./RESEARCH.md) — the feasibility brief, the protocol notes,
> and the open questions.

## The idea

A YubiHSM 2 holds keys and signs things without releasing the key material. It also has
no display, no buttons, and no way to tell you what it's about to sign. Its password
lives in a config file on the host, so a compromised host signs whatever it likes,
silently, forever.

The Baochip-1x module from the DC34 badge has a 128×128 OLED, three buttons, RSA/ECC/
Ed25519 hardware, a TRNG, a hardware keystore, monotonic counters, and 4 MiB of RRAM.
It can do everything a YubiHSM 2 does with more storage, and it can also show you the
digest and make you press a button.

The goal is **protocol compatibility first** — so that `yubihsm-shell`, the PKCS#11
module, and the Python/Go/Rust clients work unmodified — with the screen-and-button
policy layer added as extensions that degrade cleanly for clients that don't know
about them.

## Approach

Rather than claiming Yubico's USB IDs, BAOKEY reimplements `yubihsm-connector`: a small
host daemon exposing the same `POST /connector/api` HTTP interface, talking to our own
USB device. Every piece of Yubico host tooling can be pointed at a connector URL, so the
whole ecosystem comes along for free. See [§5 of the brief](./RESEARCH.md#5-proposed-architecture).

## Hardware background

Prior research on this module — the silicon, the boot chain, the published attacks, and
a verified build environment — lives in `~/Projects/BAOSEC`.

## Warning

This is a research project. Any firmware that comes out of it will be an unaudited
home-grown implementation of a security protocol. Don't put real key material on it.

Flashing custom firmware onto a DC34 badge is **irreversible** and destroys the module's
provisioned secrets. Read [§4.1](./RESEARCH.md#41-flashing-is-a-one-way-door) first.

## License

BSD 3-Clause. See [LICENSE](./LICENSE).
