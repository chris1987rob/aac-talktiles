const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');

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

  check('loads with zero JS errors', errors.length === 0, errors.join(' | '));

  // ---- 1. Lock disables the layout numbers + Edit, tiles stay live ----
  let state = await page.evaluate(() => {
    document.getElementById('btn-lock').click();
    return {
      pinned: isPinned,
      l1: document.getElementById('btn-layout-1').disabled,
      l2: document.getElementById('btn-layout-2').disabled,
      l3: document.getElementById('btn-layout-3').disabled,
      edit: document.getElementById('btn-edit-mode').disabled,
      lockBtn: document.getElementById('btn-lock').disabled,
      tilePointer: getComputedStyle(document.querySelector('.tile')).pointerEvents
    };
  });
  check('Lock pins + disables 1/2/3 + Edit', state.pinned && state.l1 && state.l2 && state.l3 && state.edit, JSON.stringify(state));
  check('Lock button itself stays usable while pinned', state.lockBtn === false, 'disabled=' + state.lockBtn);
  check('tiles stay tappable while pinned', state.tilePointer !== 'none', 'pointer-events=' + state.tilePointer);

  // ---- 2. Editor refuses to open while pinned ----
  let editorOpen = await page.evaluate(() => {
    openEditor(1);
    return document.getElementById('editor-modal').classList.contains('open');
  });
  check('tile editor blocked while pinned', editorOpen === false, 'modal open=' + editorOpen);

  let layoutHeld = await page.evaluate(() => { const before = currentLayout; setLayout(3); return { before, after: currentLayout }; });
  check('setLayout ignored while pinned', layoutHeld.before === layoutHeld.after, JSON.stringify(layoutHeld));

  // ---- 3. Unlock restores everything ----
  state = await page.evaluate(() => {
    document.getElementById('btn-lock').click();
    return {
      pinned: isPinned,
      l1: document.getElementById('btn-layout-1').disabled,
      edit: document.getElementById('btn-edit-mode').disabled,
      title: document.getElementById('btn-edit-mode').title
    };
  });
  check('Unlock re-enables 1/2/3 + Edit (title restored)', !state.pinned && !state.l1 && !state.edit && state.title === 'Toggle Edit Mode', JSON.stringify(state));

  // ---- 4. Native -> JS pin sync (the back+overview escape hatch) ----
  state = await page.evaluate(() => {
    setPinnedState(true, false);
    const pinnedNow = isPinned && document.getElementById('btn-edit-mode').disabled;
    setPinnedState(false, false);
    return { pinnedNow, releasedOk: !isPinned && !document.getElementById('btn-edit-mode').disabled };
  });
  check('setPinnedState(x,false) syncs OS truth both ways', state.pinnedNow && state.releasedOk, JSON.stringify(state));

  // ---- 5. A captured photo previews, then saves to the tile ----
  // Background removal was taken out in v2.3 (archived under versions/v2.2),
  // so what has to keep working here is the plain path: put a photo on the
  // preview canvas, press Save, and get that photo -- not the one before it --
  // onto the tile.
  const capture = await page.evaluate(async () => {
    const shot = document.createElement('canvas');
    shot.width = 240; shot.height = 320;
    const sx = shot.getContext('2d');
    sx.fillStyle = '#2f6f4f'; sx.fillRect(0, 0, 240, 320);
    sx.fillStyle = '#e8b23a'; sx.fillRect(60, 90, 120, 140);

    openEditor(2);
    const stale = await new Promise(res => {
      const c = document.createElement('canvas');
      c.width = 8; c.height = 8;
      c.getContext('2d').fillRect(0, 0, 8, 8);
      c.toBlob(res, 'image/png');
    });
    pendingPhotoBlob = stale;             // an older photo already staged

    openCameraFullscreen();
    showCameraEditorLayer();
    loadSourceIntoEditor(shot, 240, 320);

    const canvas = document.getElementById('camera-fs-canvas');
    const fs = document.getElementById('camera-fs');
    const fsStyle = getComputedStyle(fs);
    const px = canvas.getContext('2d').getImageData(120, 160, 1, 1).data;
    // Snapshot now: saving closes the full-screen view, and both the class
    // list and a live computed style would read post-close from the return.
    const shown = {
      open: fs.classList.contains('open'),
      fullScreen: fsStyle.position === 'fixed' && parseInt(fsStyle.width, 10) >= 400
    };

    saveCapturedToTile();                 // deliberately not awaited
    await saveEditorTile();               // must still store the NEW photo

    const stored = getTileRecord(pages[currentPageIndex], 2);
    return {
      previewW: canvas.width, previewH: canvas.height,
      fsOpen: shown.open,
      fsFullScreen: shown.fullScreen,
      middle: [px[0], px[1], px[2]],
      storedStale: !!(stored && stored.photo === stale),
      storedSize: stored && stored.photo ? stored.photo.size : 0
    };
  });
  check('a captured photo shows full screen at its own aspect',
    capture.fsOpen && capture.fsFullScreen && capture.previewW === 240 && capture.previewH === 320,
    JSON.stringify(capture));
  check('the preview shows the photo that was taken',
    capture.middle[0] > 180 && capture.middle[2] < 120, JSON.stringify(capture));
  check('saving stores the new photo, not the one already staged',
    capture.storedStale === false && capture.storedSize > 500, JSON.stringify(capture));

  const noBgControls = await page.evaluate(() => ({
    editBtn: !!document.getElementById('btn-edit-photo'),
    white: !!document.getElementById('btn-bg-white'),
    black: !!document.getElementById('btn-bg-black'),
    slider: !!document.getElementById('wb-tolerance'),
    stage: !!document.getElementById('bgx-stage'),
    fns: ['fillBackground', 'applyBackgroundFill', 'editPendingPhoto', 'segmentSubject']
      .filter(n => typeof window[n] === 'function')
  }));
  check('no background-removal controls or code are left behind',
    !noBgControls.editBtn && !noBgControls.white && !noBgControls.black &&
    !noBgControls.slider && !noBgControls.stage && noBgControls.fns.length === 0,
    JSON.stringify(noBgControls));

  // ---- 7. Word size saves and reaches the tile ----
  const labelTest = await page.evaluate(async () => {
    closeCameraFullscreen();
    closeEditor();
    openEditor(3);
    document.getElementById('modal-label-input').value = 'Water';
    document.getElementById('modal-label-size').value = '2.4';
    onLabelSizeInput();
    const readout = document.getElementById('label-size-value').textContent;
    const previewSize = document.getElementById('label-size-preview-text').style.fontSize;

    const c = document.createElement('canvas');
    c.width = 20; c.height = 20;
    c.getContext('2d').fillRect(0, 0, 20, 20);
    pendingPhotoBlob = await new Promise(res => c.toBlob(res, 'image/png'));
    const photoBlob = pendingPhotoBlob;   // saveEditorTile() clears the pending blob

    await saveEditorTile();
    await new Promise(r => setTimeout(r, 200));

    const stored = getTileRecord(pages[currentPageIndex], 3);
    const tileLabel = document.querySelector('#tile-slot-3 .tile-label');
    if (!tileLabel) return { missingLabel: true };

    // Measure everything BEFORE re-rendering: a detached node reports zeros and
    // empty computed styles, which would fake a pass.
    const cs = getComputedStyle(tileLabel);
    const measured = {
      renderedPx: parseFloat(cs.fontSize),
      overflowsBox: tileLabel.scrollHeight > tileLabel.clientHeight + 1,
      wraps: cs.whiteSpace,
      breaks: cs.overflowWrap
    };

    // Baseline: the same label at 1x, for the monotonicity check.
    await saveTileToDB({ id: 3, photo: photoBlob, audio: null, label: 'Water', labelSize: 1, updatedAt: Date.now() });
    renderBoard();
    await new Promise(r => setTimeout(r, 150));
    const baseEl = document.querySelector('#tile-slot-3 .tile-label');
    const basePx = baseEl ? parseFloat(getComputedStyle(baseEl).fontSize) : null;

    return Object.assign({
      readout,
      previewSize,
      storedSize: stored && stored.labelSize,
      basePx
    }, measured);
  });
  check('label measurements were taken on a live node', !labelTest.missingLabel && labelTest.basePx > 0, JSON.stringify(labelTest));
  check('word-size readout tracks the slider', labelTest.readout === '2.4×', JSON.stringify(labelTest));
  check('word size persists on the tile record', labelTest.storedSize === 2.4, JSON.stringify(labelTest));
  check('a bigger word size renders bigger on the tile',
    labelTest.renderedPx > labelTest.basePx * 1.3, JSON.stringify(labelTest));
  check('a scaled label is fitted, never spilled off the tile',
    labelTest.overflowsBox === false, JSON.stringify(labelTest));
  check('labels wrap at spaces, never mid-word',
    labelTest.wraps === 'normal' && labelTest.breaks === 'normal', JSON.stringify(labelTest));

  // ---- 7b. An impossible request shrinks to fit instead of overflowing ----
  const crowded = await page.evaluate(async () => {
    setLayout(3);   // dense 4x3: the smallest tiles
    const c = document.createElement('canvas');
    c.width = 20; c.height = 20; c.getContext('2d').fillRect(0, 0, 20, 20);
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    await saveTileToDB({ id: 4, photo: blob, audio: null, label: 'I want more please', labelSize: 3, updatedAt: Date.now() });
    renderBoard();
    await new Promise(r => setTimeout(r, 200));
    const el = document.querySelector('#tile-slot-4 .tile-label');
    const tile = document.getElementById('tile-slot-4');
    return {
      fits: el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1,
      withinTile: el.getBoundingClientRect().top >= tile.getBoundingClientRect().top - 1,
      px: parseFloat(getComputedStyle(el).fontSize)
    };
  });
  check('an oversized label shrinks to fit the tile', crowded.fits && crowded.px >= 9, JSON.stringify(crowded));
  check('a scaled label never runs past the top of its tile', crowded.withinTile, JSON.stringify(crowded));

  // ---- 8. Default size for legacy tiles (no labelSize field) ----
  const legacy = await page.evaluate(() => ({
    css: labelFontSizeCss(undefined),
    clamped: [normalizeLabelSize(99), normalizeLabelSize(0.01), normalizeLabelSize('abc')]
  }));
  check('legacy tiles default to 1x, sizes clamp', legacy.css === 'calc(var(--tile-font-size) * 1)' && legacy.clamped.join() === '3,0.6,1', JSON.stringify(legacy));

  check('no JS errors accumulated during the run', errors.length === 0, errors.join(' | '));

  await browser.close();

  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '\n        -> ' + r.detail));
  }
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed');
  process.exit(failed ? 1 : 0);
})();
