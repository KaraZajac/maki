# SSH, git and files

maki keeps signing and decryption keys made from your recovery phrase, and uses them only when you
say so on its screen, with what's being signed in front of you. Each is an app from the store:
**SSH**, **OpenPGP**, **Minisign** and **Age**. maki desktop connects them to the tools you already
use, from its **SSH, Git & keys** page.

## SSH

With the SSH app on maki, maki desktop is an SSH agent. ssh and git talk to it through
`SSH_AUTH_SOCK`, which the **SSH, Git & keys** page shows; it hands each request to the app on maki,
which shows the user you're signing in as (and the server's host key, when ssh passes it on) and
asks you. The agent holds no keys.

```sh
export SSH_AUTH_SOCK=…            # as the SSH, Git & keys page shows it
ssh-add -L                        # maki's public key, for a server's authorized_keys
ssh you@example.com               # maki shows who and where, and asks
```

The key is Ed25519, from your recovery phrase: the same on a restored maki.

### A certificate authority

Turn on the SSH app's certificate authority from its menu on maki, and the agent offers its key
too. `ssh-keygen -s ca.pub -U` signs SSH certificates with it, each one read out on maki first:
user or host, for whom, until when, with what restrictions. Servers that trust the CA's key
(`TrustedUserCAKeys`) take every certificate it signs.

## Signing git commits

git can sign commits and tags with maki's SSH key:

```sh
git config --global gpg.format ssh
git config --global user.signingkey "key::$(ssh-add -L | head -n 1)"
git config --global commit.gpgsign true
```

Through the agent alone, maki sees only a hash of what git signs. Install **maki-ssh-keygen** from
the **SSH, Git & keys** page and make it git's `gpg.ssh.program`, and git's commits and tags go to
maki whole: maki shows each one's subject and author, from the very bytes it signs, before it signs.
`git verify-commit` checks them as ever.

## gpg: an OpenPGP key

The OpenPGP app keeps an OpenPGP key (Ed25519 to sign, Curve25519 to decrypt). maki desktop's
**maki-gpg** stands in for gpg where software calls it, as git does (`gpg.program`): what's signed
comes to maki whole, and maki makes the signature itself, a commit read out by its subject first. A
message's session key is unwrapped on maki once you say yes. Save maki's public key from the
**SSH, Git & keys** page and import it into GnuPG anywhere; GnuPG verifies what maki signs.

## minisign: signing files

The Minisign app keeps a minisign key. **maki-minisign** (installed from the **SSH, Git & keys**
page) signs as minisign does:

```sh
maki-minisign -Sm release.tar.gz          # maki shows the file's name and size, and asks
minisign -Vm release.tar.gz -P RW…        # anyone checks it, with minisign itself
```

maki signs a trusted comment dated by its own clock, and the public key is on the
**SSH, Git & keys** page, as `minisign.pub` or the one-line form `minisign -P` takes.

## age: files only maki opens

The Age app keeps an age key. Anyone encrypts files to its recipient with age as it is; to open one,
age runs maki desktop's **age-plugin-maki**, which hands maki the file's key as age wrapped it, and
maki asks you before it unwraps it:

```sh
age -r age1… -o secret.age secret.txt            # anyone, anywhere
age -d -i maki-identity.txt secret.age           # maki asks, then opens it
```

The **SSH, Git & keys** page installs the plugin and saves the identity file, which holds no secret:
only which maki can open it.
