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
if (cd themes/horizon/harness && SHOOT_CHROME= ./validate.sh); then
  rm -rf /opt/horizon-live.prev
  [ -d /opt/horizon-live ] && cp -a /opt/horizon-live /opt/horizon-live.prev
  ./themes/horizon/server/install.sh
  echo "$NEW" >"$STATE"
  echo "horizon-live update: deployed $NEW (previous kept at /opt/horizon-live.prev)"
else
  # remember the failure and its time so the timer does not retry it
  # every five minutes (a retry after the cooldown above); the
  # RUNNING version is untouched
  echo "$NEW failed $(date +%s)" >"$STATE"
  echo "horizon-live update: GATE FAILED for $NEW - keeping current deploy (retry in ${RETRY_AFTER_S}s)" >&2
  exit 1
fi
