#!/usr/bin/env bash
# Deletes every build of the organization on Appetize, so the live-test links stop working
# and nobody can use up the monthly minutes by opening an old link.
# Appetize has no REST call to end a running session: a session also stops when its tab is
# closed or after the idle timeout (2 minutes by default).
#   APPETIZE_API_KEY=… scripts/appetize-stop.sh
set -euo pipefail

if [[ -z "${APPETIZE_API_KEY:-}" ]]; then
  echo "::error::The APPETIZE_API_KEY secret is missing."
  exit 1
fi

appetize() {
  curl -sS --fail-with-body -X "$1" "https://api.appetize.io$2" -H "X-API-KEY: $APPETIZE_API_KEY"
}

deleted=0
seen=" "
# The list comes 100 at a time; stop as soon as a page brings nothing new (a deleted build
# still listed for a moment must not loop forever).
for _ in $(seq 1 20); do
  new=0
  for id in $(appetize GET /v2/builds | jq -r '.builds[]?.id'); do
    [[ "$seen" == *" $id "* ]] && continue
    seen+="$id "
    appetize DELETE "/v2/builds/$id" > /dev/null
    echo "Deleted build $id"
    deleted=$((deleted + 1))
    new=1
  done
  [[ "$new" == 1 ]] || break
done

echo "::notice title=Live test stopped::$deleted build(s) deleted: the Appetize links no longer work."
echo "### Live test stopped: $deleted build(s) deleted on Appetize, the old links no longer work." \
  >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
