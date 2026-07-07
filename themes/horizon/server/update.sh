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

CUR=$(git rev-parse HEAD)
CHANGED=$(git diff --name-only "$CUR" "$NEW" -- \
  themes/horizon/server \
  themes/horizon/lightning.js themes/horizon/'*-reference.mjs' \
  themes/horizon/harness/validate.sh 2>/dev/null || echo forced)
git checkout --quiet "$NEW"
if [ -z "$CHANGED" ]; then
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
  # remember the failure so the timer does not retry it forever;
  # the RUNNING version is untouched
  echo "$NEW" >"$STATE"
  echo "horizon-live update: GATE FAILED for $NEW - keeping current deploy" >&2
  exit 1
fi
