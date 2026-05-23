#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/heavenly-dreams}"
REPO_URL="${REPO_URL:-https://github.com/edgarlovera20-hash/heavenlydreamslovera.git}"
BRANCH="${BRANCH:-main}"
APP_NAME="${APP_NAME:-heavenly-dreams}"

echo "Deploying ${APP_NAME} into ${APP_DIR}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required. Install it with: apt update && apt install -y git"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install Node.js 20+ before deploying."
  exit 1
fi

if [ ! -d "${APP_DIR}" ]; then
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

if [ ! -d .git ]; then
  echo "${APP_DIR} exists but is not a git repository. Move it or set APP_DIR to the real app folder."
  exit 1
fi

DB_BACKUP=""
if command -v pm2 >/dev/null 2>&1 && pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 stop "${APP_NAME}" >/dev/null 2>&1 || true
fi

mkdir -p data/backups
if [ -f data/heavenlydreams.db ]; then
  DB_BACKUP="data/backups/heavenlydreams.predeploy.$(date +%Y%m%d%H%M%S).db"
  cp -f data/heavenlydreams.db "${DB_BACKUP}"
  rm -f data/heavenlydreams.db-wal data/heavenlydreams.db-shm
fi

if git ls-files --error-unmatch data/heavenlydreams.db >/dev/null 2>&1; then
  git update-index --skip-worktree data/heavenlydreams.db || true
fi

for source_file in package.json package-lock.json; do
  if [ -n "$(git status --porcelain -- "${source_file}")" ]; then
    git restore --source=HEAD -- "${source_file}" || true
  fi
done

git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

if [ -n "${DB_BACKUP}" ] && [ -f "${DB_BACKUP}" ]; then
  cp -f "${DB_BACKUP}" data/heavenlydreams.db
  rm -f data/heavenlydreams.db-wal data/heavenlydreams.db-shm
fi

if [ -f package-lock.json ]; then
  npm ci || npm install
else
  npm install
fi

npm run build

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
    pm2 restart "${APP_NAME}" --update-env
  else
    pm2 start npm --name "${APP_NAME}" -- run start
  fi
  pm2 save
  pm2 status
else
  echo "PM2 is not installed. Start manually with:"
  echo "cd ${APP_DIR} && npm run start"
fi

echo "Deploy complete."
