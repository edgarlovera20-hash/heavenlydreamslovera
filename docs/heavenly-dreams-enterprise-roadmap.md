# Heavenly Dreams Enterprise Roadmap

## Objetivo

Evolucionar Heavenly Dreams hacia un CRM inteligente, centro operativo y plataforma de automatizacion empresarial con IA.

## Principio de ejecucion

La migracion debe ser progresiva. La app actual sigue siendo el runtime principal mientras se desacoplan servicios, contratos y datos. Ninguna etapa debe romper captura, SIAC, CRM, mobile ni autenticacion existente.

## Arquitectura objetivo

```text
apps/
  web/
  mobile/
  admin/

services/
  email-worker/
  sync-engine/
  ai-engine/
  ocr-engine/
  whatsapp-engine/
  notification-engine/

packages/
  shared/
  database/
  auth/
  analytics/
  ui/

storage/
  uploads/
  temp/
  logs/
  backups/
```

## Fase 1: Base enterprise

- Definir contratos compartidos para eventos, roles, entidades y workers.
- Crear migracion inicial PostgreSQL sin apagar SQLite.
- Mantener adaptadores compatibles con el servidor actual.
- Preparar workers independientes como carpetas de servicio.
- Agregar reglas de aceptacion por modulo.

## Fase 2: Email automation center

- Gmail API con OAuth2 y refresh tokens.
- Descarga de CSV/XLSX.
- Clasificacion local primero, IA despues.
- Sync logs y auditoria.
- Reprocesamiento manual desde dashboard.

## Fase 3: PostgreSQL

- Crear tablas multiempresa con `tenant_id`.
- Migrar usuarios, clientes, SIAC, morosidad, pagos, seguimientos y auditoria.
- Mantener modo dual SQLite/PostgreSQL durante pruebas.
- Activar PostgreSQL como fuente primaria solo con backup verificado.

## Fase 4: Control operativo IA

- AI engine para riesgo, seguimiento vencido, productividad, cartera critica y resumen ejecutivo.
- OCR engine para INE, comprobantes, contratos y documentos.
- Sync engine para Drive, Gmail, Sheets, Telegram y futuras APIs.

## Fase 5: Operacion realtime

- Socket.IO para alertas.
- BullMQ/Redis para colas separadas.
- WhatsApp engine con recepcion de documentos, OCR y actualizacion CRM.
- Notification engine para WhatsApp, Telegram, push y email.

## Fase 6: Enterprise hardening

- WebAuthn para roles gerenciales.
- Auditoria completa de mutaciones.
- Restricciones de exportacion.
- Cifrado de tokens y archivos sensibles.
- Backups automaticos.
- Docker/PM2/NGINX y CI/CD.

## Criterios de avance

- `npm run lint` pasa.
- `npm run build` pasa.
- Smoke test de auth y SIAC pasa.
- No se pierden datos de SQLite.
- Cada worker tiene contrato de entrada, salida, errores y auditoria.
- Cada modulo nuevo puede desactivarse por variable de entorno.
