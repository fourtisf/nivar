#!/usr/bin/env bash
# Deploy / refresh NIVAR on the server. Idempotent — safe to re-run.
#   sudo APP_DIR=/var/www/nivar BRANCH=claude/new-session-x1npk7 bash deploy/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nivar}"
REPO="${REPO:-https://github.com/fourtisf/nivar.git}"
BRANCH="${BRANCH:-claude/new-session-x1npk7}"

echo "▶ Deploying NIVAR ($BRANCH) → $APP_DIR"

mkdir -p "$(dirname "$APP_DIR")"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
git fetch --all --prune
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# Install deps. If your VPS can't reach the Prisma engine CDN, append --ignore-scripts.
npm install

# Build the shared config + the web app (the playable game).
npm run build:config
npm run build --workspace @nivar/web

# (Re)start processes.
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

echo "✅ NIVAR deployed. web → :3000   api → :4000"
echo "   pm2 status   |   pm2 logs nivar-web"
