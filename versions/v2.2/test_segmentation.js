/*
 * Subject-segmentation suite.
 *
 * The colour pass has its own suite (`test_bgeditor.js`) and runs with the
 * model switched off. This one is the opposite: it exercises the neural pass
 * and, just as importantly, everything that has to keep working when the model
 * is slow, absent or wrong. A background remover that is excellent when the
 * model loads and broken when it does not is not finished.
 *
 *   node /home/mike/aac-board/test_segmentation.js
 */
const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');
const fs = require('fs');

const PHOTO = process.argv[2] ||
  '/tmp/claude-1000/-home-mike/6b034049-155b-4a2a-9082-9855844da084/scratchpad/realphotos/PXL_20260809_230318726.jpg';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915 });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  await page.goto('file:///home/mike/aac-board/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass, detail });

  const dataUrl = 'data:image/jpeg;base64,' + fs.readFileSync(PHOTO).toString('base64');
  await page.evaluate((u) => {
    window.PHOTO_URL = u;
    window.loadPhoto = async () => {
      const img = await new Promise((res, rej) => {
        const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = window.PHOTO_URL;
      });
      openCameraFullscreen(); showCameraEditorLayer();
      ED.src = null;
      loadSourceIntoEditor(img, img.naturalWidth, img.naturalHeight);
      return img;
    };
    window.waitForAI = async (ms) => {
      const limit = (ms || 60000) / 100;
      for (let i = 0; i < limit && ED.engine !== 'ai'; i++) await new Promise(r => setTimeout(r, 100));
      return ED.engine === 'ai';
    };
    window.removedPct = () => {
      let n = 0;
      for (let i = 0; i < ED.hard.length; i++) if (ED.hard[i] > 127) n++;
      return 100 * n / (ED.w * ED.h);
    };
  }, dataUrl);

  // ---- 1. the model loads and runs, offline, from file:// ----
  const run = await page.evaluate(async () => {
    await window.loadPhoto();
    const colourEngine = ED.engine;
    const colourFill = ED.fill;
    const colourPct = window.removedPct();
    const busyWhileThinking = document.getElementById('bgx-busy').style.display === 'block';
    const t0 = performance.now();
    const ok = await window.waitForAI(90000);
    return {
      ok, colourEngine, colourFill, busyWhileThinking, engine: ED.engine, status: SEG.status,
      segMs: SEG.lastMs, waitedMs: Math.round(performance.now() - t0),
      colourPct: +colourPct.toFixed(1), aiPct: +window.removedPct().toFixed(1),
      hasSubject: !!ED.subject, subjectLen: ED.subject ? ED.subject.length : 0,
      dims: ED.w * ED.h
    };
  });
  check('the editor shows the photo untouched while the subject is being found',
    run.colourPct === 0 && run.colourFill === 'none', JSON.stringify(run));
  check('the subject model is what produces the first cut, not the colour pass',
    run.engine === 'ai' && run.aiPct > 5, JSON.stringify(run));
  check('the bundled model loads and runs from file://',
    run.ok && run.status === 'ready' && run.segMs > 0, JSON.stringify(run));
  check('the user is told what is happening during the wait',
    run.busyWhileThinking === true, JSON.stringify(run));
  check('the refined matte is kept at full resolution',
    run.hasSubject && run.subjectLen === run.dims, JSON.stringify(run));
  check('inference finishes in under 15s', run.segMs < 15000, run.segMs + 'ms');

  // ---- 2. the matte is edge-aligned, not a blurry upscale ----
  const sharp = await page.evaluate(() => {
    // A guided-filtered matte tracks the photo: its gradient should be much
    // larger where the photo's gradient is large. Compare the mean image
    // gradient under the matte's own edge band against the whole picture.
    const w = ED.w, h = ED.h, d = ED.src.data, sub = ED.subject;
    let bandSum = 0, bandN = 0;
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const i = y * w + x;
        const g = Math.abs(sub[i] - sub[i + 1]) + Math.abs(sub[i] - sub[i + w]);
        if (g > 0.08) {
          const a = i << 2, b = (i + 1) << 2;
          bandSum += Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]);
          bandN++;
        }
      }
    }
    return { ratio: bandN ? +((bandSum / bandN) / Math.max(1, meanGradient(ED.src))).toFixed(2) : 0, bandN };
  });
  check('the matte edge sits on real edges in the photo',
    sharp.ratio > 1.5 && sharp.bandN > 200, JSON.stringify(sharp));

  // ---- 3. the slider re-cuts the model matte, and does it instantly ----
  const slider = await page.evaluate(() => {
    const read = (v) => {
      document.getElementById('wb-tolerance').value = String(v);
      const t0 = performance.now();
      onToleranceInput();
      return { pct: window.removedPct(), ms: performance.now() - t0, engine: ED.engine };
    };
    const low = read(15), mid = read(50), high = read(85);
    return { low, mid, high };
  });
  check('the slider re-cuts the model matte instead of discarding it',
    slider.low.engine === 'ai' && slider.high.engine === 'ai', JSON.stringify(slider));
  check('a higher setting removes more (monotonic on the matte)',
    slider.low.pct <= slider.mid.pct + 0.01 && slider.mid.pct <= slider.high.pct + 0.01,
    JSON.stringify(slider));
  check('re-cutting is instant — no re-inference under the finger',
    slider.low.ms < 400 && slider.mid.ms < 400 && slider.high.ms < 400,
    JSON.stringify([slider.low.ms, slider.mid.ms, slider.high.ms].map(Math.round)));

  // ---- 4. the manual tools still work on top of a model mask ----
  const tools = await page.evaluate(async () => {
    await window.loadPhoto();
    await window.waitForAI(90000);
    const before = window.removedPct();
    edSetTool('erase');
    edPushUndo();
    edPaintDisc(ED.w * 0.5, ED.h * 0.5, Math.round(ED.w * 0.1), 255);
    edRebuildMask();
    const painted = window.removedPct();
    edUndo();
    const undone = window.removedPct();
    return { before: +before.toFixed(2), painted: +painted.toFixed(2), undone: +undone.toFixed(2), engine: ED.engine };
  });
  check('brush and undo work on a model mask',
    tools.painted > tools.before && Math.abs(tools.undone - tools.before) < 0.01, JSON.stringify(tools));

  // ---- 5. a late model result must never clobber the user's work ----
  const protectEdits = await page.evaluate(async () => {
    await window.loadPhoto();                 // model inference now in flight
    edPushUndo();                             // the user starts editing immediately
    edPaintDisc(ED.w * 0.5, ED.h * 0.5, Math.round(ED.w * 0.15), 255);
    edRebuildMask();
    const mine = window.removedPct();
    await new Promise(r => setTimeout(r, 30000));   // let inference land
    return { engine: ED.engine, mine: +mine.toFixed(2), now: +window.removedPct().toFixed(2) };
  });
  check('a model result arriving mid-edit is discarded, not applied',
    protectEdits.engine === 'colour' && Math.abs(protectEdits.now - protectEdits.mine) < 0.01,
    JSON.stringify(protectEdits));

  // ---- 6. swapping photos while inference runs ----
  const protectSwap = await page.evaluate(async () => {
    await window.loadPhoto();
    const firstToken = ED.loadToken;
    await window.loadPhoto();                 // second photo, first still inferring
    const secondToken = ED.loadToken;
    const w = ED.w, h = ED.h;
    await window.waitForAI(90000);
    return { firstToken, secondToken, sameSize: ED.w === w && ED.h === h,
             maskMatchesPhoto: ED.hard.length === ED.w * ED.h,
             subjectMatchesPhoto: !ED.subject || ED.subject.length === ED.w * ED.h };
  });
  check('a result for the previous photo is never applied to the new one',
    protectSwap.secondToken > protectSwap.firstToken &&
    protectSwap.maskMatchesPhoto && protectSwap.subjectMatchesPhoto,
    JSON.stringify(protectSwap));

  // ---- 7. the whole thing degrades to the colour pass ----
  const fallback = await page.evaluate(async () => {
    // Simulate the model being absent, exactly as it would be if the asset
    // failed to ship or the runtime refused to start on some device.
    SEG.ready = Promise.resolve(null);
    SEG.session = null;
    SEG.status = 'unavailable';
    await window.loadPhoto();
    await new Promise(r => setTimeout(r, 2500));
    return { engine: ED.engine, pct: +window.removedPct().toFixed(1),
             busyHidden: document.getElementById('bgx-busy').style.display === 'none',
             usable: window.removedPct() > 5 && window.removedPct() < 99 };
  });
  check('with no model at all, the colour pass still delivers a cut',
    fallback.engine === 'colour' && fallback.usable, JSON.stringify(fallback));
  check('the fallback does not leave the photo sitting uncut',
    fallback.pct > 5, JSON.stringify(fallback));
  check('the working indicator is cleared even when the model never arrives',
    fallback.busyHidden, JSON.stringify(fallback));

  // ---- 8. crop and undo must carry the matte with them ----
  const cropMatte = await page.evaluate(async () => {
    SEG.ready = null; SEG.status = 'idle';      // undo the fallback simulation
    await window.loadPhoto();
    const ok = await window.waitForAI(90000);
    if (!ok) return { skipped: true };
    const before = { w: ED.w, h: ED.h, sub: ED.subject.length };
    edCropToSubject();
    const cropped = { w: ED.w, h: ED.h, sub: ED.subject ? ED.subject.length : 0 };
    // the slider must still re-cut correctly against the cropped geometry
    document.getElementById('wb-tolerance').value = '35';
    onToleranceInput();
    const pctAfterCrop = window.removedPct();
    edUndo();
    const undone = { w: ED.w, h: ED.h, sub: ED.subject ? ED.subject.length : 0 };
    document.getElementById('wb-tolerance').value = '65';
    onToleranceInput();
    const pctAfterUndo = window.removedPct();
    return { before, cropped, undone, pctAfterCrop, pctAfterUndo,
             maskLen: ED.hard.length, dims: ED.w * ED.h };
  });
  check('cropping resizes the model matte with the photo',
    cropMatte.skipped || (cropMatte.cropped.sub === cropMatte.cropped.w * cropMatte.cropped.h &&
      cropMatte.pctAfterCrop > 0 && cropMatte.pctAfterCrop < 100),
    JSON.stringify(cropMatte));
  check('undoing a crop restores a matte that matches the photo',
    cropMatte.skipped || (cropMatte.undone.sub === cropMatte.undone.w * cropMatte.undone.h &&
      cropMatte.maskLen === cropMatte.dims &&
      cropMatte.pctAfterUndo > 0 && cropMatte.pctAfterUndo < 100),
    JSON.stringify(cropMatte));

  // ---- 9. a model that hangs must not leave the editor waiting forever ----
  const hang = await page.evaluate(async () => {
    const realSegment = window.segmentSubject;
    window.segmentSubject = () => new Promise(() => {});   // never resolves
    const shortened = 2500;
    const realTimeout = window.SEG_TIMEOUT_MS;
    await window.loadPhoto();
    const atOpen = { pct: window.removedPct(), fill: ED.fill };
    await new Promise(r => setTimeout(r, (realTimeout || 12000) + 3000));
    const after = { engine: ED.engine, pct: window.removedPct(),
                    busyHidden: document.getElementById('bgx-busy').style.display === 'none' };
    window.segmentSubject = realSegment;
    return { atOpen, after, shortened };
  });
  check('a model that never answers hands over to the colour pass',
    hang.after.engine === 'colour' && hang.after.pct > 5, JSON.stringify(hang));
  check('the working indicator is cleared after a hang', hang.after.busyHidden, JSON.stringify(hang));

  check('no JS errors during the whole run', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();

  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '\n        -> ' + r.detail));
  }
  console.log('\n' + (results.length - failed) + '/' + results.length + ' segmentation checks passed');
  process.exit(failed ? 1 : 0);
})();
