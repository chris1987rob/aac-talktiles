/*
 * Background editor quality suite.
 *
 * The old suite asserted that white pixels came out white. That is not what
 * "the background editor is good" means, and it stayed green through the
 * failures Chris actually hit. This one builds scenes with a KNOWN correct
 * answer -- gradient lighting, sensor noise, a subject touching the frame, a
 * two-surface background, a handle hole -- runs the real editor entry point
 * on them, and scores the mask it produces against the truth.
 *
 *   node /home/mike/aac-board/test_bgeditor.js
 */
const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');

const SCENES = `
/* Each scene returns { canvas, truth } where truth[i] === 1 means "this pixel
 * is background and a perfect editor removes it". */
window.SCENES = {};

function mkScene(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const truth = new Uint8Array(w * h);
  paint(ctx, truth, w, h);
  return { canvas: c, truth: truth, w: w, h: h };
}

function markRect(truth, w, x0, y0, bw, bh) {
  for (let y = y0; y < y0 + bh; y++)
    for (let x = x0; x < x0 + bw; x++) truth[y * w + x] = 0;
}
function markEllipse(truth, w, h, cx, cy, rx, ry) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) truth[y * w + x] = 0;
    }
}
function fillAllBackground(truth) { truth.fill(1); }

/* 1. The easy case: flat wall, object well inside the frame. */
SCENES.flat = () => mkScene(320, 240, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  ctx.fillStyle = '#8d939b'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c0392b'; ctx.fillRect(110, 70, 100, 100);
  markRect(truth, w, 110, 70, 100, 100);
});

/* 2. Real rooms are not one colour: a soft light falloff across the wall.
 *    A fixed seed-relative threshold cannot cross this; the local walk can. */
SCENES.gradient = () => mkScene(320, 240, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#b9c0c8'); g.addColorStop(1, '#5c626b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1f6f3f'; ctx.beginPath();
  ctx.ellipse(160, 120, 62, 52, 0, 0, Math.PI * 2); ctx.fill();
  markEllipse(truth, w, h, 160, 120, 62, 52);
});

/* 3. Phone sensors are noisy in indoor light. Without despeckling this leaves
 *    a pepper of surviving background pixels all over the cut-out. */
SCENES.noisy = () => mkScene(320, 240, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  ctx.fillStyle = '#8d939b'; ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = '#2b4c8c'; ctx.fillRect(105, 65, 110, 110);
  markRect(truth, w, 105, 65, 110, 110);
});

/* 4. The one that broke v2.0: the object stands ON the bottom edge, so the
 *    border flood starts INSIDE it and eats the whole subject. */
SCENES.touchesEdge = () => mkScene(320, 240, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  ctx.fillStyle = '#9aa3ad'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#7a3fa0'; ctx.fillRect(120, 90, 80, 150);   // runs off the bottom
  markRect(truth, w, 120, 90, 80, 150);
});

/* 5. Table meets wall: two background surfaces with a hard line between them.
 *    Both must go, and the border flood only reaches both if the tolerance is
 *    loose enough -- otherwise the user has to tap the survivor. */
SCENES.twoTone = () => mkScene(320, 240, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  ctx.fillStyle = '#c9cdd3'; ctx.fillRect(0, 0, w, 130);        // wall
  ctx.fillStyle = '#6b4a2f'; ctx.fillRect(0, 130, w, h - 130);  // table
  ctx.fillStyle = '#1d7fa8'; ctx.beginPath();
  ctx.ellipse(160, 128, 48, 44, 0, 0, Math.PI * 2); ctx.fill();
  markEllipse(truth, w, h, 160, 128, 48, 44);
});

/* 6. A mug: the hole under the handle is background but is not connected to
 *    the frame edge, so no border flood can ever reach it. */
SCENES.hole = () => mkScene(320, 240, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  ctx.fillStyle = '#8d939b'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d4622a';
  ctx.fillRect(100, 70, 90, 110);                               // body
  ctx.beginPath(); ctx.arc(200, 125, 34, 0, Math.PI * 2); ctx.fill();  // handle
  markRect(truth, w, 100, 70, 90, 110);
  markEllipse(truth, w, h, 200, 125, 34, 34);
  ctx.fillStyle = '#8d939b';
  ctx.beginPath(); ctx.arc(200, 125, 16, 0, Math.PI * 2); ctx.fill();  // the hole
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = x - 200, dy = y - 125;
      if (dx * dx + dy * dy <= 16 * 16) truth[y * w + x] = 1;
    }
});

/* 7b. A drop shadow pooling under the object: a smooth ramp from table colour
 *     to dark that the local walk should absorb as background. */
SCENES.shadow = () => mkScene(320, 240, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  ctx.fillStyle = '#a9a29a'; ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(160, 178, 4, 160, 178, 78);
  g.addColorStop(0, 'rgba(20,16,12,0.55)'); g.addColorStop(1, 'rgba(20,16,12,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 100, w, h - 100);
  ctx.fillStyle = '#2f7d5b'; ctx.fillRect(120, 70, 80, 100);
  markRect(truth, w, 120, 70, 80, 100);
});

/* 7c. A hand holding the object, entering from the right edge -- the object
 *     AND the arm are subject, and both touch the frame. */
SCENES.heldObject = () => mkScene(320, 240, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  ctx.fillStyle = '#b6bcc4'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c9926b'; ctx.fillRect(210, 100, 110, 46);   // arm off the right edge
  markRect(truth, w, 210, 100, 110, 46);
  ctx.fillStyle = '#a83232'; ctx.beginPath();
  ctx.ellipse(160, 122, 58, 50, 0, 0, Math.PI * 2); ctx.fill();
  markEllipse(truth, w, h, 160, 122, 58, 50);
});

/* 7d. Low contrast: a pale object on a pale wall, the case where any threshold
 *     is a compromise. The bar is that it degrades gracefully rather than
 *     removing everything or nothing. */
SCENES.lowContrast = () => mkScene(320, 240, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  ctx.fillStyle = '#c8cbd0'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#aeb3ba'; ctx.fillRect(110, 75, 100, 95);
  markRect(truth, w, 110, 75, 100, 95);
});

/* 7e. The whole thing at once, at phone resolution: vignette, grain, a shadow,
 *     a textured surface and an object standing on the bottom edge. This is
 *     the scene that stands in for an actual photo of an actual toy. */
SCENES.realistic = () => mkScene(768, 1024, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#cfc6b8'); g.addColorStop(1, '#8f8578');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // wood-ish streaks
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = 'rgba(90,72,50,' + (0.03 + Math.random() * 0.05) + ')';
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    const y = Math.random() * h;
    ctx.moveTo(0, y); ctx.bezierCurveTo(w / 3, y + 12, 2 * w / 3, y - 12, w, y);
    ctx.stroke();
  }
  const sh = ctx.createRadialGradient(384, 900, 10, 384, 900, 260);
  sh.addColorStop(0, 'rgba(30,24,16,0.5)'); sh.addColorStop(1, 'rgba(30,24,16,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, 640, w, h - 640);
  // the object: a mug standing on the bottom edge of the frame
  ctx.fillStyle = '#2b62a8';
  ctx.fillRect(250, 380, 270, 644);
  markRect(truth, w, 250, 380, 270, 644);
  // vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  // grain
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
});

/* 7f. A plate filling the bottom of the frame, running into BOTH bottom
 *     corners. It owns those corners, so the corner rule reads it as
 *     background and removes it -- the one case the automatic pass cannot
 *     reason its way out of, and the reason Restore has to exist. */
SCENES.ownsCorners = () => mkScene(320, 240, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  ctx.fillStyle = '#aab0b8'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#7b3f9d'; ctx.fillRect(0, 150, w, h - 150);
  markRect(truth, w, 0, 150, w, h - 150);
});

/* 7. A soft-edged object -- the chain of small steps that walks a gradient is
 *    exactly what walks INTO a blurry object. The leash has to stop it. */
SCENES.softEdge = () => mkScene(320, 240, (ctx, truth, w, h) => {
  fillAllBackground(truth);
  ctx.fillStyle = '#9aa0a8'; ctx.fillRect(0, 0, w, h);
  ctx.filter = 'blur(6px)';
  ctx.fillStyle = '#8e2f2f';
  ctx.beginPath(); ctx.ellipse(160, 120, 60, 55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.filter = 'none';
  markEllipse(truth, w, h, 160, 120, 46, 41);   // truth = the unambiguously solid core
});
`;

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
  await new Promise(r => setTimeout(r, 400));
  // The neural pass is asynchronous and would land in the middle of these
  // checks. It has its own suite; here the colour path is what is under test.
  await page.evaluate(() => { window.TT_AI.enabled = false; });
  await page.evaluate(SCENES);

  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass, detail });

  // Scoring helper installed once, used by every scene.
  await page.evaluate(() => {
    window.scoreScene = function (sceneName) {
      const s = window.SCENES[sceneName]();
      openCameraFullscreen();
      showCameraEditorLayer();
      const t0 = performance.now();
      loadSourceIntoEditor(s.canvas, s.w, s.h);
      const ms = performance.now() - t0;
      return Object.assign({ scene: sceneName, ms: Math.round(ms), amount: ED.amount }, window.maskScore(s.truth));
    };

    /* Scores ED.hard against a truth mask of the same size. */
    window.maskScore = function (truth) {
      const hard = ED.hard, total = ED.w * ED.h;
      let tp = 0, fp = 0, fn = 0, tn = 0;
      for (let i = 0; i < total; i++) {
        const got = hard[i] > 127 ? 1 : 0, want = truth[i];
        if (want && got) tp++;
        else if (!want && got) fp++;      // ate the subject
        else if (want && !got) fn++;      // left background behind
        else tn++;
      }
      return {
        iou: +(tp / (tp + fp + fn)).toFixed(4),
        bgRemoved: +(tp / (tp + fn)).toFixed(4),      // recall on background
        subjectKept: +(tn / (tn + fp)).toFixed(4),    // how much subject survived
        subjectEaten: +(fp / total).toFixed(4)
      };
    };

    /* Fraction of mask pixels sitting at a partial alpha -- i.e. is the cut
     * anti-aliased, or is it a 1-bit staircase? */
    window.edgeSoftness = function () {
      let soft = 0, edge = 0;
      const m = ED.mask, w = ED.w, h = ED.h;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const near = (m[i - 1] > 127) + (m[i + 1] > 127) + (m[i - w] > 127) + (m[i + w] > 127);
          if (near > 0 && near < 4) { edge++; if (m[i] > 8 && m[i] < 247) soft++; }
        }
      }
      return edge ? +(soft / edge).toFixed(3) : 0;
    };
  });

  // ---------------- automatic pass, per scene ----------------
  const auto = {};
  for (const name of ['flat', 'gradient', 'noisy', 'touchesEdge', 'twoTone', 'hole', 'softEdge',
                      'shadow', 'heldObject', 'lowContrast', 'realistic']) {
    auto[name] = await page.evaluate(n => window.scoreScene(n), name);
    console.log('   [auto] ' + JSON.stringify(auto[name]));
  }

  check('flat background: near-perfect cut', auto.flat.iou > 0.985, JSON.stringify(auto.flat));
  check('gradient lighting: background still goes', auto.gradient.iou > 0.95, JSON.stringify(auto.gradient));
  check('sensor noise: no pepper left behind', auto.noisy.iou > 0.95, JSON.stringify(auto.noisy));
  check('two-tone background: both surfaces removed', auto.twoTone.bgRemoved > 0.9, JSON.stringify(auto.twoTone));
  check('a subject standing on the frame edge survives the auto pass',
    auto.touchesEdge.subjectKept > 0.97 && auto.touchesEdge.iou > 0.97, JSON.stringify(auto.touchesEdge));
  check('a held object: neither the object nor the arm is eaten',
    auto.heldObject.subjectKept > 0.9 && auto.heldObject.bgRemoved > 0.9, JSON.stringify(auto.heldObject));
  check('a drop shadow is treated as background', auto.shadow.iou > 0.93, JSON.stringify(auto.shadow));
  check('low contrast degrades gracefully, never all-or-nothing',
    auto.lowContrast.subjectKept > 0.75 && auto.lowContrast.bgRemoved > 0.5, JSON.stringify(auto.lowContrast));
  check('a full-resolution realistic photo comes out clean',
    auto.realistic.iou > 0.93 && auto.realistic.subjectKept > 0.95, JSON.stringify(auto.realistic));
  check('the solid body of a blurry object is never eaten', auto.softEdge.subjectKept > 0.97, JSON.stringify(auto.softEdge));
  check('auto never eats a centred subject whole',
    ['flat', 'gradient', 'noisy', 'twoTone', 'hole', 'softEdge'].every(k => auto[k].subjectKept > 0.85),
    JSON.stringify(Object.fromEntries(Object.entries(auto).map(([k, v]) => [k, v.subjectKept]))));
  check('every scene processes in under 900ms (incl. a 768x1024 photo)',
    Object.values(auto).every(a => a.ms < 900),
    JSON.stringify(Object.fromEntries(Object.entries(auto).map(([k, v]) => [k, v.ms]))));

  // Every scene above produces a near-perfect cut, so every one of them must
  // be applied without asking. A confidence rule that rejects a good cut is as
  // much a bug as one that accepts a bad one -- an earlier version of this
  // gate quietly refused three of these because it judged by how much had been
  // removed, and a small object on a big table legitimately removes 90%.
  const confidence = await page.evaluate(() => {
    const r = {};
    for (const n of ['flat', 'gradient', 'noisy', 'touchesEdge', 'twoTone', 'hole',
                     'softEdge', 'shadow', 'heldObject', 'lowContrast', 'realistic']) {
      const s = window.SCENES[n]();
      openCameraFullscreen(); showCameraEditorLayer();
      loadSourceIntoEditor(s.canvas, s.w, s.h);
      r[n] = { confident: ED.autoConfident, fill: ED.fill };
    }
    return r;
  });
  check('a good cut is applied on open, every time',
    Object.values(confidence).every(v => v.confident === true && v.fill === 'white'),
    JSON.stringify(confidence));

  // And the opposite: a photo with no isolatable subject must open on the
  // untouched picture rather than on a nearly blank frame.
  const noSubject = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 240;
    const ctx = c.getContext('2d');
    // dense clutter edge to edge -- no background, no subject
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = 'hsl(' + Math.floor(Math.random() * 360) + ',60%,' + (25 + Math.random() * 50) + '%)';
      ctx.fillRect(Math.random() * 320, Math.random() * 240, 8 + Math.random() * 26, 8 + Math.random() * 26);
    }
    openCameraFullscreen(); showCameraEditorLayer();
    loadSourceIntoEditor(c, 320, 240);
    return { confident: ED.autoConfident, fill: ED.fill };
  });
  check('a photo with no isolatable subject opens on the original',
    noSubject.confident === false && noSubject.fill === 'none', JSON.stringify(noSubject));

  const soft = await page.evaluate(() => { window.scoreScene('flat'); return window.edgeSoftness(); });
  check('the cut edge is anti-aliased, not a 1-bit staircase', soft > 0.5, 'soft edge fraction=' + soft);

  // ---------------- tap-restore rescues a subject on the frame edge -------
  const rescue = await page.evaluate(() => {
    const s = window.SCENES.ownsCorners();
    openCameraFullscreen(); showCameraEditorLayer();
    loadSourceIntoEditor(s.canvas, s.w, s.h);
    const before = window.maskScore(s.truth);
    edSetTool('restore');
    edTapAt(160, 200);                    // inside the plate the auto pass removed
    const after = window.maskScore(s.truth);
    return { before, after, undos: ED.undo.length };
  });
  check('tap-restore rescues a subject the auto pass could not save',
    rescue.after.subjectKept > 0.97 && rescue.after.subjectKept > rescue.before.subjectKept + 0.3,
    JSON.stringify(rescue));
  check('a tap is undoable', rescue.undos > 0, 'undo depth=' + rescue.undos);

  // ---------------- tap-erase clears an unreachable hole ------------------
  const holeFix = await page.evaluate(() => {
    const s = window.SCENES.hole();
    openCameraFullscreen(); showCameraEditorLayer();
    loadSourceIntoEditor(s.canvas, s.w, s.h);
    const before = window.maskScore(s.truth);
    edSetTool('erase');
    edTapAt(200, 125);                    // the hole under the handle
    const after = window.maskScore(s.truth);
    return { before, after };
  });
  check('tap-erase clears a hole no border fill can reach',
    holeFix.after.bgRemoved > holeFix.before.bgRemoved && holeFix.after.iou > 0.985,
    JSON.stringify(holeFix));
  // Regression: the tap flood used to inherit a 3x drift leash, which let it
  // walk out of the hole through the mug's anti-aliased rim and take the whole
  // mug with it. One tap must never be able to eat the picture.
  check('one tap can never run away and eat the subject',
    holeFix.after.subjectEaten < 0.02 && holeFix.after.subjectKept > 0.98,
    JSON.stringify(holeFix.after));

  // ---------------- undo actually rewinds --------------------------------
  const undoTest = await page.evaluate(() => {
    const s = window.SCENES.flat();
    openCameraFullscreen(); showCameraEditorLayer();
    loadSourceIntoEditor(s.canvas, s.w, s.h);
    const before = window.maskScore(s.truth);
    edSetTool('erase');
    edPushUndo();
    edPaintDisc(160, 120, 40, 255);       // gouge a hole in the subject
    edRebuildMask();
    const damaged = window.maskScore(s.truth);
    edUndo();
    const restored = window.maskScore(s.truth);
    return { before, damaged, restored };
  });
  check('undo restores the mask exactly',
    undoTest.restored.iou === undoTest.before.iou && undoTest.damaged.iou < undoTest.before.iou,
    JSON.stringify(undoTest));

  // ---------------- crop to subject --------------------------------------
  const crop = await page.evaluate(() => {
    const s = window.SCENES.flat();
    openCameraFullscreen(); showCameraEditorLayer();
    loadSourceIntoEditor(s.canvas, s.w, s.h);
    const before = { w: ED.w, h: ED.h };
    edCropToSubject();
    const after = { w: ED.w, h: ED.h };
    // the subject was 100x100 inside 320x240; the crop should be close to it
    let kept = 0;
    for (let i = 0; i < ED.hard.length; i++) if (ED.hard[i] === 0) kept++;
    const fillRatio = kept / (ED.w * ED.h);
    edUndo();
    return { before, after, fillRatio, undone: { w: ED.w, h: ED.h } };
  });
  check('crop tightens the frame onto the subject',
    crop.after.w < crop.before.w * 0.6 && crop.fillRatio > 0.6,
    JSON.stringify(crop));
  check('crop is undoable back to the original size',
    crop.undone.w === crop.before.w && crop.undone.h === crop.before.h,
    JSON.stringify(crop));

  // ---------------- the amount slider still works ------------------------
  const slider = await page.evaluate(() => {
    const s = window.SCENES.gradient();
    openCameraFullscreen(); showCameraEditorLayer();
    loadSourceIntoEditor(s.canvas, s.w, s.h);
    const readAt = (v) => {
      document.getElementById('wb-tolerance').value = String(v);
      onToleranceInput();
      let removed = 0;
      for (let i = 0; i < ED.hard.length; i++) if (ED.hard[i] > 127) removed++;
      return removed / (ED.w * ED.h);
    };
    const low = readAt(8), mid = readAt(28), high = readAt(70);
    return { low, mid, high, readout: document.getElementById('wb-tolerance-value').textContent };
  });
  check('more tolerance removes more (monotonic)',
    slider.low <= slider.mid + 1e-9 && slider.mid <= slider.high + 1e-9,
    JSON.stringify(slider));
  check('slider readout tracks the value', slider.readout === '70', JSON.stringify(slider));

  // ---------------- fill modes ------------------------------------------
  const fills = await page.evaluate(() => {
    const s = window.SCENES.flat();
    openCameraFullscreen(); showCameraEditorLayer();
    loadSourceIntoEditor(s.canvas, s.w, s.h);
    const ctx = document.getElementById('camera-fs-canvas').getContext('2d');
    const px = () => { const d = ctx.getImageData(2, 2, 1, 1).data; return [d[0], d[1], d[2]].join(); };
    const mid = () => { const d = ctx.getImageData(160, 120, 1, 1).data; return [d[0], d[1], d[2]].join(); };
    edSetFill('white'); const w = px(), wm = mid();
    edSetFill('black'); const b = px(), bm = mid();
    edSetFill('none');  const n = px();
    return { w, wm, b, bm, n,
      marks: {
        white: document.getElementById('btn-bg-white').classList.contains('active-fill'),
        none: document.getElementById('btn-bg-none').classList.contains('active-fill')
      } };
  });
  check('white / black / original all render correctly',
    fills.w === '255,255,255' && fills.b === '0,0,0' && fills.n !== '255,255,255' &&
    fills.wm === fills.bm,
    JSON.stringify(fills));
  check('the active fill is the one marked in the panel',
    fills.marks.none === true && fills.marks.white === false, JSON.stringify(fills.marks));

  // ---------------- tap vs drag through real pointer events --------------
  const gesture = await page.evaluate(async () => {
    const s = window.SCENES.flat();
    openCameraFullscreen(); showCameraEditorLayer();
    loadSourceIntoEditor(s.canvas, s.w, s.h);
    await new Promise(r => requestAnimationFrame(r));
    const stage = document.getElementById('bgx-stage');
    const canvas = document.getElementById('camera-fs-canvas');
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / ED.w, rect.height / ED.h);
    const ox = rect.left + (rect.width - ED.w * scale) / 2;
    const oy = rect.top + (rect.height - ED.h * scale) / 2;
    const at = (sx, sy) => ({ clientX: ox + sx * scale, clientY: oy + sy * scale });

    const send = (type, pt, id) => stage.dispatchEvent(new PointerEvent(type, {
      pointerId: id || 1, bubbles: true, clientX: pt.clientX, clientY: pt.clientY
    }));

    const countRemoved = () => { let n = 0; for (let i = 0; i < ED.hard.length; i++) if (ED.hard[i] > 127) n++; return n; };

    // a stationary press-release inside the subject = tap
    edSetTool('erase');
    const base = countRemoved();
    send('pointerdown', at(160, 120));
    send('pointerup', at(160, 120));
    const afterTap = countRemoved();

    // a drag across the subject = brush stroke
    edUndo();
    const preDrag = countRemoved();
    send('pointerdown', at(120, 120));
    for (let x = 125; x <= 200; x += 5) send('pointermove', at(x, 120));
    send('pointerup', at(200, 120));
    await new Promise(r => requestAnimationFrame(r));
    const afterDrag = countRemoved();

    return { base, afterTap, preDrag, afterDrag, mapped: Math.round(scale * 1000) / 1000 };
  });
  check('a stationary press erases the region under the finger',
    gesture.afterTap > gesture.base, JSON.stringify(gesture));
  check('a drag paints instead of flooding',
    gesture.afterDrag > gesture.preDrag && gesture.afterDrag < gesture.afterTap,
    JSON.stringify(gesture));

  // ---------------- saving keeps the edit --------------------------------
  const save = await page.evaluate(async () => {
    const s = window.SCENES.flat();
    openEditor(11);
    openCameraFullscreen(); showCameraEditorLayer();
    loadSourceIntoEditor(s.canvas, s.w, s.h);
    edSetFill('white');
    saveCapturedToTile();
    await new Promise(r => setTimeout(r, 300));
    if (!pendingPhotoBlob) return { noBlob: true };
    const url = URL.createObjectURL(pendingPhotoBlob);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const d = c.getContext('2d').getImageData(2, 2, 1, 1).data;
    URL.revokeObjectURL(url);
    closeEditor();
    return { w: img.naturalWidth, h: img.naturalHeight, corner: [d[0], d[1], d[2]] };
  });
  check('the saved photo carries the white background',
    !save.noBlob && save.corner.every(v => v > 245) && save.w === 320,
    JSON.stringify(save));

  // Regression: saveEditorTile used to read pendingPhotoBlob synchronously
  // while canvas -> JPEG was still in flight, so a tile saved immediately
  // after editing stored the photo as it was BEFORE the background was
  // removed -- silently, with no error anywhere.
  const raceFree = await page.evaluate(async () => {
    const s = window.SCENES.flat();
    openEditor(12);
    const c = document.createElement('canvas');
    c.width = 40; c.height = 40; c.getContext('2d').fillStyle = '#123456';
    c.getContext('2d').fillRect(0, 0, 40, 40);
    const original = await new Promise(res => c.toBlob(res, 'image/png'));
    pendingPhotoBlob = original;

    openCameraFullscreen(); showCameraEditorLayer();
    loadSourceIntoEditor(s.canvas, s.w, s.h);
    edSetFill('white');
    saveCapturedToTile();          // deliberately NOT awaited
    await saveEditorTile();        // must still store the edited photo
    const stored = cachedTiles.get(12);
    const same = stored && stored.photo === original;
    const size = stored && stored.photo ? stored.photo.size : 0;
    await deleteTileFromDB(12);
    renderBoard();
    return { storedTheOriginal: !!same, size };
  });
  check('saving right after an edit stores the EDITED photo, not the original',
    raceFree.storedTheOriginal === false && raceFree.size > 1000, JSON.stringify(raceFree));

  check('no JS errors during the whole run', errors.length === 0, errors.join(' | '));

  await browser.close();

  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '\n        -> ' + r.detail));
  }
  console.log('\n' + (results.length - failed) + '/' + results.length + ' background-editor checks passed');
  process.exit(failed ? 1 : 0);
})();
