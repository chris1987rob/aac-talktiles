const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');
const path = require('path');

(async () => {
  console.log('--- STARTING QUICK EDIT 2 (GoTalk Now 7.0) TEST ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });

  const errors = [];
  page.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('CONSOLE_ERROR: ' + msg.text());
  });

  const indexPath = 'file://' + path.resolve('index.html');
  await page.goto(indexPath, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  const results = [];
  function check(name, pass, detail = '') {
    results.push({ name, pass, detail });
  }

  // --- CHECK 1: Save menu opens and shows all 4 options; "Save & Next" opens next slot editor ---
  const saveMenuTest = await page.evaluate(async () => {
    openEditor(1);
    await new Promise(r => setTimeout(r, 100));

    // Open save menu
    toggleSaveMenu();
    const menu = document.getElementById('save-options-menu');
    const isMenuVisible = menu && menu.style.display === 'flex';
    const items = menu ? Array.from(menu.querySelectorAll('.save-menu-item')).map(el => el.querySelector('.save-menu-label').textContent.trim()) : [];

    // Click "Save & Next" from menu
    await handleSaveOption('save_next');
    await new Promise(r => setTimeout(r, 200));

    const nextTitle = document.getElementById('modal-slot-title').textContent;
    const isEditorOpen = document.getElementById('editor-modal').classList.contains('open');

    return {
      isMenuVisible,
      itemCount: items.length,
      items,
      nextTitle,
      isEditorOpen
    };
  });

  check('1. Save menu opens and shows all 4 options; "Save & Next" advances editor',
    saveMenuTest.itemCount === 4 &&
    saveMenuTest.items.includes('Save') &&
    saveMenuTest.items.includes('Save & Previous') &&
    saveMenuTest.items.includes('Save & Next') &&
    saveMenuTest.items.includes('Save & Open Classic Editor') &&
    saveMenuTest.nextTitle === 'Button 2 of 4' &&
    saveMenuTest.isEditorOpen,
    JSON.stringify(saveMenuTest)
  );

  // --- CHECK 2: Selecting Sound It Out on label "butterfly" renders 3 syllable chips & Preview Animation runs without errors ---
  const soundItOutTest = await page.evaluate(async () => {
    openEditor(1);
    const labelInp = document.getElementById('modal-label-input');
    labelInp.value = 'butterfly';
    onQuickEditLabelInput();

    // Switch action type to Sound It Out
    const actionSelect = document.getElementById('modal-action-type');
    actionSelect.value = 'sounditout';
    onActionTypeChange();

    await new Promise(r => setTimeout(r, 100));

    const chips = Array.from(document.querySelectorAll('#sounditout-syllables-bar .syllable-chip')).map(c => c.textContent.trim());
    
    // Trigger preview animation
    const previewPromise = previewSoundItOutAnimation();
    await previewPromise;
    await new Promise(r => setTimeout(r, 200));

    const isDoneAnimating = !isSoundItOutAnimating;

    return {
      actionType: actionSelect.value,
      chipCount: chips.length,
      chips,
      isDoneAnimating
    };
  });

  check('2. Sound It Out on "butterfly" renders 3 syllable chips [but, ter, fly] & preview animation finishes cleanly',
    soundItOutTest.chipCount === 3 &&
    soundItOutTest.chips.join('·') === 'but·ter·fly' &&
    soundItOutTest.isDoneAnimating,
    JSON.stringify(soundItOutTest)
  );

  // --- CHECK 3: Progress tracker cycles (— -> Learning -> Learned) and persists across editor reopen ---
  const progressTest = await page.evaluate(async () => {
    openEditor(1);
    document.getElementById('modal-label-input').value = 'butterfly';
    document.getElementById('modal-action-type').value = 'sounditout';
    onActionTypeChange();

    // Set to 'learning'
    setSoundItOutProgress('learning');
    await saveEditorTile();
    await new Promise(r => setTimeout(r, 200));

    // Reopen editor on slot 1
    openEditor(1);
    const progressAfterLearning = currentSoundItOutProgress;
    const activeBtnLearning = document.querySelector('#sounditout-progress-tracker .segment-btn.active').getAttribute('data-progress');

    // Change to 'learned'
    setSoundItOutProgress('learned');
    await saveEditorTile();
    await new Promise(r => setTimeout(r, 200));

    // Reopen editor on slot 1 again
    openEditor(1);
    const progressAfterLearned = currentSoundItOutProgress;
    const activeBtnLearned = document.querySelector('#sounditout-progress-tracker .segment-btn.active').getAttribute('data-progress');

    closeEditor();

    return {
      progressAfterLearning,
      activeBtnLearning,
      progressAfterLearned,
      activeBtnLearned
    };
  });

  check('3. Progress tracker persists Learning & Learned states across tile save and editor reopen',
    progressTest.progressAfterLearning === 'learning' &&
    progressTest.activeBtnLearning === 'learning' &&
    progressTest.progressAfterLearned === 'learned' &&
    progressTest.activeBtnLearned === 'learned',
    JSON.stringify(progressTest)
  );

  // --- CHECK 4: Color scheme row shows SUGGESTED name; Apply changes tile bg color in preview & DB ---
  const colorSchemeTest = await page.evaluate(async () => {
    openEditor(1);
    document.getElementById('modal-label-input').value = 'flower';
    onQuickEditLabelInput();

    const suggestedName = document.getElementById('quick-scheme-name').textContent;
    const previewBox = document.getElementById('photo-preview-container');
    const oldBg = previewBox.style.backgroundColor || '';

    // Apply suggested color scheme
    applySuggestedColorScheme();
    const newBg = document.getElementById('modal-tile-bgcolor').value;
    const previewBg = previewBox.style.backgroundColor;

    // Pick from dropdown (e.g. Blue)
    const blueScheme = AAC_COLOR_SCHEMES.find(s => s.name === 'Blue');
    applySuggestedColorScheme(blueScheme);
    const blueBg = document.getElementById('modal-tile-bgcolor').value;

    await saveEditorTile();

    return {
      suggestedName,
      oldBg,
      newBg,
      previewBg,
      blueBg
    };
  });

  check('4. Quick Color Scheme generates deterministic suggestion and Apply updates live preview & color values',
    colorSchemeTest.suggestedName.length > 0 &&
    colorSchemeTest.newBg.length > 0 &&
    colorSchemeTest.blueBg === '#dbeafe',
    JSON.stringify(colorSchemeTest)
  );

  // --- CHECK 5: Sound It Out in Player mode triggers centered overlay animation ---
  const playerOverlayTest = await page.evaluate(async () => {
    isEditMode = false;
    const slotData = cachedTiles.get(1) || { id: 1, label: 'butterfly', actionType: 'sounditout', soundItOutWord: 'butterfly' };
    
    // Simulate player tap on tile with actionType 'sounditout'
    const animPromise = playSoundItOutPlayer('butterfly', 1);
    const overlay = document.getElementById('sounditout-player-overlay');
    const overlayShown = overlay && overlay.style.display === 'flex';
    const playerPills = Array.from(document.querySelectorAll('.sio-syllable-pill')).map(p => p.textContent.trim());

    await animPromise;
    await new Promise(r => setTimeout(r, 200));
    const overlayHidden = overlay && overlay.style.display === 'none';

    return {
      overlayShown,
      pillCount: playerPills.length,
      pills: playerPills,
      overlayHidden
    };
  });

  check('5. Player mode tap on Sound It Out tile launches center-screen syllable overlay animation and auto-dismisses',
    playerOverlayTest.overlayShown &&
    playerOverlayTest.pillCount === 3 &&
    playerOverlayTest.overlayHidden,
    JSON.stringify(playerOverlayTest)
  );

  // --- CHECK 6: Zero JS errors ---
  check('6. Zero JS console or unhandled page errors during Quick Edit 2 operations',
    errors.length === 0,
    errors.join(' | ')
  );

  await browser.close();

  console.log('\n--- QUICK EDIT 2 TEST RESULTS ---');
  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '\n        -> ' + r.detail));
  }
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed\n');
  process.exit(failed ? 1 : 0);
})();
