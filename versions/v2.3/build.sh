#!/usr/bin/env bash
# No-Gradle build of the Talk Tiles APK using the local Android SDK.
#
# Everything that differs between releases lives in the knobs below, and every
# path is derived from this script's own location -- so versions/v1/build.sh is
# this same script with the v1 knobs, and it builds the archived v1 in place.
set -euo pipefail

# --- release knobs ---------------------------------------------------------
VERSION_CODE=5
VERSION_NAME="2.3"
APK_NAME="AAC-Board-v2.3.apk"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# The signing key is shared by every version and lives in the project root.
# Losing it means Android treats a new build as a different app, so it is
# deliberately NOT duplicated into the version snapshots.
KS="${KS:-/home/mike/aac-board/aac.keystore}"
# The keystore password is deliberately NOT in this file -- this file is
# committed and the password would go with it. Provide it either in the
# environment as KS_PASS, or in a `.keystore-pass` file next to this script or
# next to the keystore itself. Both are gitignored.
KS_PASS="${KS_PASS:-}"
if [ -z "$KS_PASS" ]; then
  for _pf in "$ROOT/.keystore-pass" "$(dirname "$KS")/.keystore-pass"; do
    if [ -f "$_pf" ]; then KS_PASS="$(tr -d '\r\n' < "$_pf")"; break; fi
  done
fi
if [ -z "$KS_PASS" ]; then
  echo "error: keystore password not set." >&2
  echo "  export KS_PASS=...   or write it to $(dirname "$KS")/.keystore-pass" >&2
  exit 1
fi

SDK=/home/mike/Android/Sdk
BT=$SDK/build-tools/33.0.1
PLAT=$SDK/platforms/android-34/android.jar
APP=$ROOT/app
OUT=$ROOT/build

export ANDROID_HOME=$SDK
PATH=$BT:$PATH
export PATH

echo "=== Building $APK_NAME (versionCode $VERSION_CODE) from $ROOT ==="

rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/obj" "$OUT/dex" "$APP/assets"

# --- assets: the board itself ---
cp "$ROOT/index.html" "$APP/assets/index.html"
if [ -f "$ROOT/symbols_data.js" ]; then
  cp "$ROOT/symbols_data.js" "$APP/assets/symbols_data.js"
fi
if [ -d "$ROOT/symbols" ]; then
  # -L: version archives symlink `symbols` back at the project copy (same 3,436
  # Mulberry files since v2.3); dereference so the APK gets real files.
  cp -rL "$ROOT/symbols" "$APP/assets/symbols"
fi
# v2.2 also shipped an ONNX segmentation model here for automatic background
# removal. That feature was dropped in v2.3; the runtime and model are archived
# under versions/v2.2/assets. Clear any stragglers so an old build tree does
# not quietly add 15 MB back to the APK.
rm -rf "$APP/assets/assets"

# --- 1. compile resources ---
aapt2 compile --dir "$APP/res" -o "$OUT/compiled.zip"

# --- 2. link (manifest + resources + assets) into base APK, emit R.java ---
aapt2 link \
  -o "$OUT/base.apk" \
  -I "$PLAT" \
  --manifest "$APP/AndroidManifest.xml" \
  --java "$OUT/gen" \
  -A "$APP/assets" \
  --min-sdk-version 26 \
  --target-sdk-version 34 \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  "$OUT/compiled.zip"

# --- 3. compile java (app + generated R) ---
find "$APP/src" "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac --release 8 -classpath "$PLAT" -d "$OUT/obj" @"$OUT/sources.txt"

# --- 4. dex ---
d8 --release --min-api 26 --output "$OUT/dex" \
  $(find "$OUT/obj" -name '*.class')

# --- 5. stuff classes.dex into the APK ---
AAC_OUT="$OUT" python3 - <<'EOF'
import zipfile, os
out = os.environ["AAC_OUT"]
src, dst = os.path.join(out, "base.apk"), os.path.join(out, "unsigned.apk")
zin = zipfile.ZipFile(src, "r")
zout = zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED)
# resources.arsc must be STORED (uncompressed) + 4-byte aligned for target SDK 30+
for item in zin.namelist():
    data = zin.read(item)
    if item == "resources.arsc":
        zout.writestr(zipfile.ZipInfo(item), data, compress_type=zipfile.ZIP_STORED)
    else:
        zout.writestr(item, data)
with open(os.path.join(out, "dex", "classes.dex"), "rb") as f:
    zout.writestr("classes.dex", f.read())
zout.close(); zin.close()
print("unsigned.apk built with classes.dex:", os.path.getsize(dst), "bytes")
EOF

# --- 6. align + sign ---
zipalign -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KS" ]; then
  keytool -genkeypair -v \
    -keystore "$KS" -alias aacboard \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=AAC Board, OU=Chris, O=AACBoard, L=Boston, ST=MA, C=US"
fi

apksigner sign \
  --ks "$KS" --ks-pass "pass:$KS_PASS" \
  --ks-key-alias aacboard --key-pass "pass:$KS_PASS" \
  --out "$ROOT/$APK_NAME" \
  "$OUT/aligned.apk"

# --- 7. verify ---
apksigner verify --print-certs "$ROOT/$APK_NAME" | head -2
aapt dump badging "$ROOT/$APK_NAME" | head -2
echo "=== BUILD OK: $ROOT/$APK_NAME ==="
