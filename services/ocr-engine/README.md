# OCR Engine

Servicio para procesar documentos y extraer datos estructurados.

## Documentos

- INE.
- CURP.
- Comprobantes.
- Contratos.
- Recibos.
- Estados de cuenta.

## Pipeline

```text
upload
  -> OCR
  -> correccion IA
  -> extraccion de campos
  -> validacion
  -> DB
```

## Reglas

- Guardar huella del archivo.
- Auditar lectura.
- No exponer documentos a roles sin permiso.
