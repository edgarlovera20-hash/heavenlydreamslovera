# WhatsApp Engine

Motor dedicado para WhatsApp IA basado en Baileys.

## Responsabilidades

- Multi-sesion.
- Recepcion de documentos.
- Envio de reportes.
- Consulta de clientes.
- Actualizacion de seguimiento.
- Confirmaciones automaticas.

## Flujo documento

```text
mensaje entrante
  -> guardar documento
  -> OCR engine
  -> AI engine
  -> Sync engine
  -> respuesta al usuario
```
