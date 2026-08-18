const puppeteer = require('/home/mike/browser-automation/node_modules/puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files']
  });

  const page = await browser.newPage();
  // Standard iPad Landscape Viewport
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 2 });

  const outDir = '/home/mike/aac-board/screenshots';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  await page.goto('file:///home/mike/aac-board/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  // 1. Colors Board (User Mode)
  await page.evaluate(() => {
    switchToBoardView(false);
    currentPageIndex = 0;
    renderCurrentPage();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, '01_colors_user.png') });

  // 2. Yes/No Board (User Mode)
  await page.evaluate(() => {
    currentPageIndex = 1;
    renderCurrentPage();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, '02_yesno_user.png') });

  // 3. School 16-button Grid with Express Sentence Bar (User Mode)
  await page.evaluate(() => {
    currentPageIndex = 2;
    expressCollectedChips = [{ label: 'School Bus' }, { label: 'Friends' }];
    renderCurrentPage();
    renderExpressChips();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, '03_school_express.png') });

  // 4. Editor Mode with Empty "Tap to Add Button" cells
  await page.evaluate(() => {
    currentPageIndex = 0;
    setEditMode(true);
    // Clear tiles on page 1 for editor placeholder display
    pages[0].tiles = {};
    renderCurrentPage();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, '04_editor_empty.png') });

  // 5. Page Options Popover
  await page.evaluate(() => {
    togglePageOptions();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, '05_page_options.png') });

  // 6. Page Background Color Picker Popover
  await page.evaluate(() => {
    openColorPicker();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, '06_color_picker.png') });

  // 7. New Page Menu Popover
  await page.evaluate(() => {
    closeAllPopovers();
    toggleNewPageMenu();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, '07_new_page_menu.png') });

  // 8. Visual Scene Page in Editor Mode
  await page.evaluate(() => {
    closeAllPopovers();
    currentPageIndex = 3;
    renderCurrentPage();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, '08_scene_editor.png') });

  // 9. Set Auditory Cue Modal
  await page.evaluate(() => {
    openAuditoryCueModal();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, '09_auditory_cue.png') });

  // 10. Home Screen Launcher
  await page.evaluate(() => {
    closeAuditoryCueModal();
    switchToHomeView();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, '10_home_screen.png') });

  await browser.close();
  console.log('All 10 screenshot captures saved to:', outDir);
})();
