# Production readiness checklist

Este checklist aterriza la Fase 0 del plan de limpieza. No reemplaza el roadmap enterprise; define los minimos antes de mover trafico real o datos sensibles.

## Seguridad y secretos

- `JWT_SECRET` y `SECRETS_ENCRYPTION_KEY` definidos con valores largos, unicos y fuera de Git.
- `NODE_ENV=production`, dominio HTTPS y cookies `Secure` activos.
- `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` y `WEBAUTHN_REQUIRED=true` configurados para gerencia.
- OAuth, Twilio, Telegram, Didit, OpenAI, Gemini, ElevenLabs y Ollama definidos por variables o boveda; nunca hardcodeados.
- Politica de rotacion de secretos documentada con responsable y ventana de ejecucion.

## Datos y almacenamiento

- Ejecutar `npm run data:audit` antes de cada release.
- Mover CSV/XLSX operativos a storage privado; dejar en Git solo fixtures anonimizados.
- Confirmar `DOCUMENT_STORAGE_DIR` en volumen persistente o migrar a S3-compatible.
- Ejecutar backup SQLite antes de deploy y validar restore periodicamente.
- Definir si produccion sigue en SQLite single-server o migra a PostgreSQL.

## API y permisos

- Ejecutar `npm run routes:inventory` y revisar rutas sin guard explicito.
- Mantener matriz de permisos por modulo antes de modularizar `server.ts`.
- Revisar rutas publicas, callbacks y webhooks con token o firma obligatoria.
- Confirmar que mutaciones sensibles quedan en `managerOnly`, `adminOnly`, `opsOnly` o `requireRole`.

## Performance y frontend

- Ejecutar `npm run build` y `npm run bundle:budget`.
- Revisar regresiones en chunks de mapas, PDF, charts, CSS web y CSS movil.
- Mantener mapas, PDF/export, OCR y charts fuera del camino inicial salvo cuando la pantalla los requiera.
- Validar PWA movil en red lenta antes de publicar cambios de captura/documentos.

## Comando de Fase 0

```bash
npm run audit:phase0
```

Este comando ejecuta typecheck, build, presupuesto de bundle, checks enterprise/preproduccion, auditoria de datos y smoke API.
