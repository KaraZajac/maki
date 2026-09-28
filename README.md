# maki

Community firmware for the DEF CON 34 badge's core module: a security key with a screen,
and an app platform for the hacker community to build on. Flipper-style custom firmware,
for your keys.

> **Status: early development.** maki builds and boots in an
> emulator and on a DC34 badge: a boot PIN, a recovery phrase, a home screen, the vault and a
> serial link. A desktop app in the tray ([maki-desktop](https://github.com/KaraZajac/maki-desktop)) keeps
> it linked, its clock verified with Roughtime and its backups encrypted on the computer, and is a
> wallet with maki's Bitcoin and Ethereum apps (balances, receiving, sending, each payment shown
> and signed on maki); a browser extension asks maki for logins and TOTP codes, which you approve
> on maki's screen, and gives sites maki's Ethereum account; and Bitcoin wallet software (Sparrow,
> Bitcoin Core) sends transactions through it for maki to show you and sign. Apps anyone can write (in Rust, for
> WebAssembly or as native code maki's kernel confines) install from a signed `.maki` file, or
> from the maki store ([maki-apps](https://github.com/KaraZajac/maki-apps): reviewed, and rebuilt
> from their source), after maki shows you what they are and who signed them, and run below maki's
> own bar. The desktop side is tested against a stand-in for maki that runs maki's own code; the
> screens below are maki's firmware in the emulator. Each maki names itself the first time it
> starts, after a maki roll (natto, uni, umekyu…); its bar shows the time, and after a minute
> untouched it rests as a clock the size of its screen. On a badge so far: setup, and the link to
> maki desktop over USB with its clock set through Roughtime; the rest is still to be tried there.
> [ARCHITECTURE.md](./ARCHITECTURE.md) is the plan, [RESEARCH.md](./RESEARCH.md) the background,
> [DEVELOPMENT.md](./DEVELOPMENT.md) the build loop.

![maki's screens in the emulator, on a maki named umekyu: asks to keep a login for github.com, to pick which login to fill on gist.github.com, and to keep one for a long hostname cut at the start so its end still shows; the Ethereum app's install screen naming the account it may sign for (Ethereum, m/44'/60'); and the Bitcoin app's pages under its own bar, marked sideloaded: a receiving address to compare with the computer's, a payment of 0.0007 BTC with its full address, the fee, and "Sign and spend"](docs/screens.png)

![maki's app screens in the emulator: the install screen for Dice, a sideloaded example app (its name, version and ID); Dice running below maki's bar, which marks it as sideloaded; its menu, on App info; and App info's pages: the app, where it's from, its developer's key, whether its data is in the backup (with "leave it out"), and Remove](docs/apps.png)

![Pomodoro, a native app, on maki's firmware in the emulator: its icon on the home screen of a maki named umekyu, the time at the top right; ready, a full pie with the minutes to focus (25); the pie emptying clockwise like a clock's hand as the focus runs; paused, two bars in a dark disc at the centre; the last sliver of the focus; the screen flashing when it's over; and the pie filling back up as the break runs](docs/pomodoro.png)

![Two of the store's apps on maki's firmware in the emulator: Status's install screen; its icon, a door hanger, on the home screen; its signs, Available, Busy and On a call, in big letters it draws itself; On a call again with the screen lit, to be noticed; Passphrase's install screen; and Passphrase, six words from the EFF's list, 77 bits](docs/examples.png)

![maki desktop's Apps page, linked to a maki named uni: maki's room for apps as a bar (220 KiB of 2 MiB, room for 28 more apps), a segment each for Pomodoro, Passphrase, Status and Snake; the four installed from the maki store, Pomodoro marked native; and the maki store's apps in a grid by category, fetched from KaraZajac/maki-apps](docs/desktop.png)

![maki desktop's Wallets page, with the BIP39 test phrase's accounts: Bitcoin on testnet4, its balance (0.00279565 tBTC), a fresh address as a QR code with Copy and "Check it on maki", and its activity, sent and received; and Ethereum, its account and what it holds on each network](docs/wallets.png)

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
- **Wallets** (apps in the maki store, working in the emulator and in the browser): Bitcoin and
  Ethereum, for those who want them, and Monero next. maki keeps the keys, from the recovery
  phrase you write down, behind the boot PIN, and lets each wallet app use only the accounts it
  names. Every payment, the change and the fee shown on maki's screen before a transaction is
  signed; receiving addresses as QR codes that never touch the computer; sites connect to the
  Ethereum account only when you allow them on maki, and every message and transaction is shown
  on maki before it's signed, token transfers and approvals spelled out
- **Community apps** (working in the emulator): signed `.maki` bundles, installed through maki
  desktop after maki shows you the app, where it's from, its developer's key and what it asks
  to do, and run in a WebAssembly sandbox that reaches nothing it wasn't given. With your
  permission, an app can ask you things on maki's own screen, have secrets of its own from your
  phrase, type into your computer, and talk to software on it. Native apps too, machine code
  in a process of its own that maki's kernel confines. An SDK with a simulator and example apps,
  and the maki store, reviewed and rebuilt from source, in maki desktop: Pomodoro (a focus timer,
  a pie that empties like a clock while you work and fills back up while you rest), Passphrase
  (diceware from maki's random number generator), Status (a sign for your desk, which your
  computer can set), Nostr (your Nostr key for sites, through the extension's `window.nostr`,
  each event shown on maki before it's signed), Age (your age key: anyone encrypts files to it
  with age, and maki desktop's `age-plugin-maki` asks maki to open each one, which you approve on
  its screen), Wi-Fi (networks as QR codes for guests to join), Bitcoin and Ethereum (maki's
  wallets), Snake, Dice, Tally, Sensors and SSH so far

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

[RESEARCH.md](./RESEARCH.md) is the design brief: the hardware, the security model, the apps
and the plan, with links to the public sources at its end.

## License

BSD 3-Clause for now; under review, see [RESEARCH.md §8](./RESEARCH.md#8-open-questions).
