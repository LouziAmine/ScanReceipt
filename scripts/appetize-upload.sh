#!/usr/bin/env bash
# Uploads one build to Appetize and prints a live-test link per device.
#   APPETIZE_API_KEY=… scripts/appetize-upload.sh android dist/android/scanreceipt-debug.apk "pixel7 pixel9pro"
#   APPETIZE_API_KEY=… scripts/appetize-upload.sh ios ScanReceipt-simulator.zip "iphone15pro"
# In GitHub Actions the links also become notices and a table in the run summary, where
# `scripts/qa-cloud.sh live` reads them back.
set -euo pipefail

platform="$1"
file="$2"
devices="$3"

if [[ -z "${APPETIZE_API_KEY:-}" ]]; then
  echo "::error::The APPETIZE_API_KEY secret is missing: Appetize > Organization > API Tokens, then GitHub > Settings > Secrets and variables > Actions."
  exit 1
fi
[[ -f "$file" ]] || { echo "::error::Build not found: $file"; exit 1; }

# Each upload is a new build of the same app (matched by package / bundle id on Appetize).
# Tags: up to 20 characters each.
sha="${GITHUB_SHA:-local}"
response="$(curl -sS --fail-with-body -X POST https://api.appetize.io/v2/builds \
  -H "X-API-KEY: $APPETIZE_API_KEY" \
  -F "platform=$platform" \
  -F "file=@$file" \
  -F "tags=[\"${GITHUB_REF_NAME:-local}\",\"${sha:0:7}\"]")" || {
  echo "::error::Appetize refused the upload: $response"
  exit 1
}
id="$(jq -r '.id // empty' <<< "$response")"
[[ -n "$id" ]] || { echo "::error::No build id in the Appetize answer: $response"; exit 1; }

label="$([[ "$platform" == ios ]] && echo iPhone || echo Android)"
{
  echo "### $label · live test (Appetize)"
  echo
  echo "| Device | Link |"
  echo "| --- | --- |"
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
for device in $devices; do
  url="https://appetize.io/app/$id?device=$device"
  echo "$device  $url"
  echo "::notice title=Live test $device::$url"
  echo "| $device | $url |" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
done
echo >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
echo "Free plan: 30 min a month; a session stops when its tab closes or after 2 min idle." \
  >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
