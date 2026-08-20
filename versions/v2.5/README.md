# Talk Tiles v2.5 — archived 2026-08-20

Persistence rebuilt, real controls and 100/100 tests. `index.html` here is exactly what produced
`AAC-Board-v2.5.apk` (versionCode 8, 24,862,415 bytes).

> The project root's `README.md` still describes v1 (three layouts,
> FLAG_SECURE) and is deliberately **not** copied into this archive — it would
> be wrong about every version in here. See P2-5 in `UPGRADES.md`.

## What v2.5 changes

### 1. Safe multi-page persistence (P0-1 & P0-2)
- **Blobs in IndexedDB**: Photo and audio blobs no longer serialize to `{}` in `localStorage`.
  They live exclusively in IndexedDB (`tiles_v2`), and `pages` in `localStorage` store only
  lightweight `hasPhoto`/`hasAudio` booleans.
- **Hydration on startup**: `hydratePagesFromCache()` re-attaches blobs to page records.
- **WeakMap blob URL caching**: `tilePhotoUrl()` caches object URLs safely in a `WeakMap`,
  preventing race conditions and `ERR_FILE_NOT_FOUND` errors when rendering.
- **`pageId:slot` keying**: IndexedDB records are keyed by `pageId:slot` (was slot alone),
  preventing photo collisions across pages.
- **Non-destructive migration**: Automatically migrates legacy slot-keyed v1 records to page 1
  while preserving legacy records in place.
- **Monotonic page IDs**: `nextPageId()` ensures page IDs never collide after deletions.

### 2. Gallery & wizard template rendering (P1-1)
- Normalized `color` → `bgColor` and `wordSize` → `labelSize` on all 5 gallery boards and wizard presets.
- Resolved bare-word symbol names to real Mulberry SVG paths or emojis. All 94 template tiles paint
  background colours and graphics correctly.

### 3. Controls made real (P1-4, P1-5, P2-4)
- **Voice / Use Second Voice**: Real SpeechSynthesis voice selection applied to `speakText()`.
- **Page scanning**: Live step scanning cursor engine with highlight and tap/Space selection.
- **Auditory cues**: Plays TTS or recorded audio upon navigating to a page.
- **Share button**: Single-page JSON export.
- **Grid size 12**: Added to Page Options selector.
- Dead hidden Jump button removed.

## Suites shipped with this version — 100 checks, all green

    node test_headless.js        # 22
    node test_behavior.js        #  8
    node test_button_editor.js   # 10
    node test_photo_library.js   #  6
    node test_templates.js       # 11
    node test_scenes.js          #  9
    node test_buttons.js         # 19   (covers 240/240 buttons)
    node test_persistence.js     # 15   (new in v2.5)

Run them from this directory — each resolves `index.html` next to itself, so
they exercise the archived sources, not the live tree.

## Rebuild

    cd /home/mike/aac-board/versions/v2.5 && ./build.sh

Same parametric script as the project root with the v2.5 knobs
(`VERSION_CODE=8`, `VERSION_NAME=2.5`); it builds in place.

## Not installed on a device

The Pixel 8 Pro was not connected. v2.5 has been verified headless across all 8 suites (100/100).
The 48-grid on-device legibility pass remains open.

## `symbols/` is a symlink

`symbols` points at `../../symbols`. The 3,436 Mulberry SVGs are unchanged since
v2.3. `build.sh` copies it with `cp -rL`, so a rebuild from here still puts real
files in the APK.

## The signing key is NOT in here

`aac.keystore` lives in the project root and is shared by every version.
`build.sh` here points at `/home/mike/aac-board/aac.keystore`. Same package
(`com.aacboard.app`) as every other version, so only one installs at a time and
going back down a versionCode needs `adb install -r -d`.
