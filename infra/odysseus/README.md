# Odysseus — Motor IA Interno de Heavenly Dreams

Odysseus es un motor de IA auto-hospedado que corre como servicio interno **exclusivamente en red privada**.
Nunca debe exponerse a internet directamente.

## Prerrequisitos

- Docker + Docker Compose v2
- Git
- El servidor backend Heavenly Dreams corriendo en la misma máquina o red LAN

## Instalación

```bash
# 1. Clonar Odysseus dentro de esta carpeta
git clone https://github.com/pewdiepie-archdaemon/odysseus.git odysseus

# 2. Configurar variables de entorno
cp .env.odysseus.example .env.odysseus
# Editar .env.odysseus: cambiar passwords, configurar LLM_HOST, etc.

# 3. Levantar los servicios
docker compose -f docker-compose.odysseus.yml up -d --build

# 4. Verificar estado
docker compose -f docker-compose.odysseus.yml ps
curl http://127.0.0.1:7000/health

# 5. Ver API docs de FastAPI
open http://127.0.0.1:7000/docs
```

## Configuración del Backend HD

Agregar al `.env` del backend:

```env
AI_ENGINE=odysseus
ODYSSEUS_BASE_URL=http://127.0.0.1:7000
ODYSSEUS_API_TOKEN=<token_del_admin_panel_de_odysseus>
```

## Seguridad

- `AUTH_ENABLED=true` siempre
- `LOCALHOST_BYPASS=false` siempre
- ChromaDB, SearXNG y Ollama NO se exponen fuera de la red Docker
- El puerto 7000 solo escucha en `127.0.0.1`
- Nunca subir `.env.odysseus` a GitHub
- Los volúmenes `data/` y `logs/` contienen datos sensibles — no incluir en backups públicos

## Actualización

```bash
cd infra/odysseus/odysseus && git pull
cd .. && docker compose -f docker-compose.odysseus.yml up -d --build
```

## Nota de Licencia

Odysseus está bajo licencia AGPL-3.0-or-later.
Heavenly Dreams lo integra **como servicio separado via HTTP** — no se copia ni distribuye su código.
