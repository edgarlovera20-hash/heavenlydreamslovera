# AI Engine

Nucleo de IA operativa y predictiva.

## Funciones v1

- Clasificacion local por reglas.
- Resumen operativo.
- Riesgo de cliente.
- Seguimiento vencido.
- Calidad de datos.

## Funciones futuras

- Prediccion de pago.
- Cancelacion probable.
- Promotores inactivos.
- Zonas rentables.
- Asistente conversacional.

## Contrato

Entrada:
```json
{
  "type": "risk.customer",
  "payload": {}
}
```

Salida:
```json
{
  "priority": "alta",
  "summary": "Cliente con seguimiento vencido.",
  "signals": [],
  "suggestions": []
}
```
