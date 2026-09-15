// Scene pages must coexist with standard, express and keyboard pages in one
// book: switching pages preserves each page's type, its background image and
// its own hotspots, every scene's hotspots speak their own cue, and a scene
// page built from a template behaves exactly like one built by hand.
//
// Behaviours come from VIDEO-TRANSCRIPT-gotalknow.txt:
//   "three styles of communication pages: standard, express and scenes"
//   "scene pages are built around a single photo ... invisible hot spots ...
//    the hot spots play speech"
//   "feel free to mix and match pages within a communication book"
const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');
const path = require('path');

const SCENE_A_BG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23c00"/></svg>';
const SCENE_C_BG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%2300c"/></svg>';

(async () => {
  console.log('--- STARTING SCENE / MIXED-BOOK TEST ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  const indexPath = 'file://' + path.resolve(__dirname, 'index.html');
  await page.goto(indexPath, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass, detail });

  // Install a mixed book: standard / express / scene(with bg) / scene(no bg) /
  // scene(with bg, express) / keyboard, and capture everything spoken.
  await page.evaluate((bgA, bgC) => {
    window.__spoken = window.__spokenHistory = [];
    // Words with a Bella clip never reach speechSynthesis, so observe the app's
    // own speech log (fed by both the clip and the TTS path) instead.
    window.speechSynthesis.speak = () => {};
    localStorage.removeItem('talk_tiles_custom_templates');

    pages = [
      { id: 1, title: 'Standard', type: 'grid', gridSize: 4, bg: '#ffffff', express: false, enabled: true,
        tiles: { 1: { id: 1, label: 'red', tts: 'red' }, 2: { id: 2, label: 'blue', tts: 'blue' } } },
      { id: 2, title: 'Express', type: 'grid', gridSize: 4, bg: '#ffffff', express: true, enabled: true,
        tiles: { 1: { id: 1, label: 'I', tts: 'I' }, 2: { id: 2, label: 'want', tts: 'want' }, 3: { id: 3, label: 'water', tts: 'water' } } },
      { id: 3, title: 'Scene Hallway', type: 'scene', gridSize: 4, bg: '#00a699', express: false, enabled: true,
        sceneBg: bgA,
        hotspots: [
          { id: 1, x: 5, y: 5, w: 20, h: 20, label: 'Elevator', tts: 'Elevator please', style: 'invisible' },
          { id: 2, x: 40, y: 40, w: 20, h: 20, label: 'Sanitizer', tts: 'Hand sanitizer', style: 'invisible' }
        ] },
      { id: 4, title: 'Scene Empty', type: 'scene', gridSize: 4, bg: '#00a699', express: false, enabled: true,
        sceneBg: null,
        hotspots: [{ id: 1, x: 10, y: 10, w: 30, h: 30, label: 'Water bottle', tts: 'I want my water bottle', style: 'invisible' }] },
      { id: 5, title: 'Scene Express', type: 'scene', gridSize: 4, bg: '#00a699', express: true, enabled: true,
        sceneBg: bgC,
        hotspots: [
          { id: 1, x: 5, y: 5, w: 20, h: 20, label: 'more', tts: 'more', style: 'invisible' },
          { id: 2, x: 40, y: 5, w: 20, h: 20, label: 'juice', tts: 'juice', style: 'invisible' },
          { id: 3, x: 70, y: 5, w: 20, h: 20, label: 'please', tts: 'please', style: 'invisible' }
        ] },
      { id: 6, title: 'Keyboard', type: 'keyboard', bg: '#f1f5f9', express: false, enabled: true }
    ];
    currentPageIndex = 0;
    setEditMode(false);
    savePagesToStorage();
    renderCurrentPage();
  }, SCENE_A_BG, SCENE_C_BG);

  // Reusable snapshot of which view is live and what is inside the scene view.
  const viewProbe = `(() => {
    const p = pages[currentPageIndex];
    const img = document.getElementById('scene-image');
    return {
      title: p.title,
      type: p.type,
      gridDisplay: document.getElementById('tiles-grid').style.display,
      gridTiles: document.querySelectorAll('#tiles-grid .tile').length,
      sceneActive: document.getElementById('scene-view').classList.contains('active'),
      kbDisplay: document.getElementById('keyboard-view').style.display,
      imgDisplay: img.style.display,
      imgSrc: img.getAttribute('src') || '',
      hotspots: [...document.querySelectorAll('#scene-hotspots-container .scene-hotspot')].map(h => h.id),
      expressOpen: document.getElementById('express-bar-container').classList.contains('open')
    };
  })()`;

  // --------------------------------------------------------------------------
  // Check 1: every page type in one book renders its own view
  // --------------------------------------------------------------------------
  const c1 = await page.evaluate(`(() => {
    const trail = [];
    for (let i = 0; i < pages.length; i++) { jumpToPage(i); trail.push(${viewProbe}); }
    return trail;
  })()`);

  const [std, exp, scnA, scnB, scnC, kbd] = c1;
  check(
    '1. Standard / Express / Scene / Scene-no-bg / Scene-express / Keyboard pages each render their own view in one book',
    std.gridDisplay === 'grid' && std.gridTiles === 4 && !std.sceneActive && !std.expressOpen &&
      exp.gridDisplay === 'grid' && exp.expressOpen && !exp.sceneActive &&
      scnA.sceneActive && scnA.gridDisplay === 'none' && scnA.imgDisplay === 'block' && scnA.hotspots.length === 2 &&
      scnB.sceneActive && scnB.imgDisplay === 'none' && scnB.hotspots.length === 1 &&
      scnC.sceneActive && scnC.imgDisplay === 'block' && scnC.hotspots.length === 3 && scnC.expressOpen &&
      kbd.kbDisplay === 'flex' && kbd.gridDisplay === 'none' && !kbd.sceneActive,
    JSON.stringify(c1)
  );

  // --------------------------------------------------------------------------
  // Check 2: each scene keeps its OWN background across page switches, and no
  //          scene leaves its image or hotspots behind on the next page
  // --------------------------------------------------------------------------
  const c2 = await page.evaluate(`(() => {
    const order = [2, 3, 4, 0, 2, 5, 2];   // sceneA, sceneB, sceneC, standard, sceneA, keyboard, sceneA
    const trail = [];
    order.forEach(i => { jumpToPage(i); trail.push(${viewProbe}); });
    // and the same walk with the bottom-bar prev/next buttons
    currentPageIndex = 0; renderCurrentPage();
    const viaButtons = [];
    for (let i = 0; i < pages.length; i++) {
      viaButtons.push(${viewProbe});
      document.getElementById('btn-bar-next').click();
    }
    document.getElementById('btn-bar-prev').click();
    const afterPrev = ${viewProbe};
    return { trail, viaButtons, afterPrev };
  })()`);

  const bgOf = (t) => t.imgSrc;
  const sceneABg = c2.trail[0].imgSrc;
  const sceneCBg = c2.trail[2].imgSrc;
  const noLeak = c2.trail.every(t => t.type === 'scene' || (t.imgSrc === '' && t.hotspots.length === 0));
  const bgStable = c2.trail.filter(t => t.title === 'Scene Hallway').every(t => bgOf(t) === sceneABg && t.hotspots.length === 2);

  check(
    '2. Each scene keeps its own background + hotspots across page switches; non-scene pages are left with neither',
    sceneABg.length > 0 && sceneCBg.length > 0 && sceneABg !== sceneCBg &&
      c2.trail[1].imgSrc === '' && c2.trail[1].hotspots.length === 1 &&   // Scene Empty: own hotspot, no inherited image
      bgStable && noLeak &&
      c2.viaButtons.length === 6 &&
      c2.viaButtons.every(t => (t.type === 'scene') === t.sceneActive) &&
      c2.afterPrev.title === 'Keyboard',
    JSON.stringify(c2)
  );

  // --------------------------------------------------------------------------
  // Check 3: hotspots on EVERY scene page fire their own cue, and only their own
  // --------------------------------------------------------------------------
  const c3 = await page.evaluate(() => {
    const spokenPerPage = {};
    [2, 3, 4].forEach(i => {
      jumpToPage(i);
      window.__spoken = window.__spokenHistory = [];
      const els = [...document.querySelectorAll('#scene-hotspots-container .scene-hotspot')];
      els.forEach(el => el.click());
      spokenPerPage[pages[i].title] = { clicked: els.length, spoken: window.__spoken.slice() };
    });
    // A hotspot must not survive onto a standard page and be clickable there.
    jumpToPage(0);
    const strayHotspot = document.querySelector('.scene-hotspot');
    return { spokenPerPage, strayHotspot: !!strayHotspot };
  });

  check(
    '3. Every scene page fires its own hotspot cues (recorded/TTS) and none survive onto a standard page',
    JSON.stringify(c3.spokenPerPage['Scene Hallway'].spoken) === JSON.stringify(['Elevator please', 'Hand sanitizer']) &&
      JSON.stringify(c3.spokenPerPage['Scene Empty'].spoken) === JSON.stringify(['I want my water bottle']) &&
      JSON.stringify(c3.spokenPerPage['Scene Express'].spoken) === JSON.stringify(['more', 'juice', 'please']) &&
      c3.strayHotspot === false,
    JSON.stringify(c3)
  );

  // --------------------------------------------------------------------------
  // Check 4: an express SCENE page collects chips and the bar speaks them in order
  // --------------------------------------------------------------------------
  const c4 = await page.evaluate(() => {
    jumpToPage(4);                 // Scene Express
    expressCollectedChips = [];
    renderExpressChips();
    window.__spoken = window.__spokenHistory = [];
    ['hotspot-1', 'hotspot-2', 'hotspot-3'].forEach(id => document.getElementById(id).click());
    const chips = [...document.querySelectorAll('.express-chip')].map(c => c.textContent.trim());
    document.getElementById('express-bar').click();
    return { chips, spoken: window.__spoken.slice() };
  });

  check(
    '4. Express scene page: hotspot taps add chips and the speech bar plays them IN SEQUENCE',
    JSON.stringify(c4.chips) === JSON.stringify(['more', 'juice', 'please']) &&
      c4.spoken[c4.spoken.length - 1] === 'more juice please',
    JSON.stringify(c4)
  );

  // --------------------------------------------------------------------------
  // Check 5: a template scene page has the same shape as a hand-made one
  // --------------------------------------------------------------------------
  const c5 = await page.evaluate(() => {
    const tplIdx = BUILTIN_TEMPLATES.findIndex(t => t.title === 'Visual Scene (Blank)');
    useCustomTemplate(tplIdx);
    const fromTemplate = pages[currentPageIndex];
    const tplView = {
      sceneActive: document.getElementById('scene-view').classList.contains('active'),
      placeholder: document.getElementById('scene-empty-placeholder').style.display
    };
    addNewScenePage();
    const manual = pages[currentPageIndex];
    const shape = (p) => ({
      type: p.type, bg: p.bg, gridSize: p.gridSize, express: p.express,
      enabled: p.enabled, sceneBg: p.sceneBg, hotspots: (p.hotspots || []).length,
      keys: Object.keys(p).filter(k => k !== 'id' && k !== 'title' && k !== 'tiles').sort()
    });
    return { fromTemplate: shape(fromTemplate), manual: shape(manual), tplView };
  });

  check(
    '5. "Visual Scene (Blank)" template produces the same page shape as addNewScenePage()',
    JSON.stringify(c5.fromTemplate) === JSON.stringify(c5.manual) &&
      c5.fromTemplate.sceneBg === null && c5.fromTemplate.express === false &&
      c5.tplView.sceneActive && c5.tplView.placeholder === 'flex',
    JSON.stringify(c5)
  );

  // --------------------------------------------------------------------------
  // Check 6: a template scene page then accepts a background + hotspots and
  //          behaves identically to the hand-made one
  // --------------------------------------------------------------------------
  const c6 = await page.evaluate((bg) => {
    const out = {};
    const tplIdx = BUILTIN_TEMPLATES.findIndex(t => t.title === 'Visual Scene (Blank)');

    const build = (key) => {
      const p = pages[currentPageIndex];
      p.sceneBg = bg;
      addSceneHotspot();
      const spot = p.hotspots[p.hotspots.length - 1];
      spot.label = key;
      spot.tts = 'this is ' + key;
      renderCurrentPage();
      window.__spoken = window.__spokenHistory = [];
      document.getElementById('hotspot-' + spot.id).click();
      out[key] = {
        imgDisplay: document.getElementById('scene-image').style.display,
        imgSrc: document.getElementById('scene-image').getAttribute('src'),
        hotspotEls: document.querySelectorAll('.scene-hotspot').length,
        invisible: !document.querySelector('.scene-hotspot').className.includes('style-'),
        spoken: window.__spoken.slice()
      };
    };

    useCustomTemplate(tplIdx); build('template');
    addNewScenePage();         build('manual');
    return out;
  }, SCENE_A_BG);

  check(
    '6. A template scene page takes a background + an invisible hotspot and plays it exactly like a manual one',
    c6.template.imgDisplay === 'block' && c6.manual.imgDisplay === 'block' &&
      c6.template.imgSrc === c6.manual.imgSrc &&
      c6.template.hotspotEls === 1 && c6.manual.hotspotEls === 1 &&
      c6.template.invisible && c6.manual.invisible &&
      JSON.stringify(c6.template.spoken) === JSON.stringify(['this is template']) &&
      JSON.stringify(c6.manual.spoken) === JSON.stringify(['this is manual']),
    JSON.stringify(c6)
  );

  // --------------------------------------------------------------------------
  // Check 7: saving a scene page as a template round-trips its photo + hotspots
  // --------------------------------------------------------------------------
  const c7 = await page.evaluate(() => {
    localStorage.removeItem('talk_tiles_custom_templates');
    const sceneIdx = pages.findIndex(p => p.title === 'Scene Hallway');
    jumpToPage(sceneIdx);
    saveCurrentPageAsTemplate();

    const stored = JSON.parse(localStorage.getItem('talk_tiles_custom_templates'))[0];
    useCustomTemplate(BUILTIN_TEMPLATES.length);
    const p = pages[currentPageIndex];

    window.__spoken = window.__spokenHistory = [];
    [...document.querySelectorAll('.scene-hotspot')].forEach(el => el.click());

    return {
      storedHasBg: !!stored.sceneBg,
      storedHotspots: (stored.hotspots || []).length,
      pageType: p.type,
      pageBgSame: p.sceneBg === pages[sceneIdx].sceneBg,
      hotspots: (p.hotspots || []).length,
      imgDisplay: document.getElementById('scene-image').style.display,
      spoken: window.__spoken.slice()
    };
  });

  check(
    '7. Saving a scene page as a template keeps its background image and hotspots, and the new page plays them',
    c7.storedHasBg && c7.storedHotspots === 2 && c7.pageType === 'scene' &&
      c7.pageBgSame && c7.hotspots === 2 && c7.imgDisplay === 'block' &&
      JSON.stringify(c7.spoken) === JSON.stringify(['Elevator please', 'Hand sanitizer']),
    JSON.stringify(c7)
  );

  // --------------------------------------------------------------------------
  // Check 8: the whole mixed book survives a reload
  // --------------------------------------------------------------------------
  await page.evaluate(() => {
    pages = pages.slice(0, 6);
    currentPageIndex = 2;
    savePagesToStorage();
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  const c8 = await page.evaluate(`(() => {
    window.__spoken = window.__spokenHistory = [];
    // Words with a Bella clip never reach speechSynthesis, so observe the app's
    // own speech log (fed by both the clip and the TTS path) instead.
    window.speechSynthesis.speak = () => {};
    const types = pages.map(p => p.type + ':' + p.title);
    const trail = [];
    for (let i = 0; i < pages.length; i++) { jumpToPage(i); trail.push(${viewProbe}); }
    jumpToPage(2);
    [...document.querySelectorAll('.scene-hotspot')].forEach(el => el.click());
    return { types, trail, spoken: window.__spoken.slice() };
  })()`);

  check(
    '8. Mixed book survives a reload: every page type, both scene backgrounds and all hotspots come back',
    c8.types.length === 6 &&
      JSON.stringify(c8.types) === JSON.stringify([
        'grid:Standard', 'grid:Express', 'scene:Scene Hallway',
        'scene:Scene Empty', 'scene:Scene Express', 'keyboard:Keyboard'
      ]) &&
      c8.trail[2].imgDisplay === 'block' && c8.trail[2].hotspots.length === 2 &&
      c8.trail[3].imgDisplay === 'none' && c8.trail[3].hotspots.length === 1 &&
      c8.trail[4].imgDisplay === 'block' && c8.trail[4].hotspots.length === 3 &&
      c8.trail[2].imgSrc !== c8.trail[4].imgSrc &&
      JSON.stringify(c8.spoken) === JSON.stringify(['Elevator please', 'Hand sanitizer']),
    JSON.stringify(c8)
  );

  // --------------------------------------------------------------------------
  // Check 9: no JS errors across the whole run
  // --------------------------------------------------------------------------
  check('9. Zero JS errors during scene / mixed-book testing', errors.length === 0, errors.join('; '));

  console.log('\n--- SCENE / MIXED-BOOK TEST RESULTS ---');
  let allPass = true;
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
    if (!r.pass) { console.log(`        -> ${r.detail}`); allPass = false; }
  }
  console.log(`\n${results.filter(r => r.pass).length}/${results.length} checks passed\n`);
  await browser.close();
  if (!allPass) process.exit(1);
})();
