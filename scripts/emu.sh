#!/usr/bin/env bash
# Boot a BAOKEY firmware build in Baomulator and save OLED screenshots as PNG.
#
#   scripts/emu.sh [CHECKPOINTS] [extra shot args...]
#
#   scripts/emu.sh                       # 3G,5G,8G
#   scripts/emu.sh 4G,6G --press 5@4.5G  # press Center at 4.5G instructions
#
# Buttons: 0=Down 1=Select 2=Up 3=Right 4=Left 5=Center
#
# Env:
#   FW_UF2_DIR  where loader/xous/swap .uf2 live
#               (default: xous-core/target/riscv32imac-unknown-xous-elf/release)
#   OUT         screenshot directory (default: .emu/shots)
#   FW_BIN      where the images are unpacked for the emulator (default: .emu/fw); give
#               each run its own when running several at once, or they boot each other's
#
# The emulator starts at the loader and never runs boot1, so it can't cross the
# developer-mode door itself. --dev-mode presets one-way counter 85 so that
# devkey-signed builds boot, as they would on a badge already in developer mode.
# Needs patches/baomulator/0001-preset-one-way-counters.patch applied.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EMU="$ROOT/tools/baomulator"
FW_UF2_DIR="${FW_UF2_DIR:-$ROOT/xous-core/target/riscv32imac-unknown-xous-elf/release}"
OUT="${OUT:-$ROOT/.emu/shots}"
FW_BIN="${FW_BIN:-$ROOT/.emu/fw}"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT/.emu/target}"

CHECKPOINTS="${1:-3G,5G,8G}"
shift || true

if [[ ! -d "$EMU" ]]; then
  echo "emu: clone Baomulator first:"
  echo "  git clone https://github.com/zst123/dc34_baomulator.git tools/baomulator"
  echo "  git -C tools/baomulator apply \"\$PWD\"/patches/baomulator/*.patch"
  exit 1
fi

(cd "$EMU" && cargo build --release --quiet --bin shot)

mkdir -p "$FW_BIN" "$OUT"
python3 "$EMU/tools/uf2conv.py" "$FW_BIN" \
  "$FW_UF2_DIR/loader.uf2" "$FW_UF2_DIR/xous.uf2" "$FW_UF2_DIR/swap.uf2" >/dev/null

rm -f "$OUT"/*.pgm "$OUT"/*.png
"$CARGO_TARGET_DIR/release/shot" "$CHECKPOINTS" --dev-mode --fw "$FW_BIN" \
  --out "$OUT" --no-ascii --console-final 2000 "$@" \
  | grep -v '^    on=\|^controller'

for f in "$OUT"/*.pgm; do
  python3 "$ROOT/scripts/pgm2png.py" "$f" "${f%.pgm}.png" 3
done
echo "emu: screenshots in $OUT"
