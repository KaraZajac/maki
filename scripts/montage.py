#!/usr/bin/env python3
"""Lay out emulator PGM frames in a grid PNG, for sharing a UI flow.

    scripts/montage.py OUT.png COLS FRAME.pgm [FRAME.pgm ...]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pgm2png import read_pgm, write_png  # noqa: E402

SCALE, GAP, BG = 2, 12, 64

def main():
    out, cols, frames = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
    imgs = [read_pgm(f) for f in frames]
    w, h = imgs[0][0] * SCALE, imgs[0][1] * SCALE
    rows = (len(imgs) + cols - 1) // cols
    W, H = GAP + cols * (w + GAP), GAP + rows * (h + GAP)
    canvas = bytearray([BG]) * (W * H)
    for n, (fw, fh, pix) in enumerate(imgs):
        ox, oy = GAP + (n % cols) * (w + GAP), GAP + (n // cols) * (h + GAP)
        for y in range(h):
            src = pix[(y // SCALE) * fw:(y // SCALE) * fw + fw]
            row = bytes(b for b in src for _ in range(SCALE))
            start = (oy + y) * W + ox
            canvas[start:start + w] = row
    write_png(out, W, H, bytes(canvas), 1)

if __name__ == "__main__":
    main()
