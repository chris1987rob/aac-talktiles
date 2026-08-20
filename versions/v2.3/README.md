# Talk Tiles v2.3 — archived 2026-08-20

The GoTalk Now parity build, archived after the fact: v2.3 shipped on
2026-08-20 and was never snapshotted at the time, so this directory was cut
from the live tree immediately before the v2.4 template work began. The
`index.html` here is byte-identical to the one that produced
`AAC-Board-v2.3.apk` (versionCode 5, 24.2 MB).

What v2.3 is:

- **3,436 Mulberry AAC symbols** (`symbols_data.js` + `symbols/en/*.svg`,
  CC BY-SA 4.0) with a searchable symbol library, keyword/tag filtering and
  category chips.
- **All 8 "New Page" options** working: Online Gallery, My Templates,
  Import/Export book & pages, Duplicate Page, 3-step Page Wizard, Keyboard
  Page, Blank Scene Page, Blank Button Page.
- **Visual Scenes with hotspots**, four built-in SVG scene presets.
- **Classic Button Editor** (reverted from the Quick Edit experiment in
  commit 72d45d6) plus multi-page slot storage.
- **Photo library**, camera capture, MediaRecorder voice, TTS.
- Page navigation: Next Page button, pages drawer, arrow keys, touch swipe.

What v2.3 does **not** have (added in v2.4): built-in templates, the 48-button
grid, and `test_templates.js`.

## Suites shipped with this version

    node test_headless.js        # 22 checks
    node test_behavior.js        #  8 checks
    node test_button_editor.js   #  6 checks
    node test_photo_library.js   #  6 checks

Run them from this directory — each resolves `index.html` next to itself, so
they exercise the archived sources, not the live tree.

## Rebuild

    cd /home/mike/aac-board/versions/v2.3 && ./build.sh

`build.sh` here is the same parametric script as the project root with the v2.3
knobs (`VERSION_CODE=5`, `VERSION_NAME=2.3`), and it builds in place.

## `symbols/` is a symlink

`symbols` points at `../../symbols`. The 3,436 Mulberry SVGs have not changed
since they were added in v2.3, and three byte-identical 40 MB copies in one git
repo is 6,872 files of pure duplication. `build.sh` copies it with `cp -rL`, so
a rebuild from here still gets real files in the APK. If the symbol set is ever
replaced, this archive must be given a real copy first.

## The signing key is NOT in here

`aac.keystore` lives in the project root and is shared by every version, on
purpose. `build.sh` here points at `/home/mike/aac-board/aac.keystore`.
Same package (`com.aacboard.app`) as every other version, so only one installs
at a time and going back down a versionCode needs `adb install -r -d`.
