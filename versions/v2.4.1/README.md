# Talk Tiles v2.4.1 — archived 2026-08-20

The inline symbol showcase. `index.html` here is exactly what produced
`AAC-Board-v2.4.1.apk` (versionCode 7, 25,420,278 bytes).

> The project root's `README.md` still describes v1 (three layouts,
> FLAG_SECURE) and is deliberately **not** copied into this archive — it would
> be wrong about every version in here. See P2-5 in `UPGRADES.md`.

## What v2.4.1 changes

The 3,609-symbol catalogue now lives **inside the tile editor** instead of
behind a full-screen modal on top of it:

- a scrolling strip of 96px cards under the tile preview, seeded from the
  button's own label (or the 173 starter icons when there is no label);
- it re-filters live as the label is typed (`onEditorLabelInput`);
- its own search box for when the label and the picture differ — a typed search
  wins over the label, the ✕ clears it and the strip falls back to the label;
- `selectInlineEditorSymbol()` sets the symbol, drops a staged photo, fills a
  blank label/TTS (leaving a written one alone), updates the preview and
  highlights the card — **without closing anything**;
- the symbol already on the button is pinned first and shown selected, even
  under a search that cannot match it;
- the full-screen library is still one tap away as **Browse All Symbols**, and
  both share one matcher (`searchSymbolLibrary`).

The editor modal was widened from 480px to 640px so six cards are visible at
once on a 7–8" tablet. No storage change: `tile.symbol` already accepted an SVG
path, an emoji or a glyph.

## Suites shipped with this version — 85 checks, all green

    node test_headless.js        # 22
    node test_behavior.js        #  8
    node test_button_editor.js   # 10   (6 -> 10 in v2.4.1: the inline picker)
    node test_photo_library.js   #  6
    node test_templates.js       # 11
    node test_scenes.js          #  9
    node test_buttons.js         # 19

Run them from this directory — each resolves `index.html` next to itself, so
they exercise the archived sources, not the live tree.

`test_buttons.js` presses all **236** elements in `index.html` that carry an
`onclick`, as real DOM clicks, and fails if any was never pressed. It needs a
fake camera and microphone, which it asks Chrome for itself
(`--use-fake-device-for-media-stream`).

## Rebuild

    cd /home/mike/aac-board/versions/v2.4.1 && ./build.sh

Same parametric script as the project root with the v2.4.1 knobs
(`VERSION_CODE=7`, `VERSION_NAME=2.4.1`); it builds in place.

## Not installed on a device

The Pixel 8 Pro was not connected. v2.4.1 has only been verified headless at
1024×768 and 1280×800 — including the symbol strip, which is the one thing here
that most wants a real thumb on real glass.

## `symbols/` is a symlink

`symbols` points at `../../symbols`. The 3,436 Mulberry SVGs are unchanged since
v2.3. `build.sh` copies it with `cp -rL`, so a rebuild from here still puts real
files in the APK. If the symbol set is ever replaced, this archive needs a real
copy first.

## The signing key is NOT in here

`aac.keystore` lives in the project root and is shared by every version.
`build.sh` here points at `/home/mike/aac-board/aac.keystore`. Same package
(`com.aacboard.app`) as every other version, so only one installs at a time and
going back down a versionCode needs `adb install -r -d`.
