# Verification-only helpers for the Sip Haven storefront. Not product code.
# Sourced by launch.sh, doctor.sh, and cleanup.sh. Do not execute this file directly.

VERIFY_BASE=/tmp/sip-haven-verify

verify_repo_root() {
  local skill_dir
  skill_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
  cd "$skill_dir/../../.." && pwd
}

# Prints the run id to use. Launch always passes SIP_HAVEN_VERIFY_RUN.
# Doctor and the harness use the same rule: an explicit id, otherwise the
# single live server, otherwise refuse so two side-by-side runs are not mixed.
verify_resolve_run_id() {
  if [[ -n ${SIP_HAVEN_VERIFY_RUN:-} ]]; then
    printf '%s\n' "$SIP_HAVEN_VERIFY_RUN"
    return 0
  fi

  local dir pid live=()
  shopt -s nullglob
  for dir in "$VERIFY_BASE"/state/*; do
    [[ -f $dir/pid ]] || continue
    pid=$(<"$dir/pid")
    if [[ $pid =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
      live+=("$(basename "$dir")")
    fi
  done
  shopt -u nullglob

  if [[ ${#live[@]} -eq 1 ]]; then
    printf '%s\n' "${live[0]}"
    return 0
  fi
  if [[ ${#live[@]} -eq 0 ]]; then
    echo "No Sip Haven verification server is running. Run launch.sh." >&2
    return 1
  fi
  echo "More than one live verification server: ${live[*]}. Set SIP_HAVEN_VERIFY_RUN." >&2
  return 1
}

# Cleanup also has to reap a run whose server already died.
verify_resolve_cleanup_id() {
  if [[ -n ${SIP_HAVEN_VERIFY_RUN:-} ]]; then
    printf '%s\n' "$SIP_HAVEN_VERIFY_RUN"
    return 0
  fi

  local dir ids=()
  shopt -s nullglob
  for dir in "$VERIFY_BASE"/state/*; do
    ids+=("$(basename "$dir")")
  done
  shopt -u nullglob

  if [[ ${#ids[@]} -eq 1 ]]; then
    printf '%s\n' "${ids[0]}"
    return 0
  fi
  if [[ ${#ids[@]} -eq 0 ]]; then
    echo "No verification state to clean." >&2
    return 1
  fi
  echo "More than one verification state dir: ${ids[*]}. Set SIP_HAVEN_VERIFY_RUN." >&2
  return 1
}

verify_listener_pids() {
  local port=$1
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u
}

# True when $1 is $2 or a descendant of $2.
verify_pid_is_under() {
  local pid=$1
  local root=$2
  while [[ $pid =~ ^[0-9]+$ ]] && [[ $pid -gt 1 ]]; do
    [[ $pid -eq $root ]] && return 0
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  done
  return 1
}
