# Separacion de Heavenly Dreams en 2 apps

Este cambio prepara la separacion segura del sistema en dos aplicaciones frontend dentro del mismo monorepo:

- apps/admin-web: app central para gerencia, administracion y supervision.
- apps/campo-mobile: app movil de fuerza de venta y campo.

El backend se mantiene compartido durante esta primera fase para no romper produccion.

## Regla de migracion

No borrar archivos originales hasta que ambas apps compilen y pasen pruebas.

## Fases

1. Crear estructura de workspaces.
2. Mover entradas frontend de admin.
3. Mover entradas frontend moviles.
4. Extraer UI compartida.
5. Extraer cliente API.
6. Reorganizar backend por rutas.
7. Servir admin en /admin y campo en /m.
