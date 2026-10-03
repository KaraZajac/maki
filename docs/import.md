# Moving to maki from another password manager

maki desktop brings your logins, two-step codes and passkeys over from the password manager you
use now: export from it, choose the file on maki desktop's **Logins & passkeys** page, look over
what maki will get, and send it. maki asks you once, on its own screen, and adds what it doesn't
have; nothing it already holds is changed.

## What comes over

- **Logins**: a site, a username and a password, for maki to fill through [the
  extension](extension.md). maki keeps one site for each (and its subdomains: github.com covers
  gist.github.com); an entry with several addresses comes as its first web one, and the preview
  names the others.
- **Two-step codes** (TOTP, RFC 6238), from the export's otpauth:// links or secrets, for maki's
  Authenticator and the extension. Steam's codes, and codes counted rather than timed (HOTP), aren't
  RFC 6238's, and stay behind.
- **Passkeys**, where the export carries them, ES256 ones (nearly all): Bitwarden's JSON, Proton
  Pass's export, KeePass's XML (KeePassXC keeps its passkeys there), Keeper's JSON and the FIDO
  Alliance's Credential Exchange Format do. CSV files never carry passkeys, nor do 1Password's and
  LastPass's exports: make those again on maki, site by site.

Cards, secure notes and identities aren't logins, and stay behind; the preview says so, line by
line.

## The exports maki desktop reads

Bitwarden (its JSON export, a password-protected one too, or CSV), Proton Pass (its export, not the
PGP-encrypted one, or CSV), LastPass (CSV), 1Password (1PUX or CSV), KeePassXC and KeePass (CSV, or
KeePass 2's XML, which carries the passkeys KeePassXC keeps; in KeePass, File › Export › KeePass XML
(2.x)), Dashlane (CSV: Settings › Export data), Chrome, Edge, Brave and the other Chromium browsers
(CSV), Firefox (CSV), Apple Passwords and Safari (CSV, with codes), NordPass (CSV), Enpass (JSON),
Keeper (JSON or CSV), and the FIDO Alliance's Credential Exchange Format. Any other CSV works too:
maki desktop asks which column is which. What it can't read (an encrypted export only its own app
opens, a database rather than an export) it says, with what to export instead.

## Importing

1. On maki desktop's **Logins & passkeys** page, under **Import**, choose the export (or several
   files, for an export that comes in more than one). maki desktop says which format it found.
2. Look over the preview: how many logins, codes and passkeys; each entry's site, username and what
   it brings (never its password); what's left out, and why. Untick anything you'd rather leave.
3. **Send to maki.** maki shows where it's from and how many of each, and asks; say yes on maki.
   maki desktop then says what was added, and what maki already had.

The export holds every password in plain text: once it's in, delete it. maki desktop offers to move
it to the trash. Nothing of it is kept on this computer: maki desktop reads it, sends it to maki,
and lets go of it.

## Passkeys from elsewhere

A passkey maki makes comes from its recovery phrase and never leaves it. One you import is
different, and maki says so before you say yes: its key was made by the other manager, and it has
been in a file on this computer. maki marks it imported (the **Logins & passkeys** page counts
them) and uses it as its own. It isn't made from the phrase, so a maki restored from the phrase
alone won't have it: only [a backup](desktop.md#backups) brings it back. maki desktop makes one soon
after an import; keep it.

## How much maki holds

maki's vault takes up to 500 logins, 250 codes and 150 passkeys, and they share maki's encrypted
database with its apps: an import too big is turned down, with why, before anything's asked, and
one that fills the database part of the way stops there, keeping what it added and saying so. Leave
some out (untick them in the preview), or remove an app you don't use, and import again: what maki
has, it skips.
