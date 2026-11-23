#!/usr/bin/env bash
# Verification-only. Stops the vite process and browser harness this run started.
# Leaves /tmp/sip-haven-verify/evidence/<run-id> in place.
# Invocation: .cursor/skills/verify-sip-haven/cleanup.sh
set -euo pipefail

SKILL_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
source "$SKILL_DIR/common.sh"

RUN_ID=$(verify_resolve_cleanup_id)
STATE=$VERIFY_BASE/state/$RUN_ID
EVIDENCE=$VERIFY_BASE/evidence/$RUN_ID

kill_pid_file() {
  local file=$1
  [[ -f $file ]] || return 0
  local pid
  pid=$(<"$file")
  [[ $pid =~ ^[0-9]+$ ]] || return 0
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  kill "$pid" 2>/dev/null || true
  local _
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.2
  done
  kill -9 "$pid" 2>/dev/null || true
}

# Harness first: its SIGTERM handler closes the Chrome it launched. Then the vite
# pid. Every kill uses a pid file this run wrote. Nothing is selected by process name.
kill_pid_file "$STATE/harness.pid"
kill_pid_file "$STATE/pid"

rm -rf "$STATE"
echo "cleaned run $RUN_ID"
if [[ -d $EVIDENCE ]]; then
  echo "evidence kept at $EVIDENCE"
else
  echo "no evidence directory for run $RUN_ID"
fi
