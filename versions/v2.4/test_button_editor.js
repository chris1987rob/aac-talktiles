const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');
const path = require('path');

(async () => {
  console.log('--- STARTING CLASSIC BUTTON EDITOR TEST ---');

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

  // --------------------------------------------------------------------------
  // Check 1: Open Editor on Button 4 of 4 -> Modal title displays "Edit Button #4"
  // --------------------------------------------------------------------------
  const c1 = await page.evaluate(() => {
    setEditMode(true);
    openEditor(4);
    const modal = document.getElementById('editor-modal');
    const titleEl = document.getElementById('modal-slot-title');
    const labelInp = document.getElementById('modal-label-input');
    const ttsInp = document.getElementById('modal-tts-input');
    const searchBtn = document.querySelector('#editor-modal button[onclick="openSymbolLibrary()"]');
    const recordBtn = document.getElementById('btn-record-voice');

    return {
      isOpen: modal.classList.contains('open'),
      titleText: titleEl ? titleEl.textContent : '',
      hasLabel: !!labelInp,
      hasTts: !!ttsInp,
      hasSearchSymbolsBtn: !!searchBtn,
      hasRecordVoiceBtn: !!recordBtn
    };
  });

  check(
    '1. Open Editor on Button 4 of 4: shows "Edit Button #4" with direct Voice & Symbol buttons',
    c1.isOpen && c1.titleText === 'Edit Button #4' && c1.hasSearchSymbolsBtn && c1.hasRecordVoiceBtn,
    JSON.stringify(c1)
  );

  // --------------------------------------------------------------------------
  // Check 2: Edit Button #4 with custom label, colors, word size, and symbol -> Save -> renders correctly
  // --------------------------------------------------------------------------
  const c2 = await page.evaluate(async () => {
    document.getElementById('modal-label-input').value = 'Blueberry';
    document.getElementById('modal-tts-input').value = 'I want fresh blueberries';
    document.getElementById('modal-tile-bgcolor').value = '#dbeafe';
    document.getElementById('modal-tile-bordercolor').value = '#1d4ed8';
    document.getElementById('modal-tile-textcolor').value = '#1e3a8a';
    document.getElementById('modal-label-size').value = '1.4';
    onLabelSizeInput();
    selectSymbol('blueberry');

    await saveEditorTile();

    const tile4 = document.getElementById('tile-slot-4');
    const labelEl = tile4 ? tile4.querySelector('.tile-label') : null;

    return {
      modalOpen: document.getElementById('editor-modal').classList.contains('open'),
      labelText: labelEl ? labelEl.textContent.trim() : '',
      bgColor: tile4 ? tile4.style.backgroundColor : '',
      borderColor: tile4 ? tile4.style.borderColor : ''
    };
  });

  check(
    '2. Save Button #4: updates tile label to "Blueberry" and applies styles immediately',
    !c2.modalOpen && c2.labelText === 'Blueberry',
    JSON.stringify(c2)
  );

  // --------------------------------------------------------------------------
  // Check 3: Tapping Button #4 in User Mode speaks custom TTS cue
  // --------------------------------------------------------------------------
  const c3 = await page.evaluate(() => {
    setEditMode(false);
    window.__spokenHistory = [];
    window.__lastSpoken = '';

    const tile4 = document.getElementById('tile-slot-4');
    tile4.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    return {
      lastSpoken: window.__lastSpoken
    };
  });

  check(
    '3. User Mode: Tapping Button #4 speaks TTS cue "I want fresh blueberries"',
    c3.lastSpoken === 'I want fresh blueberries',
    JSON.stringify(c3)
  );

  // --------------------------------------------------------------------------
  // Check 4: Multi-page isolation: Add Page 2, edit Button #4 on Page 2 -> Page 1 remains unchanged
  // --------------------------------------------------------------------------
  const c4 = await page.evaluate(async () => {
    setEditMode(true);
    addNewButtonPage(); // Adds page 2 (blank)
    renderCurrentPage();

    // On Page 2, edit Button 4
    openEditor(4);
    document.getElementById('modal-label-input').value = 'Watermelon';
    document.getElementById('modal-tts-input').value = 'Juicy watermelon';
    selectSymbol('watermelon');
    await saveEditorTile();

    const page2Tile4 = document.getElementById('tile-slot-4').querySelector('.tile-label').textContent.trim();

    // Switch back to Page 1
    currentPageIndex = 0;
    renderCurrentPage();
    const page1Tile4 = document.getElementById('tile-slot-4').querySelector('.tile-label').textContent.trim();

    return {
      page2Tile4,
      page1Tile4
    };
  });

  check(
    '4. Multi-page isolation: Page 2 Button #4 is "Watermelon", Page 1 Button #4 is "Blueberry"',
    c4.page2Tile4 === 'Watermelon' && c4.page1Tile4 === 'Blueberry',
    JSON.stringify(c4)
  );

  // --------------------------------------------------------------------------
  // Check 5: Clear Tile: Open Button 1, tap "Clear Tile" -> Button 1 is empty
  // --------------------------------------------------------------------------
  const c5 = await page.evaluate(async () => {
    openEditor(1);
    await clearTileWithConfirm();

    const tile1 = document.getElementById('tile-slot-1');
    const isEmpty = tile1.classList.contains('empty-editor') || !tile1.querySelector('.tile-label');

    return { isEmpty };
  });

  check(
    '5. Clear Tile on Button #1 makes slot empty',
    c5.isEmpty,
    JSON.stringify(c5)
  );

  // --------------------------------------------------------------------------
  // Check 6: Zero JS errors
  // --------------------------------------------------------------------------
  check(
    '6. Zero JS errors during button editor testing',
    errors.length === 0,
    errors.join('; ')
  );

  console.log('\n--- BUTTON EDITOR TEST RESULTS ---');
  let allPass = true;
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
    if (!r.pass) {
      console.log(`        -> ${r.detail}`);
      allPass = false;
    }
  }

  console.log(`\n${results.filter(r => r.pass).length}/${results.length} checks passed\n`);
  await browser.close();

  if (!allPass) process.exit(1);
})();
