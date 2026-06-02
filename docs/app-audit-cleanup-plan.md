# Auditoria integral y plan de limpieza de Heavenly Dreams

Fecha de auditoria: 2026-06-02.
Repositorio analizado: `heavenlydreamslovera`.

## Alcance revisado

- Frontend web React/Vite: `src/App.tsx`, `src/components/**`, `src/layouts/**`, `src/theme/**`, `src/lib/**`.
- Frontend movil/PWA: `mobile.html`, `src/mobile/**`, `public/manifest-mobile.json`, `public/sw-mobile.js`.
- Backend/API: `server.ts`, `server/**`.
- Persistencia: `server/db.ts`, `packages/database/migrations/**`, archivos fuente SIAC/Morosos.
- Configuracion y entrega: `package.json`, `vite.config.ts`, `.env.example`, `vercel.json`, scripts y documentacion.
- Verificaciones ejecutadas: `npm run lint` y `npm run build`.

## Resumen ejecutivo

La aplicacion es funcional y compila, pero esta en una etapa de crecimiento organico: tiene demasiada logica concentrada en pocos archivos, una mezcla de monolito y carpetas tipo monorepo, dependencias pesadas cargadas por feature, modelos de datos tipados de forma debil y documentacion operativa incompleta. El mayor riesgo no es que no arranque, sino que cada cambio futuro sea caro, dificil de revisar y propenso a romper flujos de negocio.

### Hallazgos criticos

1. **Backend sobredimensionado en un unico entrypoint.** `server.ts` concentra arranque, rutas, reglas de negocio, importaciones automaticas, integraciones, middlewares y serving del frontend; contiene mas de 5,000 lineas y mas de 200 rutas registradas, lo que dificulta pruebas unitarias y control de permisos por modulo.
2. **Capa de datos monolitica.** `server/db.ts` define schema, migraciones ad-hoc, seed de desarrollo y repositorios en el mismo archivo; esto complica auditorias de migracion, rollback y compatibilidad entre SQLite/PostgreSQL.
3. **Frontend principal con responsabilidades mezcladas.** `src/App.tsx` maneja sesion, login, deteccion movil, passkeys, avatar y seleccion de vistas en el mismo componente; esto afecta mantenibilidad y UX porque los estados globales no estan modelados como dominio.
4. **App movil demasiado grande.** `src/mobile/MobileFieldApp.tsx` incluye captura, ventas, folios, clientes, documentos, seguimiento, nominas, chats, usuarios, aprobaciones, perfil y ajustes en un unico componente; el bundle movil queda menos modular y es dificil aplicar UX progresiva.
5. **CSS global excesivo.** `src/index.css` supera 9,000 lineas y `src/mobile/mobile.css` supera 2,000 lineas; esto incrementa riesgo de colisiones visuales, estilos muertos y regresiones UI.
6. **Seguridad mejorada pero con deuda.** Hay JWT, cookies httpOnly para refresh, CSP, rate limits y passkeys, pero tambien existe compatibilidad con passwords antiguos SHA-256/texto plano, almacenamiento local de sesion cacheada y rutas webhook sensibles que dependen de token opcional fuera de produccion.
7. **Persistencia productiva inconsistente.** `DATABASE_URL` existe en configuracion, pero el backend principal abre SQLite local via `better-sqlite3`; esto limita escalabilidad horizontal, backups, HA y despliegues multi-instancia.
8. **Datos fuente versionados.** Hay CSV/XLSX operativos dentro del repo (`server/siac-data.csv`, `server/source-data/*.xlsx`), lo que aumenta tamano del repositorio y riesgo de exponer datos sensibles si contienen clientes reales.
9. **Bundle pesado.** El build pasa, pero los chunks de mapas, PDF, charts y CSS son grandes; `vendor-maps` supera 1 MB sin gzip, `vendor-pdf` supera 600 KB, `vendor-charts` supera 400 KB, y los CSS principales tambien son altos.
10. **Documentacion inicial insuficiente.** El README todavia parece derivado de AI Studio y no describe arquitectura real, roles, variables obligatorias, entornos, migraciones, backups, monitoreo ni procedimientos de emergencia.

## Arquitectura actual observada

### Frontend web

- Framework: React 19 + Vite.
- Entrada principal: `index.html` -> `src/main.tsx` -> `src/App.tsx`.
- Routing: no se observa un router dedicado; la navegacion depende de estado/roles y lazy imports.
- UI: componentes propios con estilos globales, Tailwind/Vite y librerias como lucide, motion, recharts, maplibre, PDF/export utilities.
- Sesion: el servidor es la fuente de verdad, pero el cliente cachea informacion de usuario en `localStorage` y conserva el access token en memoria.

### Frontend movil/PWA

- Entrada: `mobile.html` -> `src/mobile/main.tsx` -> `src/mobile/MobileFieldApp.tsx`.
- Tiene offline queue, cache local con `idb-keyval`, captura documental, OCR movil, ubicacion, chats y flujos administrativos.
- La experiencia movil esta muy completa, pero su modularidad es baja: demasiados tabs y flujos viven en el mismo archivo.

### Backend/API

- Servidor Express iniciado desde `server.ts`.
- Middlewares base en `server/app.ts`: compresion, CSP, cabeceras de seguridad, JSON limits y request logger.
- Autenticacion/autorizacion en `server/security.ts` y `server/services/rbac-service.ts`.
- Rutas registradas principalmente en `server.ts`, con algunos modulos separados (`finance-enterprise`, `didit`, `avatar`).
- Integraciones: WhatsApp/Baileys, Telegram, Twilio, OpenAI realtime, ElevenLabs, Didit, Gmail/OAuth, OCR local/Ollama/Tesseract, SIAC/Morosos, agentes.

### Datos y dominio

- DB runtime: SQLite local en `data/heavenlydreams.db`.
- Schema y repositorios se generan en `server/db.ts`.
- Existe carpeta `packages/database/migrations`, pero el runtime actual no parece usar un runner formal de migraciones para todas las tablas.
- Hay entidades de ventas, usuarios, sesiones, SIAC, morosidad, documentos, CRM, agentes, canales, validaciones, inventario, finanzas, etc.

## Errores y riesgos detectados

### 1. Mantenibilidad

- `server.ts`, `server/db.ts`, `src/mobile/MobileFieldApp.tsx`, `src/index.css` y `src/components/views/NewSaleForm.tsx` son archivos demasiado grandes. Esto indica alto acoplamiento y baja cohesion.
- La app mezcla responsabilidades de dominio, UI, transporte HTTP y estado local sin fronteras claras.
- Hay uso extendido de `any`, lo que reduce el valor real de TypeScript aunque `tsc --noEmit` pase.

### 2. Seguridad

- La autenticacion tiene buenas bases, pero todavia acepta hashes SHA-256 y texto plano para compatibilidad; debe haber una campana de rehash obligatoria y bloqueo de passwords legados.
- `localStorage` guarda datos de sesion cacheados; aunque se sanitizan tokens, sigue siendo un punto de exposicion para datos de perfil y estados sensibles.
- El rate limit actual es en memoria, por IP y por proceso; en multi-instancia no protege globalmente.
- Falta una politica documentada de rotacion de secretos, caducidad de sesiones, auditoria de permisos y respuesta a incidentes.

### 3. Backend y datos

- SQLite local limita la operacion productiva si hay varios procesos, workers o replicas.
- Las migraciones ad-hoc ejecutadas al importar `server/db.ts` hacen dificil saber que version de schema esta desplegada.
- Auto-importar SIAC/Morosos al arrancar puede alargar el boot, generar cambios inesperados de datos y complicar despliegues.
- El repositorio contiene datos CSV/XLSX que deberian moverse a almacenamiento controlado o fixtures anonimizados.

### 4. Frontend/UX/UI

- El flujo de login, passkeys, seleccion de rol, avatar y vista inicial esta acoplado dentro de `App.tsx`; esto complica estados como error, bloqueo, aprobacion pendiente y enrolamiento passkey.
- La app movil tiene demasiadas pantallas en un solo componente; dificulta UX especializada, skeletons por modulo y pruebas de navegacion.
- Los estilos globales pueden provocar cambios visuales involuntarios entre web y movil.
- Falta evidencia de pruebas de accesibilidad, navegacion por teclado, contraste, estados vacios y errores por pantalla.

### 5. Performance

- El build muestra chunks grandes de mapas, PDF y graficas. Deben cargarse solamente en pantallas que los usan, con prefetch selectivo y presupuestos de bundle.
- CSS principal y movil son altos; conviene extraer estilos por modulo, eliminar reglas muertas y usar tokens de diseno.
- Algunas dependencias pesadas pueden ser reemplazadas o movidas a lazy imports mas finos.

### 6. DevOps/operacion

- README incompleto para una app empresarial.
- Falta script unico de auditoria que combine typecheck, build, checks de datos, seguridad y smoke tests con precondiciones claras.
- Falta health/readiness operacional documentado con dependencias externas: DB, Redis, OCR, WhatsApp, Telegram, Twilio, storage, IA.

## Plan de limpieza y mejora

### Fase 0: estabilizacion inmediata (1 a 3 dias)

1. Crear inventario de rutas y permisos por modulo.
2. Congelar contrato de APIs criticas y documentar payloads principales.
3. Mover datos reales/versionados a storage privado; dejar fixtures anonimizados pequenos.
4. Agregar presupuesto de bundle y reporte visual del build.
5. Definir criterios de produccion: secretos obligatorios, backups, dominio HTTPS, WebAuthn, Redis y storage.

### Fase 1: modularizacion backend (1 a 2 semanas)

1. Dividir `server.ts` en modulos de rutas: auth, users, sales, siac, documents, crm, channels, agents, finance, integrations, admin.
2. Extraer servicios de negocio fuera de handlers Express.
3. Crear repositorios por entidad en vez de un unico `server/db.ts`.
4. Introducir un runner formal de migraciones con versionado y rollback.
5. Reemplazar rate limits en memoria por Redis/BullMQ o proveedor compatible.
6. Mover auto-import SIAC/Morosos a job explicito o worker programado, no a boot de API.

### Fase 2: seguridad y compliance (1 semana)

1. Forzar rehash de passwords al login y plan para eliminar SHA-256/texto plano.
2. Agregar expiracion real de sesiones, rotacion configurable, revocacion por usuario y device list.
3. Revisar todas las rutas publicas y webhooks con matriz de amenazas.
4. Asegurar que secretos nunca salgan en logs, respuestas, localStorage ni exports.
5. Crear checklist de despliegue seguro: `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`, HTTPS, cookies secure, CSP, CORS/reverse proxy.

### Fase 3: frontend web (1 a 2 semanas)

1. Separar `App.tsx` en `AuthShell`, `LoginPage`, `PasskeyEnrollment`, `RoleRouter`, `AuthenticatedApp` y providers.
2. Crear un store tipado para sesion/permisos y eliminar `any` progresivamente.
3. Adoptar rutas declarativas con lazy loading por modulo.
4. Extraer formularios grandes y validaciones a hooks/servicios tipados.
5. Crear pruebas de estados UX: login fallido, aprobacion pendiente, passkey requerida, sesion expirada, offline.

### Fase 4: frontend movil/PWA (1 a 2 semanas)

1. Dividir `MobileFieldApp.tsx` por secciones: inicio, venta, folios, clientes, documentos, seguimiento, nominas, chats, usuarios, perfil, ajustes.
2. Separar offline queue, drafts, module cache y bootstrap en hooks especializados.
3. Crear navegacion movil con rutas o state machine simple.
4. Reducir CSS movil global con componentes y tokens.
5. Medir y optimizar tiempo de carga inicial, especialmente OCR, mapas, PDF y chats.

### Fase 5: performance (3 a 7 dias)

1. Analizar bundle con visualizer y fijar limites por chunk.
2. Cargar `maplibre-gl`, PDF/export, charts y OCR solo cuando la pantalla lo requiera.
3. Dividir CSS por entrypoint y eliminar reglas muertas.
4. Agregar cache-control para assets, manifest y service workers con versionado.
5. Medir Lighthouse movil y web despues de cada refactor.

### Fase 6: datos y escalabilidad (2 a 4 semanas)

1. Decidir objetivo: SQLite single-server endurecido o PostgreSQL real.
2. Si se busca multiusuario productivo/crecimiento, migrar entidades principales a PostgreSQL.
3. Mantener SQLite solo para desarrollo/local o cache.
4. Crear backups automatizados, restore drills y retencion.
5. Separar document storage a disco persistente gestionado o S3-compatible.

### Fase 7: calidad continua (continuo)

1. Agregar pruebas unitarias para servicios de dominio y repositorios.
2. Agregar smoke tests por rol y por flujo critico.
3. Agregar pruebas E2E minimas para login, venta, documento, SIAC, chat y aprobaciones.
4. Ejecutar `npm run lint`, `npm run build`, checks enterprise/preprod y smoke API en CI.
5. Documentar runbooks: deploy, rollback, backup, incidente de secretos, caida de integraciones.

## Backlog priorizado

### P0 - Alto impacto / alto riesgo

- Modularizar `server.ts` por dominios.
- Sacar datos reales del repo y anonimizar fixtures.
- Formalizar migraciones y backups.
- Revisar passwords legados y sesiones.
- Reemplazar rate limit en memoria si hay mas de una instancia.

### P1 - Producto y UX

- Refactor de `App.tsx` y `MobileFieldApp.tsx`.
- Estados UX consistentes para errores, vacios, carga, offline y permisos.
- Auditoria de accesibilidad y responsive.
- Navegacion declarativa por rol y feature flag.

### P2 - Performance

- Bundle budgets.
- Lazy loading mas fino para mapas/PDF/charts/OCR.
- Reduccion de CSS global.
- Medicion Lighthouse y Web Vitals.

### P3 - Plataforma

- PostgreSQL o estrategia SQLite endurecida.
- Workers para imports, OCR y mensajeria.
- Observabilidad: logs correlacionados, metricas, trazas y alertas.
- CI/CD con ambientes dev/staging/prod.

## Criterios de exito sugeridos

- Ningun archivo de aplicacion supera 1,000 lineas salvo casos justificados.
- Rutas API agrupadas por modulo y cubiertas por matriz de permisos.
- Migraciones versionadas y reproducibles desde cero.
- Sin datos reales versionados en Git.
- Build con presupuestos: chunks iniciales reducidos y dependencias pesadas lazy.
- Login, venta, captura documental, SIAC, chat y aprobaciones cubiertos por smoke tests.
- Runbook de produccion disponible para deploy, rollback, backup y rotacion de secretos.
