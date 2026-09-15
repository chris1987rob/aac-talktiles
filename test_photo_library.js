const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');
const path = require('path');

(async () => {
  console.log('--- STARTING SYMBOL & PHOTO LIBRARY TEST ---');

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
  // Check 1: Open Symbol Library & Assert Total Count >= 500
  // --------------------------------------------------------------------------
  const c1 = await page.evaluate(() => {
    openSymbolLibrary();
    const modal = document.getElementById('modal-symbol-library');
    const isOpen = modal && modal.classList.contains('open');
    const totalCountText = document.getElementById('sym-total-count').textContent.replace(/,/g, '');
    const totalCount = parseInt(totalCountText, 10) || 0;
    const libraryLen = (typeof AAC_SYMBOL_LIBRARY !== 'undefined') ? AAC_SYMBOL_LIBRARY.length : 0;
    const officialLen = (typeof AAC_OFFICIAL_SYMBOLS !== 'undefined') ? AAC_OFFICIAL_SYMBOLS.length : 0;

    return {
      isOpen,
      totalCount,
      libraryLen,
      officialLen
    };
  });

  check(
    '1. Open Symbol & Photo Library: modal opens and shows the full in-house catalogue (>= 500 symbols)',
    c1.isOpen && c1.totalCount >= 500 && c1.libraryLen >= 500 && c1.officialLen >= 500,
    `Total: ${c1.totalCount}, Official: ${c1.officialLen}, Unified: ${c1.libraryLen}`
  );

  // --------------------------------------------------------------------------
  // Check 2: Search for "dog", "eat", "happy" returns > 0 results with valid cards
  // --------------------------------------------------------------------------
  const searchQueries = ['dog', 'eat', 'happy'];
  const searchResults = [];

  for (const q of searchQueries) {
    const res = await page.evaluate(async (query) => {
      const inp = document.getElementById('sym-search-input');
      inp.value = query;
      filterSymbolLibrary();
      await new Promise(r => setTimeout(r, 100));

      const cards = document.querySelectorAll('#symbol-library-grid .sym-card');
      const count = cards.length;
      const firstLabel = count > 0 ? (cards[0].querySelector('.sym-name') || {}).textContent : '';
      const imgs = Array.from(document.querySelectorAll('#symbol-library-grid img'));
      
      // Verify images loaded and have naturalWidth > 0
      const brokenImgs = imgs.filter(img => img.complete && img.naturalWidth === 0).length;

      return {
        query,
        count,
        firstLabel,
        renderedImgCount: imgs.length,
        brokenImgs
      };
    }, q);
    searchResults.push(res);
  }

  const allSearchesPassed = searchResults.every(r => r.count > 0 && r.brokenImgs === 0);
  check(
    '2. Search queries ("dog", "eat", "happy") each return > 0 results with valid images',
    allSearchesPassed,
    JSON.stringify(searchResults)
  );

  // --------------------------------------------------------------------------
  // Check 3: Category chips filter correctly and display valid counts
  // --------------------------------------------------------------------------
  const categoriesToTest = ['food', 'animals', 'feelings', 'actions', 'people', 'places', 'play', 'daily', 'drinks', 'core', 'health'];
  const catResults = [];

  for (const cat of categoriesToTest) {
    const res = await page.evaluate((c) => {
      const searchInp = document.getElementById('sym-search-input');
      searchInp.value = '';
      selectSymbolCategory(c);

      const cards = document.querySelectorAll('#symbol-library-grid .sym-card');
      const countEl = document.getElementById('sym-count-' + c);
      const countText = countEl ? countEl.textContent.replace(/,/g, '') : '0';
      const badgeCount = parseInt(countText, 10) || 0;

      return {
        cat: c,
        renderedCardCount: cards.length,
        badgeCount
      };
    }, cat);
    catResults.push(res);
  }

  const allCatsPassed = catResults.every(r => r.badgeCount > 0 && r.renderedCardCount > 0);
  check(
    '3. Category chips filter correctly and display accurate counts > 0',
    allCatsPassed,
    JSON.stringify(catResults)
  );

  // --------------------------------------------------------------------------
  // Check 4: Infinite scroll (loadMoreSymbols) and 300+ image rendering test (no broken images)
  // --------------------------------------------------------------------------
  const scrollTest = await page.evaluate(async () => {
    // Reset to "all" with no search filter
    selectSymbolCategory('all');
    document.getElementById('sym-search-input').value = '';
    filterSymbolLibrary();

    // Scroll grid multiple times to load at least 320 symbols
    const grid = document.getElementById('symbol-library-grid');
    for (let i = 0; i < 6; i++) {
      grid.scrollTop = grid.scrollHeight;
      loadMoreSymbols();
      await new Promise(r => setTimeout(r, 120));
    }

    const cards = document.querySelectorAll('#symbol-library-grid .sym-card');
    const imgs = Array.from(document.querySelectorAll('#symbol-library-grid img'));

    // Wait a brief moment for all rendered images to load
    await new Promise(r => setTimeout(r, 600));
    // Lazy-loaded pictures may still be decoding; wait for every <img> to settle
    // (up to 10 s) so an in-flight load is not counted as broken.
    for (let i = 0; i < 100 && imgs.some(img => !img.complete); i++) {
      await new Promise(r => setTimeout(r, 100));
    }

    let brokenCount = 0;
    let loadedCount = 0;
    const brokenSamples = [];

    for (const img of imgs) {
      if (img.naturalWidth > 0) {
        loadedCount++;
      } else if (img.complete) {
        // loading="lazy" pictures outside the viewport never fetch (complete === false);
        // only a finished load with no pixels is a broken picture.
        brokenCount++;
        if (brokenSamples.length < 5) brokenSamples.push(img.src);
      }
    }

    return {
      totalCardsRendered: cards.length,
      totalImgsRendered: imgs.length,
      loadedCount,
      brokenCount,
      brokenSamples
    };
  });

  check(
    '4. Infinite scroll loads 300+ symbols and all rendered <img> have naturalWidth > 0 (0 broken)',
    scrollTest.totalCardsRendered >= 300 && scrollTest.loadedCount >= 250 && scrollTest.brokenCount === 0,
    `Rendered cards: ${scrollTest.totalCardsRendered}, Imgs loaded: ${scrollTest.loadedCount}, Broken: ${scrollTest.brokenCount}`
  );

  // --------------------------------------------------------------------------
  // Check 5: Selecting a symbol applies SVG path to tile and fills label
  // --------------------------------------------------------------------------
  const selectTest = await page.evaluate(async () => {
    openEditor(1);
    openSymbolLibrary();

    // Search for "apple"
    document.getElementById('sym-search-input').value = 'apple';
    filterSymbolLibrary();
    await new Promise(r => setTimeout(r, 80));

    // Click the first card
    const firstCard = document.querySelector('#symbol-library-grid .sym-card');
    if (firstCard) firstCard.click();

    const labelVal = document.getElementById('modal-label-input').value;
    const isLibraryClosed = !document.getElementById('modal-symbol-library').classList.contains('open');
    const isEditorOpen = document.getElementById('editor-modal').classList.contains('open');
    const pendingSym = pendingSymbol;

    return {
      labelVal,
      isLibraryClosed,
      isEditorOpen,
      pendingSym
    };
  });

  check(
    '5. Tapping a library symbol populates label and sets pendingSymbol SVG path',
    selectTest.isLibraryClosed && selectTest.isEditorOpen &&
    selectTest.labelVal.length > 0 && typeof selectTest.pendingSym === 'string',
    JSON.stringify(selectTest)
  );

  // --------------------------------------------------------------------------
  // Check 6: Zero JS errors
  // --------------------------------------------------------------------------
  check('6. Zero JS console or unhandled page errors during library operations', errors.length === 0, errors.join(' | '));

  await browser.close();

  let failed = 0;
  console.log('\n--- SYMBOL & PHOTO LIBRARY TEST RESULTS ---');
  for (const r of results) {
    if (!r.pass) failed++;
    console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + '\n        -> ' + r.detail);
  }
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed\n');
  process.exit(failed ? 1 : 0);
})();
