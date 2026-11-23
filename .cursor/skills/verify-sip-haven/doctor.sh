#!/usr/bin/env bash
# Verification-only read-only check: is this Sip Haven instance worth driving?
# Invocation: .cursor/skills/verify-sip-haven/doctor.sh
set -euo pipefail

SKILL_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
source "$SKILL_DIR/common.sh"

fail() {
  echo "doctor: $*" >&2
  exit 1
}

REPO_ROOT=$(verify_repo_root)
RUN_ID=$(verify_resolve_run_id)
STATE=$VERIFY_BASE/state/$RUN_ID
[[ -d $STATE ]] || fail "no state for run $RUN_ID"

PID=$(<"$STATE/pid")
PORT=$(<"$STATE/port")
URL=$(<"$STATE/url")
[[ $PID =~ ^[0-9]+$ ]] || fail "pid file is not a pid"
[[ $PORT =~ ^[0-9]+$ ]] || fail "port file is not a port"
kill -0 "$PID" 2>/dev/null || fail "vite pid $PID is not running"

cwd=$(readlink -f "/proc/$PID/cwd")
repo=$(readlink -f "$REPO_ROOT")
[[ $cwd == "$repo" ]] || fail "pid $PID cwd is $cwd, expected $repo"

if ! tr '\0' '\n' <"/proc/$PID/cmdline" | grep -q 'vite/bin/vite.js'; then
  fail "pid $PID is not the vite binary this launch started"
fi

if tr '\0' '\n' <"/proc/$PID/environ" | grep -qx 'STORE_OPEN=true'; then
  fail "STORE_OPEN=true on pid $PID. This skill drives the closed store."
fi
if tr '\0' '\n' <"/proc/$PID/environ" | grep -qx 'VITE_STORE_OPEN=true'; then
  fail "VITE_STORE_OPEN=true on pid $PID. This skill drives the closed store."
fi

owners=$(verify_listener_pids "$PORT" || true)
[[ -n $owners ]] || fail "nothing is listening on port $PORT"
owned=0
while IFS= read -r listener; do
  [[ -n $listener ]] || continue
  if verify_pid_is_under "$listener" "$PID"; then
    owned=1
    break
  fi
done <<<"$owners"
[[ $owned -eq 1 ]] || fail "port $PORT is owned by pid(s) $owners, not $PID"

installed=$(node -p "require('$REPO_ROOT/node_modules/vite/package.json').version")
grep -q "VITE v$installed " "$STATE/server.log" || fail "server log is not Vite $installed from this checkout"

html=$(curl -sf --max-time 5 "$URL/") || fail "GET $URL/ failed"
grep -q 'id="root"' <<<"$html" || fail "GET / has no #root"
grep -q 'Sip Haven' <<<"$html" || fail "GET / is not the Sip Haven document"

entry=$(curl -sf --max-time 5 "$URL/src/main.jsx") || fail "GET /src/main.jsx failed"
grep -q 'createBrowserRouter' <<<"$entry" || fail "/src/main.jsx is not this repo's entry"

# There is no shopper login. A closed store is the expected auth-free state.
echo "ok"
echo "run=$RUN_ID"
echo "pid=$PID"
echo "url=$URL"
echo "port_owner=$PID"
echo "cwd=$cwd"
echo "vite=$installed"
echo "store=closed"
echo "auth=none"
echo "entry=src/main.jsx"
