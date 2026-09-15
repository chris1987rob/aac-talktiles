// Talk Tiles voice suite: the Bella clips must start the instant a tile is
// pressed, and every clip must start with the word, not with dead air.
//
//   node test_voice.js
//
// Runs headless Chrome against index.html over file:// (as the packaged app
// does), so XHR -> decodeAudioData is the same path the WebView takes.
const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');
const path = require('path');

const WARM_LATENCY_MS = 15;     // JS-side tap -> AudioBufferSourceNode.start
const MAX_LEAD_MS = 150;        // decoded audio before the first sample above -30 dBFS
const MIN_CLIP_S = 0.2;
const MIN_PEAK_DB = -20;

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 1000 });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  await page.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 300));

  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass, detail });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clickTile = async (slot) => {
    const box = await (await page.$('#tile-slot-' + slot)).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };

  // ---- 1. Engine up, clips for the page on screen decoded before any tap ----
  let s = await page.evaluate(async () => {
    const ctx = voiceContext();
    const srcs = pageVoiceSources(pages[currentPageIndex]);
    const t0 = performance.now();
    await Promise.all(srcs.map(x => warmVoice(x)));
    return {
      ctx: !!ctx, state: ctx && ctx.state, tiles: Object.keys(pages[currentPageIndex].tiles || {}).length,
      srcs: srcs.length, ready: srcs.filter(x => !!voiceBufferReady(x)).length, warmMs: performance.now() - t0
    };
  });
  check('1. Web Audio engine is up and the first page\'s clips are decoded on render',
    s.ctx && s.state === 'running' && s.srcs > 0 && s.ready === s.srcs, JSON.stringify(s));

  // ---- 2. Warm tap: real clicks start the clip on the audio clock within WARM_LATENCY_MS ----
  const lat = [];
  for (let i = 0; i < 12; i++) {
    await clickTile(1 + (i % 4));
    await sleep(60);
    lat.push(await page.evaluate(() => ({ ...window.__voiceTelemetry, node: !!voiceSourceNode })));
  }
  const worst = Math.max(...lat.map(l => l.latencyMs));
  const median = lat.map(l => l.latencyMs).sort((a, b) => a - b)[Math.floor(lat.length / 2)];
  check(`2. 12 real taps all take the decoded-buffer path and schedule within ${WARM_LATENCY_MS} ms (median ${median.toFixed(2)} ms, worst ${worst.toFixed(2)} ms)`,
    lat.every(l => l.path === 'buffer' && l.node) && worst < WARM_LATENCY_MS,
    lat.map(l => `${l.path}:${l.latencyMs.toFixed(2)}`).join(' '));

  // ---- 3. Press plays (not release); a release after a press does not play again ----
  s = await page.evaluate(async () => {
    const tile = document.getElementById('tile-slot-1');
    const before = window.__voiceTelemetry.taps;
    tile.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const afterDown = window.__voiceTelemetry.taps;
    tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const afterUp = window.__voiceTelemetry.taps;
    // a release with no press (synthetic / assistive input) still plays once
    tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const afterLoneUp = window.__voiceTelemetry.taps;
    return { down: afterDown - before, up: afterUp - afterDown, loneUp: afterLoneUp - afterUp };
  });
  check('3. The press starts the word; the release of the same press does not replay it; a lone release still plays',
    s.down === 1 && s.up === 0 && s.loneUp === 1, JSON.stringify(s));

  // ---- 4. A second tap cuts the first clip short (one voice at a time) ----
  s = await page.evaluate(async () => {
    const t1 = document.getElementById('tile-slot-1'), t2 = document.getElementById('tile-slot-2');
    t1.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const first = voiceSourceNode;
    const firstSrc = window.__voiceTelemetry.src;
    t2.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const second = voiceSourceNode;
    return { distinct: first !== second && !!second, secondSrc: window.__voiceTelemetry.src, firstSrc,
             highlighted: document.querySelectorAll('.tile.playing').length };
  });
  check('4. Tapping another tile stops the first clip and moves the highlight',
    s.distinct && s.secondSrc !== s.firstSrc && s.highlighted === 1, JSON.stringify(s));

  // ---- 5. Cold tap: an un-warmed clip still plays at once (element path) and is a buffer next time ----
  s = await page.evaluate(async () => {
    const sym = AAC_SYMBOL_LIBRARY.filter(x => x.audio && !voiceBufferReady(x.audio))[50];
    const cold = playVoice(sym.audio, {});
    await new Promise(r => setTimeout(r, 600));
    const warmed = !!voiceBufferReady(sym.audio);
    const hot = playVoice(sym.audio, {});
    return { cold, warmed, hot, latencyMs: window.__voiceTelemetry.latencyMs };
  });
  check('5. Un-warmed clip plays immediately through the element path and is decoded for the next tap',
    s.cold === 'element' && s.warmed && s.hot === 'buffer', JSON.stringify(s));

  // ---- 6. A recorded tile (Blob) goes through the same decoded path ----
  s = await page.evaluate(async () => {
    const bytes = await fetchVoiceBytes('symbols/audio/dog.mp3');
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const p = pages[currentPageIndex];
    const slot = 3;
    p.tiles[slot] = Object.assign({}, p.tiles[slot] || { id: slot }, { label: 'Woof', tts: 'Woof', audio: blob });
    renderCurrentPage();
    await warmVoice(blob);
    document.getElementById('tile-slot-' + slot).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const tel = { ...window.__voiceTelemetry };
    delete p.tiles[slot].audio; p.tiles[slot].label = 'Yellow'; p.tiles[slot].tts = 'Yellow';
    renderCurrentPage();
    return { path: tel.path, src: tel.src, latencyMs: tel.latencyMs, spoke: window.__lastSpoken };
  });
  check('6. A tile recording (Blob) is decoded on render and starts from its buffer',
    s.path === 'buffer' && s.src === '(blob)' && s.latencyMs < WARM_LATENCY_MS, JSON.stringify(s));

  // ---- 7. Every phrase a built-in board speaks has a Bella clip ----
  s = await page.evaluate(() => {
    const missing = [];
    let total = 0;
    const add = (t, where) => { if (!t) return; total++; if (!clipForPhrase(t)) missing.push(where + ':' + t); };
    const tilesOf = p => Object.values((p && p.tiles) || {}).filter(Boolean);
    DEFAULT_PAGES.forEach(p => { tilesOf(p).forEach(t => add(t.tts || t.label, 'default')); (p.hotspots || []).forEach(h => add(h.tts || h.label, 'default-hotspot')); });
    BUILTIN_TEMPLATES.forEach(tpl => tilesOf(tpl.page || tpl).forEach(t => add(t.tts || t.label, 'template:' + (tpl.name || tpl.title))));
    ONLINE_GALLERY_TEMPLATES.forEach(b => Object.values(b.tiles || {}).forEach(t => t && add(t.tts || t.label, 'gallery:' + b.id)));
    Object.values(SCENE_PRESETS).forEach(sc => (sc.hotspots || []).forEach(h => add(h.tts || h.label, 'scene')));
    return { total, missing };
  });
  check(`7. All ${s.total} phrases on the default pages, built-in templates, gallery boards and scene presets have a Bella clip`,
    s.total > 100 && s.missing.length === 0, s.missing.slice(0, 20).join(' | ') + (s.missing.length > 20 ? ` (+${s.missing.length - 20})` : ''));

  // ---- 8. Core Words (Classic): every tile speaks its own word from a clip ----
  s = await page.evaluate(async () => {
    const tpl = BUILTIN_TEMPLATES.find(t => /core words/i.test(t.name || t.title));
    const p = tpl.page || tpl;
    const tiles = Object.values(p.tiles || {}).filter(t => t && (t.tts || t.label));
    const bad = [];
    for (const t of tiles) {
      const sym = tileSymbolClip(t);
      if (!sym) { bad.push(t.label + ':no-clip'); continue; }
      if (normalisePhrase(sym.tts || sym.label) !== normalisePhrase(t.tts || t.label)) bad.push(t.label + ':says "' + (sym.tts || sym.label) + '"');
    }
    return { tiles: tiles.length, bad };
  });
  check(`8. Every one of the ${s.tiles} Core Words (Classic) tiles resolves to a clip that says exactly its word`,
    s.tiles >= 40 && s.bad.length === 0, s.bad.join(' | '));

  // ---- 9. Express bar: all-clip sentence chains clips in one voice ----
  s = await page.evaluate(async () => {
    const p = pages[currentPageIndex];
    p.express = true;
    expressCollectedChips = [];
    renderCurrentPage();
    ['tile-slot-1', 'tile-slot-2'].forEach(id => document.getElementById(id).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    const chips = expressCollectedChips.map(c => c.label);
    window.__spokenHistory = [];
    document.getElementById('express-bar').click();
    await new Promise(r => setTimeout(r, 150));
    const out = { chips, spoke: window.__spokenHistory.slice(), voice: window.__lastVoice, chained: !!(voiceSourceNode && voiceSourceNode.stop) };
    expressCollectedChips = []; p.express = false; renderCurrentPage();
    return out;
  });
  check('9. Express bar speaks a sentence of clip words as chained Bella clips', s.chips.length === 2 && s.spoke.length === 1 && s.voice === '(clip)' && s.chained, JSON.stringify(s));

  // ---- 10. Every clip decodes, is a real word, and starts without dead air ----
  const clipStats = await page.evaluate(async (MAX_LEAD_MS, MIN_CLIP_S, MIN_PEAK_DB) => {
    const ctx = voiceContext();
    const list = AAC_SYMBOL_LIBRARY.filter(x => x.audio).map(x => x.audio)
      .concat((typeof AAC_PHRASE_CLIPS !== 'undefined' ? AAC_PHRASE_CLIPS : []).map(c => c.audio));
    const thr = Math.pow(10, -30 / 20);
    const bad = [];
    let maxLead = 0, leads = [];
    const one = async (url) => {
      try {
        const buf = await decodeVoiceBytes(ctx, await fetchVoiceBytes(url));
        const d = buf.getChannelData(0);
        let first = -1, peak = 0;
        for (let i = 0; i < d.length; i++) {
          const a = Math.abs(d[i]);
          if (a > peak) peak = a;
          if (first < 0 && a > thr) first = i;
        }
        const leadMs = first < 0 ? Infinity : 1000 * first / buf.sampleRate;
        const peakDb = 20 * Math.log10(peak || 1e-9);
        leads.push(leadMs);
        if (leadMs > maxLead) maxLead = leadMs;
        if (leadMs > MAX_LEAD_MS) bad.push(`${url}: ${leadMs.toFixed(0)} ms of dead air`);
        else if (buf.duration < MIN_CLIP_S) bad.push(`${url}: only ${buf.duration.toFixed(2)} s`);
        else if (peakDb < MIN_PEAK_DB) bad.push(`${url}: peak ${peakDb.toFixed(0)} dB`);
      } catch (e) { bad.push(`${url}: ${e.message || e}`); }
    };
    let i = 0;
    const workers = Array.from({ length: 12 }, async () => { while (i < list.length) await one(list[i++]); });
    await Promise.all(workers);
    leads.sort((a, b) => a - b);
    return { total: list.length, bad, maxLead, p50: leads[Math.floor(leads.length / 2)], p99: leads[Math.floor(leads.length * 0.99)] };
  }, MAX_LEAD_MS, MIN_CLIP_S, MIN_PEAK_DB);
  check(`10. All ${clipStats.total} clips decode, carry a word, and start within ${MAX_LEAD_MS} ms (lead p50 ${clipStats.p50.toFixed(0)} ms, p99 ${clipStats.p99.toFixed(0)} ms, max ${clipStats.maxLead.toFixed(0)} ms)`,
    clipStats.total >= 2210 && clipStats.bad.length === 0,
    clipStats.bad.slice(0, 10).join(' | ') + (clipStats.bad.length > 10 ? ` (+${clipStats.bad.length - 10})` : ''));

  // ---- 11. A finger in the gap between tiles plays nothing; a finger on a tile plays that tile ----
  // Chromium snaps a touch in the gap onto the nearest tile (touch-target
  // adjustment), which used to speak the NEXT tile's word. Real touch input
  // via CDP goes through that same adjustment.
  const touchPage = await browser.newPage();
  await touchPage.setViewport({ width: 800, height: 1000, hasTouch: true, isMobile: true });
  touchPage.on('pageerror', e => errors.push('touch pageerror: ' + e.message));
  await touchPage.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil: 'networkidle0' });
  const boxes = await touchPage.evaluate(() => [...document.querySelectorAll('#tiles-grid .tile')].map(t => {
    const r = t.getBoundingClientRect(); return { slot: t.dataset.slot, x: r.left, y: r.top, w: r.width, h: r.height, label: (pages[currentPageIndex].tiles[t.dataset.slot] || {}).label };
  }));
  const b1 = boxes[0], b2 = boxes[1], b3 = boxes[2];
  const gapTaps = [
    ['column gap centre', (b1.x + b1.w + b2.x) / 2, b1.y + b1.h / 2],
    ['column gap, 1px before tile 2', b2.x - 1, b1.y + b1.h / 2],
    ['column gap, 1px after tile 1', b1.x + b1.w + 1, b1.y + b1.h / 2],
    ['row gap centre', b1.x + b1.w / 2, (b1.y + b1.h + b3.y) / 2],
    ['grid corner outside all tiles', b1.x - 6, b1.y - 6]
  ];
  const gapOut = [];
  for (const [name, x, y] of gapTaps) {
    await touchPage.evaluate(() => { window.__voiceTelemetry.taps = 0; window.__lastSpoken = ''; });
    await touchPage.touchscreen.tap(x, y);
    await sleep(60);
    const r = await touchPage.evaluate(() => ({ taps: window.__voiceTelemetry.taps, spoke: window.__lastSpoken }));
    if (r.taps !== 0 || r.spoke) gapOut.push(`${name}: spoke "${r.spoke}"`);
  }
  const onOut = [];
  for (const b of boxes) {
    for (const [dx, dy] of [[0.5, 0.5], [0.02, 0.5], [0.98, 0.5], [0.5, 0.02], [0.5, 0.98]]) {
      await touchPage.evaluate(() => { window.__voiceTelemetry.taps = 0; window.__lastSpoken = ''; });
      await touchPage.touchscreen.tap(b.x + b.w * dx, b.y + b.h * dy);
      await sleep(60);
      const r = await touchPage.evaluate(() => ({ taps: window.__voiceTelemetry.taps, spoke: window.__lastSpoken, path: window.__voiceTelemetry.path }));
      if (r.taps !== 1 || r.spoke !== b.label) onOut.push(`slot ${b.slot} at ${dx},${dy}: spoke "${r.spoke}" x${r.taps}`);
    }
  }
  // Edit mode: a gap tap must not open a neighbouring empty slot's editor.
  const editGap = await touchPage.evaluate(() => {
    const p = pages[currentPageIndex]; delete p.tiles[2];
    isEditMode = true; renderCurrentPage();
    const t = document.getElementById('tile-slot-2'); const r = t.getBoundingClientRect();
    return { x: r.left - 6, y: r.top + r.height / 2, empty: t.classList.contains('empty-editor') };
  });
  await touchPage.touchscreen.tap(editGap.x, editGap.y);
  await sleep(60);
  const editorOpened = await touchPage.evaluate(() => document.getElementById('editor-modal').classList.contains('open'));
  await touchPage.close();
  check(`11. Touch: ${gapTaps.length} taps in the gaps play nothing; ${boxes.length * 5} taps on tiles (centre + all four edges) each play that tile's own word; a gap tap in edit mode opens no editor`,
    gapOut.length === 0 && onOut.length === 0 && editGap.empty && !editorOpened,
    [...gapOut, ...onOut, editorOpened ? 'editor opened from a gap tap' : ''].filter(Boolean).join(' | '));

  check('12. Zero JS errors during voice testing', errors.length === 0, errors.join(' | '));

  await browser.close();

  let passed = 0;
  results.forEach(r => {
    if (r.pass) passed++;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n        -> ' + r.detail}`);
  });
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
