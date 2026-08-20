const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  await page.goto('file:///home/mike/aac-board/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass, detail });

  // --------------------------------------------------------------------------
  // Check 1: Home -> Player -> Colors page: tap "Red" tile -> assert speech + Express chip + speak sentence
  // --------------------------------------------------------------------------
  const c1 = await page.evaluate(async () => {
    // 1. Start from Home screen
    switchToHomeView();
    const homeActive = document.getElementById('view-home').classList.contains('active');

    // 2. Tap Player to switch to board
    document.getElementById('btn-home-player').click();
    const boardActive = document.getElementById('view-board').classList.contains('active');

    // Jump to Colors page (Page 1) and enable Express
    currentPageIndex = 0;
    pages[0].express = true;
    renderCurrentPage();

    window.__spokenHistory = [];
    window.__lastSpoken = "";
    expressCollectedChips = [];
    renderExpressChips();

    // Tap Red tile (#tile-slot-1)
    const redTile = document.getElementById('tile-slot-1');
    redTile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    const afterTileSpoken = window.__lastSpoken;
    const chipsCount = document.querySelectorAll('#express-chips-scroll .express-chip').length;

    // Tap another tile to build a sentence: Blue (#tile-slot-4)
    const blueTile = document.getElementById('tile-slot-4');
    blueTile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    // Now tap the Express Sentence Bar to speak the sentence
    document.getElementById('express-bar').click();
    const sentenceSpoken = window.__lastSpoken;

    return {
      homeActive,
      boardActive,
      afterTileSpoken,
      chipsCount,
      sentenceSpoken,
      spokenHistory: window.__spokenHistory
    };
  });

  check(
    '1. Home -> Player -> Colors: tap Red speaks & adds chip, Express bar speaks sentence',
    c1.homeActive && c1.boardActive &&
    c1.afterTileSpoken.toLowerCase() === 'red' &&
    c1.chipsCount >= 1 &&
    c1.sentenceSpoken.toLowerCase().includes('red') &&
    c1.sentenceSpoken.toLowerCase().includes('blue'),
    JSON.stringify(c1)
  );

  // --------------------------------------------------------------------------
  // Check 2: Grid size change 4 -> 9 -> 36 re-renders correct cell counts
  // --------------------------------------------------------------------------
  const c2 = await page.evaluate(async () => {
    setGridSize(4);
    const count4 = document.querySelectorAll('#tiles-grid .tile').length;

    setGridSize(9);
    const count9 = document.querySelectorAll('#tiles-grid .tile').length;

    setGridSize(36);
    const count36 = document.querySelectorAll('#tiles-grid .tile').length;

    // Reset back to 4
    setGridSize(4);

    return { count4, count9, count36 };
  });

  check(
    '2. Grid size change 4 -> 9 -> 36 re-renders correct cell count',
    c2.count4 === 4 && c2.count9 === 9 && c2.count36 === 36,
    JSON.stringify(c2)
  );

  // --------------------------------------------------------------------------
  // Check 3: Editor: create a page, tap empty cell, set label "eat" + TTS cue, save -> reload -> tile persists & speaks
  // --------------------------------------------------------------------------
  await page.evaluate(async () => {
    setEditMode(true);
    addNewButtonPage(); // Creates a new blank button page
    renderCurrentPage();

    // Tap the first empty cell (#tile-slot-1)
    const slot1 = document.getElementById('tile-slot-1');
    slot1.click();

    // Fill in label "eat" and TTS cue "I want to eat apple"
    document.getElementById('modal-label-input').value = 'eat';
    document.getElementById('modal-tts-input').value = 'I want to eat apple';
    selectSymbol('eat');
    onLabelSizeInput();

    await saveEditorTile();
  });

  // Reload the page to verify persistence across reloads
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  const c3 = await page.evaluate(async () => {
    switchToBoardView(false); // User mode
    // Jump to the last page (where we added the new button page)
    currentPageIndex = pages.length - 1;
    renderCurrentPage();

    const tile1 = document.getElementById('tile-slot-1');
    const labelEl = tile1 ? tile1.querySelector('.tile-label') : null;
    const labelText = labelEl ? labelEl.textContent.trim() : '';

    window.__spokenHistory = [];
    window.__lastSpoken = "";

    // Tap tile in user mode
    if (tile1) tile1.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    return {
      labelText,
      lastSpoken: window.__lastSpoken
    };
  });

  check(
    '3. Editor: new page -> empty cell -> label "eat" + TTS cue -> persists on reload & speaks',
    c3.labelText === 'eat' && c3.lastSpoken === 'I want to eat apple',
    JSON.stringify(c3)
  );

  // --------------------------------------------------------------------------
  // Check 4: Express toggle ON/OFF shows/hides speech bar
  // --------------------------------------------------------------------------
  const c4 = await page.evaluate(() => {
    const expressBar = document.getElementById('express-bar-container');

    toggleExpressPage(true);
    const visibleWhenOn = expressBar.classList.contains('open') && getComputedStyle(expressBar).display !== 'none';

    toggleExpressPage(false);
    const hiddenWhenOff = !expressBar.classList.contains('open') || getComputedStyle(expressBar).display === 'none';

    return { visibleWhenOn, hiddenWhenOff };
  });

  check(
    '4. Express toggle ON/OFF shows/hides speech bar',
    c4.visibleWhenOn && c4.hiddenWhenOff,
    JSON.stringify(c4)
  );

  // --------------------------------------------------------------------------
  // Check 5: Scene page: add background, add 2 hotspots, set TTS cues, user-mode tap plays cue
  // --------------------------------------------------------------------------
  const c5 = await page.evaluate(async () => {
    addNewScenePage();
    setEditMode(true);

    const sceneP = pages[currentPageIndex];
    sceneP.sceneBg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEeQHzc1J16QAAAABJRU5ErkJggg==';
    sceneP.hotspots = [
      { id: 1, x: 10, y: 15, w: 25, h: 30, label: 'Kitchen Door', tts: 'Kitchen Door' },
      { id: 2, x: 50, y: 20, w: 30, h: 35, label: 'Refrigerator', tts: 'Open refrigerator' }
    ];
    savePagesToStorage();
    renderCurrentPage();

    const countInEditor = document.querySelectorAll('#scene-hotspots-container .scene-hotspot').length;

    // Switch to user mode
    setEditMode(false);
    renderCurrentPage();

    window.__spokenHistory = [];
    window.__lastSpoken = "";

    // Tap Hotspot 2 (Refrigerator)
    const spot2 = document.getElementById('hotspot-2');
    if (spot2) spot2.click();

    return {
      countInEditor,
      lastSpoken: window.__lastSpoken,
      spokenHistory: window.__spokenHistory
    };
  });

  check(
    '5. Scene page: background + 2 hotspots with TTS cues, user tap speaks cue',
    c5.countInEditor === 2 && c5.lastSpoken === 'Open refrigerator',
    JSON.stringify(c5)
  );

  // --------------------------------------------------------------------------
  // Check 6: New Page menu creates blank button page + duplicate page; pages navigator lists them
  // --------------------------------------------------------------------------
  const c6 = await page.evaluate(() => {
    const beforeCount = pages.length;

    // 1. Add Blank Button Page
    addNewButtonPage();
    const afterBlankCount = pages.length;

    // 2. Duplicate Page
    duplicateCurrentPage();
    const afterDupCount = pages.length;

    // 3. Open Pages Navigator
    openPagesDrawer();
    const listedCount = document.querySelectorAll('#pages-nav-list .page-nav-item').length;
    closePagesNavigator();

    return {
      beforeCount,
      afterBlankCount,
      afterDupCount,
      listedCount
    };
  });

  check(
    '6. New Page menu creates blank button page + duplicate page; pages navigator lists them',
    c6.afterBlankCount === c6.beforeCount + 1 &&
    c6.afterDupCount === c6.afterBlankCount + 1 &&
    c6.listedCount === c6.afterDupCount,
    JSON.stringify(c6)
  );

  // --------------------------------------------------------------------------
  // Check 7: Home button returns to home from editor and user modes
  // --------------------------------------------------------------------------
  const c7 = await page.evaluate(() => {
    // A. From User Mode
    switchToBoardView(false);
    const userBoardActive = document.getElementById('view-board').classList.contains('active');
    document.getElementById('btn-bar-home').click();
    const homeFromUser = document.getElementById('view-home').classList.contains('active') &&
                         !document.getElementById('view-board').classList.contains('active');

    // B. From Editor Mode
    switchToBoardView(true);
    const editorBoardActive = document.getElementById('view-board').classList.contains('active');
    document.getElementById('btn-bar-home').click();
    const homeFromEditor = document.getElementById('view-home').classList.contains('active') &&
                           !document.getElementById('view-board').classList.contains('active');

    return {
      userBoardActive,
      homeFromUser,
      editorBoardActive,
      homeFromEditor
    };
  });

  check(
    '7. Orange Home button returns to home from both user and editor modes',
    c7.userBoardActive && c7.homeFromUser && c7.editorBoardActive && c7.homeFromEditor,
    JSON.stringify(c7)
  );

  check('Zero JS errors accumulated during run', errors.length === 0, errors.join(' | '));

  await browser.close();

  let failed = 0;
  console.log('\n--- BEHAVIOR-SPEC VERIFICATION RESULTS ---');
  for (const r of results) {
    if (!r.pass) failed++;
    console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '\n        -> ' + r.detail));
  }
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed\n');
  process.exit(failed ? 1 : 0);
})();
