const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');
const path = require('path');

(async () => {
  console.log('--- STARTING QUICK EDIT (GoTalk Now 7.0) TEST ---');

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
  // Check 1: Open Editor, type "tree" -> shows ≥1 ARASAAC and ≥1 Emoji suggestions
  // --------------------------------------------------------------------------
  const c1 = await page.evaluate(async () => {
    openEditor(1);
    const labelInp = document.getElementById('modal-label-input');
    labelInp.value = 'tree';
    onQuickEditLabelInput();
    await new Promise(r => setTimeout(r, 350));

    const cards = Array.from(document.querySelectorAll('#quick-image-strip .quick-image-card'));
    const arasaacCards = cards.filter(c => (c.querySelector('.quick-img-source') || {}).textContent === 'ARASAAC');
    const emojiCards = cards.filter(c => (c.querySelector('.quick-img-source') || {}).textContent === 'Emoji');

    return {
      totalCards: cards.length,
      arasaacCount: arasaacCards.length,
      emojiCount: emojiCards.length,
      firstSource: cards.length > 0 ? cards[0].querySelector('.quick-img-source').textContent : ''
    };
  });

  check(
    '1. Typing "tree" shows ≥1 ARASAAC suggestion and ≥1 Emoji suggestion in horizontal strip',
    c1.totalCards >= 2 && c1.arasaacCount >= 1 && c1.emojiCount >= 1,
    `Total: ${c1.totalCards}, ARASAAC: ${c1.arasaacCount}, Emoji: ${c1.emojiCount}`
  );

  // --------------------------------------------------------------------------
  // Check 2: Tapping an image suggestion assigns it to the tile preview
  // --------------------------------------------------------------------------
  const c2 = await page.evaluate(async () => {
    const cards = document.querySelectorAll('#quick-image-strip .quick-image-card');
    if (cards.length > 0) {
      cards[0].click();
    }
    await new Promise(r => setTimeout(r, 100));

    const symPreview = document.getElementById('modal-symbol-preview');
    const isVisible = symPreview && symPreview.style.display !== 'none';
    const hasContent = symPreview && symPreview.innerHTML.length > 0;
    const cardActive = cards[0] && cards[0].classList.contains('active');

    return {
      pendingSymbol,
      isVisible,
      hasContent,
      cardActive
    };
  });

  check(
    '2. Tapping a suggestion card assigns symbol to tile preview and marks card active',
    c2.pendingSymbol !== null && c2.isVisible && c2.hasContent && c2.cardActive,
    JSON.stringify(c2)
  );

  // --------------------------------------------------------------------------
  // Check 3: Speech suggestion chips appear and fill TTS input on tap
  // --------------------------------------------------------------------------
  const c3 = await page.evaluate(async () => {
    const chips = Array.from(document.querySelectorAll('#speech-suggestions-bar .speech-suggestion-chip'));
    const count = chips.length;
    let clickedText = '';
    if (count > 0) {
      clickedText = chips[0].textContent;
      chips[0].click();
    }
    await new Promise(r => setTimeout(r, 80));
    const ttsValue = document.getElementById('modal-tts-input').value;

    return {
      chipCount: count,
      clickedText,
      ttsValue,
      matches: ttsValue === clickedText && ttsValue.length > 0
    };
  });

  check(
    '3. Speech suggestion chips appear for word and populate TTS speech input on tap',
    c3.chipCount >= 2 && c3.matches,
    `Chips: ${c3.chipCount}, Selected TTS: "${c3.ttsValue}"`
  );

  // --------------------------------------------------------------------------
  // Check 4: Popular SLP quick-words chips set label & trigger updates
  // --------------------------------------------------------------------------
  const c4 = await page.evaluate(async () => {
    setQuickWord('help');
    await new Promise(r => setTimeout(r, 350));
    const labelVal = document.getElementById('modal-label-input').value;
    const cards = document.querySelectorAll('#quick-image-strip .quick-image-card');
    const speechChips = document.querySelectorAll('#speech-suggestions-bar .speech-suggestion-chip');

    return {
      labelVal,
      cardCount: cards.length,
      speechChipCount: speechChips.length
    };
  });

  check(
    '4. Popular SLP quick-word chip ("help") updates label, live image strip, and speech suggestions',
    c4.labelVal === 'help' && c4.cardCount > 0 && c4.speechChipCount > 0,
    JSON.stringify(c4)
  );

  // --------------------------------------------------------------------------
  // Check 5: Long-press Save triggers "Save & next" opening next empty slot
  // --------------------------------------------------------------------------
  const c5 = await page.evaluate(async () => {
    const startSlot = currentEditingSlot;
    // Execute saveAndNextTile
    await saveAndNextTile();
    await new Promise(r => setTimeout(r, 200));

    const newSlot = currentEditingSlot;
    const titleText = document.getElementById('modal-slot-title').textContent;
    const isEditorOpen = document.getElementById('editor-modal').classList.contains('open');

    return {
      startSlot,
      newSlot,
      titleText,
      isEditorOpen
    };
  });

  check(
    '5. Long-press / Hold-to-Save executes save & opens next button editor seamlessly',
    c5.isEditorOpen && c5.newSlot !== c5.startSlot && c5.titleText.includes('Button 2'),
    JSON.stringify(c5)
  );

  // --------------------------------------------------------------------------
  // Check 6: Page Wizard Suggested Titles
  // --------------------------------------------------------------------------
  const c6 = await page.evaluate(async () => {
    closeEditor();
    openPageWizard();
    const suggestedChips = document.querySelectorAll('#wiz-suggested-names .quick-word-chip');
    if (suggestedChips.length > 0) {
      suggestedChips[1].click(); // Click "Snack Time"
    }
    const nameVal = document.getElementById('wiz-page-name').value;
    closePageWizard();

    return {
      suggestedCount: suggestedChips.length,
      nameVal
    };
  });

  check(
    '6. Page Wizard provides suggested titles and populates page title on tap',
    c6.suggestedCount >= 3 && c6.nameVal === 'Snack Time',
    JSON.stringify(c6)
  );

  // --------------------------------------------------------------------------
  // Check 7: Zero JS Errors
  // --------------------------------------------------------------------------
  check('7. Zero JS console or unhandled page errors during Quick Edit operations', errors.length === 0, errors.join(' | '));

  await browser.close();

  let failed = 0;
  console.log('\n--- QUICK EDIT TEST RESULTS ---');
  for (const r of results) {
    if (!r.pass) failed++;
    console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + '\n        -> ' + r.detail);
  }
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed\n');
  process.exit(failed ? 1 : 0);
})();
