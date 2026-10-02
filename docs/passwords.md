# Password Maker: passwords typed by maki

maki's Password Maker app makes passwords from your recovery phrase and types them into your computer
for you. None is stored anywhere: maki makes each again whenever it's needed, so a maki restored
from your phrase has every one of them, and so does anything else that follows BIP-85, the standard
they're made by. Neither the app nor your computer ever holds one: maki types it, or shows it on
its own screen, itself, once you say yes on maki.

## How they're made

Each password is BIP-85's: a key from your phrase at a path of its own,
`m/83696968'/707764'/{length}'/{number}'` for a password of letters, digits, `+` and `/` (base64,
20 to 86 characters) or `m/83696968'/707785'/{length}'/{number}'` for one with more symbols
(base85, 10 to 80 characters), turned into text as BIP-85 says. The **number** is what makes one
password different from the next: number 0, number 1, and so on, as many as you like. The same
phrase, length and number make the same password, on any maki and in any BIP-85 tool. A
Coldcard's **Type Passwords** makes them too: its number N is maki's number N at 21 base64
characters, which is what maki's own **By number** types.

Because a password is your phrase's, keep the phrase as safe as you keep your wallets': anyone with
it can make every password you've made from it. And a password from maki is the site's password
like any other: a site that's breached loses it, so give each site a number of its own.

## Which is which

What the app keeps is which password is which: a site's name, your username there, the password's
number, its length and alphabet, and whether Enter follows it. None of that is secret, and none of
it is a password. You add them in maki desktop, under **Connections**, **Password Maker**: a site, a
username, a number (it suggests the lowest you haven't used), and maki asks you on its own screen
before it keeps it. Changing or removing one asks too.

To change a site's password, give its entry a new number: number 0 is always number 0's password,
so the old one is still there if you need it.

## Typing one

On maki, open **Password Maker** (not **Passwords**, which holds the logins you've saved), pick
the site and press the centre. maki asks **Type its password?** with the site's name; put your
cursor in the password field first, then say yes, and maki types the password, and Enter if the
entry says so. From the app's menu:

- **Log in**: your username, Tab, then the password (and Enter): for a page that asks for both.
- **Type username**: just the username, for a page that asks for it first.
- **Show it**: maki shows the password on its own screen, in fixed-width type, for typing it
  somewhere maki can't reach: a phone, a TV.
- **Delete it**: the entry goes; the password doesn't (its number makes it again).

**By number**, from the menu when the list is showing, types number N's password with no entry at
all: base64, 21 characters, then Enter, as a Coldcard does.

maki types as a US keyboard does. On a computer set to another keyboard layout, some symbols come
out as that layout has them: the site then gets those, not the password maki shows. Use a base64
password there, or set the computer's layout to US English while maki types.

## For app makers

The app is in the SDK's examples (`sdk/examples/passwords`): host API 12's
`wallet::type_password` and `wallet::show_password` are open to any app with the wallet permission
for those paths (and the keyboard permission, to type). maki makes the password and types or shows
it itself, one for each yes to a review; the app never has it.
