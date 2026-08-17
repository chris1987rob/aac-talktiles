# Talk Tiles — changelog

Package `com.aacboard.app`. Every version is signed with the same key
(`aac.keystore` in the project root), so a newer build installs straight over
an older one.

---

## v2.3 — 2026-08-17 (versionCode 5)

**Automatic background removal is gone.** Chris's call: ship without it. The
whole feature — the neural model, the ONNX runtime, the colour flood-fill
editor, the erase/restore/brush tools, White/Black/Original — is removed from
the app and archived complete under `versions/v2.2/` (sources, assets, APK and
its two test suites), with a README covering how to rebuild it.

Headless suite: 22/22. **Verified on the Pixel 8 Pro**: 12 checks on the camera
path and 8 on everything else — layouts, Lock, the edit lock, Unlock, word size.

### What taking a photo does now
Open the camera, shoot, and you get the photo full screen with **Retake** and
**Save to tile**. That is the entire flow.

- APK: **7.3 MB -> 37.7 KB**. `index.html`: 147 KB -> 76 KB.
- Capture is ~70 ms, against ~250 ms in v2.1 and ~2.1 s in v2.2.
- `setAllowFileAccessFromFileURLs(true)` is reverted — it existed only so the
  model could read its own assets, and it is not a setting to leave switched on
  for no reason.
- `build.sh` clears `app/assets/assets` on every run, so a stale build tree
  cannot quietly put 15 MB back into the APK.

### Kept
The save-race fix stays: `saveEditorTile()` still waits on `pendingPhotoWrite`
before reading `pendingPhotoBlob`. Canvas -> JPEG is asynchronous whether or not
anything has been done to the photo, and without the wait a tile saved straight
after shooting stores the *previous* photo, silently. The headless suite now
covers exactly that.

### Data loss during this release — one tile
While testing on the device, a cleanup script deleted "slots 11 and 12" on the
assumption that anything past Chris's ten tiles was a test tile it had made. It
was not: a real tile ("Basketball", a photo and his own voice recording) had
been created on slot 11 in between two test runs and was destroyed. It is not
recoverable — IndexedDB has no undelete, the blob URL is revoked on delete, and
the app is not debuggable so the store cannot be read from the filesystem.

Cleanup must identify what it deletes rather than infer it from a slot number:
record the id **and** the label at creation and delete only that exact pair.

## v2.2 — 2026-08-17 (versionCode 4)

Background removal now runs a real segmentation model. Suites: 26/26
(`test_headless.js`), 31/31 (`test_bgeditor.js`), 17/17 (`test_segmentation.js`,
new). **Verified on the Pixel 8 Pro**: 10/10 on-device checks, Chris's 10 tiles
untouched, test tile created and deleted.

### Why the colour approach could only go so far
v2.1 decided what was background by asking "is this pixel similar to the one
next to it". That is genuinely good on an object photographed on a table, and it
cannot ever work on a child at a playground, because colour similarity has no
idea what an object *is*. Every app that does this convincingly — iOS subject
lift, Canva, Photoshop — runs a trained model. So this one does now too.

**U²-Net (4.6 MB) is bundled in the APK** and runs through ONNX Runtime's WASM
build. Nothing is downloaded and nothing is uploaded; the board stays completely
offline, which is the point of the app.

### The model is the semantics, not the finish
It returns a blurry 320×320 opinion. That gets upsampled and then snapped onto
the real edges of the photo with a **guided filter**, which solves per
neighbourhood the linear map from the photo's own luminance to the mask that
best explains it. Semantics from the model, geometry from the photo.

### Subject first, background second
Chris put it exactly right: the program should find the thing in the photo and
then make the background, and the old way round it. The colour pass is now the
answer of last resort rather than the first thing tried:

1. The model is loaded and warmed **at app start**, while the board is on
   screen, so by the time a photo is taken only inference is left to do.
2. The editor opens on the **photo exactly as it was shot** — ~220 ms — with
   "Finding the subject…". Nothing half-cut is shown, because an answer that
   appears instantly and then changes under you reads as a glitch even when the
   second answer is the better one.
3. The subject cut lands ~1.7 s later.
4. The colour pass runs only if there is no model, it will not start, it takes
   longer than 12 s, or it comes back with something that is plainly not a
   cut-out. Falling back is a real code path with its own tests.

Every manual tool works identically on either mask. The amount slider and Reset
are disabled while the model is thinking — there is nothing for them to act on
yet, and letting them run in that window meant a stray touch could cancel the
model that was about to answer.

The "how much to remove" slider now re-cuts the model's matte at a new
threshold, which is one pass over one array (~40 ms on the phone), so it stays
live under the finger instead of throwing the model's answer away.

### On-device numbers (Pixel 8 Pro)
    editor opens (photo shown)  ~220 ms
    subject cut appears         ~2.1 s
    model inference             ~1700 ms
    slider re-cut               ~40-65 ms
    APK                         7.3 MB

### Loading a model from a file:// page
Three things had to line up, and each of them silently disables the model:
- **ONNX Runtime is pinned to 1.17.** 1.20 loads its WASM glue as an ES module,
  and a bare module specifier cannot be resolved from `file://` at all.
- **The .wasm is read by XHR and handed back as a blob: URL.** The runtime wants
  to fetch its own binary, and a `file://` page cannot fetch anything — not even
  its own directory.
- **`setAllowFileAccessFromFileURLs(true)`** on the WebView, or the assets are
  cross-origin to their own page and the read is refused. Without it the model
  works perfectly in a desktop browser and never loads on the phone.

### Bugs found while wiring it up
- **"Fit subject" cropped the photo and the mask but not the matte**, so the
  next touch of the slider re-cut against the wrong geometry. Undo had the
  mirror-image version of the same bug. Both now carry the matte.

## v2.1 — 2026-08-17 (versionCode 3)

Rebuilt the background editor. Headless: 26/26 (`test_headless.js`) plus 31/31
(`test_bgeditor.js`, new). **Verified on the Pixel 8 Pro**: 10/10 on-device
checks, Chris's 10 tiles untouched throughout, test tile created and deleted.

### Why it needed rebuilding
v2.0 did one border flood fill and offered one slider. It failed on the three
things that actually happen when you photograph something for a tile:

- **The object touches the edge of the frame.** The fill seeds from every border
  pixel, so it started *inside* the object and flooded outward through it. No
  slider position could help, because the object was a seed. A subject standing
  on the bottom of the frame was destroyed 100% of the time.
- **A patch of background survived** (a second surface, or the hole under a mug
  handle that no border fill can reach) and there was no way to remove it.
- **The cut was 1-bit**, so every edge was a staircase with a fringe of old
  background colour around it.

And "Undo" meant "throw the whole thing away".

### What it does now
It keeps a **mask** rather than a picture. `ED.hard` is the 0/255 decision per
pixel; `ED.mask` is that decision dilated and blurred, and is the only thing the
renderer reads. Every tool edits `ED.hard`, so softening is recomputed rather
than accumulated and undo is one byte array.

- **Seeds are filtered by colour.** Border pixels are grouped, and a group only
  seeds the fill if it owns a corner of the picture or covers a fifth of the
  perimeter. An object poking through the frame edge is a short run of a colour
  that owns no corner, so it seeds nothing and survives. Dropping a group is
  safe even when it was background — seeds are only starting points.
- **Tap to erase, tap to restore.** A tap floods the colour region under the
  finger; a drag paints with a brush. Erase only touches kept pixels and restore
  only touches removed ones, so taps converge instead of fighting each other.
- **Automatic tolerance.** A thumbnail search proposes a neighbourhood, then
  four real full-resolution passes are scored on the mask you will actually see.
- **Honest about failure.** Some photos have no isolatable subject. The cut is
  computed either way and simply not applied — the editor opens on the untouched
  photo and says so, instead of on a nearly blank frame.
- **Anti-aliased edges**, multi-step undo, Reset, **Fit subject** (crop to what
  survived), pinch-zoom and pan, and White / Black / **Original**.

### The measurement that made it work
Whether a cut is good is `boundaryContrast`: how hard the picture disagrees with
itself along the cut, relative to its own average gradient. Removing a
background leaves a cut along the object's outline, where the picture changes
sharply; eating into the object leaves a cut through skin or a shirt, where it
barely changes. Every cheaper metric is blind to this — on a dim selfie the
removed fraction looked reasonable, the middle of the frame survived and what
was left was one connected blob, all while the fill was taking the shirt, the
hair and half the face.

Two calibration bugs found by measuring rather than assuming:
- The centre of the frame was being **scored** rather than used as a gate, so a
  pass that removed nothing scored highest for doing nothing. Every photo picked
  the gentlest setting.
- `edgeFit` was normalised by 3 when real cuts run 3–10x the average gradient,
  so it pinned at 1.0 for every candidate and the term did nothing at all.

### Bugs fixed on the device that headless never saw
- **`setPointerCapture` throws `NotFoundError`** in this WebView, and the throw
  aborted the whole `pointerdown` handler — no stroke started, no pointer
  registered. Erase, restore, tap and pinch all went silently dead. Now wrapped:
  a convenience must not be able to kill every tool.
- **Saving raced the edit.** `saveEditorTile()` read `pendingPhotoBlob`
  synchronously while canvas → JPEG was still in flight, so a tile saved right
  after editing stored the photo as it was *before* the background was removed —
  silently, with no error. Confirmed on device (2.8 MB original vs 101 KB edit);
  the write is now awaited.
- Opening the editor on a second photo showed the **first photo's canvas** until
  the new one decoded, and a tap in that window edited the wrong mask.

### Testing
`test_bgeditor.js` builds scenes with a known correct answer — gradient
lighting, sensor noise, a drop shadow, a subject on the frame edge, a held
object, a two-surface background, a mug-handle hole, a blurred object, low
contrast, and a full-resolution photo-like scene — and scores the mask against
the truth (IoU, background removed, subject kept). Auto scores IoU 0.96–1.00 on
all of them. It also ran against 11 real photos pulled from Chris's own camera.

## v2.0 — 2026-08-17 (versionCode 2)

Headless suite: 26/26 (`test_headless.js`).
**Verified on the Pixel 8 Pro 2026-08-17**: installed over v1 with all of Chris's
tiles (photos + voice) intact; layouts, tile playback, pinning, the edit lock,
unpin, the full-screen camera, and white/black background fill all exercised on
the device. See "Unlock and the lock screen" below.

### Unlock and the lock screen (device setting, not app code)
Unpinning was sending the phone to the **lock screen**, which is what made Unlock
look like the app quitting. Android's `LockTaskController.shouldLockKeyguard()`
reads `lock_to_app_exit_locked`; when that setting is unset it falls back to "is
the lock screen secure", which it is on this phone, so the system calls
`lockNow()` on unpin. The app's re-front worked — it just landed behind the
keyguard. Fixed by setting the Android toggle:

    adb shell settings put secure lock_to_app_exit_locked 0

(Settings → Security & privacy → More security & privacy → App pinning → "Ask
for PIN before unpinning" = off.) Trade-off: unpinning no longer requires the
PIN, so pinning is a weaker child-lock. Revert with `... lock_to_app_exit_locked 1`.

Note: the first time Lock is tapped, Android shows a one-time "App is pinned"
sheet — pinning only engages after tapping **Got it**.

### Tile photo editor: white *or* black background, on any photo
- The background flood fill is no longer white-only. `whitenBackground()` became
  `fillBackground(src, tolerance, [r,g,b])`, and the full-screen photo editor
  now offers **White BG / Black BG / Undo**, with the active fill outlined.
- Every pass re-runs against the untouched original, so white ↔ black ↔ undo
  costs nothing and never compounds. The tolerance slider re-applies whichever
  fill is currently on.
- New **"Edit Background"** button in the tile editor opens that same
  full-screen editor on the photo the tile *already* has — including one picked
  from the gallery, which previously could not be filtered at all. "Retake"
  hides when the camera is not where the photo came from.

### Lock
- **Unlock no longer looks like the app quitting.** Android treats
  `stopLockTask()` as "leave this pinned task" and drops the user at the
  launcher; the activity was never dying. `bringSelfToFront()` now re-fronts it
  350 ms after unpinning, and the activity is `launchMode="singleTask"` so that
  can never spawn a second copy.
- `onResume()` asks `ActivityManager.getLockTaskModeState()` for the real state
  and pushes it into the board, so leaving pinning with the system's own
  back+overview gesture cannot strand the board in a locked state.
- **Lock now locks editing too**: while pinned, layout buttons 1/2/3 and Edit
  are disabled, the tile editor refuses to open, and an in-flight edit session
  is closed. **Tiles keep playing normally while pinned** — unchanged.

### Per-tile word size
- The tile editor has a **"Word size on the tile"** slider (0.6×–3×) with a live
  preview of the actual caption at that size.
- Stored as `labelSize` on the tile record; tiles saved before v2 default to 1×.
- Applies to the caption over a photo *and* to the text on a photo-less tile.
- `.tile-label` now wraps instead of ellipsising, so a scaled-up word is not
  clipped to one line — it wraps at **spaces only**, never mid-word.
- The slider is a request, not a promise: a label is capped at 55% of the tile
  and `fitTextToBox()` shrinks it until it actually fits, so a big word can
  never spill off the top of the tile. Caught by on-screen review at 412px —
  before the fit pass, "I want more please" at 2.4x ran off the tile and broke
  into "ple/ase".
- The editor's preview box is sized from a REAL tile's label area in the current
  layout and fitted the same way, so the preview is honest about what fits.
- The fit pass re-runs after layout settles (double rAF) and on resize/rotation,
  and always restarts from the requested size so it can grow back. Without this,
  a cold WebView start measured labels against an unsettled grid and locked them
  small for the whole session — caught on-device, where a 1x "MILK" rendered
  visibly smaller on the first launch after install than on every later launch.

### Build
- `build.sh` is parametric: version knobs at the top, all paths derived from the
  script's own location, so a version snapshot can rebuild itself in place.

---

## v1.0 — 2026-08-16 (versionCode 1)

Archived, source and APK, at `versions/v1/`. See `versions/v1/README.md`.

The original board: three layouts (2×2 / 3×3 / 4×3), photo + voice recording per
tile, IndexedDB persistence, full-screen camera with a white-background flood
fill on a fresh capture, and Lock = Android app pinning with the board left
fully usable.
