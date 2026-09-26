#!/usr/bin/env bash
# Emulator presses that set up maki from the BIP39 test phrase ("abandon" x11, "about") with
# PIN 000000, for a MAKI_DEMO build (PIN digits start at 0). One `--press` argument per line,
# for scripts/emu.sh; OFFSET (in G instructions) shifts them all to match when the first screen
# appears. The last lands at 10.0G + OFFSET, on "Phrase restored".
#
#   bash -c 'mapfile -t P < <(OFFSET=0.6 scripts/presses-test-phrase.sh); scripts/emu.sh 10.5G "${P[@]}"'
#
# Buttons: 3 is left, 4 is right, 5 is the centre. Never use this phrase for real coins.
set -euo pipefail
p() { echo "--press"; echo "$1@$(echo "$2 + ${OFFSET:-0}" | bc)G+2M"; }
p 4 2.3; p 5 2.4                                    # "restore from phrase"
t=2.5; for _ in 1 2 3 4 5 6; do p 5 "$t"; t=$(echo "$t + 0.1" | bc); done
p 3 3.1; p 5 3.2                                    # the check mark
t=3.3; for _ in 1 2 3 4 5 6; do p 5 "$t"; t=$(echo "$t + 0.1" | bc); done
p 3 3.9; p 5 4.0                                    # again; the PIN's key takes a while
p 4 4.8; p 5 4.9                                    # "12 words"
t=5.0
for _ in $(seq 11); do                              # abandon: a, b, a, then the word
  for _ in 1 2 3 4; do p 5 "$t"; t=$(echo "$t + 0.1" | bc); done
done
p 5 9.4; p 5 9.5; p 4 9.6; p 4 9.7; p 4 9.8; p 5 9.9; p 5 10.0   # about: a, b, o, then the word
