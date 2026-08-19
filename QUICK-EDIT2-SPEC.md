# QUICK-EDIT2-SPEC — Save menu, Sound It Out, Quick Color Scheme (GoTalk Now 7.0)

Follow-up to QUICK-EDIT-SPEC (already done, commit 30930d1). Reference frames from the GoTalk Now 7.0
launch video are saved in /home/mike/talk-tiles-ref/ — view them first:
- `gt7-frame-save-menu.png`   (Save menu: Save / Save & Previous / Save & Next / Save & Open Classic Editor)
- `gt7-frame-sounditout.png`  (Sound It Out action: syllable chips but·ter·fly, Preview Animation, Record with Animation, Learning/Learned tracker)
- `gt7-frame-colorscheme.png` (Quick Color Scheme · Classic — SUGGESTED: Orange + Apply, Fonts and Colors row)

## R1. Save menu (4 options)
Replace the current single Save button behavior in the tile editor modal with a small dropdown/menu that opens
on tap (or keep short-tap = plain Save AND add the menu via a chevron/long-press — pick whichever is cleaner, but
ALL FOUR options must be reachable):
1. **Save** — save and close (current behavior)
2. **Save & Previous** — save, open editor for previous slot on page
3. **Save & Next** — save, open editor for next empty slot (existing hold-to-save-next logic)
4. **Save & Open Classic Editor** — save, then open the full classic editor view (our existing detailed settings:
   colors, label size/position, audio). If our current modal already contains all of these, this option can jump to
   a "classic" layout mode of the same modal (two-column classic view) — do NOT build a second parallel modal.
Keep the long-press = Save & Next shortcut working (it's in test_quick_edit.js).

## R2. Sound It Out action type
Add a new action option in the editor's ACTION section alongside Speak Text / Recorded Audio: **Sound It Out**.
- When selected, show a syllable chip row for the current label word (e.g. "butterfly" → but · ter · fly).
  Syllabify offline with a simple heuristic JS function (split on vowel groups; handle common English patterns —
  it does not need to be linguistically perfect, just reasonable for common AAC words).
- **Preview Animation** button: plays the animation in place — highlight each syllable chip in sequence (~700ms
  each) while speaking that syllable via TTS, then speak the whole word.
- In PLAYER mode, tapping a tile whose action is Sound It Out runs the same animation on the board (big word +
  syllable chips overlay center-screen, auto-dismiss after ~3s).
- **Record with Animation** (optional if time-boxed): record mic audio while running the animation, store as the
  tile's audio; in player mode play the recording synced to the animation. If mic recording is too fiddly, leave a
  clearly-labeled stub that toasts "Recording coming soon" — but the TTS path MUST work.
- **Progress tracker**: three tiny states under the action (— / Learning / Learned), tap to cycle, persisted with
  the tile data. Purely informational.

## R3. Quick Color Scheme
In the editor modal, add a "Quick Color Scheme" row near the color pickers:
- Deterministic suggestion: hash the label word → pick a scheme from a fixed palette list of ~10 classic AAC
  schemes (name + bg + border + text colors; include an "Orange" scheme). Show as "SUGGESTED: <Name>" with a
  swatch.
- **Apply** button applies bg/border/text to the pending tile + preview updates.
- A "Fonts and Colors" link/row that expands to the existing detailed color inputs (reuse what's already there —
  don't duplicate).

## Tests
Extend `test_quick_edit.js` (or add `test_quick_edit2.js`) with Puppeteer checks:
1. Save menu opens and shows all 4 options; "Save & Next" opens next slot editor
2. Selecting Sound It Out on label "butterfly" renders 3 syllable chips; Preview Animation runs without JS errors
   (wait for completion, verify no console errors)
3. Progress tracker cycles — → Learning → Learned and persists across editor reopen
4. Color scheme row shows a SUGGESTED name; Apply changes the tile's bg color in preview
Run BOTH suites: `node test_quick_edit.js` AND the new one — all pass, zero regressions.

## Verify + ship
1. `node test_behavior.js` still 8/8
2. Both quick-edit suites pass
3. Screenshots: editor with Sound It Out selected (syllable chips visible) → `screenshots/quick-edit-sounditout.png`;
   save menu open → `screenshots/quick-edit-savemenu.png`
4. Rebuild APK: `bash build.sh`
5. Commit everything with message "Quick Edit 2: 4-option save menu, Sound It Out syllable animation, quick color scheme"
6. Push to GitHub
7. Print `QUICK-EDIT2-DONE` when finished
