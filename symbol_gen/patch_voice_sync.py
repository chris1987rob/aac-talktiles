#!/usr/bin/env python3
"""Talk Tiles voice-sync patch (2026-09-14): tap -> Bella clip with no lag.

Applies the same exact-string edits to every index.html given on the command
line (the Android/web board and the two iPad copies share the script body).
Idempotent: a file that already carries the patch is left alone.

What changes:
  * a voice engine that decodes clips ahead of time (XHR -> decodeAudioData ->
    AudioBuffer, LRU of 160) and starts them on an AudioBufferSourceNode, so a
    tap starts sound in the audio thread's next quantum instead of after a cold
    <audio> element open+decode. The <audio> path stays as the cold fallback.
  * clips for the page on screen (and its neighbours) are warmed on render.
  * tiles play on pointerDOWN in play mode (edit mode keeps pointerup -> editor).
  * every tile / hotspot whose phrase matches a catalogue phrase speaks the
    Bella clip -- not only tiles that carry a library picture.
  * window.__voiceTelemetry records tap->start latency for the test suite.
"""
import sys

MARK = "/* --- Voice engine (Bella clips)"

ENGINE = r'''/* --- Voice engine (Bella clips) -------------------------------------------
       Every catalogue symbol ships a pre-rendered clip in one voice (see
       symbol_gen/gen_audio.py). A tap used to do `new Audio(url).play()`: the
       WebView then opened the file, decoded it and spun up a player before any
       sound came out, so the word landed noticeably after the finger. Clips
       for the page on screen are now fetched and decoded ahead of time into
       AudioBuffers and started on an AudioBufferSourceNode, which begins in
       the audio thread's next quantum (a few ms). The <audio> element remains
       the cold-start fallback (first tap on a page that has not warmed yet,
       or no Web Audio at all), and it plays at once while the buffer warms
       for the next tap. Recordings (Blobs) go through the same cache. */
    const VOICE_CACHE_MAX = 160;   // ~3 full 48-tile pages; ~0.2 MB per decoded clip
    let voiceCtx = null;
    const voiceBufferPromises = new Map();   // url -> Promise<AudioBuffer>, insertion order = LRU
    const voiceBuffers = new Map();          // url -> AudioBuffer once decoded
    const voiceBlobPromises = new WeakMap(); // Blob -> Promise<AudioBuffer>
    const voiceBlobBuffers = new WeakMap();  // Blob -> AudioBuffer once decoded
    const voiceUndecodable = new WeakSet();  // Blobs decodeAudioData rejected (element path only)
    let voiceSourceNode = null;              // the AudioBufferSourceNode playing now
    let voiceElement = null;                 // the <audio> playing now (cold path)
    window.__voiceTelemetry = { taps: 0, tapAt: 0, startAt: 0, latencyMs: null, path: '', src: '' };

    function voiceContext() {
      if (voiceCtx) return voiceCtx;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try { voiceCtx = new Ctx({ latencyHint: 'interactive' }); }
      catch (e) { try { voiceCtx = new Ctx(); } catch (e2) { return null; } }
      return voiceCtx;
    }

    // Autoplay policy leaves a fresh AudioContext suspended until a gesture;
    // resume it on the very first pointer so the first tile tap is not the
    // one that pays for it.
    function unlockVoice() {
      const ctx = voiceContext();
      if (ctx && ctx.state !== 'running') { try { ctx.resume().catch(() => {}); } catch (e) {} }
    }
    document.addEventListener('pointerdown', unlockVoice, { capture: true, passive: true });
    document.addEventListener('touchstart', unlockVoice, { capture: true, passive: true });
    document.addEventListener('keydown', unlockVoice, { capture: true, passive: true });

    // fetch() refuses file: URLs, which is what the packaged app runs from;
    // XMLHttpRequest reads them (the WebView allows file->file reads).
    function fetchVoiceBytes(url) {
      return new Promise((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.open('GET', url, true);
        x.responseType = 'arraybuffer';
        x.onload = () => {
          const ok = (x.status === 200) || (x.status === 0 && x.response && x.response.byteLength > 0);
          ok ? resolve(x.response) : reject(new Error('clip fetch ' + x.status + ' ' + url));
        };
        x.onerror = () => reject(new Error('clip fetch failed ' + url));
        x.send();
      });
    }

    function decodeVoiceBytes(ctx, bytes) {
      return new Promise((resolve, reject) => {
        try {
          const r = ctx.decodeAudioData(bytes, resolve, reject);
          if (r && typeof r.catch === 'function') r.catch(reject);
        } catch (e) { reject(e); }
      });
    }

    // Start decoding a clip (URL string or recorded Blob). Returns the
    // AudioBuffer promise, or null when Web Audio is unavailable.
    function warmVoice(src) {
      const ctx = voiceContext();
      if (!ctx || !src) return null;
      if (typeof src === 'string') {
        let p = voiceBufferPromises.get(src);
        if (p) {                                   // LRU touch
          voiceBufferPromises.delete(src);
          voiceBufferPromises.set(src, p);
          return p;
        }
        p = fetchVoiceBytes(src).then(b => decodeVoiceBytes(ctx, b));
        p.then(buf => { voiceBuffers.set(src, buf); },
               () => { voiceBufferPromises.delete(src); });
        voiceBufferPromises.set(src, p);
        while (voiceBufferPromises.size > VOICE_CACHE_MAX) {
          const oldest = voiceBufferPromises.keys().next().value;
          voiceBufferPromises.delete(oldest);
          voiceBuffers.delete(oldest);
        }
        return p;
      }
      if (isBlobLike(src) && typeof src.arrayBuffer === 'function' && !voiceUndecodable.has(src)) {
        let p = voiceBlobPromises.get(src);
        if (p) return p;
        p = src.arrayBuffer().then(b => decodeVoiceBytes(ctx, b));
        p.then(buf => { voiceBlobBuffers.set(src, buf); },
               () => { voiceBlobPromises.delete(src); voiceUndecodable.add(src); });
        voiceBlobPromises.set(src, p);
        return p;
      }
      return null;
    }

    function voiceBufferReady(src) {
      if (typeof src === 'string') return voiceBuffers.get(src) || null;
      if (isBlobLike(src)) return voiceBlobBuffers.get(src) || null;
      return null;
    }

    function stopVoice() {
      if (voiceSourceNode) {
        const n = voiceSourceNode;
        voiceSourceNode = null;
        n.onended = null;
        try { n.stop(); } catch (e) {}
        try { n.disconnect(); } catch (e) {}
      }
      if (voiceElement) {
        const el = voiceElement;
        voiceElement = null;
        el.onended = null; el.onerror = null;
        try { el.pause(); } catch (e) {}
        if (el.__objectUrl) { URL.revokeObjectURL(el.__objectUrl); el.__objectUrl = null; }
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }

    // Play a clip now. `opts.onended` runs when it finishes (or is stopped by
    // a later clip); `opts.onerror` runs when it could not play at all, so the
    // caller can fall back to TTS. Returns the path taken: 'buffer' | 'element'.
    function playVoice(src, opts) {
      opts = opts || {};
      const tapAt = opts.tapAt || performance.now();
      stopVoice();
      const ctx = voiceContext();
      const buf = ctx ? voiceBufferReady(src) : null;
      const tel = window.__voiceTelemetry;
      tel.taps++; tel.tapAt = tapAt; tel.src = (typeof src === 'string') ? src : '(blob)';

      if (buf) {
        if (ctx.state !== 'running') unlockVoice();
        const node = ctx.createBufferSource();
        node.buffer = buf;
        node.connect(ctx.destination);
        node.onended = () => {
          if (voiceSourceNode === node) voiceSourceNode = null;
          try { node.disconnect(); } catch (e) {}
          if (opts.onended) opts.onended();
        };
        voiceSourceNode = node;
        node.start(0);
        tel.startAt = performance.now();
        tel.latencyMs = tel.startAt - tapAt;
        tel.path = 'buffer';
        tel.outputLatencyMs = 1000 * ((ctx.baseLatency || 0) + (ctx.outputLatency || 0));
        return 'buffer';
      }

      // Cold: the element starts as soon as it can while the buffer decodes
      // for next time.
      warmVoice(src);
      let url = src, objectUrl = null;
      if (typeof src !== 'string') {
        try { url = objectUrl = URL.createObjectURL(src); }
        catch (e) { if (opts.onerror) opts.onerror(e); return 'none'; }
      }
      const el = new Audio(url);
      el.__objectUrl = objectUrl;
      voiceElement = el;
      const done = () => {
        if (voiceElement === el) voiceElement = null;
        if (el.__objectUrl) { URL.revokeObjectURL(el.__objectUrl); el.__objectUrl = null; }
        if (opts.onended) opts.onended();
      };
      el.onended = done;
      el.onerror = () => { done(); if (opts.onerror) opts.onerror(new Error('audio element error')); };
      el.addEventListener('playing', () => {
        if (tel.src === url || (objectUrl && tel.src === '(blob)')) {
          tel.startAt = performance.now();
          tel.latencyMs = tel.startAt - tapAt;
        }
      }, { once: true });
      tel.path = 'element';
      el.play().catch(err => { done(); if (opts.onerror) opts.onerror(err); });
      return 'element';
    }

    // Phrase -> catalogue clip. Keyed by what the clip actually says (the
    // symbol's tts), so a tile whose phrase is "I want" gets the "I want" clip
    // whichever picture it carries, and a tile that just says "Want" does not.
    let voicePhraseIndex = null;
    function normalisePhrase(s) {
      return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}']+/gu, ' ').replace(/\s+/g, ' ').trim();
    }
    function clipForPhrase(phrase) {
      const key = normalisePhrase(phrase);
      if (!key) return null;
      if (!voicePhraseIndex || voicePhraseIndex.size === 0) {
        voicePhraseIndex = new Map();
        (AAC_SYMBOL_LIBRARY || []).forEach(s => {
          if (!s.audio) return;
          const k = normalisePhrase(s.tts || s.label);
          if (k && !voicePhraseIndex.has(k)) voicePhraseIndex.set(k, s);
        });
        // Phrases the built-in boards speak that no symbol says verbatim
        // ("help", "more", "My Schedule"), rendered by symbol_gen/gen_phrases.py.
        if (typeof AAC_PHRASE_CLIPS !== 'undefined' && Array.isArray(AAC_PHRASE_CLIPS)) {
          AAC_PHRASE_CLIPS.forEach(c => {
            const k = normalisePhrase(c.text);
            if (k && c.audio && !voicePhraseIndex.has(k)) {
              voicePhraseIndex.set(k, { id: 'phrase:' + k, label: c.text, tts: c.text, audio: c.audio });
            }
          });
        }
      }
      return voicePhraseIndex.get(key) || null;
    }

    // Speak a phrase in the app voice: the Bella clip when the catalogue has
    // one for exactly these words, the device's TTS otherwise.
    function speakPhrase(text, opts) {
      const clean = String(text || '').trim();
      if (!clean) return 'none';
      const sym = clipForPhrase(clean);
      if (!sym) { speakText(clean); return 'tts'; }
      window.__lastSpoken = clean;
      window.__spokenHistory.push(clean);
      window.__lastVoice = '(clip)';
      const o = Object.assign({}, opts || {}, { onerror: () => speakText(clean) });
      return playVoice(sym.audio, o);
    }

    // Warm every clip the page on screen can speak, then its neighbours, so
    // the first tap after a page turn is already a buffer start.
    function pageVoiceSources(p) {
      const out = [];
      if (!p) return out;
      Object.values(p.tiles || {}).forEach(t => {
        if (!t) return;
        if (t.audio) out.push(t.audio);
        else { const sym = tileSymbolClip(t); if (sym) out.push(sym.audio); }
      });
      (p.hotspots || []).forEach(h => {
        if (!h) return;
        if (h.audio) out.push(h.audio);
        else { const sym = clipForPhrase(h.tts || h.label); if (sym) out.push(sym.audio); }
      });
      return out;
    }
    function warmPageVoices() {
      if (!voiceContext()) return;
      const idx = [currentPageIndex, currentPageIndex + 1, currentPageIndex - 1];
      idx.forEach(i => {
        const p = pages[(i + pages.length) % pages.length];
        pageVoiceSources(p).forEach(src => warmVoice(src));
      });
    }

    // Pre-rendered voice clips: one consistent voice for every library symbol,
    // shipped with the app (see symbol_gen/gen_audio.py). Returns false when
    // there is no clip so the caller can fall back to the device's TTS.
    function playSymbolClip(sym, text) {
      if (!sym || !sym.audio) return false;
      try {
        const say = String(text || sym.tts || sym.label || '').trim();
        window.__lastSpoken = say;
        window.__spokenHistory.push(say);
        window.__lastVoice = '(clip)';
        // A clip missing from an old offline cache must not silence the tile.
        playVoice(sym.audio, { onerror: () => speakText(say) });
        return true;
      } catch (e) {
        return false;
      }
    }

    // The clip a tile speaks: its own library picture's clip when the phrase
    // is still that picture's phrase, else any catalogue clip that says exactly
    // the tile's phrase. A recording on the tile wins over both (caller).
    function tileSymbolClip(data) {
      if (!data) return null;
      const phrase = normalisePhrase(data.tts || data.label);
      if (!phrase) return null;
      if (typeof data.symbol === 'string' && data.symbol.startsWith('symbols/modern/')) {
        const sym = AAC_SYMBOL_LIBRARY.find(s => s.img === data.symbol);
        if (sym && sym.audio && normalisePhrase(sym.tts || sym.label) === phrase) return sym;
      }
      return clipForPhrase(phrase);
    }
'''

OLD_ENGINE = '''    // Pre-rendered voice clips: one consistent voice for every library symbol,
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
'''

EDITS = [
    (OLD_ENGINE, ENGINE),

    # Tile tap: play on press, edit on release.
    ('''      tile.addEventListener('pointerup', () => handleTileTap(slotId, data));
      return tile;''',
     '''      // Play on the press itself: waiting for the release added the whole
      // finger-down time to the word. Editing still opens on release so the
      // editor does not swallow the tail of the same press. A release with no
      // press before it (synthetic / assistive input) still plays.
      //
      // Chromium's touch-target adjustment snaps a finger that lands in the
      // 12px gap between tiles onto the nearest tile (the next one across, or
      // the one below) and delivers pointerdown to it -- with the finger's real
      // coordinates. So a tile only takes a press that is actually inside its
      // own box; a gap does nothing. Synthetic events (no real finger) pass.
      const pressOnTile = (e) => {
        if (!e || !e.isTrusted) return true;
        const r = tile.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      };
      let pressed = false;
      tile.addEventListener('pointerdown', (e) => {
        if (!pressOnTile(e)) { pressed = false; return; }
        pressed = true;
        if (!isEditMode) handleTileTap(slotId, data);
      });
      tile.addEventListener('pointerup', (e) => {
        const wasPressed = pressed;
        pressed = false;
        if (isEditMode && !wasPressed && e.isTrusted) return;   // release of a press that began off the tile
        if (!isEditMode && !pressOnTile(e)) return;
        if (isEditMode || !wasPressed) handleTileTap(slotId, data);
      });
      tile.addEventListener('pointercancel', () => { pressed = false; });
      return tile;'''),

    # handleTileTap: telemetry + phrase clips.
    ('''    function handleTileTap(slotId, data) {
      if (isEditMode) {
        openEditor(slotId);
        return;
      }

      const p = pages[currentPageIndex];''',
     '''    function handleTileTap(slotId, data) {
      if (isEditMode) {
        openEditor(slotId);
        return;
      }
      const tapAt = performance.now();

      const p = pages[currentPageIndex];'''),
    ('''      if (data && data.audio) {
        playTileAudio(slotId, data.audio);
      } else if (data && (data.tts || data.label)) {
        const clipSym = tileSymbolClip(data);
        if (clipSym) {
          window.__lastSpoken = String(data.tts || data.label).trim();
          window.__spokenHistory.push(window.__lastSpoken);
          window.__lastVoice = '(clip)';
          playTileAudio(slotId, clipSym.audio);
        } else {
          speakText(data.tts || data.label);
        }
      }
    }

    function playTileAudio(slotId, audioBlob) {
      stopBoardAudio();
      const tileEl = document.getElementById(`tile-slot-${slotId}`);
      if (tileEl) tileEl.classList.add('playing');

      const audioUrl = (typeof audioBlob === 'string') ? audioBlob : URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentPlayingAudio = audio;
      currentPlayingSlot = slotId;

      const cleanup = () => {
        if (tileEl) tileEl.classList.remove('playing');
        if (typeof audioBlob !== 'string') URL.revokeObjectURL(audioUrl);
        if (currentPlayingAudio === audio) {
          currentPlayingAudio = null;
          currentPlayingSlot = null;
        }
      };

      audio.onended = cleanup;
      audio.onerror = cleanup;
      audio.play().catch(cleanup);
    }

    function stopBoardAudio() {
      if (currentPlayingAudio) {
        currentPlayingAudio.pause();
        currentPlayingAudio.currentTime = 0;
        currentPlayingAudio = null;
      }
      if (currentPlayingSlot) {
        const prev = document.getElementById(`tile-slot-${currentPlayingSlot}`);
        if (prev) prev.classList.remove('playing');
        currentPlayingSlot = null;
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }''',
     '''      if (data && data.audio) {
        playTileAudio(slotId, data.audio, tapAt);
      } else if (data && (data.tts || data.label)) {
        const clipSym = tileSymbolClip(data);
        if (clipSym) {
          window.__lastSpoken = String(data.tts || data.label).trim();
          window.__spokenHistory.push(window.__lastSpoken);
          window.__lastVoice = '(clip)';
          playTileAudio(slotId, clipSym.audio, tapAt, () => speakText(data.tts || data.label));
        } else {
          stopBoardAudio();
          speakText(data.tts || data.label);
        }
      }
    }

    // Plays a recording (Blob) or a clip (URL) for a tile / hotspot and keeps
    // the 'playing' highlight on it until the sound ends.
    function playTileAudio(slotId, audioSrc, tapAt, onerror) {
      stopBoardAudio();
      const tileEl = document.getElementById(`tile-slot-${slotId}`);
      if (tileEl) tileEl.classList.add('playing');
      currentPlayingSlot = slotId;

      const cleanup = () => {
        if (tileEl) tileEl.classList.remove('playing');
        if (currentPlayingSlot === slotId) currentPlayingSlot = null;
      };
      currentPlayingAudio = playVoice(audioSrc, {
        tapAt: tapAt,
        onended: cleanup,
        onerror: () => { cleanup(); if (onerror) onerror(); }
      });
    }

    function stopBoardAudio() {
      stopVoice();
      currentPlayingAudio = null;
      if (currentPlayingSlot) {
        const prev = document.getElementById(`tile-slot-${currentPlayingSlot}`);
        if (prev) prev.classList.remove('playing');
        currentPlayingSlot = null;
      }
    }'''),

    # Hotspots: phrase clips too.
    ('''      if (spot.audio || (spot.action === 'recorded' && spot.audio)) {
        playTileAudio(`hotspot-${spot.id}`, spot.audio);
      } else {
        speakText(spot.tts || spot.label || 'Hotspot');
      }
    }''',
     '''      if (spot.audio || (spot.action === 'recorded' && spot.audio)) {
        playTileAudio(`hotspot-${spot.id}`, spot.audio, performance.now());
      } else {
        stopBoardAudio();
        speakPhrase(spot.tts || spot.label || 'Hotspot');
      }
    }'''),

    # Express sentence: chain clips when every chip has one.
    ('''    function playExpressSentence() {
      if (expressCollectedChips.length === 0) return;
      const sentence = expressCollectedChips.map(c => c.label).join(' ');
      speakText(sentence);
    }''',
     '''    function playExpressSentence() {
      if (expressCollectedChips.length === 0) return;
      const sentence = expressCollectedChips.map(c => c.label).join(' ');
      // Keep the one voice when every chip has a clip; a sentence that mixes
      // Bella and the device voice would be worse than either alone.
      const clips = expressCollectedChips.map(c => clipForPhrase(c.tts || c.label));
      if (clips.length && clips.every(Boolean) && voiceContext()) {
        window.__lastSpoken = sentence;
        window.__spokenHistory.push(sentence);
        window.__lastVoice = '(clip)';
        playVoiceSequence(clips.map(s => s.audio), () => speakText(sentence));
        return;
      }
      speakText(sentence);
    }

    // Plays clips back to back on the audio clock with a short gap between
    // words; falls back to `onerror` if any of them cannot be decoded.
    let voiceSequenceId = 0;
    function playVoiceSequence(srcs, onerror) {
      const ctx = voiceContext();
      const mine = ++voiceSequenceId;
      stopVoice();
      Promise.all(srcs.map(s => warmVoice(s))).then(bufs => {
        if (mine !== voiceSequenceId) return;
        if (ctx.state !== 'running') unlockVoice();
        let t = ctx.currentTime + 0.01;
        const nodes = bufs.map(buf => {
          const n = ctx.createBufferSource();
          n.buffer = buf; n.connect(ctx.destination);
          n.start(t); t += buf.duration + 0.12;
          return n;
        });
        const last = nodes[nodes.length - 1];
        voiceSourceNode = { stop() { nodes.forEach(n => { try { n.stop(); } catch (e) {} }); },
                            disconnect() { nodes.forEach(n => { try { n.disconnect(); } catch (e) {} }); } };
        last.onended = () => { if (voiceSourceNode && voiceSourceNode.stop && mine === voiceSequenceId) voiceSourceNode = null; };
      }).catch(() => { if (mine === voiceSequenceId && onerror) onerror(); });
    }'''),

    # Edit mode: a gap tap must not open the neighbouring empty slot's editor.
    ('          tile.innerHTML = `<span class="tile-empty-text">Tap to Add Button</span>`;\n          tile.onclick = () => openEditor(slotId);\n          return tile;',
     '          tile.innerHTML = `<span class="tile-empty-text">Tap to Add Button</span>`;\n          // Chromium snaps a tap in the gap between tiles onto the nearest one\n          // and, for the click it synthesises, moves the coordinates inside\n          // it too -- so the click cannot be checked. The pointerdown that\n          // precedes it still carries the finger\'s real position: only a\n          // press that really landed in this slot\'s box lets the click open\n          // its editor. Synthetic clicks (no finger) pass.\n          let pressInside = false;\n          tile.addEventListener(\'pointerdown\', (e) => {\n            const r = tile.getBoundingClientRect();\n            pressInside = !e.isTrusted ||\n              (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);\n          });\n          tile.onclick = (e) => {\n            const ok = !(e && e.isTrusted) || pressInside;\n            pressInside = false;\n            if (ok) openEditor(slotId);\n          };\n          return tile;'),

    # Warm on render.
    ('''      fitAllLabels();
      requestAnimationFrame(() => requestAnimationFrame(fitAllLabels));''',
     '''      fitAllLabels();
      requestAnimationFrame(() => requestAnimationFrame(fitAllLabels));
      warmPageVoices();'''),
    ('''      const container = document.getElementById('scene-hotspots-container');
      container.innerHTML = '';

      (page.hotspots || []).forEach(spot => {''',
     '''      const container = document.getElementById('scene-hotspots-container');
      container.innerHTML = '';
      warmPageVoices();

      (page.hotspots || []).forEach(spot => {'''),
]


def patch(path):
    s = open(path, encoding='utf-8').read()
    if MARK in s:
        print(f'{path}: already patched')
        return
    for old, new in EDITS:
        if s.count(old) != 1:
            raise SystemExit(f'{path}: expected exactly one match, got {s.count(old)}:\n{old[:200]}')
        s = s.replace(old, new)
    open(path, 'w', encoding='utf-8').write(s)
    print(f'{path}: patched ({len(EDITS)} edits)')


if __name__ == '__main__':
    for p in sys.argv[1:]:
        patch(p)
