# Bóveda segura de APIs

La app Web/Admin incluye una bóveda para claves API en **Ajustes -> Integraciones y APIs**. Solo el rol `GERENTE` puede abrirla, crear claves, reemplazarlas, probarlas, revocarlas o eliminarlas.

## Seguridad

- Las claves se cifran en SQLite con AES-256-GCM.
- Después de guardar, la UI solo muestra proveedor, variable, estado y últimos 4 caracteres.
- Los endpoints nunca devuelven el secreto completo.
- Cada acción queda registrada en `audit_log` sin incluir el valor de la clave.
- En producción define `SECRETS_ENCRYPTION_KEY`; si falta, el servidor no debe arrancar en modo producción.

Genera la llave maestra con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Prioridad de configuración

Los servicios leen primero desde la bóveda y después desde `.env`. Esto permite rotar claves sin editar archivos ni reiniciar por cada cambio en la mayoría de proveedores.

Proveedores integrados:

- Gemini: `GEMINI_API_KEY`, modelo en metadata o `GEMINI_MODEL`.
- OpenAI: `OPENAI_API_KEY`.
- Ollama-compatible: `OLLAMA_API_KEY`, `OLLAMA_URL`, modelo/base URL en metadata.
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- ElevenLabs: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_AGENT_PHONE_NUMBER_ID`.
- Telegram: `TELEGRAM_BOT_TOKEN`.
- Didit: `DIDIT_API_KEY`.
- Custom: cualquier `KEY_NAME` nuevo para integraciones futuras.

## Rotación

Si una clave se compartió por chat, captura o documento no seguro, rótala en el proveedor antes de guardarla. La clave Gemini pegada durante la configuración debe borrarse o rotarse en Google Cloud y reemplazarse por una nueva.
