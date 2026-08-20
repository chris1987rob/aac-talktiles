# Talk Tiles — Template Feature + Audit + v2.4 Release

Project: `/home/mike/aac-board` (live tree = v2.3, versionCode 5).
Phone is NOT connected — do NOT attempt any adb work. Codebase + APK only.

## Context you need
- Single-file app: `index.html` (~5,460 lines) + `symbols_data.js` (3,436 Mulberry AAC symbols) + `symbols/`.
- Template machinery already exists in `index.html`:
  - `STORAGE_TEMPLATES_KEY = 'talk_tiles_custom_templates'`, `getCustomTemplates()`, `saveCustomTemplates()`, `openMyTemplatesModal()`, `renderMyTemplatesList()`, `saveCurrentPageAsTemplate()`, `useCustomTemplate(idx)`, `deleteCustomTemplate(idx)`.
  - "New Page" popover (id `popover-new-page`) has a "My Templates" menu item → opens modal `modal-my-templates` with list `my-templates-list`.
  - Tiles support: `label`, `tts`, `bgColor`, `labelColor`, `labelSize`, `symbol` (look up symbol ids in `symbols_data.js`).
  - Grid sizes supported by `getGridDimensions()`: 1, 2, 4, 9, 12, 16, 25, 36. Page Options popover has segment buttons for 1/2/4/9/16/25/36 via `setGridSize(n)`.
- Reference images (use YOUR vision on them — they are the source of truth for Task A):
  - `TEMPLATE-REF.png` — full frame from Chris's video showing the board on a tablet.
  - `TEMPLATE-REF-ZOOM.png` — 3x zoomed crop of just the board.
- Versioning convention: `versions/<v>/` holds a full snapshot (see `versions/v1/` and `versions/v2.2/` for the pattern: sources, app/, build.sh with that version's knobs, APK + .idsig, test suites, README). `build.sh` top knobs: `VERSION_CODE`, `VERSION_NAME`, `APK_NAME`. Keystore password auto-loads from `.keystore-pass` — never read/print it.

## Task A — Built-in templates (the main ask)
Chris wants the board layout from his video to be a template he can pick in the page editor (New Page → My Templates), and he wants ALL the different page styles available as templates too.

1. Look at `TEMPLATE-REF-ZOOM.png` carefully. It is a classic core-word AAC board: dark navy top row of control buttons (arrows / speech bubble style icons), a lavender/periwinkle left column, green middle columns, teal right column. Determine the grid dimensions from the image. If it is 4x5 = 20 tiles, ADD `case 20: return { cols: 4, rows: 5 }` to `getGridDimensions()` (and a "20" segment button in the Page Options popover next to the existing ones).
2. Add a `BUILTIN_TEMPLATES` array in `index.html`. Each entry same shape as custom templates: `{ title, type, gridSize, bg, tiles, hotspots?, builtin: true, date: 'Built-in' }`. Include at minimum:
   - **"Core Words (Classic)"** — the video board layout, colors matched to the reference image (navy top row ~#1a237e, lavender left col ~#9fa8da, green middle ~#4caf50, teal right ~#00897b — use your vision judgment on the actual crop). Where tile text is not legible in the video, use standard core words (I, you, want, need, help, more, please, thank you, again, stop, yes, no, go, done, happy, sad...). Give each tile `bgColor`, `labelColor` (white on dark bg, dark on light), `tts` = label.
   - One template per grid style: "Blank 1", "Blank 2", "Blank 4", "Blank 9", "Blank 16", "Blank 25", "Blank 36" (empty tiles objects, white bg).
   - "Yes/No Board" (2-tile, teal bg, yes/no with smile/frown symbols — mirror DEFAULT_PAGES entry 2).
   - "Visual Scene (Blank)" (type 'scene', empty hotspots).
   - "Keyboard Page" template if `addNewKeyboardPage()`'s page shape is reusable as a template entry; otherwise skip and note it in UPGRADES.md.
3. Merge built-ins into the My Templates list: `renderMyTemplatesList()` shows builtins first (marked "Built-in", NO delete button), then user templates (deletable). `useCustomTemplate(idx)` must work for both (indexing across the merged list — keep it simple: one array, `builtin` flag controls the delete button only).
4. "Save current page as template" behavior stays unchanged.

## Task B — Audit & upgrades list
Review: `git log`, `CHANGELOG.md`, `versions/v1/`, `versions/v2.2/`, all `test_*.js`, `screenshots/`, `UI-SPEC.md`, `BEHAVIOR-SPEC.md`, `GOAL.md`, `TODO-CLAUDE.md`, `CLAUDE-TASK.md`, `PHOTO-LIBRARY-TASK.md`, and anything else in the tree. Then write **`UPGRADES.md`**:
1. What the prototype currently has (feature inventory, brief).
2. What's broken / missing / inconsistent (cite files + line refs where possible — e.g., dead code, untested paths, spec-vs-reality gaps from the GoTalk Now rebuild).
3. A prioritized upgrade list (P0/P1/P2) with one-line rationale each.
Be honest and specific; do not pad it.

## Task C — Versioning & release (v2.4)
1. BEFORE changing anything: snapshot the current live tree to `versions/v2.3/` following the v1/v2.2 pattern (sources, app/, build.sh with v2.3 knobs, existing `AAC-Board-v2.3.apk` + .idsig, test suites, README.md). v2.3 was never archived — fix that.
2. Make Task A changes in the live tree.
3. Bump `build.sh` knobs: `VERSION_CODE=6`, `VERSION_NAME="2.4"`, `APK_NAME="AAC-Board-v2.4.apk"`. Run `./build.sh` — must end with `=== BUILD OK ===`.
4. New test suite `test_templates.js` (puppeteer, same pattern as the others): builtin templates render in the My Templates modal list; using "Core Words (Classic)" creates a page with the right gridSize and tile colors; builtins have no delete button; user templates still save/delete.
5. Run ALL suites: `test_headless.js`, `test_behavior.js`, `test_button_editor.js`, `test_photo_library.js`, `test_templates.js`. All must pass. (Puppeteer is at `/home/mike/browser-automation/node_modules/puppeteer`.)
6. Add a v2.4 entry to the TOP of `CHANGELOG.md` (what changed, test results, APK size).
7. Snapshot the finished tree to `versions/v2.4/` (same pattern, with the new APK + .idsig and all test suites incl. test_templates.js).
8. `git add -A && git commit` with a clear message. Do NOT push anywhere.

## Guardrails
- Stay inside `/home/mike/aac-board`. Nothing destructive outside it.
- Never touch `aac.keystore` or `.keystore-pass` (do not print the password).
- Never delete app tiles/data by slot number — read first, identify by exact label (hard-won lesson from v2.3).
- No adb, no GitHub push.

## Definition of done
Reply with exactly: `TEMPLATES-DONE` followed by one line summarizing what shipped + test totals. Artifacts that must exist on disk: `UPGRADES.md`, `versions/v2.3/`, `versions/v2.4/AAC-Board-v2.4.apk`, updated `CHANGELOG.md`, green suites, git commit.
