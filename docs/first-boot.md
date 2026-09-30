# First boot

After flashing, maki formats its encrypted storage and greets you: **Welcome to maki**. Everything
here happens on the badge, with its three buttons. None of it touches a computer.

## Set up, or restore

The first screen offers **set up maki** or **restore from phrase**. Set up makes a new recovery
phrase; restore takes one you already have (from another maki, or a Ledger, Trezor or any BIP39
wallet: maki's wallets make the same accounts from it). Either way, you choose a PIN first.

## The PIN

A PIN is 6 to 12 digits, entered one at a time. Each position starts on a random digit, so how
many presses it took says nothing about the PIN. Left and right step through 0 to 9, then delete
and done, and so does the jog dial on maki's side; the centre takes the digit under the cursor.
You enter it twice.

You'll enter it each time maki is plugged in. **Five wrong in a row wipe maki**: the keys that
unlock its storage are destroyed, and it starts over at setup. The count is kept in the chip, on a
counter that only goes up: pulling the plug doesn't reset it, and neither does putting back an old
copy of maki's storage. Your recovery phrase brings everything back.

## The recovery phrase

maki makes 24 words from its hardware random number generator and shows them one per screen. Write
them down, in order, on paper. Then maki checks a few: which is word 7, say, from four choices.

The phrase is the root of everything that can't be made again: the wallets, the key that encrypts
your backups, your passkeys, and the keys of apps that have their own (SSH, Nostr, age, sudo). A
maki restored from the phrase has all of them again. Anyone who reads the phrase has them too, so
keep the paper somewhere safe and never type it into a computer: to restore, it goes back in on
maki itself, word by word.

## A name

The first time it starts, a maki picks a name, a maki roll (natto, uni, umekyu, one of thirty-two)
and keeps it. Its home screen says it, and so does maki desktop, which helps when there's more than
one maki on the desk.

## The home screen

Left and right move through the apps; the centre opens one; both together open the menu. The bar
at the top is maki's own: the time, once maki desktop has set it, and a dot while maki is linked.
No app can draw over it.

After a minute untouched, maki rests as a clock the size of its screen, which moves a few pixels
each minute so the screen doesn't burn in. Any button brings back what was there, and does nothing
else.

## Next

Install [maki desktop](desktop.md) and plug maki in: it links by itself, sets maki's clock through
Roughtime, and from then on keeps backups. Then add what you want from [the store](apps.md).
