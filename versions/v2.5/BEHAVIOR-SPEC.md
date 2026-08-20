# BEHAVIOR-SPEC — talk tiles (functional requirements)

Source: GoTalk Now demo video transcript (`/home/mike/talk-tiles-ref/transcript.txt`) + the 26 reference screenshots. Every item below MUST work in `index.html`. Audit each one; fix anything missing or broken.

## B1. Three page styles
- Standard pages (grid of buttons), Express (standard + top speech bar), Scene (photo + hotspots). All three must exist and be switchable.

## B2. Home screen
- Buttons: Player, Page Editor, Settings, Downloads, Help — each opens its view (Settings/Downloads/Help may be simple stubs but MUST open something visible). Feedback button works. "Default Book (Tap for More)" tappable.
- Orange home button in bottom bar returns to Home from ANY page/mode.

## B3. Bottom bar (user mode)
- Prev-page ◀ flips to previous page; page title shows current page name (e.g. "Colors", "School", "Yes/No Board"); undo/back arrow works; play button plays the page sequence (speaks all tiles in order); speech-bubble-! icon opens auditory cue controls.

## B4. Bottom bar (editor mode)
- ◀ prev page, orange home, sliders → Page Options popover, "Page N" label, layers/pages navigator → opens sheet listing ALL pages with jump-to-any-page, speech-! , orange + → New Page menu.

## B5. Page Options popover
- Background row → opens color picker (swatches tab: 16 swatches; Picker tab: hex input + "Set Via Hex" + spectrum). Selecting a color changes the page background IMMEDIATELY and persists.
- Buttons segmented control [1|2|4|9|16|25|36] → re-renders grid at that size, preserving existing tiles where positions allow.
- Express Page toggle ON → speech bar appears at top of user view; OFF → hidden.
- Enabled + Page Specific Scanning toggles persist their state.

## B6. Tile editing (standard pages)
- Empty editor cell shows "Tap to Add Button"; tapping opens tile editor.
- Tile editor: set background color, set border color, type label text (e.g. "eat"), add image (file input from photo library; camera if available; symbol set may be a small built-in emoji/symbol picker).
- Text can be repositioned within the button.
- Auditory cue per tile: Recorded Audio (MediaRecorder) OR Text-to-Speech string; in user mode tapping the tile PLAYS the cue (TTS speech or recorded audio).
- Tiles persist across reloads (IndexedDB or localStorage).

## B7. Express speech bar (sentence builder)
- With Express Page ON: tapping any tile speaks its cue AND appends a chip (label + thumbnail) to the top bar.
- Tapping the speech bar speaks all chips IN ORDER as one sentence.
- Red X button removes the last chip (repeated taps clear all).

## B8. New Page menu (+ button)
- Items: Online Gallery, My Templates, Import from Another Book, Duplicate Page, Page Wizard, Keyboard Page, Add Blank Scene Page, Add Blank Button Page.
- "Add Blank Button Page" and "Add Blank Scene Page" MUST actually create a new page (visible in pages navigator, navigable to). Duplicate Page must clone the current page. Others may show an informative toast but must not crash.

## B9. Scene pages
- Set background image (file input / take photo). Full-bleed display.
- Editor: tap small + → adds a rectangular hotspot; drag to move; 8 handles to resize; tap hotspot → context menu: Delete, Set Action, Set Auditory Cue (record or TTS), After Action, Disable.
- User mode: hotspots are invisible/subtle; tapping one highlights it (neon green) and plays its cue.

## B10. Set Auditory Cue modal
- Tabs: Recorded Audio | Text-to-Speech | None. Text input "What to say...". Buttons: Voice, Preview (speaks the text), Use Second Voice. Saving applies the cue to the selected tile/hotspot.

## B11. Communication book
- Multiple pages in one book; navigate with ◀ and the layers navigator; page order stable; works after reload.

## B12. "Complete" toast
- Shows on save/option change (white check + "Complete", auto-fade ~1.2s).

## Verification (REQUIRED)
Write `test_behavior.js` (puppeteer, same setup as capture_screens.js) that AUTOMATICALLY exercises:
1. Home → Player → Colors page: tap "Red" tile → assert speechSynthesis was called with "red" AND (if express on) chip appears; tap express bar → assert sentence spoken in order.
2. Grid size change 4→9→36 re-renders correct cell counts.
3. Editor: create a page, tap empty cell, set label "eat" + TTS cue, save → reload → tile still there and speaks on tap.
4. Express toggle ON/OFF shows/hides speech bar.
5. Scene page: add background, add 2 hotspots, set TTS cues, user-mode tap plays cue.
6. New Page menu creates a blank button page + duplicate page; pages navigator lists them.
7. Home button returns to home from editor and user modes.
Run it: `node test_behavior.js` — ALL checks must pass. Fix code until they do. Then re-run `node capture_screens.js` for fresh screenshots, commit everything with a clear message, and push.
