# Talk Tiles — audit & upgrade list

Written 2026-08-20 against the v2.4 tree (`index.html`, 5,660 lines).
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

**Symbol library.** 3,436 Mulberry AAC pictograms + ~170 starter emoji, searchable
by keyword/tag with 11 category chips and infinite scroll.

**Page authoring.** Page Options popover (background colour picker, button-count
segments, Enabled / Express / Page-Specific-Scanning toggles, auditory cue).
"New Page" menu with all 8 entries live: Online Gallery (5 downloadable boards),
My Templates, Import/Export, Duplicate Page, 3-step Page Wizard, Keyboard Page,
Blank Scene Page, Blank Button Page.

**Templates (v2.4).** 11 built-ins — Core Words (Classic), Yes/No Board, seven
Blank grids, Visual Scene (Blank), Keyboard Page — merged ahead of the user's own
saved templates in the My Templates modal.

**Visual scenes.** Photo or one of 5 built-in SVG scene presets as a background,
with draggable/resizable hotspots (8 handles) that speak on tap.

**Express bar.** Chip-based sentence builder that speaks the chips in order.

**Keyboard page.** QWERTY/ABC with phrase prediction and TTS.

**Android.** Self-pinning Lock (`startLockTask()`), no FLAG_SECURE, camera and
file-chooser wired through `onShowFileChooser`.

**Tests.** 5 puppeteer suites, 51 checks, all green:
`test_headless.js` 22, `test_behavior.js` 8, `test_button_editor.js` 6,
`test_photo_library.js` 6, `test_templates.js` 9.

---

## 2. What is broken, missing, or inconsistent

### 2.1 Saving a photo to a tile destroys the board on next launch — CONFIRMED

`saveTileToDB` (2761) writes the tile object — including the photo `Blob` and
audio `Blob` — into `pages[i].tiles[slot]`, then calls `savePagesToStorage`
(2714), which is `JSON.stringify(pages)`. A `Blob` stringifies to `{}`. So
localStorage ends up holding `"photo": {}`.

On the next load, `loadPagesFromStorage` restores that tile, `photo` is a truthy
empty object, and `createTileElement` (4187) takes the non-string branch:
`URL.createObjectURL(data.photo)` throws, `renderGridPage` dies mid-loop, and
**the grid renders zero tiles**.

Reproduced headless: save a 185-byte PNG blob to slot 1, reload →
`pageerror: Failed to execute 'createObjectURL' on 'URL': Overload resolution
failed`, `#tiles-grid .tile` count `0`. Every page in the book is gone until
localStorage is cleared.

Two things hide it from the suites: no test saves a real photo and then reloads,
and the tile-editor suites all run within one page load.

The IndexedDB copy is intact, but `renderGridPage` (4159) only consults
`cachedTiles` when `p.tiles[slot]` is falsy **and** `currentPageIndex === 0`, so
the good copy is never reached.

### 2.2 IndexedDB is keyed by slot number, not by page

`saveTileToDB` / `deleteTileFromDB` use `store.put(tile)` with `keyPath: 'id'`,
and `id` is the slot (1…48). Slot 4 on page 1 and slot 4 on page 7 are the same
IndexedDB record. Commit 72d45d6 fixed the *visible* symptom by also writing into
`page.tiles`, but the blob store underneath is still global — so a photo taken
for one page's slot 4 silently overwrites another page's.

### 2.3 Online Gallery and Page Wizard write tile keys nothing reads — CONFIRMED

`ONLINE_GALLERY_TEMPLATES` (3589) and `AAC_PRESETS` (3478) give every tile
`color:` and `wordSize:`. `createTileElement` reads `bgColor` and `labelSize`.
Result: all 5 gallery boards and every wizard preset page come out as plain white
tiles at default text size. Confirmed — installing `gal-core-16` yields
`tiles[1] = {label:"I", color:"#fff9c4", symbol:"me"}` and a rendered
`background-color` of `""`.

Same tiles set `symbol:` to bare words (`'me'`, `'take'`, `'more'`, `'close'`).
Those match neither a `.svg` path nor a case in `getSymbolSvg` (4243), so the
default branch renders the literal string — the "symbol" on the gallery's "I"
tile is the text **me**.

Nothing in any suite opens the Online Gallery or the Page Wizard.

### 2.4 Page ids collide after a delete — CONFIRMED

Every creation path uses `const newPageId = pages.length + 1` (`useCustomTemplate`
4024, `installGalleryTemplate` 3735, `addNewButtonPage` 3090, and the wizard).
Delete a page and add one and two pages share an id: confirmed sequence
`[1, 3, 4, 5, 5]`. In editor mode the bottom bar shows `Page ${p.id}` (3228), so
the label is wrong too. Import (`handleBookFileImport` 4076) does the same.

### 2.5 Buttons that only produce a toast

- 2009 `Voice` → `showToast('Voice selected')`
- 2011 `Use Second Voice` → `showToast('Second voice set')`
- 1800 share icon → `showToast('Share Page')`
- 1763 `btn-bar-jump` → `showToast('Jump Action')` (hidden, `display: none`)

BEHAVIOR-SPEC B10 lists Voice and Use Second Voice as real controls. They are
labels over nothing.

### 2.6 Features that persist a flag and stop there

- **Page-specific scanning.** `togglePageScanning` (3213) stores `p.scanning`.
  There is no scanning engine anywhere — no timer, no highlight cursor, no
  switch input. UI-SPEC and BEHAVIOR-SPEC B5 both list it.
- **Auditory cues.** `saveAuditoryCueModal` (4822) stores `p.auditoryCue` and
  `p.auditoryMode`. Nothing ever reads them back to play a cue on page entry.
  The "Recorded Audio" tab records nothing.

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

`toggleSymbolPicker` (5253) is dead in both app and tests.
`renderBoard` (3221) is a one-line alias for `renderCurrentPage`, dead in the
app, called only by `test_headless.js` (178, 207).

### 2.9 Grid size 12 exists but cannot be chosen

`getGridDimensions` handles `12` (4×3) and `setLayout` (2998) maps legacy layout
3 to it, but Page Options has no `12` segment. A book imported or migrated with
a 12-button page renders fine and then cannot be edited back to 12.

### 2.10 Templates lose scene backgrounds and page flags

`saveCurrentPageAsTemplate` (4006) copies `type`, `gridSize`, `bg`, `tiles`,
`hotspots` — not `sceneBg`, `express`, `enabled`, `auditoryCue` or `scanning`.
`useCustomTemplate` (4024) hardcodes `express: true, enabled: true`. Saving a
scene page as a template and using it gives an empty scene: the hotspots are
there, the photo is not. (Left alone in v2.4 deliberately — the brief said the
save-as-template behaviour stays unchanged.)

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
- The reference board in `TEMPLATE-REF.png` is ~10 columns × 8 rows (~80
  buttons) and is clipped by the video frame. "Core Words (Classic)" is 8 × 6;
  the extra two columns of category folders on the real board would need
  tile→page navigation, which Talk Tiles does not have (see P1 below).

---

## 3. Prioritised upgrades

### P0 — data loss or crash

| # | Item | Why |
|---|---|---|
| P0-1 | Stop putting `Blob`s in `localStorage`; keep photo/audio in IndexedDB and store only a reference on the page tile, and make `createTileElement` defensive about a non-Blob `photo` | §2.1: one photo tile bricks the whole board on next launch |
| P0-2 | Key the IndexedDB tile store by `pageId + slot` and migrate existing records | §2.2: photos silently overwrite each other across pages |
| P0-3 | Add a reload-persistence check to `test_behavior.js` (save a real blob → reload → assert tiles render) | The bug above survived five green suites |

### P1 — advertised but not working

| # | Item | Why |
|---|---|---|
| P1-1 | Map `color`→`bgColor` and `wordSize`→`labelSize` in the gallery and wizard tile literals, and give their `symbol` values real Mulberry paths | §2.3: all 5 gallery boards and every wizard page ship colourless with a word where the picture should be |
| P1-2 | Give pages a monotonic id (`Math.max(...ids) + 1` or a counter) | §2.4: duplicate ids, wrong "Page N" label, unstable book order |
| P1-3 | Tile→page navigation (`action: {type:'goto', pageId}`) | The single biggest gap vs the reference board — its whole right-hand teal column is category folders, and "jump back" is a navigation button. Also unblocks a faithful Core Words board |
| P1-4 | Either implement scanning + auditory-cue playback, or remove the controls | §2.6: toggles that persist a flag and do nothing are worse than absent ones |
| P1-5 | Delete or implement the four toast-only buttons | §2.5: a "Voice" button that does nothing is a trap for a parent setting the board up |
| P1-6 | Point `test_button_editor.js` and `test_behavior.js` at the real symbol-library path instead of `selectSymbol` | §2.8: the covered path is not the shipped path |
| P1-7 | Add `LICENSE` / `NOTICE` crediting Mulberry (CC BY-SA 4.0) and surface it in the app's help panel | §2.13: licence compliance, not polish |

### P2 — correctness, hygiene, reach

| # | Item | Why |
|---|---|---|
| P2-1 | Either implement OBF/OBZ import properly or drop the claim from the modal | §2.7: currently promises interop with every other AAC app and delivers none |
| P2-2 | Carry `sceneBg`, `express`, `enabled`, `auditoryCue` through save/use template | §2.10: a scene template that loses its photo is not a template |
| P2-3 | Escape interpolated titles, or build rows with `textContent` | §2.11 |
| P2-4 | Add a `12` segment to Page Options | §2.9: a supported size the UI cannot select |
| P2-5 | Rewrite `README.md`; fold the real v2.3 content into `CHANGELOG.md`; delete `SPEC.md`, the three finished task briefs, `generate_html.py`, `compare_sheets.py` and `comparisons/` (or move them to `versions/`) | §2.12: the docs currently describe a different app |
| P2-6 | Drop `toggleSymbolPicker`; inline `renderBoard` and fix `test_headless.js` | §2.8: dead code that only exists because a test calls it |
| P2-7 | Surface localStorage quota failures as a toast | §2.14: silent stop-saving is the worst failure mode for a comms aid |
| P2-8 | Stop appending/stripping `" Template"` — keep the title, mark the kind separately | §2.14 |
| P2-9 | Guard the Keyboard Page template against creating a second keyboard page, or give each keyboard page its own text buffer | §2.14 |
| P2-10 | On-device pass on the Pixel 8 Pro for the v2.4 grid: 48 buttons at phone width is the densest layout shipped and has only been checked at 1280×800 headless | Legibility risk for the primary user |
