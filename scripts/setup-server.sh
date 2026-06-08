#!/usr/bin/env bash
# Setup script for Heavenly Dreams production server (Ubuntu/Debian)
# Run as root or with sudo.

set -euo pipefail

DOMAIN="app.heavenlydreams.com.mx"
EMAIL="${CERTBOT_EMAIL:-admin@heavenlydreams.com.mx}"
APP_DIR="${APP_DIR:-/root/heavenlydreams}"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"

echo "==> Installing nginx and certbot..."
apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Enabling and starting nginx..."
systemctl enable nginx
systemctl start nginx

echo "==> Obtaining Let's Encrypt certificate for ${DOMAIN}..."
certbot certonly --nginx \
  --non-interactive \
  --agree-tos \
  --email "${EMAIL}" \
  -d "${DOMAIN}"

echo "==> Copying nginx config..."
cp "${APP_DIR}/nginx/heavenlydreams.conf" "${NGINX_CONF}"
ln -sf "${NGINX_CONF}" /etc/nginx/sites-enabled/

echo "==> Testing nginx configuration..."
nginx -t

echo "==> Reloading nginx..."
systemctl reload nginx

echo "==> Installing Node.js 20 (if not present)..."
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.versions.node.split(\".\")[0])')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> Installing pm2 globally..."
npm install -g pm2

echo "==> Setting up certbot auto-renewal..."
systemctl enable certbot.timer
systemctl start certbot.timer

echo ""
echo "Setup complete!"
echo "  Domain: https://${DOMAIN}"
echo "  App dir: ${APP_DIR}"
echo ""
echo "Next steps:"
echo "  cd ${APP_DIR} && npm ci --production && npm run build && pm2 start npm --name heavenlydreams -- run start"
