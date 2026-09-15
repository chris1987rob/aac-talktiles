# Talk Tiles — changelog

Package `com.aacboard.app`. Every version is signed with the same key
(`aac.keystore` in the project root), so a newer build installs straight over
an older one.

---

## v2.6 — 2026-09-13 (versionCode 9)

**Our own symbol pictures — the licensed Mulberry set is gone.** Every symbol in
the library is now an original illustration generated in-house on the RTX 3090
with Qwen-Image-2512 (4-step Lightning), in one consistent flat-vector style
(bold outlines, bright colours, transparent background so it sits on any tile
colour). No third-party symbol licence applies any more.

- **558 symbols in 16 categories** (was 320 emoji placeholders after the Mulberry
  removal; 3,436 Mulberry SVGs before that). Added ~240 words the set was missing:
  body parts, clothing, household objects, school vocabulary, more people, animals,
  vehicles, time words (today / tomorrow / morning / night), opposites (hot / cold,
  full / empty, clean / dirty…) and everyday phrases ("I'm done", "say it again",
  "leave me alone", "can I?").
- **Symbols page is categorised**: 17 filter chips (All + 16 categories, each with a
  count) and, in the "All" view, a header per category. The five categories added
  last time (Vehicles, Nature, Numbers, Colors, Social) finally have chips.
- **Hear any symbol**: the 🔊 button on every card (library and the inline strip in
  the tile editor) speaks the word with the app voice; picking a symbol also speaks it.
- **Search is ranked, not just filtered**: "dog" puts Dog before Hot Dog, "bus" the
  School Bus before the Bus Driver. Exact word → keyword → prefix → substring.
- **Old tiles keep working**: a tile saved with a Mulberry path
  (`symbols/en/<name>.svg`) is mapped at render time onto the in-house picture with
  the same name (`legacyMulberryToModern()`), or the word's emoji, or just its label.
  Nothing in storage is rewritten.
- Built-in **Core Words** template and the five **Online Gallery** boards use catalogue
  ids, so they draw the new pictures; `resolveSymbolToken()` now prefers a catalogue
  picture over the hard-coded legacy glyphs.
- Pictures are 384 px WebP with alpha (`symbols/modern/<id>.webp`, ~20 MB total),
  emoji kept as the `onerror` fallback. Generator + prompts live in `symbol_gen/`
  (re-run `gen_symbols.py --only <id> --force` to redo one picture).
- iPad edition: same changes in both copies; service-worker cache bumped to v2 so an
  installed iPad drops the stale index/catalogue.
- Tests updated for the new catalogue (library ≥ 500, 17 chips, 34 pictured Core Words).

**Voice sync (2026-09-14).** Chris: "the voices are out of sync — they say the word
but it's like AFTER." Three things added up to the lag and all three are fixed:

- **The player.** A tap did `new Audio(url).play()` cold: the WebView had to open
  the file, decode it and bring up a media player before the first sample, on
  every tap. The board now decodes the clips for the page on screen (and its
  neighbours) ahead of time — XHR → `decodeAudioData` → `AudioBuffer`, LRU of 160 —
  and a tap starts an `AudioBufferSourceNode`, which begins on the audio thread's
  next quantum. Measured JS-side tap→start: 0.2–0.6 ms (was a cold element open).
  The `<audio>` element remains the cold-start fallback and plays at once while
  the buffer warms. Tile recordings (Blobs) use the same cache. The
  `AudioContext` is resumed on the very first pointer so no tap pays for it.
  `MainActivity` sets `setAllowFileAccessFromFileURLs(true)` so the packaged app
  can read its own clips with XHR.
- **The gesture.** Tiles played on `pointerup`; the whole finger-down time sat
  between the tap and the word. Play mode now fires on `pointerdown` (edit mode
  still opens the editor on release; a release with no press — synthetic or
  assistive input — still plays once).
- **The clips.** The TTS + "recorded"/--room chain left 60–260 ms of dead air in
  front of every word (median 112 ms) and it was in the raw WAVs, not added by
  LAME (whose 46 ms priming Chrome's decoder trims). `symbol_gen/encode_clip.py`
  now trims to the first 5 ms window above −40 dB RMS, keeping 20 ms: leads are
  p50 21 ms / p99 68 ms / max 136 ms. Peak-per-sample detection was tried first
  and rejected: it fires on room-tone spikes, and the 20 ms RMS default ate the
  /k/ burst off "clap". `gen_audio.py` uses the same encoder. The un-trimmed
  bella set is kept in `symbol_gen/audio_mp3_bella_untrimmed/`.
- **Every tile speaks Bella.** A tile used to get the clip only if it carried a
  library picture with the catalogue phrase. Now any tile or hotspot whose phrase
  matches a catalogue phrase (`clipForPhrase`, keyed by what the clip actually
  says) plays the clip; the express bar chains clips when every chip has one.
  74 phrases the built-in boards speak that no symbol says verbatim ("help",
  "more", "My Schedule", the gallery sentences, the scene-preset hotspots) were
  rendered by `symbol_gen/gen_phrases.py` into `symbols/audio/phrases/` and are
  registered as `AAC_PHRASE_CLIPS` in `symbols_data.js`. All 135 built-in phrases
  now resolve to a clip (2,284 clips total).
- **Checkers.** `symbol_gen/check_audio.py` (ffmpeg silencedetect) flags any clip
  with > 150 ms before the first −30 dBFS sample, silent or short clips, and
  catalogue entries whose file is missing. New suite `test_voice.js` (11 checks):
  real-click tap→start latency < 15 ms on the buffer path, press-not-release,
  one-voice-at-a-time, cold path, Blob path, 100 % built-in phrase coverage, Core
  Words says exactly its words, and an in-browser decode of all 2,284 clips
  asserting lead ≤ 150 ms / duration ≥ 0.2 s / peak ≥ −20 dB.
- **Build.** `build.sh` staged assets with `cp -r` into an existing directory,
  which nested a second `symbols/symbols/` and never refreshed the tree — a v2.6
  build would have shipped without pictures or clips. It now rebuilds
  `assets/symbols` from `modern/` + `audio/` only (no Mulberry `en/`).
- **Gap taps (follow-up, same day).** Chris: "you press between tiles and it plays
  the NEXT symbol's word." Reproduced with real touch input: Chromium's
  touch-target adjustment snaps a finger that lands in the 12 px gap onto the
  nearest tile and delivers `pointerdown` there (the next tile across, or the one
  below) — with the finger's true coordinates. A tile now accepts a press only if
  those coordinates are inside its own box; gaps do nothing. For the synthesised
  `click` Chromium also moves the coordinates inside the target, so an empty
  slot in edit mode opens its editor only after a `pointerdown` that really landed
  in it. `test_voice.js` check 11 taps the column gap, row gap and grid corner
  through the real touch pipeline (nothing plays), every tile at its centre and
  all four edges (its own word), and a gap in edit mode (no editor). 112/112.
- Tests that stubbed `speechSynthesis.speak` now read the app's own speech log
  (`__spokenHistory`, fed by both paths), as `test_templates` already did.
  **111/111 across 9 suites.** iPad edition: same script + clips in both copies,
  service worker cache v7.

---

## v2.5 — 2026-08-20 (versionCode 8)

**Persistence rebuilt & real controls.** Fixes the P0 data loss bug where saving a
photo serialized a Blob to `{}` in localStorage and bricked board rendering on the
next launch. All placeholder and decoration-only controls are now fully functional.

- **Safe multi-page persistence (P0-1 & P0-2)**:
  - Blobs (photos & audio recordings) live exclusively in IndexedDB (`tiles_v2`).
  - Page records in localStorage carry lightweight `hasPhoto`/`hasAudio` boolean
    flags; `hydratePagesFromCache()` re-attaches blobs on startup.
  - IndexedDB is keyed by `pageId:slot` (was slot alone), preventing slot 4 on
    page 1 from overwriting slot 4 on page 2.
  - Non-destructive migration (`talk_tiles_tilestore_migrated`) automatically
    adopts legacy v1 slot-keyed records onto page 1 while leaving legacy stores in place.
  - Object URLs are safely cached per Blob via `WeakMap` in `tilePhotoUrl()`,
    preventing race conditions and `ERR_FILE_NOT_FOUND` errors.
  - Monotonic `nextPageId()` (`(Math.max(...ids) || 0) + 1`) prevents page ID collisions
    when pages are deleted and added.

- **Gallery & wizard templates painted (P1-1)**:
  - Normalized `color` → `bgColor` and `wordSize` → `labelSize` across all 5 Online
    Gallery boards and Page Wizard presets.
  - Resolved bare-word symbol names to real Mulberry SVG paths (`symbols/en/*.svg`)
    or standard emojis (remapping tokens without exact Mulberry matches like `angry`
    and `wave`). All 94 template tiles now paint backgrounds and icons cleanly.

- **Controls made real (P1-4, P1-5, P2-4)**:
  - **Voice / Use Second Voice**: Opens a system voice picker modal and configures
    real `SpeechSynthesisVoice` objects that `speakText()` applies.
  - **Page-specific scanning**: Implemented a step scanning cursor engine that
    highlights candidate buttons/hotspots on interval and selects via tap or Space/Enter.
  - **Auditory cues**: Plays TTS or recorded auditory cue upon navigating to a page
    (once per visit, never on silent pages, suppressed in editor).
  - **Share button**: Exports the active page as JSON.
  - **Grid size 12**: Added a `12` (4×3) segmented control to the Page Options selector.
  - Dead hidden Jump button removed.

- **Tests: 100/100 across 8 suites** (was 85/85 across 7 suites):
  - Added `test_persistence.js` (15/15 checks) covering Blob storage survival across
    reloads, multi-page store keying, defensive unreadable record skips, monotonic IDs,
    gallery/wizard rendering, scanning cursor lifecycle, voice selection, JSON export,
    and legacy v1 migration.
  - `test_buttons.js` presses 240/240 declared buttons with onclick handlers.

APK: `AAC-Board-v2.5.apk`, 24,862,415 bytes.

---

## v2.4.1 — 2026-08-20 (versionCode 7)

**The symbol library is now inside the tile editor.** Editing a button used to
mean tapping "Search Symbols & Photos", waiting for a full-screen modal on top
of the editor, searching, picking, and being dropped back. The 3,609-symbol
catalogue is the best thing the app has and it was hidden behind a door. It is
now a scrolling strip of cards in the editor itself:

- **Seeded from the tile's own label.** Open the editor on a button labelled
  "apple" and the strip already shows apple symbols. With no label it leads with
  the 173 starter icons rather than an alphabetical slice of 3,600.
- **Filters as you type the label.** `#modal-label-input` now runs
  `onEditorLabelInput()`, which refreshes the strip alongside the size preview.
- **Its own search box** for when the label and the picture differ ("juice" on a
  button labelled "drink"). A search the adult typed wins over the label; the ✕
  clears it and the strip falls back to the label.
- **Picking never interrupts the edit.** `selectInlineEditorSymbol()` sets the
  symbol, drops any staged photo, fills a blank label/TTS (and leaves a written
  one alone), updates the preview and highlights the card. No modal closes, no
  modal opens.
- **The strip always states what is set.** The symbol already on the button is
  pinned first and shown selected, even under a search that cannot match it —
  so the strip answers "what is on this button?" as well as "what could be?".
- The full-screen library is still there, one tap away, relabelled **Browse All
  Symbols**.

Sized for a 7–8" tablet: 96px cards, horizontal scroll, and the editor modal
widened from 480px to 640px so six cards are visible at once instead of three.
The old and new pickers share one matcher (`searchSymbolLibrary()`), so a query
behaves identically in both.

No schema change: `tile.symbol` already accepted an SVG path, an emoji or a
glyph, and `saveEditorTile()` already persisted `pendingSymbol`.

**Tests: 85/85 across seven suites** (was 81/81). `test_button_editor.js` grew
from 6 checks to 10: the strip is seeded from the tile label with no second
modal open; it re-filters live as the label is retyped; a symbol search
overrides the label and clearing it falls back; a dud query explains itself; a
tap sets the symbol in place with exactly one card highlighted, a staged photo
dropped, a blank label filled and a written TTS cue preserved; Save persists it
and reopening highlights it even under a query that cannot match it.
`test_buttons.js` covers the new ✕ and now presses 236/236 declared buttons.
Everything else unchanged and green: `test_headless.js` 22, `test_behavior.js`
8, `test_photo_library.js` 6, `test_templates.js` 11, `test_scenes.js` 9,
`test_buttons.js` 19.

APK: `AAC-Board-v2.4.1.apk`, 25,420,278 bytes — 4 KB over v2.4. Not installed:
no device connected, so the strip has only been used at 1024×768 headless.

---

## v2.4 — 2026-08-20 (versionCode 6)

**Built-in page templates.** "New Page → My Templates" now opens with eleven
templates already in it, ahead of anything the user has saved. They are code,
not storage: they cannot be deleted, they cost nothing to restore, and clearing
the app's data does not lose them.

- **Core Words (Classic)** — the board from Chris's reference video, rebuilt as
  a 48-button page: navy control row across the top (back, go, stop, yes, no,
  help, more, all done), a lavender pronoun column down the left, four green
  verb columns, blue describers, white function words, and a teal social column
  on the right. 27 of the 48 tiles carry a real Mulberry pictogram; the abstract
  words are text-only, as they are on the reference board.
- **Yes/No Board** — the two-button teal board, mirroring the one in the
  default book.
- **Blank 1 / 2 / 4 / 9 / 16 / 25 / 36** — an empty page at every grid size.
- **Visual Scene (Blank)** and **Keyboard Page**.

Built-ins are listed first, tagged "Built-in" and shown without a delete button;
`deleteCustomTemplate()` refuses a built-in index outright rather than relying on
the missing button. The user's own templates follow, still saved, used and
deleted exactly as before.

**New grid size: 48 (8 × 6).** Added to `getGridDimensions()` with a matching
segment in Page Options. The reference board is roughly 10 columns × 8 rows and
runs off the edge of the video frame; 8 × 6 is the densest grid Talk Tiles can
render with a label that is still readable.

**Fixed while in there:** the My Templates rows were inheriting
`flex-direction: column` from `.editor-section`, so every row stacked its title
above its button instead of putting the button on the right. Also "1 Buttons" →
"1 Button".

**`versions/v2.3/` now exists.** v2.3 shipped on 2026-08-20 and was never
archived; the snapshot was cut from the live tree before any of the above was
written, so its `index.html` is exactly what produced `AAC-Board-v2.3.apk`. Its
`symbols/` is a symlink to the project copy — the 3,436 Mulberry files have not
changed since v2.3, and `build.sh` now copies them with `cp -rL` so a rebuild
from an archive still gets real files.

**`UPGRADES.md`** — a full audit of the prototype: feature inventory, what is
broken or only pretending to work, and a P0/P1/P2 upgrade list. The headline is
a **P0 confirmed in headless Chrome: saving a photo to a tile takes the whole
board down on the next launch.** `saveTileToDB()` puts the photo `Blob` into
`pages[i].tiles[slot]` and `savePagesToStorage()` JSON-stringifies it to `{}`;
on reload `URL.createObjectURL({})` throws inside `renderGridPage()` and the
grid renders zero tiles. Not fixed in this release — it needs the persistence
layer reworked, and v2.4 was scoped to templates. It is P0-1 in `UPGRADES.md`.

### Scenes across a mixed book

Chris asked for scene pages to be proven to work alongside standard and express
pages. Three real defects came out of it, all fixed:

- **Scene pages leaked into every page after them.** `#scene-image` and
  `#scene-hotspots-container` are singletons shared by every scene page, and
  only the scene branch of `renderCurrentPage()` ever touched them. A scene's
  photo stayed in the `<img>` and its hotspot `<div>`s stayed in the DOM while a
  standard page was on screen — hidden, but still id-addressable and still
  clickable — and a scene with no photo of its own showed the previous scene's.
  New `clearSceneView()` wipes both whenever a non-scene page renders.
- **Saving a scene page as a template threw away its photo.**
  `saveCurrentPageAsTemplate()` copied the hotspots but not `sceneBg`.
- **Every page made from a template was silently an express page.**
  `useCustomTemplate()` hardcoded `express: true`. It now carries the template's
  own `express`, `enabled` and `sceneBg`, so a scene page from a template has
  the same shape as one from `addNewScenePage()`.

Core Words (Classic) is now an express page on purpose — the reference board has
a message window across the top, and that is what the express speech bar is.

### Other fixes found by pressing every button

- Six Online Gallery tiles pointed at Mulberry files that are not in the set
  (`calm`, `doctor`, `ear_protectors`, `napkin`, `receipt`, `teacher`), so the
  Medical / Feelings / Dining / School boards shipped with broken images. They
  now point at ids that exist.
- The express speech bar rendered every symbol that was not `smile` or `frown`
  as a star — 48 identical stars on a core board. Chips now show the tile's own
  Mulberry SVG or emoji, which is what BEHAVIOR-SPEC B7 asked for.
- `playHotspotRecordedAudio()` and `togglePlayAudioPreview()` called
  `audio.play()` with no `.catch`, so a preview cut short surfaced as an
  unhandled `AbortError`.
- The Settings dialog still said "v2.3".

**Tests: 81/81 across seven suites.**

- `test_templates.js` (11) — the built-in list, the Built-in badge, the absent
  delete button, the refusal in `deleteCustomTemplate()`, the 48-button Core
  Words page and its colours, the blank/scene/keyboard shapes, the user
  save→use→delete round trip, the 48 segment button, **a tap on each of the 48
  Core Words tiles asserting the exact word spoken**, and the express bar
  playing all 48 back in sequence.
- `test_scenes.js` (9, new) — a six-page book of every page type; each scene
  keeps its own background and hotspots across page switches; every scene's
  hotspots fire their own cue and none survive onto another page; an express
  scene chips its hotspots and plays them in sequence; a template scene page is
  shape-identical to a manual one; a saved scene template round-trips its photo;
  the whole mixed book survives a reload.
- `test_buttons.js` (19, new) — **presses all 235 elements in `index.html` that
  carry an `onclick`, as real DOM clicks, and fails if any was never pressed.**
  Home screen, bottom toolbar in both modes, Page Options, all 16 colour
  swatches, the New Page menu, the pages navigator, the tile editor (including
  record/stop/preview via a fake mic), the symbol library's 12 chips, the
  auditory-cue modal, the page wizard, the online gallery, import/export, the
  templates modal, the scene picker and hotspot editor, all 29 keyboard keys and
  9 quick phrases, the express bar, and the full-screen camera through a fake
  camera device. Zero JS errors and zero failed resource loads are themselves
  assertions.
- Unchanged and green: `test_headless.js` 22/22, `test_behavior.js` 8/8,
  `test_button_editor.js` 6/6, `test_photo_library.js` 6/6.

APK: `AAC-Board-v2.4.apk`, 25,416,182 bytes (24.2 MB) — 4 KB larger than v2.3.
Not installed on a device: the phone was not connected for this release, so the
48-button grid has only ever been looked at headless at 1280x800.

---

## v2.3 — 2026-08-17 (versionCode 5)

**Automatic background removal is gone.** Chris's call: ship without it. The
whole feature — the neural model, the ONNX runtime, the colour flood-fill
editor, the erase/restore/brush tools, White/Black/Original — is removed from
the app and archived complete under `versions/v2.2/` (sources, assets, APK and
its two test suites), with a README covering how to rebuild it.

Headless suite: 22/22. **Verified on the Pixel 8 Pro**: 12 checks on the camera
path and 8 on everything else — layouts, Lock, the edit lock, Unlock, word size.

### What taking a photo does now
Open the camera, shoot, and you get the photo full screen with **Retake** and
**Save to tile**. That is the entire flow.

- APK: **7.3 MB -> 37.7 KB**. `index.html`: 147 KB -> 76 KB.
- Capture is ~70 ms, against ~250 ms in v2.1 and ~2.1 s in v2.2.
- `setAllowFileAccessFromFileURLs(true)` is reverted — it existed only so the
  model could read its own assets, and it is not a setting to leave switched on
  for no reason.
- `build.sh` clears `app/assets/assets` on every run, so a stale build tree
  cannot quietly put 15 MB back into the APK.

### Kept
The save-race fix stays: `saveEditorTile()` still waits on `pendingPhotoWrite`
before reading `pendingPhotoBlob`. Canvas -> JPEG is asynchronous whether or not
anything has been done to the photo, and without the wait a tile saved straight
after shooting stores the *previous* photo, silently. The headless suite now
covers exactly that.

### Data loss during this release — one tile
While testing on the device, a cleanup script deleted "slots 11 and 12" on the
assumption that anything past Chris's ten tiles was a test tile it had made. It
was not: a real tile ("Basketball", a photo and his own voice recording) had
been created on slot 11 in between two test runs and was destroyed. It is not
recoverable — IndexedDB has no undelete, the blob URL is revoked on delete, and
the app is not debuggable so the store cannot be read from the filesystem.

Cleanup must identify what it deletes rather than infer it from a slot number:
record the id **and** the label at creation and delete only that exact pair.

## v2.2 — 2026-08-17 (versionCode 4)

Background removal now runs a real segmentation model. Suites: 26/26
(`test_headless.js`), 31/31 (`test_bgeditor.js`), 17/17 (`test_segmentation.js`,
new). **Verified on the Pixel 8 Pro**: 10/10 on-device checks, Chris's 10 tiles
untouched, test tile created and deleted.

### Why the colour approach could only go so far
v2.1 decided what was background by asking "is this pixel similar to the one
next to it". That is genuinely good on an object photographed on a table, and it
cannot ever work on a child at a playground, because colour similarity has no
idea what an object *is*. Every app that does this convincingly — iOS subject
lift, Canva, Photoshop — runs a trained model. So this one does now too.

**U²-Net (4.6 MB) is bundled in the APK** and runs through ONNX Runtime's WASM
build. Nothing is downloaded and nothing is uploaded; the board stays completely
offline, which is the point of the app.

### The model is the semantics, not the finish
It returns a blurry 320×320 opinion. That gets upsampled and then snapped onto
the real edges of the photo with a **guided filter**, which solves per
neighbourhood the linear map from the photo's own luminance to the mask that
best explains it. Semantics from the model, geometry from the photo.

### Subject first, background second
Chris put it exactly right: the program should find the thing in the photo and
then make the background, and the old way round it. The colour pass is now the
answer of last resort rather than the first thing tried:

1. The model is loaded and warmed **at app start**, while the board is on
   screen, so by the time a photo is taken only inference is left to do.
2. The editor opens on the **photo exactly as it was shot** — ~220 ms — with
   "Finding the subject…". Nothing half-cut is shown, because an answer that
   appears instantly and then changes under you reads as a glitch even when the
   second answer is the better one.
3. The subject cut lands ~1.7 s later.
4. The colour pass runs only if there is no model, it will not start, it takes
   longer than 12 s, or it comes back with something that is plainly not a
   cut-out. Falling back is a real code path with its own tests.

Every manual tool works identically on either mask. The amount slider and Reset
are disabled while the model is thinking — there is nothing for them to act on
yet, and letting them run in that window meant a stray touch could cancel the
model that was about to answer.

The "how much to remove" slider now re-cuts the model's matte at a new
threshold, which is one pass over one array (~40 ms on the phone), so it stays
live under the finger instead of throwing the model's answer away.

### On-device numbers (Pixel 8 Pro)
    editor opens (photo shown)  ~220 ms
    subject cut appears         ~2.1 s
    model inference             ~1700 ms
    slider re-cut               ~40-65 ms
    APK                         7.3 MB

### Loading a model from a file:// page
Three things had to line up, and each of them silently disables the model:
- **ONNX Runtime is pinned to 1.17.** 1.20 loads its WASM glue as an ES module,
  and a bare module specifier cannot be resolved from `file://` at all.
- **The .wasm is read by XHR and handed back as a blob: URL.** The runtime wants
  to fetch its own binary, and a `file://` page cannot fetch anything — not even
  its own directory.
- **`setAllowFileAccessFromFileURLs(true)`** on the WebView, or the assets are
  cross-origin to their own page and the read is refused. Without it the model
  works perfectly in a desktop browser and never loads on the phone.

### Bugs found while wiring it up
- **"Fit subject" cropped the photo and the mask but not the matte**, so the
  next touch of the slider re-cut against the wrong geometry. Undo had the
  mirror-image version of the same bug. Both now carry the matte.

## v2.1 — 2026-08-17 (versionCode 3)

Rebuilt the background editor. Headless: 26/26 (`test_headless.js`) plus 31/31
(`test_bgeditor.js`, new). **Verified on the Pixel 8 Pro**: 10/10 on-device
checks, Chris's 10 tiles untouched throughout, test tile created and deleted.

### Why it needed rebuilding
v2.0 did one border flood fill and offered one slider. It failed on the three
things that actually happen when you photograph something for a tile:

- **The object touches the edge of the frame.** The fill seeds from every border
  pixel, so it started *inside* the object and flooded outward through it. No
  slider position could help, because the object was a seed. A subject standing
  on the bottom of the frame was destroyed 100% of the time.
- **A patch of background survived** (a second surface, or the hole under a mug
  handle that no border fill can reach) and there was no way to remove it.
- **The cut was 1-bit**, so every edge was a staircase with a fringe of old
  background colour around it.

And "Undo" meant "throw the whole thing away".

### What it does now
It keeps a **mask** rather than a picture. `ED.hard` is the 0/255 decision per
pixel; `ED.mask` is that decision dilated and blurred, and is the only thing the
renderer reads. Every tool edits `ED.hard`, so softening is recomputed rather
than accumulated and undo is one byte array.

- **Seeds are filtered by colour.** Border pixels are grouped, and a group only
  seeds the fill if it owns a corner of the picture or covers a fifth of the
  perimeter. An object poking through the frame edge is a short run of a colour
  that owns no corner, so it seeds nothing and survives. Dropping a group is
  safe even when it was background — seeds are only starting points.
- **Tap to erase, tap to restore.** A tap floods the colour region under the
  finger; a drag paints with a brush. Erase only touches kept pixels and restore
  only touches removed ones, so taps converge instead of fighting each other.
- **Automatic tolerance.** A thumbnail search proposes a neighbourhood, then
  four real full-resolution passes are scored on the mask you will actually see.
- **Honest about failure.** Some photos have no isolatable subject. The cut is
  computed either way and simply not applied — the editor opens on the untouched
  photo and says so, instead of on a nearly blank frame.
- **Anti-aliased edges**, multi-step undo, Reset, **Fit subject** (crop to what
  survived), pinch-zoom and pan, and White / Black / **Original**.

### The measurement that made it work
Whether a cut is good is `boundaryContrast`: how hard the picture disagrees with
itself along the cut, relative to its own average gradient. Removing a
background leaves a cut along the object's outline, where the picture changes
sharply; eating into the object leaves a cut through skin or a shirt, where it
barely changes. Every cheaper metric is blind to this — on a dim selfie the
removed fraction looked reasonable, the middle of the frame survived and what
was left was one connected blob, all while the fill was taking the shirt, the
hair and half the face.

Two calibration bugs found by measuring rather than assuming:
- The centre of the frame was being **scored** rather than used as a gate, so a
  pass that removed nothing scored highest for doing nothing. Every photo picked
  the gentlest setting.
- `edgeFit` was normalised by 3 when real cuts run 3–10x the average gradient,
  so it pinned at 1.0 for every candidate and the term did nothing at all.

### Bugs fixed on the device that headless never saw
- **`setPointerCapture` throws `NotFoundError`** in this WebView, and the throw
  aborted the whole `pointerdown` handler — no stroke started, no pointer
  registered. Erase, restore, tap and pinch all went silently dead. Now wrapped:
  a convenience must not be able to kill every tool.
- **Saving raced the edit.** `saveEditorTile()` read `pendingPhotoBlob`
  synchronously while canvas → JPEG was still in flight, so a tile saved right
  after editing stored the photo as it was *before* the background was removed —
  silently, with no error. Confirmed on device (2.8 MB original vs 101 KB edit);
  the write is now awaited.
- Opening the editor on a second photo showed the **first photo's canvas** until
  the new one decoded, and a tap in that window edited the wrong mask.

### Testing
`test_bgeditor.js` builds scenes with a known correct answer — gradient
lighting, sensor noise, a drop shadow, a subject on the frame edge, a held
object, a two-surface background, a mug-handle hole, a blurred object, low
contrast, and a full-resolution photo-like scene — and scores the mask against
the truth (IoU, background removed, subject kept). Auto scores IoU 0.96–1.00 on
all of them. It also ran against 11 real photos pulled from Chris's own camera.

## v2.0 — 2026-08-17 (versionCode 2)

Headless suite: 26/26 (`test_headless.js`).
**Verified on the Pixel 8 Pro 2026-08-17**: installed over v1 with all of Chris's
tiles (photos + voice) intact; layouts, tile playback, pinning, the edit lock,
unpin, the full-screen camera, and white/black background fill all exercised on
the device. See "Unlock and the lock screen" below.

### Unlock and the lock screen (device setting, not app code)
Unpinning was sending the phone to the **lock screen**, which is what made Unlock
look like the app quitting. Android's `LockTaskController.shouldLockKeyguard()`
reads `lock_to_app_exit_locked`; when that setting is unset it falls back to "is
the lock screen secure", which it is on this phone, so the system calls
`lockNow()` on unpin. The app's re-front worked — it just landed behind the
keyguard. Fixed by setting the Android toggle:

    adb shell settings put secure lock_to_app_exit_locked 0

(Settings → Security & privacy → More security & privacy → App pinning → "Ask
for PIN before unpinning" = off.) Trade-off: unpinning no longer requires the
PIN, so pinning is a weaker child-lock. Revert with `... lock_to_app_exit_locked 1`.

Note: the first time Lock is tapped, Android shows a one-time "App is pinned"
sheet — pinning only engages after tapping **Got it**.

### Tile photo editor: white *or* black background, on any photo
- The background flood fill is no longer white-only. `whitenBackground()` became
  `fillBackground(src, tolerance, [r,g,b])`, and the full-screen photo editor
  now offers **White BG / Black BG / Undo**, with the active fill outlined.
- Every pass re-runs against the untouched original, so white ↔ black ↔ undo
  costs nothing and never compounds. The tolerance slider re-applies whichever
  fill is currently on.
- New **"Edit Background"** button in the tile editor opens that same
  full-screen editor on the photo the tile *already* has — including one picked
  from the gallery, which previously could not be filtered at all. "Retake"
  hides when the camera is not where the photo came from.

### Lock
- **Unlock no longer looks like the app quitting.** Android treats
  `stopLockTask()` as "leave this pinned task" and drops the user at the
  launcher; the activity was never dying. `bringSelfToFront()` now re-fronts it
  350 ms after unpinning, and the activity is `launchMode="singleTask"` so that
  can never spawn a second copy.
- `onResume()` asks `ActivityManager.getLockTaskModeState()` for the real state
  and pushes it into the board, so leaving pinning with the system's own
  back+overview gesture cannot strand the board in a locked state.
- **Lock now locks editing too**: while pinned, layout buttons 1/2/3 and Edit
  are disabled, the tile editor refuses to open, and an in-flight edit session
  is closed. **Tiles keep playing normally while pinned** — unchanged.

### Per-tile word size
- The tile editor has a **"Word size on the tile"** slider (0.6×–3×) with a live
  preview of the actual caption at that size.
- Stored as `labelSize` on the tile record; tiles saved before v2 default to 1×.
- Applies to the caption over a photo *and* to the text on a photo-less tile.
- `.tile-label` now wraps instead of ellipsising, so a scaled-up word is not
  clipped to one line — it wraps at **spaces only**, never mid-word.
- The slider is a request, not a promise: a label is capped at 55% of the tile
  and `fitTextToBox()` shrinks it until it actually fits, so a big word can
  never spill off the top of the tile. Caught by on-screen review at 412px —
  before the fit pass, "I want more please" at 2.4x ran off the tile and broke
  into "ple/ase".
- The editor's preview box is sized from a REAL tile's label area in the current
  layout and fitted the same way, so the preview is honest about what fits.
- The fit pass re-runs after layout settles (double rAF) and on resize/rotation,
  and always restarts from the requested size so it can grow back. Without this,
  a cold WebView start measured labels against an unsettled grid and locked them
  small for the whole session — caught on-device, where a 1x "MILK" rendered
  visibly smaller on the first launch after install than on every later launch.

### Build
- `build.sh` is parametric: version knobs at the top, all paths derived from the
  script's own location, so a version snapshot can rebuild itself in place.

---

## v1.0 — 2026-08-16 (versionCode 1)

Archived, source and APK, at `versions/v1/`. See `versions/v1/README.md`.

The original board: three layouts (2×2 / 3×3 / 4×3), photo + voice recording per
tile, IndexedDB persistence, full-screen camera with a white-background flood
fill on a fresh capture, and Lock = Android app pinning with the board left
fully usable.
