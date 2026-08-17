# Talk Tiles — task for Claude Code (from Hermes, 2026-08-17)

Project: `/home/mike/aac-board` — "Talk Tiles" AAC picture board.
- `index.html` — the board. Vanilla JS, NO CDNs/npm/build step, must stay a single self-contained offline file.
- `app/` — Android WebView wrapper (`MainActivity.java`, `AndroidManifest.xml`).
- `build.sh` — no-Gradle build. Run `cd /home/mike/aac-board && ./build.sh` → `/home/mike/aac-board/AAC-Board-v1.0.apk` (signed with `aac.keystore` in repo root — NEVER delete/recreate it; a lost key = Android treats the new build as a different app).
- adb: `/home/mike/Android/Sdk/platform-tools/adb`. Device: Pixel 8 Pro (husky), serial `38290DLJG0016D`. **The device is NOT attached right now** — Part 2 only runs when Hermes says "DEVICE READY".
- Read `/home/mike/shared-agent-memory.md` first (Ongoing + Durable sections) for context.

## Background — why this task exists
Chris user-tested the current "hard lock" build: Lock button → `startLockTask()` (App Pinning) + immersive-sticky bar hiding + back consumption in `onBackPressed()` + a full-screen red "BOARD LOCKED" overlay that disables the whole board until Unlock. He does NOT want that. His verbatim asks (2026-08-17):

1. "swiping the screen down still works and exiting the screen still happens when you swipe from the bottom. Menu shade is working and home recent swipe is still working and the screen tiles need to work when app pinning is on, not be completely locked"
2. "I'm not worried about swiping not spying." (recents/shade preview protection is dropped — no security requirement)
3. "When taking photos it needs to be a full camera screen and it needs to be able to filter the image background white of the item on the text tile."
4. Part 2: when the phone is plugged in, test EVERY feature on-device, fix what's not working, "make sure app pinning" behaves as specified.

Where OS behavior conflicts with his gesture requirements, HIS REQUIREMENTS WIN. Report the conflict to Hermes rather than silently re-adding traps.

## Part 1 — code changes (do now, no device needed)

### 1.1 Lock = soft pinning toggle; board stays fully usable
Current lock path: JS `toggleLock()` → native bridge `TalkTiles.lock()/unlock()` → `setBoardLocked()` → `startLockTask()` + `hideSystemBars()` + `onBackPressed()` consuming all back while locked + full-screen `#lock-overlay` (red, "BOARD LOCKED") disabling the entire board; lock state persisted across reloads.
Change to:
- **Tap Lock** → `startLockTask()` ONLY (self-pin; the system shows its own "App pinned" toast). While pinned: **all board tiles must remain fully tappable and working**. No full-screen overlay, no bar hiding, no back consumption.
- Remove from the lock path: `hideSystemBars()` / `showSystemBars()` calls, immersive-sticky flags, and the `if (boardLocked) return;` early-return in `onBackPressed()` (keep only the `canGoBack()/goBack()` logic).
- Remove (or make fully non-blocking) the full-screen `#lock-overlay` so it can never cover/disable tiles. The Lock BUTTON must clearly show active state while pinned (e.g., filled/red styling + label change like "Pinned") so the user knows the state at a glance.
- **Tap Unlock** → `stopLockTask()`, button back to normal style.
- Remove any persisted lock state across reloads (localStorage/IndexedDB flag, if present) — pinning is a live OS state, not an app state.
- **Remove `FLAG_SECURE`** from `MainActivity` (Chris dropped the anti-spy requirement; removing it also lets Part 2 verify visuals via adb screencaps).

### 1.2 Camera: full-screen capture + white-background filter
Current: photo capture is a modal with a small `<video class="camera-video">` and a controls row inside the board layout.
Change to:
a) **Full-screen camera.** When the user chooses "take photo", the camera preview fills the ENTIRE screen: `position:fixed; inset:0; z-index` above everything; `object-fit:cover`; no board content visible behind it. Overlay UI on top of the video: close/cancel button (top-right, large tap target ≥48px), capture button (bottom-center, big round), camera-flip if you keep it.
b) **White-background filter.** After capture, show the captured image in an editor view with a "Make background white" control:
   - Pure JS/canvas (NO external libs/APIs — file must stay self-contained + offline).
   - Algorithm: edge flood-fill — BFS from ALL border pixels; replace a pixel with pure white if its color distance to the connected background region is within tolerance. This keeps the photographed item, whites out the table/background around it.
   - Tolerance slider (range ~10–120, default ~40). Re-applying must run against the ORIGINAL capture each time (non-destructive, instant feedback).
   - Buttons: "Undo" (show original photo) and "Save to tile" (store processed image in IndexedDB exactly like the existing photo flow does).
   - Existing flow after save (label → tile) must keep working unchanged.

### 1.3 Build + headless sanity check
- `cd /home/mike/aac-board && ./build.sh` must print `=== BUILD OK ...`. javac is strict against android.jar (API 34) — fix any errors properly, no `|| true` band-aids.
- Headless check with puppeteer (`require('/home/mike/browser-automation/node_modules/puppeteer')`, headless:'new', viewport ~412x915, `file:///home/mike/aac-board/index.html`): zero JS errors on load; lock toggle works without the native bridge present (guard `window.TalkTiles` calls); camera view computes to full-screen when opened; flood-fill function runs on a synthetic canvas without throwing.

## Part 2 — on-device test pass (ONLY after Hermes sends "DEVICE READY"; Chris will have plugged in the Pixel)
ADB=`/home/mike/Android/Sdk/platform-tools/adb`
1. `$ADB devices` → confirm `38290DLJG0016D device`; force-stop + `install -r` the fresh APK; launch it.
2. Test EVERY feature via adb; verify with logcat (tags `AAC_APP` / `AAC_JS`) and `adb exec-out screencap -p > /tmp/shot.png` (FLAG_SECURE is gone, so screencaps will work — READ the images yourself):
   a) Layout buttons 1/2/3 → three distinct grids.
   b) Tap a tile with a recording → it plays (AAC_JS log, no crash).
   c) Editor: add label + record voice (mic permission dialog on first use — approve it via adb input using coordinates from the screencap) + upload image (picker must open; pick one).
   d) Camera: full-screen preview visible in screencap; capture a photo; white-background filter produces a visibly whiter background (before/after screencaps); save to tile works.
   e) **App-pinning matrix (Chris specifically wants this verified):**
      - Tap Lock → system "App pinned" toast appears; confirm lock-task active: `$ADB shell dumpsys activity activities | grep -i 'locktask'`.
      - While pinned, ALL of these must still work: tap a tile (AAC_JS log), pull notification shade (`$ADB shell input swipe 540 150 540 700 400` → shade visible in screencap), back exits/app behaves like normal Android (`$ADB shell input keyevent KEYCODE_BACK`), home works (`$ADB shell input keyevent KEYCODE_HOME`).
      - Tap Unlock (relaunch the app first if home/back exited it) → confirm lock-task released in dumpsys.
      - If the OS hard-blocks any gesture here (this only happens when the user has enabled App Pinning in Settings — check with Chris via Hermes), REPORT the exact observed behavior; do NOT re-add trapping code to "fix" it.
3. Anything that fails: fix → rebuild (`./build.sh`) → reinstall → re-run the failed checks until all green.
4. When ALL pass: update the Talk Tiles entry under `## Ongoing` in `/home/mike/shared-agent-memory.md` with the final state (new soft-lock semantics, camera full-screen + white-bg filter, verification results), then reply exactly: `PART2-DONE <one-line summary>`.

## Completion markers
- Part 1 finished → reply EXACTLY: `PART1-DONE <one-line summary + APK size>` (do not start Part 2; wait for "DEVICE READY").
- Part 2 finished → reply EXACTLY: `PART2-DONE <one-line summary>`.
