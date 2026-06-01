<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0e792da5-346b-4f41-8caf-6eec4525119b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Instala Ollama local y configura `OLLAMA_URL=http://127.0.0.1:11434` para OCR documental privado.
3. Run the app:
   `npm run dev`

## Deploy en servidor

En el servidor Ubuntu, ejecuta siempre dentro del repo o usa el script:

```bash
curl -fsSL https://raw.githubusercontent.com/edgarlovera20-hash/heavenlydreamslovera/main/scripts/deploy-server.sh -o /tmp/deploy-heavenly-dreams.sh
bash /tmp/deploy-heavenly-dreams.sh
```

Por defecto usa `/opt/heavenly-dreams`, rama `main` y proceso PM2 `heavenly-dreams`.
Puedes cambiarlo asi:

```bash
APP_DIR=/opt/heavenly-dreams APP_NAME=heavenly-dreams bash /tmp/deploy-heavenly-dreams.sh
```

Si no tienes PM2:

```bash
npm install -g pm2
```

### Agregar dominio al servidor

Puedes pasar el dominio al script de deploy y la app configurara `APP_URL`, OAuth, Twilio y WebAuthn/passkeys:

```bash
APP_DOMAIN=crm.tudominio.com bash /tmp/deploy-heavenly-dreams.sh
```

Luego apunta el DNS del subdominio a la IP del servidor y activa HTTPS en el reverse proxy. Guia completa: `docs/server-domain.md`.

### Bóveda de claves API

El gerente puede administrar claves de Gemini, OpenAI, Twilio, ElevenLabs, Telegram, Didit, Ollama-compatible y proveedores personalizados desde `Ajustes -> Integraciones y APIs`.

Antes de producción genera `SECRETS_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Guia completa: `docs/api-vault.md`.
