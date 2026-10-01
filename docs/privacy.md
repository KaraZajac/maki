# Privacy

maki keeps your secrets on maki, and gives each one out only when you press yes on its own
screen. This page says what each part of maki sends anywhere, and to whom. None of them has an
account, analytics or telemetry.

## The browser extension

The extension talks only to maki desktop, on the same computer, through the browser's native
messaging. It sends nothing to any server.

- **What it hands maki desktop:**
  - The hostname of a page that asks for a login, a code or a signature.
  - A login you chose to keep.
  - The page's wallet requests (Ethereum, Solana and Nostr: what it asks to sign).
  maki desktop passes these to maki, which shows them on its screen.
- **What it gets back:** a login or a code once you've approved it on maki, which it fills into
  the page you're on, and signatures for the page. It keeps none of it.
- **What Firefox lists when you install it:** Mozilla counts anything a browser extension hands
  an app on the computer as data leaving the browser. So Firefox names these when you add the
  extension: authentication info (logins), browsing activity (the sites that ask), financial
  info (payments to sign) and communications (Nostr posts and messages).

## maki desktop

maki desktop runs on your computer and keeps what it has in its own folder there. Your backups
are encrypted by maki, with a key from its recovery phrase. It reaches the internet only for
these:

- **The time:** Roughtime servers that maki chooses, to check its clock. maki desktop passes the
  requests and their signed answers back and forth.
- **The maki store and updates:** the store's apps, its signed index, and new releases of maki
  and maki desktop, all from GitHub.
- **Wallets, when you use them:**
  - Bitcoin, through mempool.space.
  - Ethereum and its networks, and Solana, through public nodes (publicnode.com, drpc.org and
    the networks' own).
  - Monero, through your own node.
  - Prices, through CoinGecko, when shown.

  Those services see the addresses and transactions you look up or send, as they would from
  any wallet.
- **Nostr:** the relays you add for remote signing.

## maki

maki holds your keys, logins, codes, passkeys and apps' data, encrypted, and gives none of them
out without a press on its screen. It reaches nothing by itself, only through maki desktop as
above. Apps on maki get only the permissions it showed you when you installed them.

## This site

maki.netslum.io is a static site, with no cookies, analytics or sign-in.

Questions or problems: open an issue on
[maki desktop's repository](https://github.com/KaraZajac/maki-desktop/issues).
