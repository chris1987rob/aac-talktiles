# Talk Tiles v2.2 — archived 2026-08-17

The build with **automatic background removal**, archived complete (sources,
assets, APK) at Chris's request: v2.3 ships without that feature, and this is
what to come back to if it is ever wanted again.

What is in here that the live project no longer has:

- **Subject segmentation.** U^2-Net (`assets/subject.onnx`, 4.6 MB) run through
  ONNX Runtime WASM (`assets/ort.min.js`, `assets/ort-wasm-simd.wasm`), fully
  offline. Finds the subject; the background is whatever is left.
- **A guided filter** that snaps the model's blurry 320x320 output onto the real
  edges of the photo.
- **The colour flood-fill editor** it replaced, kept as the fallback: border
  seeds filtered by colour so a subject touching the frame is not eaten,
  tap-to-erase, tap-to-restore, brush, multi-step undo, Reset, Fit subject,
  pinch-zoom, White / Black / Original.
- Its suites: `test_bgeditor.js` (31 checks) and `test_segmentation.js` (21).

`app/` here also carries the one WebView setting the model needed:
`setAllowFileAccessFromFileURLs(true)`. The live app does not set it.

To rebuild this version in place: `./build.sh` from this directory.
Note it shares the project keystore at `/home/mike/aac-board/aac.keystore`, and
the package name is the same, so installing it replaces whatever is on the
phone (and going back down a versionCode needs `adb install -r -d`).
