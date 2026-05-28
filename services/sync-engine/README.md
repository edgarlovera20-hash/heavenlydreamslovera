# Sync Engine

Motor de sincronizacion para convertir archivos y eventos externos en datos del CRM.

## Procesos

```text
archivo recibido
  -> detectar tipo
  -> leer filas
  -> normalizar columnas
  -> validar registros
  -> insertar/actualizar DB
  -> emitir metricas
  -> auditar resultado
```

## Tipos soportados

- SIAC.
- Morosidad.
- Seguimiento.
- Pagos.
- Ventas.
- Portabilidad.

## Salidas

- `sync.completed`
- `sync.failed`
- `customer.updated`
- `payment.updated`
- `morosity.updated`
