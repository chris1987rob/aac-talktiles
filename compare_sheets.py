#!/usr/bin/env python3
"""Build side-by-side comparison sheets: each GoTalk Now reference (gt-NN) next to the
matching talk tiles built screenshot. Outputs individual pair PNGs + one master sheet.

Usage: python3 compare_sheets.py
Reads refs from /home/mike/talk-tiles-ref/ and built shots from /home/mike/aac-board/screenshots/.
"""
import os
from PIL import Image, ImageDraw, ImageFont

REF = "/home/mike/talk-tiles-ref"
BUILT = "/home/mike/aac-board/screenshots"
OUT = "/home/mike/aac-board/comparisons"
os.makedirs(OUT, exist_ok=True)

# ref -> (built_file, human label). gt-01 is a YouTube video frame (no built counterpart).
MAPPING = {
    "gt-02": ("10_home_screen.png",   "Home launcher"),
    "gt-03": ("03_school_express.png","School page (user)"),
    "gt-17": ("03_school_express.png","School page (user)"),
    "gt-21": ("02_yesno_user.png",    "Yes/No board (user)"),
    "gt-07": ("07_new_page_menu.png", "New Page menu + tile editor"),
    "gt-10": ("07_new_page_menu.png", "New Page menu + tile editor"),
    "gt-08": ("08_scene_editor.png",  "Scene editor (hotspots)"),
    "gt-04": ("08_scene_editor.png",  "Scene page w/ hotspot"),
    "gt-05": ("08_scene_editor.png",  "Scene page w/ hotspot"),
    "gt-06": ("08_scene_editor.png",  "Scene page (hotspot card)"),
    "gt-12": ("03_school_express.png","Express bar (chips + play)"),
    "gt-13": ("03_school_express.png","Express bar (chips + play)"),
    "gt-18": ("03_school_express.png","Express bar (chips + play)"),
    "gt-14": ("06_color_picker.png",  "Color picker (swatches)"),
    "gt-15": ("06_color_picker.png",  "Color picker (swatches)"),
    "gt-16": ("11_picker_tab.png",    "Color picker (spectrum/hex)"),
    "gt-19": ("05_page_options.png",  "Page Options popover"),
    "gt-20": ("05_page_options.png",  "Page Options popover"),
    "gt-22": ("09_auditory_cue.png",  "Set Auditory Cue modal"),
    "gt-25": ("09_auditory_cue.png",  "Set Auditory Cue modal"),
    "gt-24": ("04_editor_empty.png",  "Editor grid + Page Options"),
    "gt-26": ("04_editor_empty.png",  "Editor grid (empty)"),
    "gt-09": ("13_scene_bg_menu.png", "Scene page (user)"),
    "gt-23": ("13_scene_bg_menu.png", "Scene page (user, photo bg)"),
}

def load_font(size):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    return ImageFont.load_default()

def fit(img, h):
    r = h / img.height
    return img.resize((max(1, int(img.width * r)), h))

def pair(ref_name, built_name, label):
    refp = os.path.join(REF, ref_name + ".png")
    btp  = os.path.join(BUILT, built_name)
    if not (os.path.exists(refp) and os.path.exists(btp)):
        return None
    H = 520
    left  = fit(Image.open(refp).convert("RGB"), H)
    right = fit(Image.open(btp).convert("RGB"), H)
    gap, pad, barh = 18, 14, 46
    W = pad + left.width + gap + right.width + pad
    canvas = Image.new("RGB", (W, H + barh + 2*pad), "white")
    d = ImageDraw.Draw(canvas)
    f_lbl = load_font(20); f_cap = load_font(16)
    # header bar
    d.rectangle([0, 0, W, barh], fill="#0b3d3a")
    d.text((pad, 8), f"{ref_name}  ->  {label}", font=f_lbl, fill="white")
    # images
    y = barh + pad
    canvas.paste(left, (pad, y))
    canvas.paste(right, (pad + left.width + gap, y))
    d.text((pad, y + H + 4), "GoTalk Now (ref)", font=f_cap, fill="#333")
    d.text((pad + left.width + gap, y + H + 4), "talk tiles (built)", font=f_cap, fill="#0b6b52")
    # divider
    dx = pad + left.width + gap//2
    d.line([dx, barh+4, dx, H+pad], fill="#cccccc", width=2)
    outp = os.path.join(OUT, f"cmp_{ref_name}.png")
    canvas.save(outp)
    return outp

def master(pairs):
    # stack all pair images vertically, scaled to a common width
    W = 1500
    imgs = []
    for p in pairs:
        im = Image.open(p).convert("RGB")
        r = W / im.width
        imgs.append(im.resize((W, int(im.height * r))))
    total_h = sum(i.height for i in imgs) + 10*(len(imgs)-1)
    sheet = Image.new("RGB", (W, total_h), "white")
    y = 0
    for im in imgs:
        sheet.paste(im, (0, y)); y += im.height + 10
    outp = os.path.join(OUT, "MASTER_comparison.png")
    sheet.save(outp)
    return outp

if __name__ == "__main__":
    made = []
    for ref in sorted(MAPPING):
        built, label = MAPPING[ref]
        p = pair(ref, built, label)
        if p: made.append(p)
    print(f"pair sheets: {len(made)}")
    m = master(made)
    print("master:", m, os.path.getsize(m), "bytes")
