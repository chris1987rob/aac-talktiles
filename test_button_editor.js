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
  // Check 6: the editor opens with an inline symbol strip, seeded from the
  //          tile's own label -- the library is showcased, not hidden behind a
  //          second modal
  // --------------------------------------------------------------------------
  const c6 = await page.evaluate(() => {
    setEditMode(true);
    currentPageIndex = 0;
    pages[0].tiles = { 1: { id: 1, label: 'apple', tts: 'apple' } };
    renderCurrentPage();

    openEditor(1);
    const strip = document.getElementById('editor-symbol-strip');
    const cards = [...strip.querySelectorAll('.sym-card')];
    return {
      librarySize: AAC_SYMBOL_LIBRARY.length,
      editorOpen: document.getElementById('editor-modal').classList.contains('open'),
      libraryModalOpen: document.getElementById('modal-symbol-library').classList.contains('open'),
      searchBoxPresent: !!document.getElementById('editor-symbol-search'),
      querySource: strip.dataset.querySource,
      query: strip.dataset.query,
      cardCount: cards.length,
      labels: cards.slice(0, 6).map(c => c.querySelector('.sym-name').textContent),
      everyCardHasValue: cards.every(c => !!c.dataset.symbolValue),
      hint: document.getElementById('editor-symbol-hint').textContent,
      // big enough to hit with a thumb on a tablet
      cardBox: (() => { const r = cards[0].getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()
    };
  });

  check(
    '6. Editor opens with an inline symbol strip seeded from the tile label ("apple"), no second modal',
    c6.editorOpen && !c6.libraryModalOpen && c6.searchBoxPresent &&
      c6.librarySize > 3400 &&
      c6.querySource === 'label' && c6.query === 'apple' &&
      c6.cardCount > 0 && c6.everyCardHasValue &&
      c6.labels.some(l => /apple/i.test(l)) &&
      /match/.test(c6.hint) &&
      c6.cardBox[0] >= 88 && c6.cardBox[1] >= 88,
    JSON.stringify(c6)
  );

  // --------------------------------------------------------------------------
  // Check 7: typing filters the strip live; a symbol search overrides the
  //          label; clearing it falls back to the label; a dud query says so
  // --------------------------------------------------------------------------
  const c7 = await page.evaluate(() => {
    const strip = document.getElementById('editor-symbol-strip');
    const hint = () => document.getElementById('editor-symbol-hint').textContent;
    const snap = () => ({
      src: strip.dataset.querySource,
      query: strip.dataset.query,
      matches: parseInt(strip.dataset.matchCount, 10),
      first: (strip.querySelector('.sym-card .sym-name') || {}).textContent,
      cards: strip.querySelectorAll('.sym-card').length,
      hint: hint()
    });

    const out = {};
    const labelInp = document.getElementById('modal-label-input');
    const searchInp = document.getElementById('editor-symbol-search');
    const clearBtn = document.getElementById('btn-editor-sym-clear');

    labelInp.value = 'water';
    labelInp.dispatchEvent(new Event('input', { bubbles: true }));   // fires oninput
    out.fromLabel = snap();

    labelInp.value = 'bus';
    labelInp.dispatchEvent(new Event('input', { bubbles: true }));
    out.retyped = snap();

    searchInp.value = 'dog';
    searchInp.dispatchEvent(new Event('input', { bubbles: true }));
    out.fromSearch = snap();
    out.clearBtnShown = clearBtn.style.display;

    clearBtn.click();
    out.afterClear = snap();
    out.clearBtnHidden = clearBtn.style.display;

    searchInp.value = 'zzzqqqxyz';
    searchInp.dispatchEvent(new Event('input', { bubbles: true }));
    out.noMatch = {
      empty: !!document.getElementById('editor-symbol-empty'),
      cards: strip.querySelectorAll('.sym-card').length,
      text: (document.getElementById('editor-symbol-empty') || {}).textContent
    };

    searchInp.value = '';
    searchInp.dispatchEvent(new Event('input', { bubbles: true }));
    labelInp.value = '';
    labelInp.dispatchEvent(new Event('input', { bubbles: true }));
    out.emptyState = snap();
    return out;
  });

  check(
    '7. The strip re-filters live as the label is typed; a symbol search overrides the label and clearing it falls back; a dud query explains itself',
    c7.fromLabel.src === 'label' && c7.fromLabel.query === 'water' && c7.fromLabel.matches > 0 &&
      c7.retyped.query === 'bus' && c7.retyped.first !== c7.fromLabel.first &&
      c7.fromSearch.src === 'search' && c7.fromSearch.query === 'dog' && c7.clearBtnShown === 'flex' &&
      c7.afterClear.src === 'label' && c7.afterClear.query === 'bus' && c7.clearBtnHidden === 'none' &&
      c7.noMatch.empty && c7.noMatch.cards === 0 && /No symbol matches/.test(c7.noMatch.text) &&
      c7.emptyState.src === 'default' && c7.emptyState.cards > 0 &&
      /symbols available/.test(c7.emptyState.hint),
    JSON.stringify(c7)
  );

  // --------------------------------------------------------------------------
  // Check 8: tapping a card sets the symbol in place -- preview updates, the
  //          card is highlighted, a staged photo is dropped, editor stays open
  // --------------------------------------------------------------------------
  const c8 = await page.evaluate(() => {
    const strip = document.getElementById('editor-symbol-strip');
    const searchInp = document.getElementById('editor-symbol-search');

    // an empty label should be auto-filled by the pick; a TTS cue the adult
    // already wrote must survive it
    document.getElementById('modal-label-input').value = '';
    document.getElementById('modal-tts-input').value = 'I am thirsty';

    // stage a photo first, so we can prove picking a symbol replaces it
    pendingPhotoBlob = new Blob(['x'], { type: 'image/png' });
    updateModalPhotoPreview();
    const photoStaged = document.getElementById('modal-photo-img').style.display;

    searchInp.value = 'water';
    searchInp.dispatchEvent(new Event('input', { bubbles: true }));

    const cards = [...strip.querySelectorAll('.sym-card')];
    const target = cards[1];
    const wantValue = target.dataset.symbolValue;
    const wantLabel = target.querySelector('.sym-name').textContent;
    target.click();

    return {
      photoStaged,
      wantValue, wantLabel,
      pendingSymbol,
      photoDropped: pendingPhotoBlob === null,
      editorStillOpen: document.getElementById('editor-modal').classList.contains('open'),
      libraryModalOpen: document.getElementById('modal-symbol-library').classList.contains('open'),
      selected: [...strip.querySelectorAll('.sym-card.selected')].map(c => c.dataset.symbolValue),
      previewShown: document.getElementById('modal-symbol-preview').style.display,
      previewHtml: document.getElementById('modal-symbol-preview').innerHTML.slice(0, 200),
      removeBtn: document.getElementById('btn-remove-photo').style.display,
      tts: document.getElementById('modal-tts-input').value,
      label: document.getElementById('modal-label-input').value
    };
  });

  check(
    '8. Tapping an inline card sets the symbol in place: preview updates, that one card is highlighted, a staged photo is dropped, an empty label is filled and an existing TTS cue is left alone',
    c8.photoStaged === 'block' &&
      c8.pendingSymbol === c8.wantValue && c8.photoDropped &&
      c8.editorStillOpen && !c8.libraryModalOpen &&
      JSON.stringify(c8.selected) === JSON.stringify([c8.wantValue]) &&
      c8.previewShown === 'block' && c8.previewHtml.includes(c8.wantValue) &&
      c8.removeBtn === 'inline-flex' &&
      c8.label === c8.wantLabel && c8.tts === 'I am thirsty',
    JSON.stringify(c8)
  );

  // --------------------------------------------------------------------------
  // Check 9: Save persists the inline pick, the tile renders it, and reopening
  //          shows it selected even when it is not in the current results
  // --------------------------------------------------------------------------
  const c9 = await page.evaluate(async () => {
    const picked = pendingSymbol;
    document.getElementById('modal-label-input').value = 'drink';
    onEditorLabelInput();
    await saveEditorTile();

    const tile = document.getElementById('tile-slot-1');
    const saved = pages[0].tiles[1];

    openEditor(1);
    const strip = document.getElementById('editor-symbol-strip');
    const reopened = {
      pendingSymbol,
      querySource: strip.dataset.querySource,
      query: strip.dataset.query,
      selected: [...strip.querySelectorAll('.sym-card.selected')].map(c => c.dataset.symbolValue),
      firstCardValue: (strip.querySelector('.sym-card') || {}).dataset
    };

    // a query that cannot match it still shows the symbol that IS on the tile
    const searchInp = document.getElementById('editor-symbol-search');
    searchInp.value = 'zzzqqqxyz';
    searchInp.dispatchEvent(new Event('input', { bubbles: true }));
    const stubborn = {
      cards: strip.querySelectorAll('.sym-card').length,
      selected: strip.querySelectorAll('.sym-card.selected').length,
      hint: document.getElementById('editor-symbol-hint').textContent
    };
    closeEditor();

    return {
      picked,
      savedSymbol: saved.symbol,
      savedLabel: saved.label,
      tileRendersSymbol: !!tile.querySelector('.tile-image-wrap img, .tile-image-wrap span'),
      reopenedSelected: reopened.selected,
      reopenedSymbol: reopened.pendingSymbol,
      reopenedSource: reopened.querySource,
      stubborn
    };
  });

  check(
    '9. Save persists the inline pick to the tile, and reopening highlights it -- even under a query that cannot match it',
    c9.savedSymbol === c9.picked && c9.savedLabel === 'drink' && c9.tileRendersSymbol &&
      c9.reopenedSymbol === c9.picked &&
      JSON.stringify(c9.reopenedSelected) === JSON.stringify([c9.picked]) &&
      c9.reopenedSource === 'label' &&
      c9.stubborn.cards === 1 && c9.stubborn.selected === 1 &&
      /already on this button/.test(c9.stubborn.hint),
    JSON.stringify(c9)
  );

  // --------------------------------------------------------------------------
  // Check 10: Zero JS errors
  // --------------------------------------------------------------------------
  check(
    '10. Zero JS errors during button editor testing',
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
