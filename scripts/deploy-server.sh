#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/heavenly-dreams}"
REPO_URL="${REPO_URL:-https://github.com/edgarlovera20-hash/heavenlydreamslovera.git}"
BRANCH="${BRANCH:-main}"
APP_NAME="${APP_NAME:-heavenly-dreams}"
APP_DOMAIN="${APP_DOMAIN:-}"
APP_URL="${APP_URL:-}"

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

upsert_env_var() {
  local key="$1"
  local value="$2"
  local file="${3:-.env}"
  [ -n "${value}" ] || return 0
  touch "${file}"
  if grep -qE "^${key}=" "${file}"; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" "${file}"
  else
    printf '%s="%s"\n' "${key}" "${value}" >> "${file}"
  fi
}

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
  git update-index --no-skip-worktree data/heavenlydreams.db || true
  git restore --source=HEAD -- data/heavenlydreams.db || true
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

if [ -n "${APP_DOMAIN}" ] || [ -n "${APP_URL}" ]; then
  if [ -z "${APP_DOMAIN}" ]; then
    APP_DOMAIN="$(printf '%s' "${APP_URL}" | sed -E 's|^https?://||; s|/.*$||; s|:[0-9]+$||')"
  fi
  if [ -z "${APP_URL}" ]; then
    APP_URL="https://${APP_DOMAIN}"
  fi
  upsert_env_var APP_DOMAIN "${APP_DOMAIN}"
  upsert_env_var APP_URL "${APP_URL}"
  upsert_env_var OAUTH_CALLBACK_BASE_URL "${APP_URL}"
  upsert_env_var TWILIO_WEBHOOK_BASE_URL "${APP_URL}"
  upsert_env_var WEBAUTHN_RP_ID "${APP_DOMAIN}"
  upsert_env_var WEBAUTHN_ORIGIN "${APP_URL}"
  upsert_env_var HOST "0.0.0.0"
  echo "Dominio configurado: ${APP_URL}"
fi

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
