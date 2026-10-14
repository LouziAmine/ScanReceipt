#!/usr/bin/env bash
# Opens an Android emulator window, installs the freshly built app and starts it,
# so a tester can use it by hand. Closing the emulator window ends the script.
# The ML Kit document scanner does not run in emulators: use "Import from photos" there.
set -euo pipefail

apk="dist/android/scanreceipt-debug.apk"
package="app.scanreceipt.mobile"

[ "${SKIP_BUILD:-0}" = "1" ] && [ -f "$apk" ] || ./scripts/android-build.sh debug

emulator -avd smoke -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -memory 3072 \
  > /tmp/emulator.log 2>&1 &
emulator_pid=$!

echo "Booting the emulator (the window opens in a few seconds)…"
deadline=$((SECONDS + 420))
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
  if [ $SECONDS -gt $deadline ] || ! kill -0 "$emulator_pid" 2> /dev/null; then
    echo "The emulator did not start. Last lines of its log:" >&2
    tail -20 /tmp/emulator.log >&2
    exit 1
  fi
  sleep 3
done

adb install -r "$apk" > /dev/null
adb shell am start -n "$package/.MainActivity" > /dev/null
echo "ScanReceipt is running in the emulator. Close the emulator window to finish."
wait "$emulator_pid" || true
