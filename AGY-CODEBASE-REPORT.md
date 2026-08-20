# AntiGravity (agy) — Read-Only Codebase Analysis of /home/mike/aac-board/index.html
Generated: 2026-08-20 ~14:35 EDT, Gemini 3.7 Flash (high), read-only pass requested by Chris.
Purpose: map for Claude Code's "inline symbol showcase in tile editor" task (v2.4.1).
Line numbers are as of the v2.4 codebase — verify before editing.

comprehensive read-only analysis of [`index.html`](file:///home/mike/aac-board/index.html).

---

### (1) Overall Architecture

#### 1. Main State Objects
* **`pages`** ([`index.html:2654`](file:///home/mike/aac-board/index.html#L2654)): The root array of all page objects in the book, initialized from `DEFAULT_PAGES` ([lines 2590–2652](file:///home/mike/aac-board/index.html#L2590-L2652)) or loaded from `localStorage`.
* **`currentPageIndex`** ([`index.html:2655`](file:///home/mike/aac-board/index.html#L2655)): Integer index pointing to the active page in `pages`.
* **`isEditMode`** ([`index.html:2656`](file:///home/mike/aac-board/index.html#L2656)): Boolean toggling between user communication mode and button/page editing mode.
* **`isPinned`** ([`index.html:2657`](file:///home/mike/aac-board/index.html#L2657)): Boolean indicating if the app is pinned/locked (disables editing and navigation).
* **`cachedTiles`** ([`index.html:2587`](file:///home/mike/aac-board/index.html#L2587)): In-memory `Map<slotId, tileRecord>` loaded from IndexedDB.
* **`activeObjectURLs`** ([`index.html:2588`](file:///home/mike/aac-board/index.html#L2588)): `Map<slotId, objectUrl>` tracking active `blob:` URLs for cleanup.
* **`AAC_SYMBOL_LIBRARY`** ([`index.html:5123`](file:///home/mike/aac-board/index.html#L5123)): In-memory catalog of 3,600+ symbols populated by [`initSymbolLibrary()`](file:///home/mike/aac-board/index.html#L5125-L5145).

#### 2. Storage Pipeline
* **`localStorage`**: Persists page metadata and button layout structures via [`savePagesToStorage()`](file:///home/mike/aac-board/index.html#L2714-L2718) and [`loadPagesFromStorage()`](file:///home/mike/aac-board/index.html#L2720-L2727) under the key `'talk_tiles_pages_v2'`.
* **IndexedDB** (`DB_NAME = 'aac-board'`, store `'tiles'`, [lines 2581–2583](file:///home/mike/aac-board/index.html#L2581-L2583)): Persists binary assets (photos, audio recordings) and tile records via [`saveTileToDB(tile)`](file:///home/mike/aac-board/index.html#L2761-L2781) and [`deleteTileFromDB(id)`](file:///home/mike/aac-board/index.html#L2783-L2801).
* **Page Object Schema**:
  ```js
  {
    id: 1,
    title: "Colors",
    type: "grid",       // 'grid' | 'scene' | 'keyboard'
    gridSize: 4,        // 1, 2, 4, 9, 12, 16, 25, 36, 48
    bg: "#ffffff",
    express: false,     // whether top speech bar is enabled
    enabled: true,
    tiles: {            // slotId -> tile record
      1: { id: 1, label: "Red", tts: "Red", bgColor: "#c4312a", labelColor: "#ffffff", labelSize: 1.4 }
    },
    hotspots: [],       // visual scene hotspot array (for type === 'scene')
    sceneBg: null       // image for visual scene
  }
  ```

#### 3. Render Pipeline
* **`renderBoard()`** ([`index.html:3221`](file:///home/mike/aac-board/index.html#L3221)) → delegates to **[`renderCurrentPage()`](file:///home/mike/aac-board/index.html#L3225-L3259)**.
* **`renderCurrentPage()`**:
  1. Updates the bottom bar label (`#bar-page-label`, line 3228).
  2. Toggles Express Sentence Bar visibility (`#express-bar-container`, line 3231).
  3. Sets board background color (`#board-content`, line 3237).
  4. Dispatches by page type:
     - `'scene'` → [`renderScenePage(p)`](file:///home/mike/aac-board/index.html#L3243)
     - `'keyboard'` → [`renderKeyboardPage(p)`](file:///home/mike/aac-board/index.html#L3250)
     - `'grid'` (default) → **[`renderGridPage(p)`](file:///home/mike/aac-board/index.html#L3257)**.
* **`renderGridPage(page)`** ([`index.html:4161-4181`](file:///home/mike/aac-board/index.html#L4161-L4181)):
  1. Computes grid columns/rows with [`getGridDimensions(count)`](file:///home/mike/aac-board/index.html#L4183-L4199).
  2. Clears previous tiles and revokes stale blob object URLs.
  3. Loops `slotId = 1..count`, pulling data from `page.tiles[slotId]` (or `cachedTiles.get(slotId)`).
  4. Calls **[`createTileElement(slotId, data)`](file:///home/mike/aac-board/index.html#L4201-L4255)** to construct DOM nodes:
     - Sets `bgColor` and `borderColor`.
     - Builds `.tile-image-wrap`: embeds `<img>` for `data.photo` or calls [`getSymbolSvg(data.symbol)`](file:///home/mike/aac-board/index.html#L4257-L4278).
     - Builds `.tile-label` with `data.label`, `data.labelColor`, and `data.labelSize`.
     - Positions label `top` or `bottom` according to `data.labelPosition`.
     - Binds `pointerup` to [`handleTileTap(slotId, data)`](file:///home/mike/aac-board/index.html#L4713-L4735).
  5. Runs [`fitAllLabels()`](file:///home/mike/aac-board/index.html#L5404-L5408) / [`fitTextToBox()`](file:///home/mike/aac-board/index.html#L5410-L5421) inside `requestAnimationFrame` to ensure text shrinks to fit tile bounds.

---

### (2) The Tile Editor

#### 1. Functions that Open and Render the Editor
* **HTML Element**: `<div id="editor-modal" class="modal-backdrop">` ([`index.html:2024–2136`](file:///home/mike/aac-board/index.html#L2024-L2136)).
* **Entry Points**:
  - Tapping an empty slot in edit mode ([`index.html:4213`](file:///home/mike/aac-board/index.html#L4213)).
  - Tapping an existing tile while `isEditMode === true` via [`handleTileTap()`](file:///home/mike/aac-board/index.html#L4715).
* **Opening & Population Function**: **[`openEditor(slotId)`](file:///home/mike/aac-board/index.html#L4888-L4918)**:
  - Verifies `!isPinned`.
  - Sets `currentEditingSlot = slotId`.
  - Populates staging state: `pendingPhotoBlob`, `pendingAudioBlob`, `pendingSymbol`, `pendingLabelPosition`.
  - Populates input values: `#modal-label-input`, `#modal-tts-input`, `#modal-tile-bgcolor`, `#modal-tile-bordercolor`, `#modal-tile-textcolor`, `#modal-label-size`.
  - Calls [`setLabelPosition()`](file:///home/mike/aac-board/index.html#L4920-L4924), [`onLabelSizeInput()`](file:///home/mike/aac-board/index.html#L5380-L5393), [`updateModalPhotoPreview()`](file:///home/mike/aac-board/index.html#L5424-L5449), and [`updateModalAudioPreview()`](file:///home/mike/aac-board/index.html#L5578-L5594).
  - Opens modal: `document.getElementById('editor-modal').classList.add('open')`.
* **Saving & Closing**:
  - **[`saveEditorTile()`](file:///home/mike/aac-board/index.html#L5330-L5364)**: Packages tile record, saves to DB via [`saveTileToDB()`](file:///home/mike/aac-board/index.html#L2761), calls [`closeEditor()`](file:///home/mike/aac-board/index.html#L5316), and calls [`renderCurrentPage()`](file:///home/mike/aac-board/index.html#L3225).

#### 2. Tile Fields (Data Model)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `number` | Button slot index (1..gridSize) |
| `label` | `string` | Text displayed on the tile |
| `tts` | `string` | Speech synthesis phrase (defaults to `label` if empty) |
| `symbol` | `string \| null` | SVG relative path (`symbols/en/*.svg`), emoji character, or glyph key |
| `photo` | `Blob \| string \| null`| Custom camera capture or uploaded image blob / URL |
| `audio` | `Blob \| string \| null`| Recorded microphone voice memo blob |
| `bgColor` | `string` | Hex background color (default `#ffffff`) |
| `borderColor`| `string` | Hex border color (default `#000000`) |
| `labelColor` | `string` | Hex label text color (default `#111111`) |
| `labelSize` | `number` | Font scale multiplier (0.6× to 3.0×, default 1.0) |
| `labelPosition`| `string` | Text placement: `'top'` or `'bottom'` |
| `updatedAt` | `number` | Timestamp |

#### 3. How a Tile's Symbol is Currently Chosen or Set
1. Inside the `#editor-modal` "Photo / Symbol" section ([lines 2084–2109](file:///home/mike/aac-board/index.html#L2084-L2109)), the user clicks the button:
   ```html
   <button class="btn btn-primary" type="button" onclick="openSymbolLibrary()">
     <span>Search Symbols & Photos</span>
   </button>
   ```
2. This invokes [`openSymbolLibrary()`](file:///home/mike/aac-board/index.html#L5151), opening a separate modal dialog (`#modal-symbol-library`).
3. When the user taps a symbol in that library, [`selectLibrarySymbol(symbolObj)`](file:///home/mike/aac-board/index.html#L5227-L5250) is called:
   - Sets `pendingSymbol = symbolObj.svgPath || symbolObj.emoji || symbolObj.id`.
   - Clears `pendingPhotoBlob = null`.
   - Auto-fills empty `#modal-label-input` and `#modal-tts-input` with `symbolObj.label`.
   - Calls [`updateModalPhotoPreview()`](file:///home/mike/aac-board/index.html#L5424) to render the preview.
   - Closes the symbol library modal.

---

### (3) Symbol Search

#### 1. Where the Symbol List Lives
1. **Mulberry AAC SVG Symbols (3,436 vector symbols)**:
   - Included via `<script src="symbols_data.js"></script>` ([line 1518](file:///home/mike/aac-board/index.html#L1518)).
   - Stored in `AAC_OFFICIAL_SYMBOLS` array (in [`symbols_data.js`](file:///home/mike/aac-board/symbols_data.js)).
   - Corresponds to physical SVG files at `symbols/en/<id>.svg`.
2. **`AAC_STARTER_EMOJIS`** ([`index.html:4927–5120`](file:///home/mike/aac-board/index.html#L4927-L5120)):
   - Array of ~100 core vocabulary emojis categorized by `core`, `feelings`, `food`, `drinks`, `actions`, `people`, `places`, `play`, `daily`, `animals`.
3. **Unified Catalog `AAC_SYMBOL_LIBRARY`** ([`index.html:5123–5145`](file:///home/mike/aac-board/index.html#L5123-L5145)):
   - Generated by [`initSymbolLibrary()`](file:///home/mike/aac-board/index.html#L5125-L5145) combining `AAC_STARTER_EMOJIS` and `AAC_OFFICIAL_SYMBOLS`. Total size: ~3,600+ symbols.

#### 2. UI Structure and Search/Filter Mechanism
* **Modal Markup**: `<div id="modal-symbol-library" class="modal-backdrop">` ([lines 2161–2214](file:///home/mike/aac-board/index.html#L2161-L2214)).
  - Search input: `#sym-search-input` ([line 2178](file:///home/mike/aac-board/index.html#L2178)) with `oninput="filterSymbolLibrary()"`.
  - Category chips: `#sym-category-chips` ([lines 2186–2199](file:///home/mike/aac-board/index.html#L2186-L2199)).
  - Grid container: `<div class="sym-grid" id="symbol-library-grid"></div>` ([line 2202](file:///home/mike/aac-board/index.html#L2202)).
* **Filtering Logic** ([`filterSymbolLibrary()`, lines 5252–5272](file:///home/mike/aac-board/index.html#L5252-L5272)):
  - Checks if query `q` matches `label`, `id`, `category`, `rawCat`, or any tag in `keywords`.
  - Respects active category chip (`currentSymbolCategory`).
* **Infinite Scroll & Rendering** ([`renderSymbolLibrary()`, lines 5176–5219](file:///home/mike/aac-board/index.html#L5176-L5219)):
  - Renders batches of 120 symbols, dynamically appending more via [`loadMoreSymbols()`](file:///home/mike/aac-board/index.html#L5221) on scroll.

#### 3. Symbol Representation on Tiles
Rendered by **[`getSymbolSvg(symbol)`](file:///home/mike/aac-board/index.html#L4257-L4278)**:
* If string contains `.svg` or `/`: renders `<img src="${symbol}" class="tile-symbol-img" />`.
* If legacy keyword (`'smile'`, `'frown'`): renders inline `<svg viewBox="0 0 24 24">`.
* If emoji / unicode: renders formatted `<span>${symbol}</span>`.

#### 4. Relevant Code Snippets
**Symbol Catalog Initialization & Selection:**
```js
// lines 5125-5145
function initSymbolLibrary() {
  const list = [...AAC_STARTER_EMOJIS];
  if (typeof AAC_OFFICIAL_SYMBOLS !== 'undefined' && Array.isArray(AAC_OFFICIAL_SYMBOLS)) {
    AAC_OFFICIAL_SYMBOLS.forEach(s => {
      let cat = s.category || 'core';
      if (s.rawCat && s.rawCat.toLowerCase().includes('drink')) {
        cat = 'drinks';
      }
      list.push({
        id: s.id,
        label: s.label,
        category: cat,
        rawCat: s.rawCat,
        svgPath: 'symbols/en/' + s.id + '.svg',
        keywords: [s.id.replace(/_/g, ' '), ...(s.tags || [])]
      });
    });
  }
  AAC_SYMBOL_LIBRARY = list;
}

// lines 5227-5250
function selectLibrarySymbol(symbolObj) {
  if (symbolObj.svgPath) {
    pendingSymbol = symbolObj.svgPath;
  } else {
    pendingSymbol = symbolObj.emoji || symbolObj.id;
  }
  pendingPhotoBlob = null;

  const labelInp = document.getElementById('modal-label-input');
  const ttsInp = document.getElementById('modal-tts-input');

  // Auto-fill label and TTS if empty
  if (!labelInp.value.trim()) {
    labelInp.value = symbolObj.label;
    onLabelSizeInput();
  }
  if (!ttsInp.value.trim()) {
    ttsInp.value = symbolObj.label;
  }

  updateModalPhotoPreview();
  closeSymbolLibrary();
  showToast(`Selected "${symbolObj.label}"`);
}
```

**Filter Implementation:**
```js
// lines 5252-5272
function filterSymbolLibrary() {
  const q = document.getElementById('sym-search-input').value.trim().toLowerCase();
  document.getElementById('btn-sym-clear-search').style.display = q ? 'flex' : 'none';

  let filtered = AAC_SYMBOL_LIBRARY;
  if (currentSymbolCategory !== 'all') {
    filtered = filtered.filter(s => s.category === currentSymbolCategory);
  }

  if (q) {
    filtered = filtered.filter(s => {
      if (s.label.toLowerCase().includes(q)) return true;
      if (s.id && s.id.toLowerCase().includes(q)) return true;
      if (s.category && s.category.toLowerCase().includes(q)) return true;
      if (s.rawCat && s.rawCat.toLowerCase().includes(q)) return true;
      return (s.keywords || []).some(k => k.toLowerCase().includes(q));
    });
  }

  renderSymbolLibrary(filtered, true);
}
```

---

### (4) Concretely: What it Takes to Showcase Search Symbols Inside the Tile Editor

Currently, the Tile Editor (`#editor-modal`) does not display symbols inline—it only has a preview box and a button that opens the external `#modal-symbol-library`.

To display and offer the searchable symbol set **directly inside the Tile Editor UI** (e.g. an inline search bar, real-time suggestion strip, or embedded symbol picker):

#### 1. Exact HTML Markup Changes
* **Location: [`index.html:2084–2109`](file:///home/mike/aac-board/index.html#L2084-L2109)** (inside `#editor-modal` > `.modal-body`):
  - Add an inline symbol search input (e.g., `#editor-sym-search-input`) with `oninput="onEditorSymbolSearch()"` or connect the existing `#modal-label-input` ([line 2042](file:///home/mike/aac-board/index.html#L2042)) to auto-suggest symbols matching the typed tile label in real time.
  - Add an inline scrollable suggestion strip or grid container (e.g., `<div id="editor-symbol-strip" class="sym-strip-container"></div>`).

#### 2. Exact Functions to Change or Add
1. **[`openEditor(slotId)`](file:///home/mike/aac-board/index.html#L4888-L4918)**:
   - Ensure `initSymbolLibrary()` is called if `AAC_SYMBOL_LIBRARY` is empty.
   - Populate the inline symbol suggestion strip/grid based on the button's current label or default core category.
2. **[`onLabelSizeInput()`](file:///home/mike/aac-board/index.html#L5380-L5393)** (or input listener on `#modal-label-input`):
   - When the user types a word in `#modal-label-input`, filter `AAC_SYMBOL_LIBRARY` against the input text and update the inline symbol suggestions dynamically.
3. **New / Adapted Selection Function (e.g., `selectInlineEditorSymbol(symbolObj)`)**:
   - Similar to [`selectLibrarySymbol()`](file:///home/mike/aac-board/index.html#L5227-L5250), sets `pendingSymbol = symbolObj.svgPath || symbolObj.emoji || symbolObj.id`, resets `pendingPhotoBlob = null`, updates preview via [`updateModalPhotoPreview()`](file:///home/mike/aac-board/index.html#L5424), and highlights the active symbol card in the editor—**without** closing `#editor-modal`.
4. **[`updateModalPhotoPreview()`](file:///home/mike/aac-board/index.html#L5424-L5449)**:
   - Update to visually reflect/highlight which inline symbol card is selected when `pendingSymbol` matches.
5. **[`saveEditorTile()`](file:///home/mike/aac-board/index.html#L5330-L5364)**:
   - Already persists `pendingSymbol` into `updatedTile.symbol` ([line 5344](file:///home/mike/aac-board/index.html#L5344)), so no changes to the save persistence contract are needed.

#### 3. Data Structures
* No schema migration is required: `AAC_SYMBOL_LIBRARY` ([line 5123](file:///home/mike/aac-board/index.html#L5123)) already contains the full array of emojis + Mulberry SVGs with search keywords, and the tile schema already natively supports SVG paths, emojis, and glyph strings in `tile.symbol`.�4**Analyzing the Foundation**
