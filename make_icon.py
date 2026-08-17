#!/usr/bin/env python3
"""Generate launcher icons (2x2 rounded tiles motif) as pure-Python PNGs, no PIL needed."""
import zlib, struct, os

def chunk(tag, data):
    c = tag + data
    return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

def rounded_rect_mask(x0, y0, x1, y1, r, size):
    """Return list of (x,y) pixels inside a rounded rect, on a `size` grid."""
    pts = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            # distance to corner centers for the four corners
            cx = min(max(x, x0 + r), x1 - 1 - r)
            cy = min(max(y, y0 + r), y1 - 1 - r)
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= r * r:
                pts.append((x, y))
    return pts

def make_icon(size):
    # colors (RGBA): warm cream background tiles on dark slate, orange accents
    BG = (30, 34, 46, 255)
    T1 = (255, 214, 170, 255)   # warm cream
    T2 = (255, 183, 120, 255)   # soft orange
    T3 = (163, 199, 255, 255)   # cool blue
    T4 = (120, 220, 190, 255)   # mint
    px = bytearray()
    grid = [[BG] * size for _ in range(size)]
    m = size // 8                      # margin
    gap = max(1, size // 16)           # gap between tiles
    inner = size - 2 * m
    tile = (inner - gap) // 2
    r = max(2, tile // 5)              # corner radius
    positions = [
        (m, m, T1),
        (m + tile + gap, m, T2),
        (m, m + tile + gap, T3),
        (m + tile + gap, m + tile + gap, T4),
    ]
    for x0, y0, color in positions:
        for (x, y) in rounded_rect_mask(x0, y0, x0 + tile, y0 + tile, r, size):
            grid[y][x] = color
    raw = b""
    for row in grid:
        raw += b"\x00" + bytes(c for p in row for c in p)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    return png

out = "/home/mike/aac-board/app/res"
for dpi, px in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
    d = os.path.join(out, f"mipmap-{dpi}")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "ic_launcher.png"), "wb") as f:
        f.write(make_icon(px))
    print(f"wrote {d}/ic_launcher.png ({px}px)")
