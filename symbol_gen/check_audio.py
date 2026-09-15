#!/usr/bin/env python3
"""Flag voice clips that would sound late or broken on a tile.

For every ../symbols/audio/*.mp3 (or the files given) it runs ffmpeg
silencedetect and reports the leading silence (time from the start of the
decoded audio to the first clearly audible sample, above -30 dBFS), the duration, and whether
the clip is silent altogether. Exit 1 if any clip has more than MAX_LEAD
seconds of dead air in front, is empty, or is missing for a catalogue symbol.

    python3 check_audio.py            # whole set, summary + offenders
    python3 check_audio.py dog.mp3    # one or more files
"""
import os, sys, re, json, subprocess
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(HERE, "..", "symbols", "audio")
DATA = os.path.join(HERE, "..", "symbols_data.js")

# Seconds allowed before the first clearly audible sample. After the encoder's
# trim the set sits at p50 21 ms / p99 68 ms; the four clips above 100 ms
# (clock, crawl, num_12, soup) carry a breathy pre-onset at -32 dB peak, which
# is voice, not dead air, so the limit is set above them rather than trimming it.
MAX_LEAD = 0.15
SILENCE_DB = -30      # 'audible' threshold; the encoder trims to a -40 dB RMS onset
MIN_DURATION = 0.2

def probe(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
                          f"silencedetect=noise={SILENCE_DB}dB:d=0.02", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                "-of", "csv=p=0", path], capture_output=True, text=True).stdout or 0)
    lead = 0.0
    m = re.search(r"silence_start: (0(?:\.0*)?)\n.*?silence_end: ([\d.]+)", out, re.S)
    if m: lead = float(m.group(2))
    silent = "silence_end" not in out and "silence_start: 0" in out
    return {"file": os.path.basename(path), "duration": dur, "lead": lead, "silent": silent}

def catalogue_audio():
    src = open(DATA, encoding="utf-8").read()
    m = re.search(r"const AAC_OFFICIAL_SYMBOLS = (\[.*?\]);", src, re.S)
    out = [s["audio"] for s in json.loads(m.group(1)) if s.get("audio")]
    m = re.search(r"const AAC_PHRASE_CLIPS = (\[.*?\]);", src, re.S)
    if m: out += [c["audio"] for c in json.loads(m.group(1))]
    return out

def main():
    if sys.argv[1:]:
        files = [f if os.path.exists(f) else os.path.join(AUDIO, f) for f in sys.argv[1:]]
    else:
        files = [os.path.join(AUDIO, f) for f in sorted(os.listdir(AUDIO)) if f.endswith(".mp3")]
        pdir = os.path.join(AUDIO, "phrases")
        if os.path.isdir(pdir):
            files += [os.path.join(pdir, f) for f in sorted(os.listdir(pdir)) if f.endswith(".mp3")]
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as ex:
        rows = list(ex.map(probe, files))
    bad = [r for r in rows if r["lead"] > MAX_LEAD or r["silent"] or r["duration"] < MIN_DURATION]
    missing = []
    if not sys.argv[1:]:
        missing = [a for a in catalogue_audio() if not os.path.exists(os.path.join(HERE, "..", a))]
    leads = sorted(r["lead"] for r in rows)
    pct = lambda q: leads[min(len(leads) - 1, int(len(leads) * q))]
    print(f"{len(rows)} clips  lead: median {pct(.5)*1000:.0f} ms  p99 {pct(.99)*1000:.0f} ms  "
          f"max {leads[-1]*1000:.0f} ms  (limit {MAX_LEAD*1000:.0f} ms)")
    for r in bad:
        why = "SILENT" if r["silent"] else ("too short" if r["duration"] < MIN_DURATION else f"lead {r['lead']*1000:.0f} ms")
        print(f"  BAD {r['file']}: {why}")
    for a in missing: print(f"  MISSING {a}")
    print(f"{'OK' if not bad and not missing else 'FAIL'}: {len(bad)} bad, {len(missing)} missing")
    sys.exit(1 if bad or missing else 0)

if __name__ == "__main__":
    main()
