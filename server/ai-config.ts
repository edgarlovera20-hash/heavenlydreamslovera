export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = 'glm-ocr:latest';

function cleanBaseUrl(value: string) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function getOllamaUrl() {
  return cleanBaseUrl(process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL);
}

export function getOllamaModel() {
  return String(process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL).trim();
}

export function getOllamaApiKey() {
  return String(process.env.OLLAMA_API_KEY || '').trim();
}

export function getOllamaUrlSource() {
  return process.env.OLLAMA_URL ? 'env' : 'default-local';
}
