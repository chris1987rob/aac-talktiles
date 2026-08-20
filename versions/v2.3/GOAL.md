# GOAL — Talk Tiles: pixel-faithful GoTalk Now UI rebuild

## Mission
Rebuild the AAC board app at `/home/mike/aac-board/` so its UI looks **exactly like the
GoTalk Now app** in the reference photos. The app is renamed **"talk tiles"** everywhere.
"Pixel-faithful" means: just like it looks in the photo — layout, colors, icons, text,
spacing. Do not invent a new design language.

## Phase 1 — Reference review (MANDATORY before touching code)
Reference material:
- **GoTalk Now screenshots**: `/home/mike/talk-tiles-ref/gt-01.png` … `gt-26.png`
  (chronological; 24 unique — two pairs are duplicates). Many are video frames with
  YouTube player chrome around them — IGNORE the player UI, analyze only what's on the
  tablet screen.
- **Transcript**: `/home/mike/talk-tiles-ref/transcript.txt` (5:05, "How to Program the
  GoTalk Now App", Step Up AT for Early Literacy) + `video_info.md`.

Look at EVERY screenshot with your vision. Then write `/home/mike/aac-board/UI-SPEC.md`
covering, exhaustively:
1. **Screen inventory** — user-mode boards, home page, scene pages (photo background with
   hotspot tiles), editor mode (empty "Tap to Add Button" cells), Page Options dialog,
   color picker, New Page menu, Set Auditory Cue dialog.
2. **Bottom bar** — exact button order left→right, each icon, colors (the green/teal bar,
   the orange home button, layers/info/play icons), and the "Page N" label placement.
3. **Tiles** — grid sizes 1 / 2 / 4 / 9 / 16 / 25 / 36; tile borders/radii; editor-mode
   placeholder style; tile content (symbol + text); tile colors actually in use.
4. **Colors** — sample real hex values from the images: page background, bar green,
   orange home button, dialog greys, toggle greens, selected-chip green.
5. **Text** — every visible string verbatim ("Page Options", "Background", "Buttons",
   "Enabled", "Express Page", "Page Specific Scanning", "Scanning Auditory Cues",
   "Set Auditory Cue", "Recorded Audio / Text-to-Speech / None", "Voice", "Preview",
   "Use Second Voice", "Tap to Add Button", "Complete", etc.).
6. **Features from transcript** — standard pages, express page, scanning (page-specific),
   auditory cues (recorded / TTS / none), scene pages with hotspots, grid sizes 1–36.

## Phase 2 — Rebuild
Target: `/home/mike/aac-board/` — single self-contained `index.html` inside an Android
WebView wrapper. Restyle/restructure the UI layer to match `UI-SPEC.md`:
- App name → "talk tiles" (title, labels, anywhere it appears).
- Keep existing board data + navigation behavior working; this is a UI rebuild, not a
  feature rewrite.
- Landscape tablet layout, full-screen, no scrollbars on the board.
- Editor mode: dashed-border empty cells with "Tap to Add Button", Page Options dialog
  (Background color row, Buttons grid-size chips 1/2/4/9/16/25/36 with selected state,
  Enabled / Express Page / Page Specific Scanning toggles).
- User mode: colored tiles (symbol + text), scene pages with photo background + hotspots,
  bottom bar exactly per spec.

## Phase 3 — Verify + ship
1. Run the app (WebView or `python3 -m http.server` + browser at tablet viewport) and
   screenshot each screen type.
2. Compare side-by-side against the `gt-*.png` references. Fix mismatches until it looks
   "just like it looks in the photo". Iterate — do not stop at "close enough".
3. Commit + push to GitHub (git-over-SSH is configured on this box, identity chris1987rob).

## Acceptance criteria
- [ ] `UI-SPEC.md` written from all 24 images + transcript (Phase 1 complete)
- [ ] `index.html` restyled: bottom bar, tiles, dialogs, editor match references
- [ ] App renamed "talk tiles"
- [ ] Side-by-side screenshots demonstrate visual parity
- [ ] Pushed to GitHub

## Constraints
- Pixel-faithfulness is the #1 priority.
- Do NOT add FLAG_SECURE / anti-spying / lockdown features — explicitly rejected by owner.
- Screen tiles must stay interactive (no overlay that blocks touch).
