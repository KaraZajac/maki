#!/usr/bin/env python3
"""Convert a binary PGM (P5) to PNG, scaled up with nearest-neighbour. No deps."""
import struct, sys, zlib

def read_pgm(path):
    data = open(path, "rb").read()
    tokens, i = [], 0
    while len(tokens) < 4:
        while data[i:i+1].isspace(): i += 1
        if data[i:i+1] == b"#":
            while data[i:i+1] not in (b"\n", b""): i += 1
            continue
        j = i
        while not data[j:j+1].isspace(): j += 1
        tokens.append(data[i:j]); i = j
    assert tokens[0] == b"P5", "not a binary PGM"
    w, h, maxval = int(tokens[1]), int(tokens[2]), int(tokens[3])
    i += 1
    return w, h, data[i:i + w * h]

def write_png(path, w, h, pix, scale):
    rows = []
    for y in range(h):
        row = bytes(b for x in range(w) for b in [pix[y * w + x]] * scale)
        rows.extend([b"\x00" + row] * scale)
    raw = b"".join(rows)
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w * scale, h * scale, 8, 0, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(png)

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    scale = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    w, h, pix = read_pgm(src)
    write_png(dst, w, h, pix, scale)
