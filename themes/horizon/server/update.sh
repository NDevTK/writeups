#!/bin/bash
# horizon-live self-updater - the box deploys ITSELF, gated by the
# same reference suite the repo trusts. Run by the systemd timer
# (horizon-live-update.timer); safe to run by hand.
#
# Flow: fetch the watched branch of the repo; if the server files
# changed since the last considered revision, check out the new
# tree, run the FULL CPU reference gate on the box (plain node -
# that portability is the point of the gate), and only on PASS
# back up /opt/horizon-live and reinstall. A failing gate leaves
# the running version untouched and is remembered so the journal
# is not spammed every five minutes. Rollback: the previous
# install is kept at /opt/horizon-live.prev.
#
# Config (optional, in /etc/horizon-live.env):
#   UPDATE_REPO    git URL   (default the NDevTK/writeups repo)
#   UPDATE_BRANCH  branch    (default main - merging to main IS
#                             the deploy trigger, same as Pages)
set -euo pipefail
[ -f /etc/horizon-live.env ] && set -a && . /etc/horizon-live.env && set +a
REPO=${UPDATE_REPO:-https://github.com/NDevTK/writeups}
BRANCH=${UPDATE_BRANCH:-main}
CLONE=/opt/horizon-live-repo
STATE=/opt/horizon-live-update.state

if [ ! -d "$CLONE/.git" ]; then
  git clone --branch "$BRANCH" "$REPO" "$CLONE"
fi
cd "$CLONE"
git fetch origin "$BRANCH" --quiet
NEW=$(git rev-parse "origin/$BRANCH")
LAST=$(cat "$STATE" 2>/dev/null || echo none)
[ "$NEW" = "$LAST" ] && exit 0
# A revision whose gate FAILED is remembered as "<rev> failed <epoch>"
# and retried after a cooldown (158th pass): a transient failure - a
# box short of memory that hour, a fetch the gate could not make -
# no longer pins the deploy to the old build until the next commit.
RETRY_AFTER_S=${UPDATE_RETRY_S:-21600}
FORCE=
case "$LAST" in
  "$NEW failed "*)
    FAILED_AT=${LAST##* }
    if [ $(( $(date +%s) - FAILED_AT )) -lt "$RETRY_AFTER_S" ]; then exit 0; fi
    echo "horizon-live update: retrying $NEW after its failed gate"
    # the tree is already at NEW from the failed attempt, so the
    # change check below would see nothing - gate regardless
    FORCE=1
    ;;
esac

CUR=$(git rev-parse HEAD)
# The shared-module watch list is DERIVED from install.sh's own ship
# list, so the two can never drift again: a module install.sh ships
# but this diff did not watch would deploy stale physics forever
# (modis-land.js was exactly that). A ship-list change itself lands
# under themes/horizon/server, which stays watched explicitly.
mapfile -t SHIPPED < <(sed -n \
  's#^install -m 644 \.\./\([a-z0-9-]*\.js\) .*#themes/horizon/\1#p' \
  themes/horizon/server/install.sh)
CHANGED=$(git diff --name-only "$CUR" "$NEW" -- \
  themes/horizon/server \
  "${SHIPPED[@]}" \
  themes/horizon/'*-reference.mjs' \
  themes/horizon/harness/validate.sh 2>/dev/null || echo forced)
git checkout --quiet "$NEW"
if [ -z "$CHANGED" ] && [ -z "$FORCE" ]; then
  # unrelated commit (site content etc.) - considered, no deploy
  echo "$NEW" >"$STATE"
  exit 0
fi

echo "horizon-live update: $CUR -> $NEW (gating...)"
# THE GATE'S OWN REPORT (172nd pass): the phase, the revision, the
# seconds the gate took and, on a failure, the failing lines of its
# output are written as JSON to a world-readable status file that the
# running daemon serves under /health as version.update - so a box
# whose gate fails or crawls is seen from anywhere, without the
# journal (the 167th-171st sat unseen behind a gate for hours).
STATUS=${UPDATE_STATUS:-/opt/horizon-live-update.status.json}
GATE_LOG=${UPDATE_GATE_LOG:-/opt/horizon-live-update.gate.log}
json_str() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\r' | awk 'BEGIN{ORS=""} NR>1{print "\\n"} {print}'; }
write_status() { # phase rev startedAt seconds tail
  printf '{"phase":"%s","rev":"%s","startedAt":"%s","gatedS":%s,"at":"%s","tail":"%s"}\n' \
    "$1" "$2" "$3" "$4" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(json_str "$5")" >"$STATUS.tmp"
  mv -f "$STATUS.tmp" "$STATUS"
  chmod 644 "$STATUS" 2>/dev/null || true
}
STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
T0=$(date +%s)
write_status gating "$NEW" "$STARTED_AT" 0 ""
if (cd themes/horizon/harness && SHOOT_CHROME= ./validate.sh 2>&1 | tee "$GATE_LOG"); then
  GATED_S=$(( $(date +%s) - T0 ))
  write_status installing "$NEW" "$STARTED_AT" "$GATED_S" "$(grep -c '^\[ok\]' "$GATE_LOG" 2>/dev/null || echo 0) files passed"
  rm -rf /opt/horizon-live.prev
  [ -d /opt/horizon-live ] && cp -a /opt/horizon-live /opt/horizon-live.prev
  # THE INSTALL CAN FAIL AFTER A PASSING GATE (174th, measured): the
  # ship-list drift guard refuses an index.mjs whose '../../' import was
  # not rewritten - and under set -e that abort used to leave the state
  # file unwritten, so the same revision was gated again at the next
  # tick, an hour a time, with nothing recorded (the 168th-173rd sat
  # behind it for hours). Record it like a failed gate (the cooldown
  # applies) and say so in the status file.
  INSTALL_LOG=${UPDATE_INSTALL_LOG:-/opt/horizon-live-update.install.log}
  if ./themes/horizon/server/install.sh >"$INSTALL_LOG" 2>&1; then
    cat "$INSTALL_LOG"
    write_status deployed "$NEW" "$STARTED_AT" "$GATED_S" "$(grep -c '^\[ok\]' "$GATE_LOG" 2>/dev/null || echo 0) files passed"
    echo "$NEW" >"$STATE"
    echo "horizon-live update: deployed $NEW (previous kept at /opt/horizon-live.prev)"
  else
    cat "$INSTALL_LOG" >&2
    echo "$NEW failed $(date +%s)" >"$STATE"
    write_status install-failed "$NEW" "$STARTED_AT" "$GATED_S" "$(tail -n 8 "$INSTALL_LOG")"
    echo "horizon-live update: INSTALL FAILED for $NEW after a passing gate - keeping current deploy (retry in ${RETRY_AFTER_S}s)" >&2
    exit 1
  fi
else
  # remember the failure and its time so the timer does not retry it
  # every five minutes (a retry after the cooldown above); the
  # RUNNING version is untouched
  echo "$NEW failed $(date +%s)" >"$STATE"
  write_status failed "$NEW" "$STARTED_AT" $(( $(date +%s) - T0 )) "$(grep -aE '^\[FAIL\]|FAIL |Error|error' "$GATE_LOG" 2>/dev/null | tail -n 8)"
  echo "horizon-live update: GATE FAILED for $NEW - keeping current deploy (retry in ${RETRY_AFTER_S}s)" >&2
  exit 1
fi
