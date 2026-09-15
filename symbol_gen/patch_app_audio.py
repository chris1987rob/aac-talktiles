#!/usr/bin/env python3
"""Wire the pre-rendered voice clips (symbols/audio/<id>.mp3) into every index.html
copy. Same contract as patch_app.py: each replacement must match exactly once per
file or nothing is written for that file."""
import sys
FILES = [
    "/home/mike/aac-board/index.html",
    "/home/mike/aac-text-tiles-ipad/index.html",
    "/home/mike/aac-text-tiles-ipad/AACTextTilesiPad/www/index.html",
]
R = []

# 1. Carry the clip path through the in-memory catalogue.
R.append(("""            img: s.img || null,
            tts: s.tts || s.label,""",
"""            img: s.img || null,
            audio: s.audio || null,
            tts: s.tts || s.label,"""))

# 2. The 🔊 on a symbol card plays the clip; device TTS remains the fallback.
R.append(("""      const text = sym.tts || sym.label || sym.id;
      speakText(text);

      if (event && event.currentTarget) {""",
"""      const text = sym.tts || sym.label || sym.id;
      if (!playSymbolClip(sym, text)) speakText(text);

      if (event && event.currentTarget) {"""))

# 3. Shared clip player + tile lookup, placed next to speakText.
R.append(("""    /* --- Storage Helpers --- */""",
"""    // Pre-rendered voice clips: one consistent voice for every library symbol,
    // shipped with the app (see symbol_gen/gen_audio.py). Returns false when
    // there is no clip so the caller can fall back to the device's TTS.
    let currentClipAudio = null;
    function playSymbolClip(sym, text) {
      if (!sym || !sym.audio) return false;
      try {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (currentClipAudio) { try { currentClipAudio.pause(); } catch (e) {} }
        const a = new Audio(sym.audio);
        currentClipAudio = a;
        window.__lastSpoken = String(text || sym.tts || sym.label || '').trim();
        window.__spokenHistory.push(window.__lastSpoken);
        window.__lastVoice = '(clip)';
        // A clip missing from an old offline cache must not silence the tile.
        a.onerror = () => { if (currentClipAudio === a) speakText(text || sym.tts || sym.label); };
        a.play().catch(() => speakText(text || sym.tts || sym.label));
        return true;
      } catch (e) {
        return false;
      }
    }

    // A tile made from a library picture speaks that picture's clip as long as
    // its phrase is still the catalogue phrase. Edit the phrase and it goes back
    // to TTS; add a recording and the recording wins (handled by the caller).
    function tileSymbolClip(data) {
      if (!data || !data.symbol || typeof data.symbol !== 'string') return null;
      if (!data.symbol.startsWith('symbols/modern/')) return null;
      const sym = AAC_SYMBOL_LIBRARY.find(s => s.img === data.symbol);
      if (!sym || !sym.audio) return null;
      const want = String(data.tts || data.label || '').trim().toLowerCase();
      const have = String(sym.tts || sym.label || '').trim().toLowerCase();
      return want === have ? sym : null;
    }

    /* --- Storage Helpers --- */"""))

# 4. Tile tap: recording > clip > TTS.
R.append(("""      if (data && data.audio) {
        playTileAudio(slotId, data.audio);
      } else if (data && (data.tts || data.label)) {
        speakText(data.tts || data.label);
      }
    }""",
"""      if (data && data.audio) {
        playTileAudio(slotId, data.audio);
      } else if (data && (data.tts || data.label)) {
        const clipSym = tileSymbolClip(data);
        if (clipSym) {
          playTileAudio(slotId, clipSym.audio);
        } else {
          speakText(data.tts || data.label);
        }
      }
    }"""))

# 5. Picking a symbol in the editor previews the clip too.
R.append(("""      closeSymbolLibrary();
      showToast(`Selected "${symbolObj.label}"`);
      speakText(symbolObj.tts || symbolObj.label);
    }""",
"""      closeSymbolLibrary();
      showToast(`Selected "${symbolObj.label}"`);
      if (!playSymbolClip(symbolObj)) speakText(symbolObj.tts || symbolObj.label);
    }"""))

ok = True
for f in FILES:
    src = open(f, encoding="utf-8").read()
    good = True
    for i, (old, new) in enumerate(R):
        n = src.count(old)
        if n != 1:
            print(f"{f}: replacement #{i} matched {n} times"); good = False; continue
        src = src.replace(old, new)
    if good:
        open(f, "w", encoding="utf-8").write(src); print("patched", f)
    ok = ok and good
sys.exit(0 if ok else 1)
