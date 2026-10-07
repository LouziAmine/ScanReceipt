#!/usr/bin/env bash
# ScanReceipt test console: type a number to run, stop or rebuild anything.
# Every launch uses the newest code: git pull (when a remote is set), dependencies
# reinstalled when package-lock.json changed, and the app rebuilt before it runs.
#
#   ./tester.sh            interactive menu
#   ./tester.sh 3          run menu entry 3 directly (handy for scripts / CI)
set -uo pipefail

cd "$(dirname "$0")"

export UID
GID="$(id -g)"
KVM_GID="$(getent group kvm 2> /dev/null | cut -d: -f3 || true)"
export GID KVM_GID

bold=$'\e[1m'; dim=$'\e[2m'; red=$'\e[31m'; green=$'\e[32m'; yellow=$'\e[33m'; cyan=$'\e[36m'; reset=$'\e[0m'

info() { echo "${cyan}▸${reset} $*"; }
ok() { echo "${green}✔${reset} $*"; }
warn() { echo "${yellow}!${reset} $*"; }
fail() { echo "${red}✘${reset} $*" >&2; }

compose() { docker compose "$@"; }

# ---------------------------------------------------------------- Docker itself

docker_running() { docker info > /dev/null 2>&1; }

start_docker() {
  if docker_running; then ok "Docker is already running."; return 0; fi
  info "Starting Docker (sudo password needed)…"
  sudo systemctl start docker && ok "Docker started." || fail "Could not start Docker."
}

stop_docker() {
  info "Stopping the ScanReceipt containers…"
  docker_running && compose down --remove-orphans > /dev/null 2>&1
  info "Stopping Docker (sudo password needed)…"
  sudo systemctl stop docker.socket docker && ok "Docker stopped." || fail "Could not stop Docker."
}

require_docker() {
  if ! command -v docker > /dev/null; then
    fail "Docker is not installed: https://docs.docker.com/engine/install/"
    return 1
  fi
  docker_running || start_docker
  docker_running
}

# ---------------------------------------------------------------- Newest code

pull_latest_code() {
  if [ ! -d .git ]; then
    info "Not a git repository: using the local code as is."
    return 0
  fi
  if ! git rev-parse --abbrev-ref '@{u}' > /dev/null 2>&1; then
    info "No tracked remote branch: using the local code."
    return 0
  fi
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    warn "Uncommitted local changes: no git pull, using the local code."
    return 0
  fi
  info "Fetching the latest code (git pull)…"
  git pull --ff-only && ok "Code up to date: $(git log -1 --format='%h %s')" ||
    warn "git pull failed (diverged branch?): using the local code."
}

ensure_images() {
  info "Build image (rebuilt only when the Dockerfile changed)…"
  compose build --quiet install
}

ensure_dependencies() {
  local wanted current
  wanted="$(sha256sum package-lock.json | cut -d' ' -f1)"
  current="$(compose run --rm -T install sh -c 'cat node_modules/.lock-hash 2> /dev/null' 2> /dev/null | tr -d '\r' || true)"
  if [ "$wanted" = "$current" ]; then
    ok "Dependencies up to date."
    return 0
  fi
  info "package-lock.json changed: installing dependencies…"
  compose run --rm install sh -c "npm ci && echo $wanted > node_modules/.lock-hash"
}

# Run before every launch so the tester always gets the current app.
prepare() {
  require_docker || return 1
  pull_latest_code
  ensure_images || return 1
  ensure_dependencies || return 1
}

# ---------------------------------------------------------------- Actions

open_url() { command -v xdg-open > /dev/null && xdg-open "$1" > /dev/null 2>&1 || true; }

web_start() {
  prepare || return 1
  info "Starting the web app (reloads on every code change)…"
  compose up -d dev || return 1
  info "Compiling…"
  for _ in $(seq 1 90); do
    if curl -s -o /dev/null http://localhost:4200; then
      ok "App ready at ${bold}http://localhost:4200${reset}"
      open_url http://localhost:4200
      return 0
    fi
    sleep 2
  done
  warn "Not ready yet: see the logs (entry 9)."
}

web_stop() { compose stop dev && ok "Web app stopped."; }

verify() { prepare && compose run --rm verify && ok "All green."; }

build_apk() {
  prepare || return 1
  compose run --rm android && ok "APK : ${bold}dist/android/scanreceipt-debug.apk${reset}"
}

emulator_gui() {
  if [ ! -e /dev/kvm ]; then fail "KVM unavailable: the emulator cannot run on this machine."; return 1; fi
  if [ -z "${DISPLAY:-}" ]; then fail "No graphical display (DISPLAY is empty)."; return 1; fi
  prepare || return 1
  compose build --quiet emulator || return 1
  xhost +local:docker > /dev/null 2>&1 || warn "xhost unavailable: the window may not open."
  info "Opening the emulator. Close its window to come back to the menu."
  info "${dim}The camera scanner does not work in the emulator: use \"Import from photos\".${reset}"
  compose run --rm emulator-gui
}

emulator_smoke() {
  if [ ! -e /dev/kvm ]; then fail "KVM unavailable on this machine."; return 1; fi
  prepare || return 1
  compose build --quiet emulator || return 1
  compose run --rm emulator && ok "Screenshot: ${bold}dist/android/emulator-screenshot.png${reset}" && open_url dist/android/emulator-screenshot.png
}

install_phone() {
  prepare || return 1
  compose run --rm android || return 1
  info "Plug in the phone over USB (USB debugging on) and accept the key on its screen…"
  compose run --rm android-install && ok "App installed on the phone."
}

build_release() {
  if [ ! -f .env.android ]; then
    fail "Missing .env.android file: copy .env.android.example and fill it in."
    return 1
  fi
  prepare || return 1
  compose run --rm android-release && ok "Release: ${bold}dist/android/${reset} (.aab for Google Play)"
}

status() {
  require_docker || return 1
  compose ps --all
  echo
  docker images --format '{{.Repository}}:{{.Tag}}  {{.Size}}' | grep scanreceipt || true
}

logs() { compose logs --tail 80 -f dev; }

stop_all() { compose down --remove-orphans && ok "All ScanReceipt containers stopped."; }

rebuild_images() {
  require_docker || return 1
  info "Full image rebuild (no cache, ~15 min)…"
  compose build --no-cache install && compose build --no-cache emulator && ok "Images rebuilt."
}

reset_all() {
  read -r -p "Delete containers, dependencies and Gradle cache (y/N)? " answer
  [[ "$answer" =~ ^[yY]$ ]] || return 0
  compose down --volumes --remove-orphans && ok "Reset done: the next run reinstalls everything."
}

# ---------------------------------------------------------------- Menu

menu() {
  local docker_state="${red}stopped${reset}"
  docker_running && docker_state="${green}running${reset}"
  local web_state="${dim}stopped${reset}"
  docker_running && [ -n "$(compose ps -q dev 2> /dev/null)" ] && web_state="${green}http://localhost:4200${reset}"

  cat << EOF

${bold}ScanReceipt — test console${reset}     Docker: $docker_state   Web app: $web_state
${dim}Every run takes the latest code, then rebuilds the app.${reset}

 ${bold}Run${reset}
   1) Web app in the browser
   2) Android emulator (window, manual testing)
   3) Automated emulator test (screenshot + logs)
   4) Install on an Android phone (USB)
   5) Build the test APK
   6) Full check (lint + tests + build)
   7) Signed release build (Google Play)

 ${bold}Manage${reset}
   8) Stop the web app
   9) Web app logs
  10) Containers and images status
  11) Stop everything
  12) Rebuild the Docker images
  13) Reset (dependencies + caches)

 ${bold}Docker${reset}
  14) Start Docker
  15) Stop Docker

   0) Quit
EOF
}

run_choice() {
  case "$1" in
    1) web_start ;;
    2) emulator_gui ;;
    3) emulator_smoke ;;
    4) install_phone ;;
    5) build_apk ;;
    6) verify ;;
    7) build_release ;;
    8) web_stop ;;
    9) logs ;;
    10) status ;;
    11) stop_all ;;
    12) rebuild_images ;;
    13) reset_all ;;
    14) start_docker ;;
    15) stop_docker ;;
    0 | q) exit 0 ;;
    *) warn "Unknown choice: $1" ;;
  esac
}

if [ $# -gt 0 ]; then
  run_choice "$1"
  exit $?
fi

while true; do
  menu
  read -r -p "${bold}Your choice: ${reset}" choice || exit 0
  echo
  run_choice "$choice" || fail "The action failed (see the messages above)."
  read -r -p "${dim}Press Enter to go back to the menu…${reset}" _ || exit 0
done
