# Confirm: a yes on maki before a script goes ahead

With the Confirm app on maki and maki desktop's `maki-confirm`, a script or program asks maki
before it goes ahead with something that matters: a deploy, `terraform apply`, a force push, a
database migration. maki shows the question whole, with who asked and where, and the script goes
ahead only once you say yes on maki. It's a person in the loop that a typo or the wrong terminal
can't get past, and, with a key file, a yes nothing on the computer can forge.

## What maki shows

`maki-confirm "Deploy to production?" --detail "web-1, web-2"` asks maki, and maki shows:

- **The details**, if there are any, line by line: which servers, which commits, what the plan
  changes.
- **Who asked, where:** your user, the computer's name, the directory it was asked from, and the
  program that ran `maki-confirm`, its command line quoted as a shell would take it back (say,
  `bash ./deploy.sh production`), so a space or a quote can't hide anything.

Then **the question**, with yes and no. Bytes that aren't printable ASCII are shown as escapes
(`\xc3\xa9`), so nothing hides or looks like something it isn't. What maki can't show whole (a
question longer than 64 characters, details longer than 1024), it turns down without asking, and
`maki-confirm` says so before it asks.

A yes lets the script go on; a no, or no answer within a minute (or the `--timeout` you give, up to
80 seconds), stops it. Confirm keeps the last question and what you said, to show when you open it.

## maki-confirm

```
maki-confirm QUESTION [-d DETAIL] [-k KEYFILE] [-t SECONDS]
maki-confirm --public-key
```

- `-d`, `--detail TEXT`: more about it, shown before the question. `-` reads it from stdin, a line a
  line.
- `-k`, `--key FILE`: check maki's yes against the keys in FILE, the lines `--public-key` prints.
- `-t`, `--timeout SECONDS`: how long maki waits for your answer, 10 to 80 seconds (60).
- `--public-key`: Confirm's key, as a key file's line, on stdout; on stderr, the key in hex, as
  Confirm shows it from its menu, to compare.

It exits with what happened, so a script can tell:

| exit | what happened |
| --- | --- |
| 0 | you said yes (and, with `--key`, maki's signature checks out) |
| 1 | you said no |
| 2 | it was run wrong: no question, an unknown option, a key file it can't read, too long to show |
| 3 | nobody answered in time |
| 4 | maki couldn't be asked: maki desktop isn't running, maki isn't plugged in or is locked, Confirm isn't installed, or another app is open on maki |
| 5 | maki's yes didn't check out against the key file |

## Why a yes can be trusted, and when

maki's yes is a signature: the Confirm app signs the request (a fresh nonce from `maki-confirm`, and
everything maki showed) with a key of its own from your recovery phrase, which never leaves maki.
With `--key`, `maki-confirm` checks the signature against the key file before it exits 0. Software
on your computer can't make that signature, can't reuse an old one (each request has a nonce of its
own), and can't stand in for maki desktop to say yes.

**Without `--key`, `maki-confirm` takes maki desktop's word for your answer.** Anything that can
pretend to be maki desktop on your computer (anything running as you) could say yes. That's fine for
a check against mistakes; for a check against malware, use `--key`, and keep the key file where what
you're guarding against can't change it: `/etc/maki/confirm.pub`, say, which only root can.

`maki-confirm` guards what calls it, no more: software that can change your deploy script can take
the `maki-confirm` line out of it. And who asked, where, is what the computer says: it shows you
what's asking, so a request you don't expect stands out, but it isn't proof. If you weren't
expecting the question, say no.

## Setting it up

- Install the **Confirm** app on maki from the store.
- In maki desktop, **sudo & Confirm**, **Confirm**: **Install** `maki-confirm` (it goes in
  `~/.local/bin`), compare the key it shows with the one Confirm shows on maki, from its menu, then
  **Save…** the key file. **Test it** asks maki, as `maki-confirm` would, and checks the yes.

Or in a terminal, once `maki-confirm` is installed:

```sh
maki-confirm --public-key > maki-confirm.pub     # compare the hex it prints with maki's
sudo install -D -m 644 maki-confirm.pub /etc/maki/confirm.pub
```

A key file can hold several keys, a line each: any of their makis can say yes.

## Examples

**A shell script** that deploys only on a yes (with `set -e`, a no stops it):

```sh
#!/bin/sh
set -e
maki-confirm "Deploy to production?" --key /etc/maki/confirm.pub \
  --detail "$(git log -1 --format='%h %s')
to web-1 and web-2"
rsync -a --delete dist/ web-1:/srv/site/
rsync -a --delete dist/ web-2:/srv/site/
```

Or a plan, read from stdin:

```sh
terraform plan -out plan.tfplan
terraform show -no-color plan.tfplan | grep -E '^ *# |^Plan:' |
  maki-confirm "Apply this plan?" --detail - --key /etc/maki/confirm.pub &&
  terraform apply plan.tfplan
```

**A git hook**, `.git/hooks/pre-push` (made executable), that asks before a force push, and before
anything goes to main:

```sh
#!/bin/sh
# git gives the hook the remote's name, and a line for each ref it pushes
gone() { case $1 in *[!0]*) return 1 ;; esac; }   # all zeros: a ref that isn't there
while read -r local_ref local_sha remote_ref remote_sha; do
  gone "$local_sha" && continue
  if ! gone "$remote_sha" && ! git merge-base --is-ancestor "$remote_sha" "$local_sha"; then
    question="Force-push ${remote_ref#refs/heads/} to $1?"
  elif [ "$remote_ref" = refs/heads/main ]; then
    question="Push to main on $1?"
  else
    continue
  fi
  git log --oneline -n 20 "$local_sha" --not --remotes="$1" |
    maki-confirm "$question" --detail - --key /etc/maki/confirm.pub || exit 1
done
```

**CI on the same computer**: a self-hosted runner on the computer maki is plugged into, running as
the user maki desktop runs as (`maki-confirm` finds maki desktop through that user's
`$XDG_RUNTIME_DIR`), with `~/.local/bin` on its PATH. A GitHub Actions job waits for your yes before
its deploy step:

```yaml
jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - name: Ask maki
        run: |
          maki-confirm "Deploy ${GITHUB_SHA::7} to production?" \
            --detail "$(git log -1 --format=%s)" --key /etc/maki/confirm.pub
      - run: ./deploy.sh
```

A no, or no answer, fails the step, and the deploy doesn't run.

## Checked how

The Confirm app is tested as maki runs it (maki's own app host): each request shown whole on maki's
review screen, escapes and quoting, every limit, a yes signed and the signature checked, a no and no
answer signing nothing, and what it can't read or show turned down without asking. `maki-confirm` is
tested against a stand-in for each answer and exit code, and the whole way, through maki desktop's
socket and the link, to the Confirm app on the stand-in for maki: a yes checked against the key
`--public-key` wrote, and another maki's turned down. And end to end: maki desktop running, its
sudo & Confirm page testing the key, and `maki-confirm` started as the script it installs starts it.
