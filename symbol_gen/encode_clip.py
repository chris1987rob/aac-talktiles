#!/usr/bin/env python3
"""WAV -> symbols/audio/<id>.mp3, with the dead air in front of the word removed.

The TTS + "recorded"/--room post chain leaves ~60-260 ms of near-digital
silence before the first sound (median 112 ms across the 2,210 bella clips).
On a tile that is time between the tap and the voice, on top of whatever the
player adds, so it is trimmed here: everything before the first 5 ms window
whose RMS is above -40 dBFS goes, except LEAD_KEEP seconds. The --room preset
lays a floor of about -40 dB peak / -50 dB RMS in front of some words (a fifth
of a second in "for"), which is dead air on a tablet speaker; a 5 ms RMS window
ignores its single-sample spikes but still catches a plosive burst (the /k/ of
"clap" runs 60 ms at -29 dB peak).

    python3 encode_clip.py in.wav out.mp3      # one clip
    python3 encode_clip.py --all               # re-encode audio_raw/ -> ../symbols/audio/
"""
import os, sys, subprocess
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "audio_raw")
OUT = os.path.join(HERE, "..", "symbols", "audio")

LEAD_KEEP = 0.02          # seconds of silence left in front of the word
LEAD_THRESHOLD_DB = -40   # 5 ms windows with RMS below this are "silence"
LEAD_WINDOW = 0.005

def encode(wav, mp3):
    # The default 20 ms RMS window averages a plosive burst down below the
    # threshold and cuts it off; per-sample peak detection fires on noise spikes.
    af = (f"silenceremove=start_periods=1:start_threshold={LEAD_THRESHOLD_DB}dB"
          f":start_silence={LEAD_KEEP}:detection=rms:window={LEAD_WINDOW},afade=t=in:d=0.005")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-af", af,
                    "-ac", "1", "-ar", "24000", "-codec:a", "libmp3lame", "-b:a", "48k", mp3],
                   check=True)

def main():
    if len(sys.argv) == 3 and sys.argv[1] != "--all":
        encode(sys.argv[1], sys.argv[2]); return
    if sys.argv[1:] != ["--all"]:
        print(__doc__); sys.exit(2)
    os.makedirs(OUT, exist_ok=True)
    jobs = [(os.path.join(RAW, f), os.path.join(OUT, f[:-4] + ".mp3"))
            for f in sorted(os.listdir(RAW)) if f.endswith(".wav")]
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as ex:
        list(ex.map(lambda j: encode(*j), jobs))
    print(f"encoded {len(jobs)} clips -> {os.path.abspath(OUT)}")

if __name__ == "__main__":
    main()
