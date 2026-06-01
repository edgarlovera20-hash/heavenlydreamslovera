# Enterprise Migration

Migrar arquitectura actual a modelo event-driven.

Servicios:
- auth-service
- crm-service
- workflow-service
- fraud-service
- validation-service
- whatsapp-service
- ocr-service

Infra:
- DigitalOcean Droplet
- NGINX
- PM2 o Docker
- Redis
- BullMQ
- PostgreSQL
- MinIO
- Playwright / Chromium Headless

Objetivos:
- OCR async
- WhatsApp queues
- Automatizaciones web con workers y cola
- Validador Telmex con consulta individual, Excel masivo, historial y reportes
- RBAC granular
- workflow engine
- antifraude

Politica operativa:
- Concurrencia limitada por worker.
- Rate limit por usuario y modulo.
- Logs completos y auditoria.
- Detener automatizaciones ante CAPTCHA, bloqueo o restriccion externa.
- No usar tecnicas de evasion ni bypass de validaciones.
