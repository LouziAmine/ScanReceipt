#!/usr/bin/env bash
# Builds the Android app. Usage: scripts/android-build.sh [debug|release]
# Output: dist/android/scanreceipt-<variant>.apk (+ .aab for release, the format Google Play wants)
set -euo pipefail

variant="${1:-debug}"
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [ ! -d node_modules/@angular/core ]; then
  npm ci
fi

npx ng build
npx cap sync android

cd android
out="$root/dist/android"
mkdir -p "$out"

case "$variant" in
  debug)
    ./gradlew --no-daemon assembleDebug
    cp app/build/outputs/apk/debug/app-debug.apk "$out/scanreceipt-debug.apk"
    ;;
  release)
    : "${ANDROID_KEYSTORE_PATH:?Set ANDROID_KEYSTORE_PATH (see .env.android.example)}"
    ./gradlew --no-daemon bundleRelease assembleRelease
    cp app/build/outputs/bundle/release/app-release.aab "$out/scanreceipt-release.aab"
    cp app/build/outputs/apk/release/app-release.apk "$out/scanreceipt-release.apk"
    ;;
  *)
    echo "Unknown variant: $variant (use debug or release)" >&2
    exit 1
    ;;
esac

echo "Done: $(ls "$out")"
