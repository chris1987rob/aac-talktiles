# AAC Picture Board — Spec (build exactly this)

**Deliverable:** ONE self-contained file: `/home/mike/aac-board/index.html`
Vanilla HTML + CSS + JS only. **No external CDNs, no npm, no build step** — must work
offline on a tablet/phone browser (Chrome/Safari). All data persisted in IndexedDB.

## What it is
A communication board ("AAC-style"): a grid of picture tiles. Each tile can hold a photo
(camera capture) and a voice recording (user's own voice, e.g. "I want water").
When the user taps a tile that has a recording, it PLAYS THAT RECORDING.

## Top bar (always visible)
- Layout buttons: `[1]` `[2]` `[3]` — switch grid template, active one highlighted
- Lock button (padlock icon, 📷🔒 emoji or inline SVG): toggles screen lock

### Layout templates (each a DISTINCT size + style, not just smaller squares)
1. **Layout 1 — "Huge"**: 2×2 grid = 4 tiles, very large, chunky rounded corners (radius ~24px), warm palette (soft orange/cream tiles on light background), thick borders.
2. **Layout 2 — "Classic"**: 3×3 grid = 9 tiles, medium size, radius ~16px, cool palette (soft blue/slate), standard borders.
3. **Layout 3 — "Dense"**: 4 columns × 3 rows = 12 tiles, smaller, radius ~8px, high-contrast dark theme (near-black background, white outlined tiles, bright accent) for visibility.

Tile content: photo fills the tile (object-fit: cover); if no photo yet, show a camera
icon placeholder + optional text label. Tiles that HAVE a recording get a small speaker
badge (🔊) so users know it will speak.

## Interactions
- **Tap tile with audio** → play its recording (stop any other tile's audio first).
  Show brief "playing" pulse animation on the tile.
- **Tap empty tile, or tap-hold (~600ms) a filled tile** → open the editor panel for that tile.
  (Also provide a small ✏️ button in the top bar that puts the board into EDIT MODE where
  plain taps open the editor — good for usability; when edit mode is off, tap = play.)

### Editor panel (modal overlay)
- Preview of current photo/recording (if any)
- **📷 Take Photo**: `navigator.mediaDevices.getUserMedia({video: true})` → live video
  preview in the modal → "Capture" button draws to canvas → store JPEG blob. Cancel stops camera stream.
- **🎙️ Record Voice**: `MediaRecorder` on mic stream (default audio; try webm, accept whatever
  browser gives). Show recording indicator + elapsed seconds, max ~15s auto-stop. "Re-record" and "Stop".
- **Save** / **Cancel** buttons. Save writes to IndexedDB.
- **Clear tile** button (removes photo+audio with confirm).

## Lock feature (on screen, prominent)
- Tap lock button → LOCKED state: padlock shows as closed + board dims slightly with a
  "LOCKED" overlay label; ALL tile taps ignored (no playback, no editing) and layout
  buttons disabled. The unlock button itself stays visible and tappable to release.
- Persist lock state across reload (localStorage).

## Data model (IndexedDB, db `aac-board`, store `tiles` keyPath `id`)
```js
{ id: number (tile slot index within 1..12),
  photo: Blob|null,      // image/jpeg
  audio: Blob|null,      // recorded audio (any mime)
  label: string,         // optional text caption
  updatedAt: number }
```
- Tiles belong to a SLOT (1–12), not to a layout — switching layout keeps content in the
  same slot numbers. Slots beyond a layout's tile count simply aren't shown.
- Load all tiles on startup before rendering.

## Quality bar
- Mobile-first, works fullscreen portrait; `touch-action: manipulation`, no 300ms tap delay feel.
- Graceful error toasts when camera/mic permission is denied (e.g. "Camera blocked — allow in browser settings").
- No console errors on load; must render the empty board fine even before any permission grants.

## Definition of done
1. `index.html` exists and opens without JS errors (verify with headless check if available).
2. Layout 1/2/3 visibly change size AND style as specced.
3. Lock disables everything except the unlock control.
4. Camera + mic flows implemented per Web APIs above (can't fully test camera in CI, but code paths must be correct and errors handled).
