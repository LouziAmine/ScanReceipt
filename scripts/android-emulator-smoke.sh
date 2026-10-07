#!/usr/bin/env bash
# Boots a headless Android emulator, installs the debug APK, starts the app and saves
# a screenshot + the relevant logcat lines. Fails if the app crashes or shows a JS error.
set -euo pipefail

apk="dist/android/scanreceipt-debug.apk"
out="dist/android"
package="app.scanreceipt.mobile"

# Always test the current code; SKIP_BUILD=1 reuses the last APK.
[ "${SKIP_BUILD:-0}" = "1" ] && [ -f "$apk" ] || ./scripts/android-build.sh debug

emulator -avd smoke -no-window -no-audio -no-boot-anim -no-snapshot \
  -gpu swiftshader_indirect -memory 3072 > /tmp/emulator.log 2>&1 &
emulator_pid=$!

echo "Booting emulator…"
deadline=$((SECONDS + 420))
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
  if [ $SECONDS -gt $deadline ] || ! kill -0 "$emulator_pid" 2> /dev/null; then
    echo "The emulator did not boot. Last lines of its log:" >&2
    tail -20 /tmp/emulator.log >&2
    exit 1
  fi
  sleep 3
done
adb shell input keyevent 82 || true

echo "Installing and starting $package…"
adb install -r "$apk" > /dev/null
adb logcat -c
adb shell am start -W -n "$package/.MainActivity" > /dev/null
sleep 25

adb exec-out screencap -p > "$out/emulator-screenshot.png"
adb logcat -d > /tmp/logcat.txt
grep -E "Capacitor|chromium|AndroidRuntime|FATAL|SQLite" /tmp/logcat.txt > "$out/emulator-logcat.txt" || true
adb emu kill > /dev/null 2>&1 || true

if grep -qE "FATAL EXCEPTION|ERROR Error|Uncaught" "$out/emulator-logcat.txt"; then
  echo "App errors found, see $out/emulator-logcat.txt" >&2
  exit 1
fi
echo "OK: app started. Screenshot: $out/emulator-screenshot.png"
