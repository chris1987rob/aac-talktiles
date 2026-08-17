# Talk Tiles v1.0 — archived original

This is the app exactly as it stood before the v2 changes (2026-08-17), kept so
it can be rebuilt or reinstalled without touching the live project.

- `AAC-Board-v1.0.apk` — signed, installable, versionCode 1.
- `index.html`, `app/` — the v1 sources, byte-identical to the originals.
- `build.sh` — the current parametric build script with the v1 knobs. It builds
  in place, into this directory. Do not point it at the parent project.

## Rebuild

    cd /home/mike/aac-board/versions/v1 && ./build.sh

## Install

v1 and v2 are the same package (`com.aacboard.app`) signed with the same key, so
only one can be on the phone at a time and installing one replaces the other.

    ADB=/home/mike/Android/Sdk/platform-tools/adb
    $ADB install -r -d versions/v1/AAC-Board-v1.0.apk   # -d: allow the downgrade from v2

`-d` is required going v2 → v1: Android refuses a lower versionCode without it.
`-r` keeps the tiles already saved in IndexedDB.

## The signing key is NOT in here

`aac.keystore` lives in the project root and is shared by every version, on
purpose — a duplicated key is a key that gets lost out of sync. `build.sh` here
points at `/home/mike/aac-board/aac.keystore`. If that file is ever lost,
Android treats every future build as a different app and the saved board is
gone with it.
