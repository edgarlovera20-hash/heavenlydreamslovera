# Auditoría de Integración del Motor IA — Fase 0

Fecha: 2026-06-13  
Versión: 1.0.0

## Resumen Ejecutivo

Este documento describe el estado actual del ecosistema y el plan de integración de Odysseus como motor IA interno.

## Estado Actual de los Repositorios

### heavenlydreamslovera (Monolito Legacy — Producción Activa)

| Aspecto | Estado |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS v4 |
| Backend | Express 4 + tsx (ESM) |
| Base de Datos | better-sqlite3 (SQLite) + pg (PostgreSQL) |
| Colas | BullMQ + Redis |
| Auth | Firebase + JWT + bcrypt + WebAuthn |
| WhatsApp | @whiskeysockets/baileys |
| IA Actual | Google Gemini 2.5 Flash + Ollama (local) + ElevenLabs |
| OCR | Ollama (glm-ocr) + Tesseract.js (fallback) |
| Deploy | PM2 en Ubuntu / Vercel |
| Apps internas | apps/admin, apps/mobile, apps/web |

### HD-RH (Reclutamiento — En Desarrollo Activo)

| Aspecto | Estado |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS v4 |
| Backend | Express 4 + tsx |
| Auth | Firebase + JWT |
| IA Actual | @google/genai (Gemini) |
| WhatsApp | @whiskeysockets/baileys |
| HD-CORE | Integrado via file: paths |

### HD-CORE (Contratos Compartidos)

Paquetes: contracts, rbac, types, validation, ui, crm-contracts, crm-domain, api-client.
Nuevo en este PR: `ai-gateway.ts` con `AiEngine` interface + `hdOdysseusAgents` catalog.

## Asignación de Roles por Plataforma

| Plataforma | Rol |
|---|---|
| heavenlydreamslovera | Monolito de producción → aloja AI Gateway principal |
| HD-RH | Panel operativo de reclutamiento + consumidor del AI Gateway |
| HD-BRAIN | Futuro comando central |
| HD-ADMIN | Gestión de usuarios, finanzas, audit log |
| HD-CORE | Contratos, tipos, RBAC |

## Ubicación del AI Gateway

Vive en **heavenlydreamslovera** porque:
- App de producción activa con Express + BullMQ + Redis ya configurados
- Sistema de auth (JWT) ya implementado
- Tiene SQLite/PG para persistencia
- Tiene los servicios de WhatsApp, Gmail, Drive y OCR ya integrados

HD-RH consume el AI Gateway via HTTP usando `VITE_AI_GATEWAY_URL`.

## Variables de Entorno Nuevas

```env
AI_ENGINE=odysseus              # odysseus | ollama | gemini | openai | mock
ODYSSEUS_BASE_URL=http://127.0.0.1:7000
ODYSSEUS_API_TOKEN=
AI_GATEWAY_SECRET=
AI_RATE_LIMIT_PER_MINUTE=30
AI_REQUIRE_APPROVAL_FOR_HIGH_RISK=true
```

## Cambios Seguros (Sin Riesgo para Producción)

- Agregar nuevas rutas Express en `server/modules/ai/`
- Agregar nuevas tablas SQLite (no modifica tablas existentes)
- Agregar archivos en `infra/odysseus/`
- Agregar componentes React en HD-RH

## Cambios que Requieren Revisión Antes de Producción

- Registrar el router `/api/ai` en `server.ts`
- Configurar variables de entorno en servidor
- Ejecutar migración SQL: `server/db/migrations/0010_ai_tables.sql`
- Levantar Odysseus: `docker compose -f infra/odysseus/docker-compose.odysseus.yml up -d`

## Riesgos y Mitigaciones

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Odysseus expuesto a internet | Crítico | Solo bind a 127.0.0.1, red Docker privada |
| Tokens en logs | Alto | Middleware sanitizeForLog activo en ai.repo.ts |
| Agentes enviando mensajes sin aprobación | Alto | `requiresApproval: true` en agentes de riesgo |
| AGPL-3.0 de Odysseus | Legal | Odysseus corre como servicio separado, no se copia código |

## Plan de Rollback

El AI Gateway es completamente aditivo. Para deshabilitarlo:
1. No registrar el router `/api/ai` en `server.ts` (o comentarlo)
2. Todo lo demás del sistema queda intacto
