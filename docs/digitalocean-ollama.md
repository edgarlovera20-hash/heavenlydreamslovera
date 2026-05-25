# Ollama local en DigitalOcean

Esta app ya queda preparada para usar Ollama como IA primaria sin llaves API.
Por defecto intenta conectarse a `http://127.0.0.1:11434`, en el mismo servidor donde corre la app.

## Instalacion rapida

Conectate por SSH al droplet y ejecuta:

```bash
cd /opt/heavenly-dreams
git pull
chmod +x scripts/setup-ollama-digitalocean.sh
sudo APP_DIR=/opt/heavenly-dreams APP_NAME=heavenly-dreams OLLAMA_MODEL=glm-ocr:latest bash scripts/setup-ollama-digitalocean.sh
```

El script hace esto:

- Instala Ollama si falta.
- Activa el servicio `ollama` con `systemd`.
- Descarga el modelo `glm-ocr:latest`.
- Configura `.env` con `OLLAMA_URL="http://127.0.0.1:11434"`.
- Deja `OLLAMA_API_KEY=""` porque Ollama local no necesita llave.
- Reinicia la app con PM2 si el proceso existe.

## Verificar Ollama

```bash
curl http://127.0.0.1:11434/api/tags
ollama list
systemctl status ollama --no-pager
```

## Seguridad

No abras el puerto `11434` a internet. La app debe hablar con Ollama por `127.0.0.1`.

```bash
sudo ufw deny 11434/tcp
```

Tampoco agregues una ruta publica en Nginx para `/api` de Ollama.

## Variables importantes

```bash
OLLAMA_URL="http://127.0.0.1:11434"
OLLAMA_API_KEY=""
OLLAMA_MODEL="glm-ocr:latest"
OLLAMA_TIMEOUT_MS="60000"
OCR_LLM_TIMEOUT_MS="30000"
OCR_TESSERACT_TIMEOUT_MS="25000"
OCR_MAX_OUTPUT_TOKENS="900"
OCR_PRIMARY="ollama"
OCR_STRATEGY="adaptive"
GEMINI_API_KEY=""
```

Gemini queda como respaldo opcional. Si no quieres usar ningun servicio de pago, deja `GEMINI_API_KEY` vacio.

## Reiniciar la app

```bash
cd /opt/heavenly-dreams
npm run build
pm2 restart heavenly-dreams --update-env
pm2 save
```
