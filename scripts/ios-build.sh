#!/usr/bin/env bash
# iOS build, macOS only (Apple requires Xcode: Docker cannot build iOS apps).
#   scripts/ios-build.sh simulator   build and launch in the iPhone simulator
#   scripts/ios-build.sh archive     Release archive in dist/ios, then upload it from Xcode > Organizer
set -euo pipefail

if [ "$(uname)" != "Darwin" ]; then
  echo "iOS builds need macOS with Xcode and CocoaPods (Apple requirement)." >&2
  exit 1
fi

mode="${1:-simulator}"
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

[ -d node_modules/@angular/core ] || npm ci
npx ng build
npx cap sync ios
(cd ios/App && pod install)

workspace="ios/App/App.xcworkspace"
case "$mode" in
  simulator)
    xcodebuild -workspace "$workspace" -scheme App -configuration Debug \
      -sdk iphonesimulator -derivedDataPath build/ios CODE_SIGNING_ALLOWED=NO build
    device="$(xcrun simctl list devices available | grep -m1 -E '^\s+iPhone' | grep -oE '[0-9A-F-]{36}')"
    xcrun simctl boot "$device" 2>/dev/null || true
    open -a Simulator
    xcrun simctl install "$device" build/ios/Build/Products/Debug-iphonesimulator/App.app
    xcrun simctl launch "$device" app.scanreceipt.mobile
    echo "Running in the simulator. The camera scanner needs a real iPhone."
    ;;
  archive)
    mkdir -p dist/ios
    xcodebuild -workspace "$workspace" -scheme App -configuration Release \
      -destination 'generic/platform=iOS' -archivePath dist/ios/ScanReceipt.xcarchive archive
    open dist/ios/ScanReceipt.xcarchive
    echo "Archive ready: Xcode Organizer opened. Click 'Distribute App' to upload to App Store Connect."
    ;;
  *)
    echo "Unknown mode: $mode (use simulator or archive)" >&2
    exit 1
    ;;
esac
