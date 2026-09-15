const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');
const path = require('path');

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

(async () => {
  console.log('--- STARTING BUILT-IN TEMPLATES TEST ---');

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
  // Check 1: New Page -> My Templates lists every built-in, before any user ones
  // --------------------------------------------------------------------------
  const c1 = await page.evaluate(() => {
    localStorage.removeItem('talk_tiles_custom_templates');
    openMyTemplatesModal();
    const modal = document.getElementById('modal-my-templates');
    const rows = [...document.querySelectorAll('#my-templates-list .editor-section')];
    return {
      modalOpen: modal.classList.contains('open'),
      builtinCount: BUILTIN_TEMPLATES.length,
      rowCount: rows.length,
      titles: rows.map(r => r.querySelector('.template-title').textContent.replace(/\s+/g, ' ').trim()),
      allBuiltinFlagged: rows.every(r => r.dataset.builtin === 'true'),
      hasEmptyHint: !!document.getElementById('my-templates-empty-hint')
    };
  });

  const expectedTitles = [
    'Core Words (Classic)', 'Yes/No Board', 'Blank 1', 'Blank 2', 'Blank 4',
    'Blank 9', 'Blank 16', 'Blank 25', 'Blank 36', 'Visual Scene (Blank)', 'Keyboard Page'
  ];

  check(
    '1. My Templates modal lists all 11 built-ins (Core Words, Yes/No, 7 blanks, scene, keyboard)',
    c1.modalOpen &&
      c1.builtinCount === expectedTitles.length &&
      c1.rowCount === expectedTitles.length &&
      expectedTitles.every((t, i) => c1.titles[i] === t + ' Built-in') &&
      c1.allBuiltinFlagged &&
      c1.hasEmptyHint,
    JSON.stringify(c1)
  );

  // --------------------------------------------------------------------------
  // Check 2: built-in rows carry the Built-in badge and NO delete button
  // --------------------------------------------------------------------------
  const c2 = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#my-templates-list .editor-section')];
    return {
      badges: rows.filter(r => r.querySelector('.template-builtin-badge')).length,
      useButtons: rows.filter(r => r.querySelector('.btn-primary')).length,
      deleteButtons: rows.filter(r => r.querySelector('.btn-danger')).length,
      total: rows.length
    };
  });

  check(
    '2. Every built-in row has a "Built-in" badge and a +Use button but no delete button',
    c2.total === 11 && c2.badges === 11 && c2.useButtons === 11 && c2.deleteButtons === 0,
    JSON.stringify(c2)
  );

  // --------------------------------------------------------------------------
  // Check 3: deleteCustomTemplate() refuses a built-in index
  // --------------------------------------------------------------------------
  const c3 = await page.evaluate(() => {
    const before = BUILTIN_TEMPLATES.length;
    deleteCustomTemplate(0);          // "Core Words (Classic)"
    deleteCustomTemplate(before - 1); // "Keyboard Page"
    return {
      builtinsStillThere: BUILTIN_TEMPLATES.length === before,
      storedCustoms: JSON.parse(localStorage.getItem('talk_tiles_custom_templates') || '[]').length,
      listRows: document.querySelectorAll('#my-templates-list .editor-section').length
    };
  });

  check(
    '3. deleteCustomTemplate() on a built-in index is a no-op (nothing removed, nothing stored)',
    c3.builtinsStillThere && c3.storedCustoms === 0 && c3.listRows === 11,
    JSON.stringify(c3)
  );

  // --------------------------------------------------------------------------
  // Check 4: using "Core Words (Classic)" builds a 48-button 8x6 page
  // --------------------------------------------------------------------------
  const c4 = await page.evaluate(() => {
    const pagesBefore = pages.length;
    useCustomTemplate(0);
    const p = pages[currentPageIndex];
    const grid = document.getElementById('tiles-grid');
    const cs = getComputedStyle(grid);
    return {
      pagesAdded: pages.length - pagesBefore,
      title: p.title,
      type: p.type,
      gridSize: p.gridSize,
      tileCount: Object.keys(p.tiles).length,
      renderedTiles: grid.querySelectorAll('.tile').length,
      cols: cs.gridTemplateColumns.split(' ').length,
      rows: cs.gridTemplateRows.split(' ').length,
      dims: getGridDimensions(48),
      modalClosed: !document.getElementById('modal-my-templates').classList.contains('open')
    };
  });

  check(
    '4. "Core Words (Classic)" creates a new 48-button page laid out 8 cols x 6 rows',
    c4.pagesAdded === 1 && c4.title === 'Core Words (Classic)' && c4.type === 'grid' &&
      c4.gridSize === 48 && c4.tileCount === 48 && c4.renderedTiles === 48 &&
      c4.cols === 8 && c4.rows === 6 && c4.dims.cols === 8 && c4.dims.rows === 6 &&
      c4.modalClosed,
    JSON.stringify(c4)
  );

  // --------------------------------------------------------------------------
  // Check 5: the Core Words page carries the reference board's colour families
  // --------------------------------------------------------------------------
  const expectedColors = {
    1: ['back', '#1a237e', '#ffffff'],   // navy control row
    8: ['all done', '#1a237e', '#ffffff'],
    9: ['I', '#9fa8da', '#1a1a2e'],      // lavender pronoun column
    10: ['want', '#4caf50', '#ffffff'],  // green verbs
    14: ['good', '#64b5f6', '#0d1b2a'],  // blue describers
    15: ['my', '#f5f5f7', '#212121'],    // white function words
    16: ['please', '#00897b', '#ffffff'],// teal social column
    48: ['again', '#00897b', '#ffffff']
  };

  const c5 = await page.evaluate((slots) => {
    const out = {};
    Object.keys(slots).forEach(slot => {
      const el = document.getElementById('tile-slot-' + slot);
      const labelEl = el ? el.querySelector('.tile-label') : null;
      out[slot] = {
        label: labelEl ? labelEl.textContent.trim() : null,
        bg: el ? el.style.backgroundColor : null,
        color: labelEl ? labelEl.style.color : null
      };
    });
    const p = pages[currentPageIndex];
    const svgSymbols = Object.values(p.tiles).filter(t => t.symbol && t.symbol.indexOf('symbols/modern/') === 0).length;
    const brokenImgs = [...document.querySelectorAll('#tiles-grid img')].filter(i => i.complete && i.naturalWidth === 0).length;
    return { tiles: out, svgSymbols, brokenImgs };
  }, expectedColors);

  const colorsOk = Object.entries(expectedColors).every(([slot, [label, bg, fg]]) => {
    const t = c5.tiles[slot];
    return t && t.label === label && t.bg === hexToRgb(bg) && t.color === hexToRgb(fg);
  });

  check(
    '5. Core Words tiles match the reference colours (navy row, lavender/green/blue/white/teal columns) with working in-house symbol pictures',
    colorsOk && c5.svgSymbols >= 20 && c5.brokenImgs === 0,
    JSON.stringify(c5)
  );

  // --------------------------------------------------------------------------
  // Check 6: the blank + scene + keyboard built-ins produce the right page shapes
  // --------------------------------------------------------------------------
  const c6 = await page.evaluate(() => {
    const out = [];
    BUILTIN_TEMPLATES.forEach((tpl, idx) => {
      if (tpl.title.indexOf('Blank ') !== 0 && tpl.type === 'grid') return;
      useCustomTemplate(idx);
      const p = pages[currentPageIndex];
      out.push({
        title: p.title,
        type: p.type,
        gridSize: p.gridSize,
        tiles: Object.keys(p.tiles || {}).length,
        rendered: p.type === 'grid' ? document.querySelectorAll('#tiles-grid .tile').length : null,
        gridVisible: document.getElementById('tiles-grid').style.display,
        sceneActive: document.getElementById('scene-view').classList.contains('active'),
        kbVisible: document.getElementById('keyboard-view').style.display
      });
    });
    return out;
  });

  const blanks = c6.filter(r => r.title.indexOf('Blank ') === 0);
  const scene = c6.find(r => r.title === 'Visual Scene (Blank)');
  const kb = c6.find(r => r.title === 'Keyboard Page');

  check(
    '6. Blank 1/2/4/9/16/25/36 create empty grids of the right size; scene + keyboard built-ins open their own views',
    blanks.length === 7 &&
      blanks.every(b => b.type === 'grid' && b.tiles === 0 &&
        b.gridSize === parseInt(b.title.slice(6), 10) && b.rendered === b.gridSize) &&
      scene && scene.type === 'scene' && scene.sceneActive && scene.gridVisible === 'none' &&
      kb && kb.type === 'keyboard' && kb.kbVisible === 'flex',
    JSON.stringify(c6)
  );

  // --------------------------------------------------------------------------
  // Check 7: user templates still save, list after the built-ins, and delete
  // --------------------------------------------------------------------------
  const c7 = await page.evaluate(() => {
    // Land on a known page so the saved template is identifiable.
    currentPageIndex = 0;
    renderCurrentPage();
    const savedTitle = pages[0].title + ' Template';

    saveCurrentPageAsTemplate();
    openMyTemplatesModal();

    const rowsAfterSave = [...document.querySelectorAll('#my-templates-list .editor-section')];
    const lastRow = rowsAfterSave[rowsAfterSave.length - 1];
    const userIdx = BUILTIN_TEMPLATES.length; // first index past the built-ins
    const stored = JSON.parse(localStorage.getItem('talk_tiles_custom_templates') || '[]');

    const afterSave = {
      rowCount: rowsAfterSave.length,
      storedCount: stored.length,
      storedTitle: stored[0] && stored[0].title,
      lastIsUser: lastRow.dataset.builtin !== 'true',
      lastHasDelete: !!lastRow.querySelector('.btn-danger'),
      lastTitle: lastRow.querySelector('.template-title').textContent.replace(/\s+/g, ' ').trim(),
      hintGone: !document.getElementById('my-templates-empty-hint')
    };

    // Using it must build a page from the user's copy, not a built-in.
    const pagesBefore = pages.length;
    useCustomTemplate(userIdx);
    const used = {
      pagesAdded: pages.length - pagesBefore,
      title: pages[currentPageIndex].title,
      gridSize: pages[currentPageIndex].gridSize
    };

    openMyTemplatesModal();
    deleteCustomTemplate(userIdx);
    const afterDelete = {
      storedCount: JSON.parse(localStorage.getItem('talk_tiles_custom_templates') || '[]').length,
      rowCount: document.querySelectorAll('#my-templates-list .editor-section').length,
      hintBack: !!document.getElementById('my-templates-empty-hint')
    };

    closeMyTemplatesModal();
    return { savedTitle, afterSave, used, afterDelete, expectedSize: pages[0].gridSize };
  });

  check(
    '7. Saving the current page still works: it lists after the built-ins with a delete button, uses, and deletes',
    c7.afterSave.rowCount === 12 &&
      c7.afterSave.storedCount === 1 &&
      c7.afterSave.storedTitle === c7.savedTitle &&
      c7.afterSave.lastIsUser && c7.afterSave.lastHasDelete &&
      c7.afterSave.lastTitle === c7.savedTitle &&
      c7.afterSave.hintGone &&
      c7.used.pagesAdded === 1 &&
      c7.used.title === c7.savedTitle.replace(/\s*Template$/, '') &&
      c7.afterDelete.storedCount === 0 &&
      c7.afterDelete.rowCount === 11 &&
      c7.afterDelete.hintBack,
    JSON.stringify(c7)
  );

  // --------------------------------------------------------------------------
  // Check 8: the 48 segment button exists in Page Options and drives setGridSize
  // --------------------------------------------------------------------------
  const c8 = await page.evaluate(() => {
    const btn = document.querySelector('#popover-page-options .segment-btn[data-grid="48"]');
    if (!btn) return { present: false };
    currentPageIndex = 0;
    renderCurrentPage();
    setGridSize(48);
    return {
      present: true,
      active: btn.classList.contains('active'),
      gridSize: pages[0].gridSize,
      rendered: document.querySelectorAll('#tiles-grid .tile').length
    };
  });

  check(
    '8. Page Options has a 48 segment button that switches the page to the 8x6 grid',
    c8.present && c8.active && c8.gridSize === 48 && c8.rendered === 48,
    JSON.stringify(c8)
  );

  // --------------------------------------------------------------------------
  // Check 9: tap all 48 Core Words tiles and assert each speaks its own word
  // --------------------------------------------------------------------------
  const c9 = await page.evaluate(() => {
    // Library-picture tiles play a pre-rendered voice clip instead of calling
    // speechSynthesis, so observe the app's own speech log (fed by both paths).
    window.__spokenHistory = [];
    window.__spoken = window.__spokenHistory;
    window.speechSynthesis.speak = () => {};

    pages = pages.slice(0, 1);
    currentPageIndex = 0;
    useCustomTemplate(0);                 // Core Words (Classic)
    setEditMode(false);
    renderCurrentPage();

    const expected = CORE_WORDS_LAYOUT.map(e => e[0]);
    const taps = [];
    for (let slot = 1; slot <= 48; slot++) {
      const el = document.getElementById('tile-slot-' + slot);
      if (!el) { taps.push({ slot, error: 'no tile' }); continue; }
      const before = window.__spoken.length;
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      taps.push({
        slot,
        label: (el.querySelector('.tile-label') || {}).textContent,
        spoke: window.__spoken.slice(before)
      });
    }
    return {
      expected,
      taps,
      allSpoken: window.__spoken.slice(),
      chips: [...document.querySelectorAll('.express-chip')].map(c => c.textContent.trim())
    };
  });

  const tapsOk = c9.taps.length === 48 && c9.taps.every((t, i) =>
    t.label === c9.expected[i] && t.spoke.length === 1 && t.spoke[0] === c9.expected[i]);

  check(
    '9. Every one of the 48 Core Words (Classic) tiles speaks its own word when tapped',
    tapsOk && JSON.stringify(c9.allSpoken) === JSON.stringify(c9.expected),
    JSON.stringify({ mismatches: c9.taps.filter((t, i) =>
      !(t.label === c9.expected[i] && t.spoke.length === 1 && t.spoke[0] === c9.expected[i])) })
  );

  // --------------------------------------------------------------------------
  // Check 10: Core Words is an express page (the reference board's message
  //           window), so the 48 taps also built a 48-chip sentence in order
  // --------------------------------------------------------------------------
  const c10 = await page.evaluate(() => {
    const bar = document.getElementById('express-bar-container');
    window.__spokenHistory = [];
    window.__spoken = window.__spokenHistory;
    document.getElementById('express-bar').click();
    return {
      express: pages[currentPageIndex].express,
      barOpen: bar.classList.contains('open'),
      // a chip is [thumbnail][label span]; read the label, not the glyph
      chips: [...document.querySelectorAll('.express-chip')].map(c => {
        const span = c.querySelector('span:last-of-type');
        return (span ? span.textContent : c.textContent).trim();
      }),
      thumbs: document.querySelectorAll('.express-chip .express-chip-thumb').length,
      sentence: window.__spoken.slice()
    };
  });

  check(
    '10. Core Words is an express page: 48 taps chip up in order with their own symbol thumbnails (34 pictured words), and the speech bar plays them IN SEQUENCE',
    c10.express === true && c10.barOpen &&
      c10.chips.length === 48 && c10.chips.every((t, i) => t === c9.expected[i]) &&
      c10.sentence.length === 1 && c10.sentence[0] === c9.expected.join(' ') &&
      c10.thumbs === 34,
    JSON.stringify({ express: c10.express, barOpen: c10.barOpen, chips: c10.chips, thumbs: c10.thumbs, sentence: c10.sentence })
  );

  // --------------------------------------------------------------------------
  // Check 11: no JS errors anywhere in the run
  // --------------------------------------------------------------------------
  check(
    '11. Zero JS errors during built-in template testing',
    errors.length === 0,
    errors.join('; ')
  );

  console.log('\n--- BUILT-IN TEMPLATES TEST RESULTS ---');
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
