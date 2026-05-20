# Heavenly Dreams Enterprise Platform

## Architecture

Monorepo (npm workspaces + Turborepo) with:

- `apps/api` — NestJS Business Core (port 3000)
- `apps/web` — Next.js 14 Frontend (port 3001)
- `apps/whatsapp-service` — Baileys multi-session (port 4001)
- `apps/ocr-service` — Gemini→Tesseract pipeline (port 4002)
- `apps/ai-service` — Ollama/Phi-3/Mistral7B (port 4003)
- `apps/telegram-service` — Telegram bots (port 4004)
- `apps/phone-validation-service` — Phone validator (port 4005)
- `apps/email-validation-service` — Email validator (port 4006)
- `apps/worker-service` — BullMQ workers

Shared: `packages/database` (Prisma), `packages/types`, `packages/shared`, `packages/ui`, `packages/auth`, `packages/utils`, `packages/flows`

## Critical Rules

1. ALL business logic lives in `apps/api` (NestJS). Never in frontend or microservices.
2. All microservices communicate with `apps/api` via HTTP or BullMQ queues.
3. All database access goes through Prisma in `packages/database`.
4. Every table has `company_id` for multi-tenant isolation.
5. Use RBAC guards on all protected endpoints.

## Database

PostgreSQL via Prisma ORM.
Schema: `packages/database/prisma/schema.prisma`

```bash
# Generate client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed
cd packages/database && npx tsx prisma/seed.ts
```

## Roles (RBAC)

SUPER_ADMIN > GERENTE > ADMINISTRACION > SUPERVISOR > PROMOTOR > COBRANZA > SOPORTE

Sensitive operations require GERENTE+. QR generation requires SUPER_ADMIN/GERENTE.

## BullMQ Queues

- `ocr-processing` — OCR jobs
- `message-sending` — WhatsApp/Telegram messages
- `campaigns` — Bulk message campaigns
- `ai-processing` — AI tasks
- `fraud-analysis` — Fraud checks
- `notifications` — User notifications
- `automation` — Automation flow execution

## Dev Setup

```bash
# Install
npm install

# Start infrastructure
npm run docker:up

# Run migrations + seed
npm run db:migrate
cd packages/database && npx tsx prisma/seed.ts

# Dev (all services)
npm run dev

# Dev individual services
npm run dev:api
npm run dev:web
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 + TailwindCSS |
| Backend | NestJS + Passport/JWT |
| ORM | Prisma |
| DB | PostgreSQL |
| Cache/Queue | Redis + BullMQ |
| WhatsApp | Baileys |
| Telegram | node-telegram-bot-api |
| OCR | Gemini → Tesseract |
| AI | Ollama (Phi-3 + Mistral 7B) |
| Realtime | Socket.IO |
| Infra | Docker + Nginx |
