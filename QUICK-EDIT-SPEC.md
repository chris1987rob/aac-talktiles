# QUICK-EDIT-SPEC — Live image suggestions in the Tile Editor (GoTalk Now 7.0 "Quick Edit")

Reference: screenshot `/home/mike/talk-tiles-ref/gt7-quick-edit.jpg` (from GoTalk Now 7.0 launch video,
transcript at `/home/mike/talk-tiles-ref/transcript-gotalk7.txt`).

## What the reference does (screenshot)
The tile editor is ONE consolidated screen ("Quick Edit", "Button 1 of 4"):
- LEFT: PREVIEW (live tile), BUTTON TEXT input, "Popular with other SLPs" chips (go, help, I, it, more, no, that, want, what)
- RIGHT: **IMAGE row** — as you type the button text ("tree"), matching images from ALL installed image
  libraries appear side-by-side in a horizontal strip (QuickPick English tree, several Emoji trees, Symbolsmith
  tree), each with its library name under it. Tap one → it becomes the tile's image.
- RIGHT: ACTION section — "Speak Text" with the typed word prefilled + **speech suggestion chips**
  ("I want to play in the tree.").

## Implement in `index.html` (tile editor modal, `openEditor()` at ~line 4061)

### Q1. Live image-suggestion strip (THE headline feature)
- Add a horizontal scrollable strip in the editor modal, labeled "IMAGE", above the photo/symbol picker area.
- On every input event in `modal-label-input` (debounced ~250ms), search BOTH libraries:
  - ARASAAC: `AAC_OFFICIAL_SYMBOLS` from `symbols_data.js` (3,436 entries, each has keywords) — match label word against id + keywords.
  - Emoji: `AAC_STARTER_EMOJIS` in index.html (has keywords).
- Show top ~12 matches as tiles: image (SVG for ARASAAC via `getSymbolSvg`, emoji char for emoji), tiny caption under each = library name ("ARASAAC" / "Emoji").
- Tap a suggestion → assign to tile exactly like the existing pickers do (set pendingSymbol / pendingPhotoBlob path + preview update), mark it selected.
- If the typed word has no matches: show a single muted "No images for 'xyz' — tap photo button to add one" hint.
- Reuse the existing keyword-matching logic from `filterSymbolLibrary` if it's reusable; otherwise write a small shared helper `searchAllLibraries(term)` returning `[{source:'arasaac', id, label, keywords}, {source:'emoji', ...}]`.

### Q2. Related-keyword expansion
- When searching, also match common related terms so "flower" finds flower-related symbols and "dog" finds puppy:
  implement a small built-in synonym map for the top ~40 AAC words (dog↔puppy/doggy, water↔drink, eat↔food/hungry,
  toilet↔bathroom/potty, sleep↔bed/rest, etc.). Keep it a plain JS object; no network.

### Q3. Speech suggestion chips
- Below the TTS input (`modal-tts-input`), when the label is non-empty show 2–4 tappable chips built from templates:
  `I want <word>`, `I see <word>`, `I like <word>`, `More <word> please`.
- Tap chip → fills the TTS input.

### Q4. "Popular" quick-word chips
- Under BUTTON TEXT, a static row of chips: go, help, I, it, more, no, that, want, what (exactly as in screenshot).
- Tap → appends/sets the label text (and re-triggers Q1 search + Q3 chips).

### Q5. Long-press Save = "Save & next"
- In the editor modal, long-press (600ms) on the Save button: save current tile AND immediately open the editor for
  the next empty slot on the page (wrap to first empty if none after). Short tap = normal save+close.
- Add a tiny hint text under the save button: "Hold to save & continue".

### Q6. Page-name suggestion (cheap win from same video)
- In the page wizard / page rename, when the page name field is focused and empty, offer 2–3 suggested titles derived
  from the page's tile labels (e.g. most common category word among tiles). One line of logic + a chip row. Optional if time-boxed.

## Rules
- Everything offline, no new dependencies. Keep existing behavior intact — this is additive to the editor modal.
- Match the app's existing visual style (colors, border radius, font sizes) — do NOT copy iPad styling; this is our Android look.
- Update `test_behavior.js` (or add `test_quick_edit.js`) with Puppeteer checks:
  1. typing "tree" in editor shows ≥1 ARASAAC suggestion and ≥1 emoji suggestion in the strip
  2. tapping a suggestion assigns it to the tile preview
  3. speech chips appear and fill TTS input on tap
  4. long-press save opens next empty slot's editor
  Run: `node test_quick_edit.js` — all must pass.

## Verify + ship
1. `node test_behavior.js` still passes (no regressions)
2. `node test_quick_edit.js` passes
3. Screenshot the editor with "tree" typed, showing the suggestion strip → `screenshots/quick-edit-tree.png`
4. Rebuild APK: `bash build.sh`
5. Commit everything (`index.html`, tests, screenshots, APK) with message
   "Quick Edit: live image suggestions from ARASAAC+emoji, speech chips, popular words, hold-to-save-next"
6. Push to GitHub
7. Print `QUICK-EDIT-DONE` when finished
