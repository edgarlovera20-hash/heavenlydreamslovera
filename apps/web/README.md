# apps/web

Aplicacion web principal de Heavenly Dreams.

Estado actual:
- El runtime sigue viviendo en `src/` y `server.ts`.
- Esta carpeta reserva el destino para desacoplar el frontend web en una fase posterior.

Regla de migracion:
- No mover componentes existentes hasta que el build quede cubierto por pruebas.
- Primero crear adaptadores y exports estables desde `packages/ui` y `packages/shared`.
