# CLAUDE TASK — Talk Tiles: visual-fidelity pass (UI polish)

You are Claude Code, working in `/home/mike/aac-board`. Hermes (the orchestrator)
will verify your work from disk afterward — do not claim success without durable
artifacts.

## Context (read these first, in order)
1. `GOAL.md` — mission: pixel-faithful GoTalk Now UI, app renamed "talk tiles".
2. `UI-SPEC.md` — the full visual spec derived from all reference photos + transcript.
3. `BEHAVIOR-SPEC.md` — B1–B12 functional behaviors (already implemented; do NOT break).
4. `comparisons/` — current side-by-side sheets (left = GoTalk Now reference, right = our UI).

Reference material:
- `/home/mike/talk-tiles-ref/gt-01.png` … `gt-26.png` — 24 unique GoTalk Now screenshots
  (some are video frames with YouTube chrome — ignore the player UI, only the tablet screen).
- `/home/mike/talk-tiles-ref/transcript.txt` + `video_info.md`.

## Your task: close every remaining visual gap
The current `index.html` is structurally correct and behaviorally complete (B1–B12,
test suite green), but may still have pixel-level gaps vs the references. Your job:

1. **Review** all 24 unique reference images with your vision. Map each to a screen/state
   in our UI (the mapping already exists in `comparisons/` — extend/correct it as needed).
2. **Capture** the current UI for every mapped screen/state using puppeteer
   (existing patterns: `capture_screens.js`, `test_behavior.js`; puppeteer lives at
   `/home/mike/browser-automation/node_modules/puppeteer`). Tablet landscape viewport,
   no scrollbars.
3. **Compare** each pair side-by-side and list concrete mismatches: colors (sample real
   hex from the refs), spacing, radii, icon shapes, font sizes/weights, text strings,
   border styles, bottom-bar layout, dialog styling.
4. **Fix `index.html`** until every mapped screen looks "just like it looks in the photo".
   Iterate: fix → re-capture → re-compare. Do not stop at "close enough".
5. **Rebuild** the comparison sheets (`compare_sheets.py` exists — reuse or improve) so
   `comparisons/` reflects the final state.
6. **Regression:** run `node test_behavior.js` — must stay green (8/8). If a visual fix
   breaks behavior, fix the behavior back.
7. **Ship:** commit with a clear message + push (git-over-SSH is configured; identity
   chris1987rob).

## Hard constraints
- Single self-contained `index.html`. App name stays "talk tiles".
- NO FLAG_SECURE / anti-spying / lockdown features — explicitly rejected by the owner.
- Screen tiles must stay interactive in user mode (no blocking overlay).
- Do not restructure working behavior (B1–B12); visual polish only, plus any small
  behavior fix a mismatch reveals (e.g. wrong string, wrong icon).
- Stay inside `/home/mike/aac-board` and `/home/mike/talk-tiles-ref` (read-only).

## Definition of done
- [ ] Every mapped reference screen re-captured after fixes
- [ ] `comparisons/` rebuilt with final side-by-side sheets
- [ ] `node test_behavior.js` passes 8/8
- [ ] Committed + pushed to GitHub

When everything above is complete, reply with exactly:
UI-PASS-DONE
followed by one line summarizing the biggest visual fixes you made.
