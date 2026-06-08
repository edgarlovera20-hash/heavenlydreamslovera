#!/bin/bash
# Deploy nginx configs for 3 separate domains on the same server
# Run as root on 159.89.87.91

set -e

REPO_DIR="/var/www/heavenlydreamslovera"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

echo "=== Deploying nginx multi-site configs ==="

# Copy configs
cp "$REPO_DIR/nginx/app.heavenlydreams.conf"  "$NGINX_AVAILABLE/app.heavenlydreams.com.mx"
cp "$REPO_DIR/nginx/rh.heavenlydreams.conf"   "$NGINX_AVAILABLE/rh.heavenlydreams.com.mx"
cp "$REPO_DIR/nginx/www.heavenlydreams.conf"  "$NGINX_AVAILABLE/www.heavenlydreams.com.mx"

# Remove old/conflicting configs that point to the wrong ports
rm -f "$NGINX_ENABLED/heavenlydreams.conf"
rm -f "$NGINX_ENABLED/default"
rm -f "$NGINX_ENABLED/heavenly-dreams-app"
rm -f "$NGINX_ENABLED/rhdreamsapp2026"

# Enable all 3
ln -sf "$NGINX_AVAILABLE/app.heavenlydreams.com.mx" "$NGINX_ENABLED/app.heavenlydreams.com.mx"
ln -sf "$NGINX_AVAILABLE/rh.heavenlydreams.com.mx"  "$NGINX_ENABLED/rh.heavenlydreams.com.mx"
ln -sf "$NGINX_AVAILABLE/www.heavenlydreams.com.mx" "$NGINX_ENABLED/www.heavenlydreams.com.mx"

# Test config
echo "Testing nginx config..."
nginx -t

# Reload
echo "Reloading nginx..."
systemctl reload nginx

echo ""
echo "=== SSL certificates ==="
echo "Check which certs exist:"
certbot certificates 2>/dev/null || ls /etc/letsencrypt/live/ 2>/dev/null || echo "certbot not found"

echo ""
echo "=== Issue missing SSL certs if needed ==="
echo "For rh.heavenlydreams.com.mx:"
echo "  certbot --nginx -d rh.heavenlydreams.com.mx --non-interactive --agree-tos -m edgarlovera20@gmail.com"
echo ""
echo "For www.heavenlydreams.com.mx:"
echo "  certbot --nginx -d www.heavenlydreams.com.mx -d heavenlydreams.com.mx --non-interactive --agree-tos -m edgarlovera20@gmail.com"

echo ""
echo "=== RHDREAMSAPP2026 must run on port 3001 ==="
echo "In /var/www/RHDREAMSAPP2026/ecosystem.config.cjs set PORT=3001"
echo "Then: cd /var/www/RHDREAMSAPP2026 && pm2 start ecosystem.config.cjs"

echo ""
echo "=== Static site ==="
echo "Clone HEAVENLY-DREAMS-WEB-2026 and build to /var/www/heavenly-dreams-web/"
echo "  git clone https://github.com/edgarlovera20-hash/HEAVENLY-DREAMS-WEB-2026.git /var/www/heavenly-dreams-web-repo"
echo "  cd /var/www/heavenly-dreams-web-repo && npm ci && npm run build"
echo "  cp -r dist/* /var/www/heavenly-dreams-web/"

echo ""
echo "Done."
