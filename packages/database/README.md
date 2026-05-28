# packages/database

Contratos y migraciones de base de datos enterprise.

Estado:
- SQLite sigue activo como runtime actual.
- PostgreSQL se prepara con migraciones SQL versionadas.

Activacion:
- Crear backup SQLite.
- Ejecutar migracion PostgreSQL.
- Correr importador dual.
- Validar conteos y auditoria.
- Cambiar `DATABASE_URL` cuando pase QA.
