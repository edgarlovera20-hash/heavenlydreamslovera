# Heavenly Dreams en DigitalOcean

## Objetivo

Heavenly Dreams queda diseñado para operar en DigitalOcean como CRM, API y plataforma de automatizaciones web con IA. La arquitectura objetivo elimina Vercel del diseño de despliegue y concentra el runtime en un Droplet controlado por NGINX, PM2/Docker y servicios de cola.

## Infraestructura recomendada

```text
DigitalOcean Droplet
|
├── Next.js / Vite frontend CRM
├── Node.js API
├── Playwright workers
├── Redis
├── PostgreSQL
└── IA
```

Servidor principal recomendado:

- 4 vCPU
- 8 GB RAM
- 160 GB SSD
- Costo aproximado: USD 48/mes

Servidor inicial para MVP:

- 2 vCPU
- 4 GB RAM
- Costo aproximado: USD 24/mes

## Stack objetivo

Frontend:

- Next.js 15 o Vite/React durante la transición actual
- TypeScript
- Tailwind CSS
- Shadcn UI

Backend:

- Node.js
- Express o Fastify
- JWT
- RBAC por roles

Datos:

- PostgreSQL en DigitalOcean como opción primaria enterprise
- Supabase externo como opción administrada
- SQLite solo como runtime transitorio o modo local

Automatización:

- Playwright
- Chromium Headless
- Redis
- BullMQ
- Workers con concurrencia limitada

IA:

- GPT-4o-mini
- GPT-4.1-mini
- Clasificación y resumen de respuestas

## Flujo de consulta masiva

```text
Excel
|
├── 5000 registros
|
v
Cola Redis
|
v
5 workers configurables
|
v
Playwright
|
v
Servicio externo autorizado
|
v
Clasificador IA
|
v
PostgreSQL
```

La regla principal es no abrir miles de navegadores simultáneos. Cada lote debe entrar a Redis y procesarse con concurrencia limitada, tiempos de espera configurables, reintentos seguros, logs y capacidad de pausar o cancelar.

## Modulo Validador Telmex

Funciones MVP:

- Consulta individual.
- Guardado en base de datos.
- Historial.
- Dashboard básico.
- Registro de errores.

Funciones fase 2:

- Consulta masiva.
- Carga Excel.
- Exportar Excel.
- Reportes.
- Estadísticas.
- Clasificación IA.

Tabla objetivo:

```sql
CREATE TABLE telmex_consultas (
  id UUID PRIMARY KEY,
  telefono VARCHAR(20) NOT NULL,
  respuesta TEXT,
  estatus VARCHAR(50),
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  tiempo_consulta INTEGER,
  created_by UUID,
  raw_payload JSONB,
  error TEXT
);
```

Clasificación IA:

| Texto detectado | Resultado |
| --- | --- |
| Adeudo vencido | Moroso |
| Pago pendiente | Moroso |
| Convenio activo | Convenio |
| Sin adeudos | Al corriente |
| Servicio suspendido | Moroso |
| Cuenta al corriente | Al corriente |

## Seguridad y operación

- Login JWT.
- Roles: administrador, gerente, supervisor y asesor.
- Rate limit por usuario, IP y tipo de consulta.
- Registro completo de consultas.
- Auditoría de cambios.
- Logs de worker.
- Backups de PostgreSQL.
- Variables de entorno fuera del repositorio.
- Detención automática ante CAPTCHA, bloqueo, error de autenticación o restricción del sitio.

## Política de automatización responsable

Los workers deben usar concurrencia controlada y respetar límites operativos. No se deben implementar técnicas para evadir detección, saltar CAPTCHA, ocultar automatización o ignorar restricciones de un tercero.

Configuración sugerida:

```text
TELMEX_WORKER_CONCURRENCY=5
TELMEX_JOB_TIMEOUT_MS=120000
TELMEX_RETRY_LIMIT=2
TELMEX_REQUEST_INTERVAL_MS=10000
TELMEX_QUEUE_PAUSED=false
```

## Fases

Fase 1 MVP:

- Prototipo Playwright de una consulta individual.
- Guardado de resultado.
- Dashboard básico.
- Validación de que el flujo no exige CAPTCHA ni pasos manuales no automatizables.
- Tiempo estimado: 3 a 5 días.

Fase 2:

- Carga masiva Excel.
- Cola Redis/BullMQ.
- Clasificador IA.
- Exportación de resultados.
- Reportes.
- Tiempo estimado: 5 a 7 días.

Fase 3:

- Integración completa con fichas de clientes.
- Estadísticas por asesor, zona y campaña.
- Monitoreo de workers.
- Alertas y reprocesamiento.
- Tiempo estimado: 7 a 10 días.

## Siguiente paso recomendado

Construir primero un prototipo Playwright de una sola consulta y confirmar que el sitio devuelve la información esperada sin CAPTCHA, restricciones adicionales ni pasos que requieran intervención humana. Solo después conviene construir carga masiva, colas y reportes.
