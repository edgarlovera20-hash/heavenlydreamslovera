#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/heavenly-dreams}"
APP_NAME="${APP_NAME:-heavenly-dreams}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-glm-ocr:latest}"
OLLAMA_TIMEOUT_MS="${OLLAMA_TIMEOUT_MS:-60000}"
OCR_LLM_TIMEOUT_MS="${OCR_LLM_TIMEOUT_MS:-30000}"
OCR_TESSERACT_TIMEOUT_MS="${OCR_TESSERACT_TIMEOUT_MS:-25000}"
OCR_MAX_OUTPUT_TOKENS="${OCR_MAX_OUTPUT_TOKENS:-900}"
OCR_PRIMARY="${OCR_PRIMARY:-ollama}"
OCR_STRATEGY="${OCR_STRATEGY:-adaptive}"

require_command() {
  if command -v "$1" >/dev/null 2>&1; then
    return 0
  fi
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y "$1"
    return 0
  fi
  echo "Falta el comando '$1'. Instálalo y vuelve a ejecutar este script."
  exit 1
}

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"

  sudo mkdir -p "$(dirname "$file")"
  sudo touch "$file"

  if sudo grep -q "^${key}=" "$file"; then
    sudo sed -i "s|^${key}=.*|${key}=\"${value}\"|" "$file"
  else
    echo "${key}=\"${value}\"" | sudo tee -a "$file" >/dev/null
  fi
}

wait_for_ollama() {
  for _ in $(seq 1 30); do
    if curl -fsS "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Ollama no respondió en ${OLLAMA_URL}."
  sudo systemctl status ollama --no-pager || true
  exit 1
}

require_command curl

if ! command -v ollama >/dev/null 2>&1; then
  echo "Instalando Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
fi

echo "Activando servicio Ollama..."
sudo systemctl enable --now ollama
wait_for_ollama

echo "Descargando modelo ${OLLAMA_MODEL}..."
ollama pull "${OLLAMA_MODEL}"

echo "Probando API local..."
curl -fsS "${OLLAMA_URL}/api/chat" \
  -H 'Content-Type: application/json' \
  -d "{\"model\":\"${OLLAMA_MODEL}\",\"stream\":false,\"messages\":[{\"role\":\"user\",\"content\":\"Responde solo: ok\"}]}" >/dev/null

if [ -d "${APP_DIR}" ]; then
  echo "Configurando ${APP_DIR}/.env..."
  set_env_value "${APP_DIR}/.env" "OLLAMA_URL" "${OLLAMA_URL}"
  set_env_value "${APP_DIR}/.env" "OLLAMA_API_KEY" ""
  set_env_value "${APP_DIR}/.env" "OLLAMA_MODEL" "${OLLAMA_MODEL}"
  set_env_value "${APP_DIR}/.env" "OLLAMA_TIMEOUT_MS" "${OLLAMA_TIMEOUT_MS}"
  set_env_value "${APP_DIR}/.env" "OCR_LLM_TIMEOUT_MS" "${OCR_LLM_TIMEOUT_MS}"
  set_env_value "${APP_DIR}/.env" "OCR_TESSERACT_TIMEOUT_MS" "${OCR_TESSERACT_TIMEOUT_MS}"
  set_env_value "${APP_DIR}/.env" "OCR_MAX_OUTPUT_TOKENS" "${OCR_MAX_OUTPUT_TOKENS}"
  set_env_value "${APP_DIR}/.env" "OCR_PRIMARY" "${OCR_PRIMARY}"
  set_env_value "${APP_DIR}/.env" "OCR_STRATEGY" "${OCR_STRATEGY}"

  if command -v pm2 >/dev/null 2>&1 && pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
    echo "Reiniciando ${APP_NAME} con PM2..."
    pm2 restart "${APP_NAME}" --update-env
    pm2 save
  else
    echo "PM2 no tiene ${APP_NAME} activo. Reinicia la app manualmente si aplica."
  fi
else
  echo "No encontré ${APP_DIR}; solo quedó instalado Ollama."
fi

echo "Listo. Modelos disponibles:"
ollama list
