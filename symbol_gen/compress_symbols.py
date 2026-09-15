#!/usr/bin/env python3
"""One-pass symbol compression: 384px webp q80 (visually identical, ~2x smaller).
Backs up originals to symbol_gen/modern_webp_backup/ first."""
import os, shutil, glob
from multiprocessing import Pool

SRC = '/home/mike/aac-board/symbols/modern'
BAK = '/home/mike/aac-board/symbol_gen/modern_webp_backup'

def work(path):
    rel = os.path.basename(path)
    bak = os.path.join(BAK, rel)
    if not os.path.exists(bak):
        shutil.copy2(path, bak)
    from PIL import Image
    im = Image.open(bak).convert('RGB')
    im.save(path, 'WEBP', quality=80, method=6)
    return path

if __name__ == '__main__':
    os.makedirs(BAK, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC, '*.webp')))
    before = sum(os.path.getsize(f) for f in files)
    with Pool(8) as p:
        done = 0
        for _ in p.imap_unordered(work, files, chunksize=50):
            done += 1
            if done % 500 == 0:
                print(f"{done}/{len(files)}")
    after = sum(os.path.getsize(f) for f in files)
    print(f"DONE {len(files)} files: {before/1e6:.1f} MB -> {after/1e6:.1f} MB ({after/before*100:.0f}%)")
