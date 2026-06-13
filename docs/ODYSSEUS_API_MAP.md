# Mapa de API de Odysseus

> **NOTA**: Este mapa es una estimación basada en la arquitectura FastAPI documentada.
> Verificar contra `http://127.0.0.1:7000/docs` una vez levantado el servicio.
> Repo: https://github.com/pewdiepie-archdaemon/odysseus

## Acceso

- URL base interna: `http://127.0.0.1:7000`
- Auth: `Authorization: Bearer <ODYSSEUS_API_TOKEN>`
- Formato: JSON

## Endpoints Estimados

| Método | Ruta | Auth | Descripción | Uso en HD |
|---|---|---|---|---|
| GET | `/health` | No | Estado del servicio | `AiEngine.health()` |
| POST | `/api/chat/completions` | Sí | Chat con LLM (OpenAI-compatible) | `AiEngine.chat()` |
| POST | `/api/memory/add` | Sí | Guardar memoria vectorial | `AiEngine.saveMemory()` |
| POST | `/api/memory/search` | Sí | Buscar en ChromaDB | `AiEngine.searchMemory()` |
| POST | `/api/documents/upload` | Sí | Subir y analizar documento | `AiEngine.analyzeDocument()` |
| GET | `/api/models` | Sí | Modelos disponibles | `AiEngine.health()` |

## Formato de Chat (OpenAI-compatible estimado)

### Request
```json
{
  "model": "gemma4:e4b",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": false
}
```

### Response
```json
{
  "id": "chatcmpl-xxx",
  "choices": [{
    "message": { "role": "assistant", "content": "..." },
    "finish_reason": "stop"
  }],
  "usage": { "total_tokens": 123 }
}
```

## Proceso para Verificar Rutas Reales

```bash
# 1. Levantar Odysseus
cd infra/odysseus
git clone https://github.com/pewdiepie-archdaemon/odysseus.git odysseus
cp .env.odysseus.example .env.odysseus
# Editar .env.odysseus con credenciales reales
docker compose -f docker-compose.odysseus.yml up -d --build

# 2. Ver documentación OpenAPI automática de FastAPI
open http://127.0.0.1:7000/docs

# 3. Smoke test desde el backend HD
curl http://localhost:3000/api/ai/health

# 4. Actualizar odysseus.adapter.ts con rutas reales confirmadas
```

## Actualización del Adapter

Editar `server/modules/ai/adapters/odysseus.adapter.ts` y actualizar:
1. La ruta de health check (línea ~20)
2. La ruta de chat (línea ~35)
3. El formato de request/response si difiere del OpenAI-compatible
4. Las rutas de memoria y documentos
