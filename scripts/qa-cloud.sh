#!/usr/bin/env bash
# Drives the cloud test workflows on GitHub Actions from this computer, nothing to install:
#   "2 · QA" (Android emulators API 24 / 30 / 36 + iPhone simulator, screenshot + logs)
#   "6 · Live test" (the app on Appetize: a link per device to use it in the browser)
#
#   scripts/qa-cloud.sh run          start a QA run on master and follow it until it ends
#   scripts/qa-cloud.sh status       state of the latest QA run, job by job
#   scripts/qa-cloud.sh stop         cancel the latest QA run if it is still going
#   scripts/qa-cloud.sh results      download its screenshots and logs into qa-results/<run id>/
#   scripts/qa-cloud.sh live [android|ios|both]   send the app to Appetize (Android by default), print the links
#   scripts/qa-cloud.sh links        links of the latest live test (no token needed)
#   scripts/qa-cloud.sh live-stop    delete the builds on Appetize: the links stop working
#
# Needs curl, python3 and a GitHub token allowed to run Actions on this repository:
#   1. https://github.com/settings/personal-access-tokens/new
#      Repository access: only this repository · Permissions: Actions = Read and write
#   2. mkdir -p ~/.config/scanreceipt && chmod 700 ~/.config/scanreceipt
#      printf '%s' 'github_pat_…' > ~/.config/scanreceipt/github-token
#      chmod 600 ~/.config/scanreceipt/github-token
#   (or export GITHUB_TOKEN=… for one session). The token never goes into the repository.
set -euo pipefail

cd "$(dirname "$0")/.."

WORKFLOW=2-qa-devices.yml
LIVE_WORKFLOW=6-live-test-appetize.yml
BRANCH="${QA_BRANCH:-master}"
TOKEN_FILE="$HOME/.config/scanreceipt/github-token"

bold=$'\e[1m'; red=$'\e[31m'; green=$'\e[32m'; yellow=$'\e[33m'; cyan=$'\e[36m'; reset=$'\e[0m'
info() { echo "${cyan}▸${reset} $*"; }
ok() { echo "${green}✔${reset} $*"; }
fail() { echo "${red}✘${reset} $*" >&2; exit 1; }

# owner/name from the "origin" remote (https or ssh form).
REPO="$(git remote get-url origin 2> /dev/null | sed -E 's#(git@github\.com:|https://github\.com/)##; s#\.git$##')"
[[ "$REPO" == */* ]] || fail "No GitHub \"origin\" remote found."
API="https://api.github.com/repos/$REPO"

# Prints the token, or nothing when there is none (reading a public repository needs none).
token() {
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    printf '%s' "$GITHUB_TOKEN"
  elif [[ -r "$TOKEN_FILE" ]]; then
    tr -d '[:space:]' < "$TOKEN_FILE"
  fi
}

require_token() {
  [[ -n "$(token)" ]] || fail "No GitHub token. See the top of scripts/qa-cloud.sh (2 minutes, once)."
}

# api METHOD PATH [JSON BODY] -> response body; fails with GitHub's message on an HTTP error.
api() {
  local method="$1" path="$2" body="${3:-}" response status auth=()
  [[ -n "$(token)" ]] && auth=(-H "Authorization: Bearer $(token)")
  response="$(curl -sS -w '\n%{http_code}' -X "$method" "${auth[@]}" \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    ${body:+-d "$body"} "$API$path")"
  status="${response##*$'\n'}"
  response="${response%$'\n'*}"
  if [[ "$status" -ge 400 ]]; then
    fail "GitHub answered $status: $(json "$response" 'd.get("message", "")')"
  fi
  printf '%s' "$response"
}

# json DOCUMENT PYTHON_EXPRESSION  (the document is `d`)
json() {
  python3 -c 'import json, sys; d = json.loads(sys.argv[1] or "{}"); r = eval(sys.argv[2]); print(r if r is not None else "")' "$1" "$2"
}

latest_run_id() { # of $WORKFLOW
  local runs
  runs="$(api GET "/actions/workflows/$WORKFLOW/runs?per_page=1" 2> /dev/null)" ||
    fail "$WORKFLOW is not on GitHub yet: push it first."
  json "$runs" 'd["workflow_runs"][0]["id"] if d["workflow_runs"] else ""'
}

print_status() {
  local id="$1" run jobs
  run="$(api GET "/actions/runs/$id")"
  jobs="$(api GET "/actions/runs/$id/jobs")"
  echo "${bold}$(json "$run" 'd["display_title"]')${reset} · run $id · commit $(json "$run" 'd["head_sha"][:7]')"
  echo "$(json "$run" 'd["html_url"]')"
  json "$jobs" '"\n".join(
    ("  ✔ " if j["conclusion"] == "success" else "  ✘ " if j["conclusion"] in ("failure", "timed_out") else
     "  ■ " if j["conclusion"] == "cancelled" else "  … ") + j["name"] + "  (" + (j["conclusion"] or j["status"]) + ")"
    for j in d["jobs"])'
  json "$run" 'd["status"] + ("/" + d["conclusion"] if d["conclusion"] else "")'
}

cmd_status() {
  local id="${1:-$(latest_run_id)}"
  [[ -n "$id" ]] || fail "The QA workflow has never run. Start one with: scripts/qa-cloud.sh run"
  print_status "$id" | sed '$d'
}

# cmd_run [INPUTS_JSON]: dispatch $WORKFLOW and follow it.
cmd_run() {
  local before id out state inputs="${1:-}"
  [[ -n "$inputs" ]] || inputs='{}'
  require_token
  before="$(latest_run_id)"
  api POST "/actions/workflows/$WORKFLOW/dispatches" "{\"ref\":\"$BRANCH\",\"inputs\":$inputs}" > /dev/null
  info "Started on $BRANCH. Waiting for GitHub to create the run…"
  for _ in $(seq 1 30); do
    id="$(latest_run_id)"
    [[ -n "$id" && "$id" != "$before" ]] && break
    sleep 3
  done
  [[ -n "$id" && "$id" != "$before" ]] || fail "The run did not appear. Check the Actions tab on GitHub."
  # Ctrl+C only stops following; the run goes on (stop it with: scripts/qa-cloud.sh stop).
  while true; do
    out="$(print_status "$id")"
    state="$(tail -n 1 <<< "$out")"
    clear 2> /dev/null || true
    sed '$d' <<< "$out"
    [[ "$state" == completed* ]] && break
    echo; info "Refreshing every 30 s · Ctrl+C stops following, not the run."
    sleep 30
  done
  [[ "$state" == "completed/success" ]] && ok "Run passed." || echo "${yellow}!${reset} Run ended: $state"
  [[ "$WORKFLOW" == "$LIVE_WORKFLOW" ]] || info "Screenshots and logs: scripts/qa-cloud.sh results"
}

cmd_live() {
  local platform="${1:-android}"
  [[ "$platform" =~ ^(both|android|ios)$ ]] || fail "Platform: both, android or ios."
  WORKFLOW="$LIVE_WORKFLOW"
  cmd_run "{\"action\":\"start\",\"platform\":\"$platform\"}"
  cmd_links
}

cmd_live_stop() {
  WORKFLOW="$LIVE_WORKFLOW"
  cmd_run '{"action":"stop","platform":"both"}'
  ok "Appetize builds deleted: the old links no longer work. Close any tab still open."
}

# The upload step leaves each link as a "Live test <device>" notice on its job.
cmd_links() {
  local id jobs links
  WORKFLOW="$LIVE_WORKFLOW"
  id="$(latest_run_id)" || exit 1
  [[ -n "$id" ]] || fail "No live test yet. Start one with: scripts/qa-cloud.sh live"
  jobs="$(api GET "/actions/runs/$id/jobs")"
  links=""
  while read -r job_id; do
    [[ -n "$job_id" ]] || continue
    links+="$(json "$(api GET "/check-runs/$job_id/annotations")" \
      '"\n".join("  " + x["title"].replace("Live test ", "").ljust(16) + x["message"] for x in d if (x.get("title") or "").startswith("Live test"))')"$'\n'
  done < <(json "$jobs" '"\n".join(str(j["id"]) for j in d["jobs"])')
  links="$(sed '/^$/d' <<< "$links")"
  [[ -n "$links" ]] || fail "Run $id has no links (still building, or the upload failed: scripts/qa-cloud.sh status)."
  echo "${bold}Live test · run $id${reset}  (free plan: 30 min a month · closing the tab stops the session)"
  echo "$links"
}

cmd_stop() {
  local id
  require_token
  id="$(latest_run_id)"
  [[ -n "$id" ]] || fail "No QA run to stop."
  [[ "$(json "$(api GET "/actions/runs/$id")" 'd["status"]')" == completed ]] && { ok "Run $id has already ended."; return; }
  api POST "/actions/runs/$id/cancel" > /dev/null
  ok "Run $id is being cancelled."
}

cmd_results() {
  local id="${1:-$(latest_run_id)}" artifacts dir
  require_token # artifact downloads need one even on a public repository
  [[ -n "$id" ]] || fail "No QA run yet."
  artifacts="$(api GET "/actions/runs/$id/artifacts")"
  [[ "$(json "$artifacts" 'd["total_count"]')" != 0 ]] || fail "Run $id has no results (yet, or they expired after 7 days)."
  dir="qa-results/$id"
  mkdir -p "$dir"
  while IFS=$'\t' read -r artifact_id name; do
    [[ "$name" == debug-apk ]] && continue # the APK is ~30 MB and not a result
    info "Downloading $name…"
    curl -sSL -H "Authorization: Bearer $(token)" -o "$dir/$name.zip" "$API/actions/artifacts/$artifact_id/zip"
    rm -rf "${dir:?}/$name"
    python3 -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$dir/$name.zip" "$dir/$name"
    rm "$dir/$name.zip"
  done < <(json "$artifacts" '"\n".join(str(a["id"]) + "\t" + a["name"] for a in d["artifacts"])')
  ok "Results in $dir:"
  find "$dir" -type f | sort | sed 's/^/  /'
}

case "${1:-}" in
  run) cmd_run ;;
  live) cmd_live "${2:-android}" ;;
  links) cmd_links ;;
  live-stop) cmd_live_stop ;;
  status) cmd_status "${2:-}" ;;
  stop) cmd_stop ;;
  results) cmd_results "${2:-}" ;;
  *) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
