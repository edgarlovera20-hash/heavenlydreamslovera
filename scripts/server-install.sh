#!/usr/bin/env bash
set -euo pipefail

# ─── Heavenly Dreams — Setup inicial del servidor ─────────────
REPO_URL="https://github.com/edgarlovera20-hash/heavenlydreamslovera.git"
BRANCH="main"
INSTALL_DIR="/root/heavenlydreamslovera"
COMPOSE_FILE="infrastructure/docker/docker-compose.yml"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ─── 1. Dependencias ──────────────────────────────────────────
info "Verificando dependencias..."
command -v docker  >/dev/null || die "Docker no instalado. Instálalo con: curl -fsSL https://get.docker.com | sh"
command -v git     >/dev/null || die "Git no instalado: apt install -y git"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 no disponible"

# ─── 2. Clonar / actualizar repo ──────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Repo existente — actualizando..."
  cd "$INSTALL_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  info "Clonando repositorio..."
  git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ─── 3. Configurar .env ───────────────────────────────────────
if [ ! -f ".env" ]; then
  info "Creando .env desde template..."
  cp .env.example .env

  # Generar secretos aleatorios
  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  REDIS_PASSWORD=$(openssl rand -hex 16)
  INTERNAL_API_KEY=$(openssl rand -hex 24)

  sed -i "s|change_me_super_secret_jwt_key_minimum_32_chars|${JWT_SECRET}|g"    .env
  sed -i "s|change_me_refresh_secret_key_minimum_32_chars|${JWT_REFRESH_SECRET}|g" .env
  sed -i "s|hd_secret|${POSTGRES_PASSWORD}|g"                                   .env
  sed -i "s|redis_secret|${REDIS_PASSWORD}|g"                                   .env
  sed -i "s|change_me_internal_service_key|${INTERNAL_API_KEY}|g"               .env

  # URLs de producción
  sed -i "s|FRONTEND_URL=http://localhost:3001|FRONTEND_URL=https://heavenlydreams.com.mx|g" .env
  sed -i "s|NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1|NEXT_PUBLIC_API_URL=https://heavenlydreams.com.mx/api/v1|g" .env
  sed -i "s|NEXT_PUBLIC_WS_URL=http://localhost:3000|NEXT_PUBLIC_WS_URL=https://heavenlydreams.com.mx|g" .env

  info ".env creado con secretos generados automáticamente"
  warn "Revisa .env si necesitas añadir API keys (GEMINI_API_KEY, etc.)"
else
  info ".env ya existe — omitiendo configuración"
fi

# ─── 4. Copiar .env donde Docker Compose lo espera ───────────
# Docker Compose busca .env en el directorio del compose file
cp .env infrastructure/docker/.env

# ─── 5. Construir y levantar contenedores ─────────────────────
info "Construyendo imágenes Docker (puede tardar 5–10 min)..."
docker compose -f "$COMPOSE_FILE" build --parallel

info "Levantando servicios..."
docker compose -f "$COMPOSE_FILE" up -d

# ─── 6. Esperar a que postgres esté listo ─────────────────────
info "Esperando a que PostgreSQL esté listo..."
for i in {1..30}; do
  if docker exec hd-postgres pg_isready -U hd_user >/dev/null 2>&1; then
    info "PostgreSQL listo"
    break
  fi
  [ "$i" -eq 30 ] && die "PostgreSQL no respondió a tiempo"
  sleep 2
done

# ─── 7. Migraciones ───────────────────────────────────────────
info "Ejecutando migraciones de base de datos..."
docker exec hd-api sh -c "cd /app && npx prisma migrate deploy --schema /app/packages/database/prisma/schema.prisma" 2>/dev/null \
  || warn "Migraciones con advertencias (puede ser la primera vez)"

# ─── 7. Estado final ──────────────────────────────────────────
info "Estado de los contenedores:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
info "=== Setup completado ==="
echo -e "  Frontend: ${GREEN}https://heavenlydreams.com.mx${NC}"
echo -e "  API:      ${GREEN}https://heavenlydreams.com.mx/api/v1/health${NC}"
echo ""
warn "Si el sitio no carga, verifica que nginx en el host apunte a localhost:80 del stack Docker."
warn "Logs: docker compose -f $COMPOSE_FILE logs -f"
