# API route inventory

Este inventario es el primer guardrail de Fase 0 para hacer visible el tamano real del backend antes de modularizarlo.

## Como actualizarlo

Ejecuta:

```bash
npm run routes:inventory
```

El comando escanea los registros `app.get/post/put/patch/delete` en los entrypoints de API principales y agrupa las rutas por guard/middleware. Su salida debe usarse para actualizar la matriz de permisos y detectar rutas nuevas sin clasificacion.

## Matriz inicial de guards

| Guard | Uso esperado |
| --- | --- |
| `wrap(...)` sin guard explicito | Solo rutas publicas o callbacks/webhooks que tengan validacion interna. |
| `authOnly` | Usuarios autenticados, sin privilegio administrativo por defecto. |
| `mobileOnly` | Experiencia movil/PWA y captura de campo. |
| `opsOnly` | Roles operativos: gerencia, administracion o supervision. |
| `adminOnly` | Acciones administrativas acotadas. |
| `managerOnly` / `requireRole('GERENTE')` | Mutaciones sensibles, configuracion, import/export y secretos. |
| `chatUserOnly` | Canales, conversaciones, agentes y mensajeria. |
| `diditOnly` / `financeAdminOnly` | Modulos especializados con reglas propias. |

## Criterio de aceptacion

- Toda ruta nueva debe tener guard explicito o justificar por que es publica.
- Toda ruta mutante (`POST`, `PUT`, `PATCH`, `DELETE`) debe tener auditoria o registrar decision de no auditar.
- Antes de separar `server.ts`, cada modulo destino debe conservar el mismo guard efectivo.

