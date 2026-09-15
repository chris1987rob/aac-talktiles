#!/usr/bin/env python3
"""Render one spoken clip per catalogue symbol with VoiceForge (voice "bella",
Chatterbox Turbo, "recorded"/--room post preset as in the bella_sample_v2 render,
ASR-verified retakes) -> ../symbols/audio/<id>.mp3

Runs in-process against VoiceForge's renderer so the engine loads once for the
whole run. Must be executed with VoiceForge's orchestrator venv:
  cd ~/Desktop/voiceforge && .venv/bin/python ~/aac-board/symbol_gen/gen_audio.py
Skips clips that already exist, so it resumes after an interruption.
"""
import os, sys, json, time, subprocess, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); import encode_clip
VF = "/home/mike/Desktop/voiceforge"
os.chdir(VF); sys.path.insert(0, VF)

ap = argparse.ArgumentParser()
ap.add_argument("--only", default="")
ap.add_argument("--force", action="store_true")
ap.add_argument("--voice", default="bella")
args = ap.parse_args()

import numpy as np, soundfile as sf
from voiceforge.api.server import SpeakRequest, _synthesise

OUT = os.path.join(HERE, "..", "symbols", "audio")
RAW = os.path.join(HERE, "audio_raw")
os.makedirs(OUT, exist_ok=True); os.makedirs(RAW, exist_ok=True)

cat = json.load(open(os.path.join(HERE, "catalog.json")))
todo = [s for s in cat if s.get("tts", "").strip()]
if args.only:
    keep = set(args.only.split(",")); todo = [s for s in todo if s["id"] in keep]
if not args.force:
    todo = [s for s in todo if not os.path.exists(os.path.join(OUT, s["id"] + ".mp3"))]
print(f"{len(todo)} clips to render", flush=True)

failed = []
t_run = time.time()
for n, s in enumerate(todo, 1):
    text = s["tts"].strip()
    # Short single words sound clipped on their own; a trailing period gives the
    # model a natural sentence-final fall without changing what is said.
    if text[-1] not in ".!?": text += "."
    t1 = time.time()
    try:
        req = SpeakRequest(text=text, voice=args.voice, engine="chatterbox-turbo",
                           speed=0.95, quality_gate=True, max_retakes=3,
                           post_preset="recorded", target_lufs=-16.0, sample_rate=24000)
        audio, sr, info = _synthesise(req)
        wav = os.path.join(RAW, s["id"] + ".wav")
        sf.write(wav, audio, sr)
        mp3 = os.path.join(OUT, s["id"] + ".mp3")
        encode_clip.encode(wav, mp3)   # trims the dead air in front of the word
        ok = info.get("passed", True)
        if not ok: failed.append(s["id"])
        dt = time.time() - t1; eta = (time.time() - t_run) / n * (len(todo) - n)
        print(f"[{n}/{len(todo)}] {s['id']} {dt:.1f}s takes={info.get('attempts')} wer={info.get('wer')} reasons={info.get('reasons')} "
              f"{'OK' if ok else 'GATE-FAIL'}  eta {eta/60:.0f} min", flush=True)
    except Exception as e:
        failed.append(s["id"]); print(f"[{n}/{len(todo)}] {s['id']} ERROR {e}", flush=True)

json.dump(failed, open(os.path.join(HERE, "audio_failed.json"), "w"))
print(f"ALL DONE  failed={len(failed)}", flush=True)
