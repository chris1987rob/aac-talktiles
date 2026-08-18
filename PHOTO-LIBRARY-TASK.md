# Task: Verify, finish, and ship the 3,400+ image photo library

Context: The app's Symbol & Photo Library (modal `modal-symbol-library` in index.html) was just
loaded with **3,436 ARASAAC SVG symbols** in `symbols/en/` plus metadata in `symbols_data.js`
(`AAC_OFFICIAL_SYMBOLS`). This work is on disk and bundled into AAC-Board-v2.3.apk, but **nothing
is committed to git yet**, and the UI still has stale text. Finish it and ship it.

## 1. Verify the full library works (puppeteer, headless)
Write/extend a node script (e.g. `test_photo_library.js`) that against `index.html`:
- Opens the Symbol & Photo Library modal (`openSymbolLibrary()`).
- Asserts the total count badge shows 3,400+ items (3,436 official symbols + starter emojis).
- Asserts search works: typing "dog", "eat", "happy" each returns >0 results with visible images.
- Asserts category chips filter correctly and show counts.
- Scrolls the grid to exercise infinite scroll (`loadMoreSymbols`) and asserts no broken images:
  every rendered `<img>` has `naturalWidth > 0` (check at least 300 sampled tiles across scrolls).
- Run it and make it pass. Fix any bug you find (missing file, bad id, broken path) — all 3,436
  files were pre-verified to exist for every id in symbols_data.js.

## 2. Fix stale UI text
- The search placeholder still says "Search 140+ symbols ..." — update it to reflect the real
  library size (e.g. "Search 3,400+ symbols ...").
- Any other hardcoded counts that are now wrong — fix them.

## 3. Commit + push everything
`git status` currently shows uncommitted: `symbols/` (3,436 SVGs), `symbols_data.js`, big
`index.html` changes, rebuilt `AAC-Board-v2.3.apk`, new screenshots. Commit ALL of it (stage
everything including the binary APK and screenshots) with a clear message like:
"Ship 3,436-symbol photo library: ARASAAC EN set, searchable library UI, verification tests"
then `git push`. Confirm the push succeeded (show the remote ref update).

## 4. Report
Print a final summary: total images in library, test results, commit hash, push confirmation,
and end with the marker line: PHOTO-LIBRARY-DONE
