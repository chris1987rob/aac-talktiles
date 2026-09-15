#!/usr/bin/env python3
"""Merge the base catalog + extra vocabulary into catalog.json (the app catalog
without image paths yet) and prompts.json (id -> full image prompt)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from base_subjects import SUBJECTS
from extra_symbols import EXTRA
from extra_symbols2 import EXTRA2
from extra_symbols3 import EXTRA3
from extra_symbols4 import EXTRA4
from extra_symbols5 import EXTRA5
EXTRA = EXTRA + EXTRA2 + EXTRA3 + EXTRA4 + EXTRA5

# One style for the whole set so the library reads as a single family of
# pictures. Kept deliberately concrete — the model follows description far
# better than adjectives like "modern".
STYLE = ("{subject}. Flat vector icon illustration, "
         "clean bold rounded shapes, thick dark outlines, bright friendly colors, "
         "simple and clear, centered single subject, minimal detail, "
         "plain solid white background, absolutely no text, no letters, no words, no logos, no watermark, no border")
NEGATIVE = ("text, letters, words, watermark, signature, photo, photorealistic, 3d render, "
            "blurry, noisy, busy background, frame, border, multiple panels, collage, extra limbs")

base = json.load(open(os.path.join(HERE, "catalog_base.json")))
ids = {s["id"] for s in base}
catalog = list(base)
for (sid, label, cat, emoji, tts, tags, subject) in EXTRA:
    if sid in ids:
        print("DUPLICATE id, skipping:", sid); continue
    ids.add(sid)
    SUBJECTS[sid] = subject
    catalog.append({"id": sid, "label": label, "category": cat, "emoji": emoji, "tts": tts, "tags": tags})

missing = [s["id"] for s in catalog if s["id"] not in SUBJECTS]
if missing:
    print("MISSING subjects for:", missing); sys.exit(1)

prompts = {s["id"]: STYLE.format(subject=SUBJECTS[s["id"]]) for s in catalog}
json.dump(catalog, open(os.path.join(HERE, "catalog.json"), "w"), indent=1)
json.dump({"negative": NEGATIVE, "prompts": prompts}, open(os.path.join(HERE, "prompts.json"), "w"), indent=1)
from collections import Counter
print(len(catalog), "symbols;", Counter(s["category"] for s in catalog))
