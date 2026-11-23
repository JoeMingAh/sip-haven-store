#!/usr/bin/env bash
# Verification-only. Starts the Sip Haven Vite dev server for a shopper-level check.
# Not product code. Invocation: .cursor/skills/verify-sip-haven/launch.sh
set -euo pipefail

SKILL_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
source "$SKILL_DIR/common.sh"

REPO_ROOT=$(verify_repo_root)
RUN_ID=${SIP_HAVEN_VERIFY_RUN:-$(date -u +%Y%m%dT%H%M%SZ)-$$}
PORT=${SIP_HAVEN_VERIFY_PORT:-5173}
STATE=$VERIFY_BASE/state/$RUN_ID
EVIDENCE=$VERIFY_BASE/evidence/$RUN_ID
PID=

if [[ -e $STATE ]]; then
  echo "Run id already exists: $RUN_ID" >&2
  exit 1
fi

for env_file in .env .env.local .env.development .env.development.local; do
  if [[ -e $REPO_ROOT/$env_file ]]; then
    echo "Refusing to launch: $REPO_ROOT/$env_file is present." >&2
    echo "Vite would load it. That can open the store or read live Stripe, Resend, or Blob secrets." >&2
    echo "Move the file aside for this run. Do not commit it, and do not point this skill at production." >&2
    exit 1
  fi
done

if pids=$(verify_listener_pids "$PORT") && [[ -n $pids ]]; then
  echo "Port $PORT is already in use by pid $pids." >&2
  echo "Set SIP_HAVEN_VERIFY_PORT to a free port. This skill will not drive a server it did not start." >&2
  exit 1
fi

mkdir -p "$STATE" "$EVIDENCE"
printf '%s\n' "$RUN_ID" >"$STATE/run-id"
printf '%s\n' "$PORT" >"$STATE/port"
printf '%s\n' "http://127.0.0.1:$PORT" >"$STATE/url"

cd "$REPO_ROOT"
if [[ ! -f node_modules/vite/bin/vite.js ]]; then
  npm ci
fi

# The committed default is a closed store. Drop anything a parent shell exported
# so this instance cannot open the store or call Stripe, Resend, or Blob.
env \
  -u STORE_OPEN \
  -u VITE_STORE_OPEN \
  -u STRIPE_SECRET_KEY \
  -u VITE_STRIPE_PUBLIC_KEY \
  -u STRIPE_WEBHOOK_SECRET \
  -u RESEND_API_KEY \
  -u RESEND_AUDIENCE_ID \
  -u RESEND_SEGMENT_TEA \
  -u RESEND_SEGMENT_COFFEE \
  -u BLOB_READ_WRITE_TOKEN \
  -u ORDER_NOTIFY_EMAIL \
  node node_modules/vite/bin/vite.js --host 127.0.0.1 --port "$PORT" --strictPort \
  >"$STATE/server.log" 2>&1 &
PID=$!
printf '%s\n' "$PID" >"$STATE/pid"

stop_server() {
  if [[ -n ${PID:-} ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
  fi
}
ready=0
cleanup_if_failed() {
  if [[ $ready -ne 1 ]]; then
    stop_server
  fi
}
trap cleanup_if_failed EXIT

for _ in $(seq 1 60); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "Vite exited during startup. Log:" >&2
    cat "$STATE/server.log" >&2
    exit 1
  fi
  if doctor_out=$(SIP_HAVEN_VERIFY_RUN=$RUN_ID "$SKILL_DIR/doctor.sh" 2>"$STATE/doctor-last.err"); then
    ready=1
    break
  fi
  sleep 0.5
done

if [[ $ready -ne 1 ]]; then
  echo "Timed out waiting for a usable storefront. Last doctor check:" >&2
  cat "$STATE/doctor-last.err" >&2
  echo "Vite log:" >&2
  cat "$STATE/server.log" >&2
  exit 1
fi

printf '%s\n' "$doctor_out"
echo "EVIDENCE=$EVIDENCE"
echo "STATE=$STATE"
echo "Export SIP_HAVEN_VERIFY_RUN=$RUN_ID before doctor, harness, or cleanup if another run is also up."
