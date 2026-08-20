# Talk Tiles v2.4 — archived 2026-08-20

The built-in templates release. `index.html` here is exactly what produced
`AAC-Board-v2.4.apk` (versionCode 6, 25,416,182 bytes).

> Note: the project root's `README.md` still describes v1 (three layouts,
> FLAG_SECURE) and is **not** copied into this archive on purpose — it would be
> wrong about every version in here. See P2-5 in `UPGRADES.md`.

## What v2.4 adds over v2.3

- **Eleven built-in page templates** in "New Page → My Templates", listed ahead
  of the user's own saved templates, tagged "Built-in" and not deletable:
  Core Words (Classic), Yes/No Board, Blank 1/2/4/9/16/25/36,
  Visual Scene (Blank), Keyboard Page.
- **Core Words (Classic)** reproduces the board in Chris's reference video
  (`TEMPLATE-REF.png`, `TEMPLATE-REF-ZOOM.png`, both kept here) as a 48-button
  express page: navy control row, lavender pronoun column, green verb columns,
  blue describers, white function words, teal social column, and the message
  window along the top.
- **Grid size 48 (8 × 6)** in `getGridDimensions()` with a matching Page Options
  segment. The filmed board is ~10 × 8 and clipped by the frame; 48 is the
  densest grid that still reads on a phone.
- **Scene pages fixed for mixed books**: `clearSceneView()` stops a scene's
  photo and hotspots surviving onto the next page, and templates now carry
  `sceneBg` / `express` / `enabled` so a template scene page is identical to a
  hand-made one.
- **Six broken Online Gallery symbol paths repointed**, express chips render
  their real symbol instead of a star, and two unguarded `audio.play()` calls no
  longer throw unhandled rejections.
- `UPGRADES.md` — the audit of the whole prototype, including a confirmed P0
  (photo tiles take the board down on reload) that this release does **not**
  fix.
- `VIDEO-TRANSCRIPT-gotalknow.txt` — the reference app's demo transcript the
  page-style behaviour is checked against.

## Suites shipped with this version — 81 checks, all green

    node test_headless.js        # 22
    node test_behavior.js        #  8
    node test_button_editor.js   #  6
    node test_photo_library.js   #  6
    node test_templates.js       # 11   (new in v2.4)
    node test_scenes.js          #  9   (new in v2.4)
    node test_buttons.js         # 19   (new in v2.4)

Run them from this directory — each resolves `index.html` next to itself, so
they exercise the archived sources, not the live tree.

`test_buttons.js` presses all **235** elements in `index.html` that carry an
`onclick`, as real DOM clicks, and fails if any of them was never pressed — so
adding a button to the markup without adding a check for it turns the suite red.
It needs a fake camera and microphone, which it asks Chrome for itself
(`--use-fake-device-for-media-stream`).

## Rebuild

    cd /home/mike/aac-board/versions/v2.4 && ./build.sh

`build.sh` here is the same parametric script as the project root with the v2.4
knobs (`VERSION_CODE=6`, `VERSION_NAME=2.4`), and it builds in place.

## Not installed on a device

The Pixel 8 Pro was not connected for this release. v2.4 has only been verified
headless at 1024×768 and 1280×800. The 48-button grid is the densest layout the
app has ever shipped and has not been looked at on the phone — see P2-10 in
`UPGRADES.md`.

## `symbols/` is a symlink

`symbols` points at `../../symbols`. The 3,436 Mulberry SVGs are unchanged since
v2.3, and three byte-identical 40 MB copies in one git repo is pure duplication.
`build.sh` copies it with `cp -rL`, so a rebuild from here still puts real files
in the APK. If the symbol set is ever replaced, this archive needs a real copy
first.

## The signing key is NOT in here

`aac.keystore` lives in the project root and is shared by every version, on
purpose. `build.sh` here points at `/home/mike/aac-board/aac.keystore`.
Same package (`com.aacboard.app`) as every other version, so only one installs
at a time and going back down a versionCode needs `adb install -r -d`.
