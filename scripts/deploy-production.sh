#!/usr/bin/env bash
set -euo pipefail

COMMIT="${1:-}"
MODE="${2:-deploy}"
REPO_URL="${JUNSHI_REPO_URL:-https://github.com/chuangyilingdong/junshi-platform.git}"
RELEASE_ROOT="/srv/junshi-platform/releases"
CURRENT_LINK="/srv/junshi-platform/current"
NODE_BIN="/srv/ai-kids-platform/runtime/node/bin"
HEALTH_URL="http://127.0.0.1:8790/health"
READY_URL="http://127.0.0.1:8790/ready"
PUBLIC_JUNSHI_URL="https://aicyld.com/api/junshi/health"
PUBLIC_SITE_URL="https://aicyld.com/api/health"
SERVICE="junshi-api"

if [[ ! "$COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "usage: deploy-production.sh <40-char-commit> [deploy|--no-switch]" >&2
  exit 2
fi
if [[ "$MODE" != "deploy" && "$MODE" != "--no-switch" ]]; then
  echo "unknown mode: $MODE" >&2
  exit 2
fi

export PATH="$NODE_BIN:$PATH"
old_release="$(readlink -f "$CURRENT_LINK")"
target="$RELEASE_ROOT/$(date -u +%Y%m%dT%H%M%SZ)"
case "$target" in
  "$RELEASE_ROOT"/*) ;;
  *) echo "unsafe target: $target" >&2; exit 1 ;;
esac
if [[ -e "$target" ]]; then
  echo "release already exists: $target" >&2
  exit 1
fi

echo "old_release=$old_release"
echo "target_release=$target"
sudo install -d -o ai-kids-prod -g ai-kids-prod -m 755 "$target"
git clone --quiet --branch main "$REPO_URL" "$target"
git -c safe.directory="$target" -C "$target" checkout --quiet "$COMMIT"
actual="$(git -c safe.directory="$target" -C "$target" rev-parse HEAD)"
if [[ "$actual" != "$COMMIT" ]]; then
  echo "commit mismatch: expected=$COMMIT actual=$actual" >&2
  exit 1
fi
sudo chown -R ai-kids-prod:ai-kids-prod "$target"

cd "$target"
corepack pnpm install --prod --frozen-lockfile --ignore-scripts
node scripts/verify-release-runtime.mjs
node --check apps/api/src/routes/junshiWorkbench.js
node --test apps/api/test/avatar-segments.test.mjs
node scripts/verify-migration.mjs
node scripts/audit-api-dependencies.mjs
node scripts/verify-deploy-templates.mjs

if [[ "$MODE" == "--no-switch" ]]; then
  echo "verified_release=$target"
  echo "switch_skipped=true"
  exit 0
fi

backup_dir="$(mktemp -d /tmp/junshi-deploy-units.XXXXXX)"
for unit in junshi-api.service junshi-healthcheck.service junshi-healthcheck.timer; do
  if [[ -f "/etc/systemd/system/$unit" ]]; then cp -a "/etc/systemd/system/$unit" "$backup_dir/$unit"; fi
done

restore_units() {
  for unit in junshi-api.service junshi-healthcheck.service junshi-healthcheck.timer; do
    if [[ -f "$backup_dir/$unit" ]]; then sudo install -m 644 -o root -g root "$backup_dir/$unit" "/etc/systemd/system/$unit"; fi
  done
  sudo systemctl daemon-reload
}

switch_release() {
  local release="$1"
  [[ ! -e /srv/junshi-platform/.current-next ]] || sudo rm -f /srv/junshi-platform/.current-next
  sudo ln -s "$release" /srv/junshi-platform/.current-next
  sudo mv -Tf /srv/junshi-platform/.current-next "$CURRENT_LINK"
}

wait_healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 3 "$HEALTH_URL" >/tmp/junshi-deploy-health.json \
      && curl -fsS --max-time 3 "$READY_URL" >/tmp/junshi-deploy-ready.json; then
      return 0
    fi
    sleep 1
  done
  return 1
}

rollback() {
  echo "deployment health check failed; rolling back to $old_release" >&2
  switch_release "$old_release"
  restore_units
  sudo systemctl restart "$SERVICE"
  sudo systemctl restart junshi-healthcheck.timer || true
  wait_healthy || true
}

sudo install -m 644 -o root -g root deploy/systemd/junshi-api.service /etc/systemd/system/junshi-api.service
sudo install -m 644 -o root -g root deploy/systemd/junshi-healthcheck.service /etc/systemd/system/junshi-healthcheck.service
sudo install -m 644 -o root -g root deploy/systemd/junshi-healthcheck.timer /etc/systemd/system/junshi-healthcheck.timer
sudo systemctl daemon-reload
switch_release "$target"
sudo systemctl restart "$SERVICE"

if ! wait_healthy; then
  rollback
  exit 1
fi
if ! curl -fsS --max-time 10 "$PUBLIC_JUNSHI_URL" >/tmp/junshi-deploy-public.json \
  || ! curl -fsS --max-time 10 "$PUBLIC_SITE_URL" >/tmp/junshi-deploy-site.json; then
  rollback
  exit 1
fi
if ! sudo systemctl restart junshi-healthcheck.timer; then
  rollback
  exit 1
fi
if ! sudo systemctl start junshi-healthcheck.service; then
  rollback
  exit 1
fi
if [[ "$(systemctl show -p Result --value junshi-healthcheck.service)" != "success" ]]; then
  rollback
  exit 1
fi

echo "deployed_release=$target"
echo "deployed_commit=$COMMIT"
echo "rollback_release=$old_release"
echo "api_active=$(systemctl is-active "$SERVICE")"
echo "api_restarts=$(systemctl show -p NRestarts --value "$SERVICE")"
echo "health=$(cat /tmp/junshi-deploy-health.json)"
echo "ready=$(cat /tmp/junshi-deploy-ready.json)"
