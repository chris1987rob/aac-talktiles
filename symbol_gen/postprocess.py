#!/usr/bin/env python3
"""raw/<id>.png (1024px, white background) -> ../symbols/modern/<id>.webp
(384px, transparent background) so symbols sit on any tile colour like the
old vector set did. The white is knocked out by a flood fill from the image
border, so white INSIDE the drawing (eyes, teeth, a milk glass) is kept."""
import os, sys, glob
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
OUT = os.environ.get("SYM_OUT") or os.path.join(HERE, "..", "symbols", "modern")
SIZE = 384
os.makedirs(OUT, exist_ok=True)

def knock_out_white(im, thresh=235, soft=20):
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    h, w, _ = a.shape
    mn = a.min(axis=2)                       # "whiteness" = darkest channel
    bg = mn >= thresh                        # candidate background pixels
    # Connected components of the near-white mask; keep only the ones that
    # touch the border (the true background), never an enclosed white area.
    labels, n = ndimage.label(bg)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    border = border[border != 0]
    seen = np.isin(labels, border)
    alpha = np.full((h, w), 255, dtype=np.uint8)
    alpha[seen] = 0
    # edge feather: reached pixels that are not pure white keep a little alpha
    edge = seen & (mn < thresh + soft)
    alpha[edge] = np.clip((thresh + soft - mn[edge]) * (255 // soft), 0, 255).astype(np.uint8)
    rgba = np.dstack([a.astype(np.uint8), alpha])
    return Image.fromarray(rgba, "RGBA")

def trim_and_fit(im, size=SIZE, pad=0.06):
    bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    side = int(max(w, h) * (1 + pad * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return canvas.resize((size, size), Image.LANCZOS)

files = sys.argv[1:] or sorted(glob.glob(os.path.join(RAW, "*.png")))
for n, f in enumerate(files, 1):
    sid = os.path.splitext(os.path.basename(f))[0]
    dst = os.path.join(OUT, sid + ".webp")
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(f):
        continue
    im = Image.open(f)
    im = knock_out_white(im)
    im = trim_and_fit(im)
    im.save(dst, "WEBP", quality=85, method=6)
    if n % 50 == 0: print(n, flush=True)
print("done", len(files))
