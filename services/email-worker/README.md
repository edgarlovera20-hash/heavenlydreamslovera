# Email Worker

Servicio responsable de leer Gmail, detectar adjuntos, descargar CSV/XLSX y enviarlos al Sync Engine.

## Entradas

- Gmail API.
- Query configurable.
- Remitentes permitidos.
- Asuntos permitidos.

## Salidas

- Evento `email.attachment.detected`.
- Archivo temporal en `storage/temp`.
- Registro en `sync_logs`.

## Reglas

- Usar OAuth2 y refresh token.
- Nunca usar scraping ni contrasena directa.
- Marcar duplicados por `message_id + attachment_id + fingerprint`.
- Limitar tamano maximo de archivo antes de procesar.

## Variables previstas

```text
GMAIL_SYNC_CLIENT_ID=
GMAIL_SYNC_CLIENT_SECRET=
GMAIL_SYNC_REFRESH_TOKEN=
GMAIL_SYNC_QUERY=
GMAIL_SYNC_MAX_ATTACHMENTS=25
```
