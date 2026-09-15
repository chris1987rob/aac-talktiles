#!/usr/bin/env python3
"""Render the phrase clips: words and sentences the built-in boards speak that
are not the tts of any catalogue symbol (the Core Words board says "help", the
catalogue's help symbol says "Help me please"). Same voice, engine and post
chain as gen_audio.py; list in phrases.json (id, text, where) ->
../symbols/audio/phrases/<id>.mp3, raw takes in audio_raw_phrases/. Registered
in symbols_data.js as AAC_PHRASE_CLIPS by write_phrase_clips().

  cd ~/Desktop/voiceforge && .venv/bin/python ~/aac-board/symbol_gen/gen_phrases.py
Skips clips that already exist (resumable); --force re-renders; --only id,id.
"""
import os, sys, json, time, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); import encode_clip
VF = "/home/mike/Desktop/voiceforge"
os.chdir(VF); sys.path.insert(0, VF)

ap = argparse.ArgumentParser()
ap.add_argument("--only", default="")
ap.add_argument("--force", action="store_true")
ap.add_argument("--voice", default="bella")
ap.add_argument("--register-only", action="store_true", help="just rewrite AAC_PHRASE_CLIPS in symbols_data.js")
args = ap.parse_args()

OUT = os.path.join(HERE, "..", "symbols", "audio", "phrases")
RAW = os.path.join(HERE, "audio_raw_phrases")
os.makedirs(OUT, exist_ok=True); os.makedirs(RAW, exist_ok=True)
phrases = json.load(open(os.path.join(HERE, "phrases.json")))

def write_phrase_clips():
    """Rewrite `const AAC_PHRASE_CLIPS = [...]` in every symbols_data.js copy."""
    rows = [{"text": p["text"], "audio": f"symbols/audio/phrases/{p['id']}.mp3"} for p in phrases
            if os.path.exists(os.path.join(OUT, p["id"] + ".mp3"))]
    line = "const AAC_PHRASE_CLIPS = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    for data in [os.path.join(HERE, "..", "symbols_data.js"),
                 "/home/mike/aac-text-tiles-ipad/symbols_data.js",
                 "/home/mike/aac-text-tiles-ipad/AACTextTilesiPad/www/symbols_data.js"]:
        if not os.path.exists(data): continue
        s = open(data, encoding="utf-8").read()
        lines = [l for l in s.splitlines(True) if not l.startswith("const AAC_PHRASE_CLIPS = ")]
        s = "".join(lines)
        if not s.endswith("\n"): s += "\n"
        s += "// Clips for phrases the built-in boards speak that no catalogue symbol says\n// verbatim (see symbol_gen/gen_phrases.py).\n" if "// Clips for phrases the built-in boards" not in s else ""
        s += line
        open(data, "w", encoding="utf-8").write(s)
        print(f"registered {len(rows)} phrase clips in {data}")

if args.register_only:
    write_phrase_clips(); sys.exit(0)

import soundfile as sf
from voiceforge.api.server import SpeakRequest, _synthesise

todo = phrases
if args.only:
    keep = set(args.only.split(",")); todo = [p for p in todo if p["id"] in keep]
if not args.force:
    todo = [p for p in todo if not os.path.exists(os.path.join(OUT, p["id"] + ".mp3"))]
print(f"{len(todo)} phrase clips to render", flush=True)

failed = []
t_run = time.time()
for n, p in enumerate(todo, 1):
    text = p["text"].strip()
    if text[-1] not in ".!?": text += "."
    t1 = time.time()
    try:
        req = SpeakRequest(text=text, voice=args.voice, engine="chatterbox-turbo",
                           speed=0.95, quality_gate=True, max_retakes=3,
                           post_preset="recorded", target_lufs=-16.0, sample_rate=24000)
        audio, sr, info = _synthesise(req)
        wav = os.path.join(RAW, p["id"] + ".wav")
        sf.write(wav, audio, sr)
        encode_clip.encode(wav, os.path.join(OUT, p["id"] + ".mp3"))
        ok = info.get("passed", True)
        if not ok: failed.append(p["id"])
        print(f"[{n}/{len(todo)}] {p['id']} {time.time()-t1:.1f}s takes={info.get('attempts')} wer={info.get('wer')} "
              f"{'OK' if ok else 'GATE-FAIL'}", flush=True)
    except Exception as e:
        failed.append(p["id"]); print(f"[{n}/{len(todo)}] {p['id']} ERROR {e}", flush=True)

write_phrase_clips()
json.dump(failed, open(os.path.join(HERE, "phrases_failed.json"), "w"))
print(f"ALL DONE  failed={len(failed)}", flush=True)
