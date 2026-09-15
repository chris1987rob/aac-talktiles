#!/usr/bin/env python3
"""catalog.json -> symbols_data.js for the Android app and both iPad copies,
attaching img: 'symbols/modern/<id>.webp' for every picture that exists.
Also mirrors the webp set into the iPad copies."""
import json, os, shutil, glob
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODERN = os.path.join(ROOT, "symbols", "modern")
AUDIO = os.path.join(ROOT, "symbols", "audio")
TARGETS = [
    ROOT,
    "/home/mike/aac-text-tiles-ipad",
    "/home/mike/aac-text-tiles-ipad/AACTextTilesiPad/www",
]

catalog = json.load(open(os.path.join(HERE, "catalog.json")))
have = {os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(MODERN, "*.webp"))}
have_audio = {os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(AUDIO, "*.mp3"))}
out = []
for s in catalog:
    e = {"id": s["id"], "label": s["label"], "category": s["category"], "emoji": s["emoji"],
         "tts": s.get("tts", s["label"]), "tags": s.get("tags", [])}
    if s["id"] in have:
        e["img"] = f"symbols/modern/{s['id']}.webp"
    if s["id"] in have_audio:
        e["audio"] = f"symbols/audio/{s['id']}.mp3"
    out.append(e)

js = ("// Talk Tiles symbol catalogue — original pictures generated in-house\n"
      "// (Qwen-Image-2512 on the local RTX 3090, see symbol_gen/). No third-party symbol licence.\n"
      "const AAC_OFFICIAL_SYMBOLS = " + json.dumps(out, ensure_ascii=False) + ";\n")
for t in TARGETS:
    open(os.path.join(t, "symbols_data.js"), "w", encoding="utf-8").write(js)
    if t != ROOT:
        dst = os.path.join(t, "symbols", "modern")
        os.makedirs(dst, exist_ok=True)
        for p in glob.glob(os.path.join(MODERN, "*.webp")):
            shutil.copy2(p, dst)
        adst = os.path.join(t, "symbols", "audio")
        os.makedirs(adst, exist_ok=True)
        for p in glob.glob(os.path.join(AUDIO, "*.mp3")):
            shutil.copy2(p, adst)
print(f"{len(out)} symbols, {len(have)} with pictures, {len(have_audio)} with voice clips -> {len(TARGETS)} targets")
