# Talk Tiles

An offline AAC (augmentative and alternative communication) picture board for
Android. Each tile is a photo with a recorded voice on it; tapping a tile plays
the recording. Built for a Pixel 8 Pro.

Everything lives on the device. There is no account, no network call, and no
analytics — the board works in airplane mode, which for a communication aid is
the point rather than a feature.

## What it is, structurally

A single self-contained `index.html` (vanilla JS, IndexedDB, no CDNs, no build
step) inside a thin WebView shell
(`app/src/com/aacboard/app/MainActivity.java`). That is the whole app.

- **Three layouts** — 2×2 (large, warm), 3×3 (default), 4×3 (dense, high
  contrast). The choice persists.
- **Tiles** hold a photo, a voice recording made in the app, a label, and a
  per-tile word size (0.6×–3×). Labels wrap at spaces and shrink to fit rather
  than spilling off the tile.
- **Lock** self-pins the app with Android's App Pinning and disables editing:
  layouts, the edit button and the tile editor all refuse while pinned. Tiles
  still play normally — locking is about stopping a child leaving the board,
  not about stopping them using it.
- **FLAG_SECURE** is set, so the app is black in screenshots and the recents
  view.

## Building

No Gradle. `build.sh` drives the Android SDK tools directly (aapt2, javac, d8,
zipalign, apksigner):

```sh
./build.sh                 # -> AAC-Board-v2.3.apk
adb install -r AAC-Board-v2.3.apk
```

Version knobs are the first few lines of `build.sh`. All paths derive from the
script's own location, which is why each archived version under `versions/`
carries the same script with its own knobs and builds in place.

**Signing.** Every version is signed with the same key so builds install over
each other and keep their data. The key (`aac.keystore`) and its password
(`.keystore-pass`) are gitignored and are **not** in this repository — put them
back in the project root, or pass the password as `KS_PASS`, before building.

## Testing

```sh
node test_headless.js      # puppeteer, headless Chrome
```

Covers the lock behaviour and its edit-lock, the camera capture and save path,
and label sizing/fitting. It needs puppeteer from `~/browser-automation`.

Two lessons this suite exists because of:

- **Assertions do not see layout.** The suite was fully green while labels were
  visibly running off the tiles and breaking mid-word. Screenshot the board at
  phone width after touching anything to do with tile text.
- **Headless does not see the WebView.** `setPointerCapture` throws
  `NotFoundError` in Android's WebView but not in desktop Chrome, and an
  uncaught throw there once killed every touch tool in the photo editor. Verify
  on the device.

## Versions

`versions/` holds each shipped version whole — sources, and the script to
rebuild it in place. `CHANGELOG.md` has the reasoning behind each.

| Version | What changed |
|---|---|
| **v2.3** (current) | Automatic background removal removed; taking a photo is camera → preview → Retake / Save. APK 37 KB. |
| v2.2 | Background removal by neural segmentation — U²-Net + ONNX Runtime WASM bundled offline, refined with a guided filter. Archived under `versions/v2.2/`. |
| v2.1 | Rebuilt the background editor around a mask: tap-to-erase, tap-to-restore, brush, undo, crop, anti-aliased edges. |
| v2.0 | White/black background fill; the Unlock-looks-like-a-crash fix; lock also locks editing; per-tile word size. |
| v1.0 | The original board. Archived under `versions/v1/`. |

Background removal was taken out in v2.3 as a shipping decision, not because it
stopped working — `versions/v2.2/` is complete and rebuildable if it is ever
wanted back.

## A note on the "Unlock closes the app" problem

It was never app code. Android's `LockTaskController.shouldLockKeyguard()`
reads the `lock_to_app_exit_locked` secure setting; when that is unset it falls
back to "is the lock screen secure", which on any phone with a PIN it is — so
the system calls `lockNow()` the instant you unpin. The app was alive and
foregrounded the whole time, just behind the keyguard:

```sh
adb shell settings put secure lock_to_app_exit_locked 0
```

(Settings → Security & privacy → More security & privacy → App pinning → "Ask
for PIN before unpinning" = off.) The trade-off is that unpinning then needs no
PIN, which makes pinning a weaker child-lock.
