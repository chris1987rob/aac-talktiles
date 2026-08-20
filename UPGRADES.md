# Talk Tiles — audit & upgrade list

Written 2026-08-20 against the v2.4 tree. Revised the same day after the scene
and button-coverage work, which fixed six of the findings below -- those are
kept, marked FIXED IN v2.4, so the history stays readable.
Line references are to `index.html` unless stated otherwise. Everything called
"confirmed" below was reproduced in headless Chrome, not read off the source.

---

## 1. What the prototype has today

**Shell.** One self-contained `index.html` (vanilla JS, no build step, no CDN)
plus `symbols_data.js` and `symbols/en/*.svg`, wrapped in a thin Android WebView
(`app/src/com/aacboard/app/MainActivity.java`, 314 lines). Built without Gradle
by `build.sh`. Runs fully offline.

**Board model.** A *book* of pages; each page is `grid`, `scene`, or `keyboard`.
Grid pages come in 1 / 2 / 4 / 9 / 12 / 16 / 25 / 36 / 48 buttons
(`getGridDimensions`, 4169). Pages live in `localStorage` under
`talk_tiles_pages_v2`; tile photos and voice recordings live in IndexedDB.

**Tiles.** Label, TTS string, recorded audio, photo, symbol (Mulberry SVG path
or emoji), background/border/label colour, label size (0.6×–3×) and label
position. Labels shrink to fit (`fitTextToBox`).

**Symbol library.** 3,436 Mulberry AAC pictograms + 173 starter emoji (3,609
total), searchable by keyword/tag with 11 category chips and infinite scroll,
reachable two ways: a full-screen library, and (since v2.4.1) an inline strip in
the tile editor that seeds from the tile's label and filters as it is typed.

**Page authoring.** Page Options popover (background colour picker, button-count
segments, Enabled / Express / Page-Specific-Scanning toggles, auditory cue).
"New Page" menu with all 8 entries live: Online Gallery (5 downloadable boards),
My Templates, Import/Export, Duplicate Page, 3-step Page Wizard, Keyboard Page,
Blank Scene Page, Blank Button Page.

**Templates (v2.4).** 11 built-ins — Core Words (Classic), Yes/No Board, seven
Blank grids, Visual Scene (Blank), Keyboard Page — merged ahead of the user's own
saved templates in the My Templates modal.

**Visual scenes.** Photo or one of 5 built-in SVG scene presets as a background,
with draggable/resizable hotspots (8 handles) that speak on tap. Four built-in
SVG scene presets (living room, classroom, playground, kitchen).

**Express bar.** Chip-based sentence builder that speaks the chips in order.

**Keyboard page.** QWERTY/ABC with phrase prediction and TTS.

**Android.** Self-pinning Lock (`startLockTask()`), no FLAG_SECURE, camera and
file-chooser wired through `onShowFileChooser`.

**Tests.** 7 puppeteer suites, 85 checks, all green:
`test_headless.js` 22, `test_behavior.js` 8, `test_button_editor.js` 10,
`test_photo_library.js` 6, `test_templates.js` 11, `test_scenes.js` 9,
`test_buttons.js` 19. `test_buttons.js` presses all 235 elements that carry an
`onclick` in `index.html` and fails if any of them was never pressed.

---

## 2. What is broken, missing, or inconsistent

### 2.1 Saving a photo to a tile destroys the board on next launch — FIXED IN v2.5

Blobs no longer go to `localStorage`. Tile photos and audio live exclusively in
IndexedDB (`tiles_v2`), while pages carry lightweight `hasPhoto`/`hasAudio`
flags. On app load, `hydratePagesFromCache()` re-attaches blobs to page records,
and `tilePhotoUrl` caches blob URLs in a `WeakMap` with defensive handling if a
blob is unreadable.

### 2.2 IndexedDB is keyed by slot number, not by page — FIXED IN v2.5

The IndexedDB tile store is now re-keyed by `pageId:slot` (`tiles_v2`), so
slot 4 on page 1 and slot 4 on page 7 have completely independent records and
blobs. Includes a non-destructive migration (`talk_tiles_tilestore_migrated`)
that adopts an existing v1 board onto page 1 while leaving legacy records in place.

### 2.3 Online Gallery and Page Wizard write tile keys nothing reads — FIXED IN v2.5

All 5 gallery boards and wizard presets have been normalized: `color` → `bgColor`,
`wordSize` → `labelSize`, and bare-word symbols resolved to real Mulberry SVG
paths (`symbols/en/*.svg`) or emoji. All 94 template tiles now paint correctly
with background colours and real pictures.

### 2.4 Page ids collide after a delete — FIXED IN v2.5

All page creation paths now use monotonic `nextPageId()` (`(Math.max(...ids) || 0) + 1`),
ensuring page IDs never collide even after intermediate pages are deleted.

### 2.5 Buttons that only produce a toast — FIXED IN v2.5

- `Voice` & `Use Second Voice`: Opens a SpeechSynthesis voice picker modal and
  selects real system speech voices applied by `speakText()`.
- Share icon: Exports the current page JSON.
- Dead hidden `btn-bar-jump` button removed.

### 2.6 Features that persist a flag and stop there — FIXED IN v2.5

- **Page-specific scanning**: Implemented a real step scanning cursor engine
  (`startScanning`, `scanStep`, `stopScanning`) that highlights tiles/hotspots,
  advances on interval, and can be activated via tap or Space/Enter (`selectScannedTarget`).
- **Auditory cues**: `playPageAuditoryCue()` plays TTS or recorded audio cue
  upon arrival on a page (only once, never on silent pages or in editor).

### 2.7 Open Board Format import is a label, not an implementation

The import modal (2393–2396) advertises "Open Board Format (.obf / .obz)".
`handleBookFileImport` (4076) does `JSON.parse` and then looks for `data.pages`
or `data.tiles`. OBF's actual schema (`buttons`, `grid.order`, `images`,
`sounds`) is never mapped, and `.obz` is a zip, which `JSON.parse` cannot read.
Picking a real OBF file gives "Invalid book file format"; picking an OBZ gives
"Failed to parse JSON file".

### 2.8 Two of the three tile-editing suites test a function the app never calls

`selectSymbol(sym)` (5257) has exactly one reference in `index.html` — its own
definition. The live symbol-library path is at 5176/5178, which sets
`pendingSymbol` directly from the catalogue entry. But `test_button_editor.js`
(66, 121) and `test_behavior.js` (119) both call `selectSymbol(...)`. The real
selection path could break outright and those checks would stay green.

`test_photo_library.js` check 5 is titled "sets pendingSymbol SVG path" but its
recorded value is `"🍎"` — it asserts non-empty, not a path, so it does not test
what its name claims.

**Partly addressed in v2.4.1:** `test_button_editor.js` checks 6-9 now drive the
inline editor picker (`selectInlineEditorSymbol`), which is a real shipped path
and shares its matcher (`searchSymbolLibrary`) with the full-screen library. The
`selectSymbol` calls in checks 2 and 4 are still there and still test nothing
that ships.

`toggleSymbolPicker` is dead in both app and tests.
`renderBoard` (3221) is a one-line alias for `renderCurrentPage`, dead in the
app, called only by `test_headless.js` (178, 207).

### 2.9 Grid size 12 exists but cannot be chosen — FIXED IN v2.5

Added a `12` (4×3) segmented button to the Page Options grid selector.

### 2.10 Templates lost scene backgrounds and page flags — FIXED IN v2.4

`saveCurrentPageAsTemplate` copied `type`, `gridSize`, `bg`, `tiles` and
`hotspots` but not `sceneBg`, and `useCustomTemplate` hardcoded
`express: true, enabled: true`. Saving a scene page as a template and using it
gave an empty scene: the hotspots were there, the photo was not. Every page made
from any template was also silently an express page.

Both now carry `sceneBg`, `express` and `enabled`, and `useCustomTemplate`
writes `sceneBg: null` even when there is none so a template scene page has the
same shape as `addNewScenePage()`'s. `test_scenes.js` checks 5-7 assert the
shapes match and that a saved scene template round-trips its photo.

### 2.10a Scene pages leaked into every page after them — FIXED IN v2.4

`#scene-image` and `#scene-hotspots-container` are singletons shared by every
scene page, and `renderCurrentPage()` only touched them on the scene branch. So
a scene's photo stayed in the `<img>` (hidden) and its hotspot `<div>`s stayed
in the DOM while a *standard* page was on screen -- still id-addressable, still
clickable. Walking scene A -> scene B (no photo of its own) left scene A's
photo sitting in the element. A new `clearSceneView()` runs on the non-scene
branches and when a scene has no background; `test_scenes.js` checks 2 and 3
assert nothing is left behind.

### 2.11 Template titles are interpolated into `innerHTML`

`renderMyTemplatesList` (3965) builds each row with a template literal
containing `${tpl.title}`, and the title comes from the user's page title. Same
pattern in the pages drawer (3040) and the gallery list. Single-user offline
device, so the blast radius is small, but a page named `<img onerror=...>`
executes.

### 2.12 Documentation is behind the code

- `README.md` still describes v1: "Three layouts — 2×2, 3×3, 4×3" and
  "**FLAG_SECURE** is set". FLAG_SECURE was deliberately removed
  (`MainActivity.java` 56) and the app has had pages and 1–48 grids since v2.0.
- `CHANGELOG.md`'s newest entry before v2.4 was v2.3 dated 2026-08-17, covering
  only the ONNX removal. The v2.3 APK that actually shipped on 2026-08-20 also
  contained the 3,436-symbol library, the 8 New Page options, visual scenes, the
  keyboard page and the Classic Button Editor revert. None of it is in the
  changelog.
- `SPEC.md` is the v1 spec and is contradicted by `UI-SPEC.md`.
- `TODO-CLAUDE.md`, `CLAUDE-TASK.md`, `PHOTO-LIBRARY-TASK.md` are finished task
  briefs still sitting in the project root as if they were live.
- `generate_html.py` (117 KB), `compare_sheets.py`, `capture_screens.js` and
  `comparisons/` are one-off artefacts of the finished pixel-parity pass.

### 2.13 Mulberry symbols ship with no attribution

3,436 Mulberry pictograms are bundled. Mulberry is CC BY-SA 4.0, which requires
attribution and share-alike. There is no `LICENSE`, no `NOTICE`, and no credit
anywhere in the app or repo. The only mention of the word "Mulberry" in
`index.html` is a marketing line in the help panel (2894).

### 2.14 Smaller things

- `saveCurrentPageAsTemplate` always appends `" Template"` and
  `useCustomTemplate` always strips a trailing `" Template"`, so a page genuinely
  called "Snack Template" round-trips to "Snack".
- Using the "Keyboard Page" built-in twice creates two keyboard pages that share
  one global `kbCurrentText`; `addNewKeyboardPage` (3262) guards against this,
  the template path does not.
- `savePagesToStorage` swallows quota errors into `console.error`. Once
  localStorage fills, edits stop persisting silently.
- **FIXED IN v2.4:** the express speech bar rendered every symbol that was not
  `smile` or `frown` as a star, so a 48-button core board produced 48 identical
  stars -- against BEHAVIOR-SPEC B7's "label + thumbnail". Chips now render the
  tile's own Mulberry SVG or emoji (`expressChipThumb`).
- **FIXED IN v2.4:** `playHotspotRecordedAudio()` and `togglePlayAudioPreview()`
  called `audio.play()` with no `.catch`, so a preview cut short by a pause
  surfaced as an unhandled `AbortError` on the page.
- `kbToggleNumbers()` rebuilds `#kb-keys-layout` from an innerHTML string, so
  the keyboard markup exists three times over (once in the document, twice in
  template literals) and drifts independently.
- `createPageFromWizard()` writes `sceneImage: null` on a wizard scene page;
  the renderer reads `sceneBg`. The key is dead -- the page works only because
  the scene picker sets `sceneBg` later.
- `#editor-modal` and `#modal-auditory-cue` have no backdrop `onclick`, unlike
  every other dialog. That is the right call for a form, but it is undocumented
  and reads as an oversight; `test_buttons.js` check 17 now pins it down.
- The reference board in `TEMPLATE-REF.png` is ~10 columns × 8 rows (~80
  buttons) and is clipped by the video frame. "Core Words (Classic)" is 8 × 6;
  the extra two columns of category folders on the real board would need
  tile→page navigation, which Talk Tiles does not have (see P1 below).

---

## 3. Prioritised upgrades

### P0 — data loss or crash

| # | Item | Status | Why |
|---|---|---|---|
| P0-1 | Stop putting `Blob`s in `localStorage`; keep photo/audio in IndexedDB and store only a reference on the page tile, and make `createTileElement` defensive about a non-Blob `photo` | **FIXED IN v2.5** | §2.1: one photo tile bricks the whole board on next launch |
| P0-2 | Key the IndexedDB tile store by `pageId + slot` and migrate existing records | **FIXED IN v2.5** | §2.2: photos silently overwrite each other across pages |
| P0-3 | Add a reload-persistence check for a real photo blob (save → reload → assert tiles render) | **FIXED IN v2.5** (`test_persistence.js`) | The bug above survived what are now seven green suites; `test_buttons.js` check 16 deliberately drops the staged photo rather than saving it, so it does not trip over P0-1 |

### P1 — advertised but not working

| # | Item | Status | Why |
|---|---|---|---|
| P1-1 | Map `color`→`bgColor` and `wordSize`→`labelSize` in the gallery and wizard tile literals, and give their `symbol` values real Mulberry paths | **FIXED IN v2.5** | §2.3: all 5 gallery boards and every wizard page ship colourless with a word where the picture should be |
| P1-2 | Give pages a monotonic id (`Math.max(...ids) + 1` or a counter) | **FIXED IN v2.5** | §2.4: duplicate ids, wrong "Page N" label, unstable book order |
| P1-3 | Tile→page navigation (`action: {type:'goto', pageId}`) | Open | The single biggest gap vs the reference board — its whole right-hand teal column is category folders, and "jump back" is a navigation button. Also unblocks a faithful Core Words board |
| P1-4 | Either implement scanning + auditory-cue playback, or remove the controls | **FIXED IN v2.5** | §2.6: toggles that persist a flag and do nothing are worse than absent ones |
| P1-5 | Delete or implement the four toast-only buttons | **FIXED IN v2.5** | §2.5: a "Voice" button that does nothing is a trap for a parent setting the board up |
| P1-6 | Point the remaining `selectSymbol` calls in `test_button_editor.js` and `test_behavior.js` at a real path — **partly done in v2.4.1**, which added four checks driving the inline picker | Partially addressed | §2.8: the covered path is not the shipped path |
| P1-7 | Add `LICENSE` / `NOTICE` crediting Mulberry (CC BY-SA 4.0) and surface it in the app's help panel | Open | §2.13: licence compliance, not polish |

### P2 — correctness, hygiene, reach

| # | Item | Status | Why |
|---|---|---|---|
| P2-1 | Either implement OBF/OBZ import properly or drop the claim from the modal | Open | §2.7: currently promises interop with every other AAC app and delivers none |
| P2-2 | ~~Carry `sceneBg`, `express`, `enabled` through save/use template~~ **done in v2.4**; `auditoryCue` and `scanning` still do not travel | Open | §2.10 |
| P2-3 | Escape interpolated titles, or build rows with `textContent` | Open | §2.11 |
| P2-4 | Add a `12` segment to Page Options | **FIXED IN v2.5** | §2.9: a supported size the UI cannot select |
| P2-5 | Rewrite `README.md`; fold the real v2.3 content into `CHANGELOG.md`; delete `SPEC.md`, the three finished task briefs, `generate_html.py`, `compare_sheets.py` and `comparisons/` (or move them to `versions/`) | Open | §2.12: the docs currently describe a different app |
| P2-6 | Drop `toggleSymbolPicker`; inline `renderBoard` and fix `test_headless.js` | Open | §2.8: dead code that only exists because a test calls it |
| P2-7 | Surface localStorage quota failures as a toast | Open | §2.14: silent stop-saving is the worst failure mode for a comms aid |
| P2-8 | Stop appending/stripping `" Template"` — keep the title, mark the kind separately | Open | §2.14 |
| P2-9 | Guard the Keyboard Page template against creating a second keyboard page, or give each keyboard page its own text buffer | Open | §2.14 |
| P2-11 | Build the keyboard key rows from one data table instead of three copies of the markup | Open | §2.14: three copies that drift |
| P2-12 | Drop the dead `sceneImage` key from `createPageFromWizard()` | Open | §2.14 |
| P2-10 | On-device pass on the Pixel 8 Pro for the v2.4 grid: 48 buttons at phone width is the densest layout shipped and has only been checked at 1280×800 headless | Open (No device connected) | Legibility risk for the primary user |
