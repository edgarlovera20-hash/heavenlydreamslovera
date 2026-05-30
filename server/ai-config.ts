export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_OCR_MODEL = 'glm-ocr:latest';
export const DEFAULT_OLLAMA_CHAT_MODEL = 'gemma4:e4b';
export const DEFAULT_GEMINI_OCR_MODEL = 'gemini-2.5-flash';

function cleanBaseUrl(value: string) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function getOllamaUrl() {
  return cleanBaseUrl(process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL);
}

export function getOllamaOcrModel() {
  return String(process.env.OLLAMA_OCR_MODEL || process.env.OCR_OLLAMA_MODEL || process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_OCR_MODEL).trim();
}

export function getOllamaChatModel() {
  return String(process.env.OLLAMA_CHAT_MODEL || process.env.QWEN_MODEL || process.env.AI_MODEL || DEFAULT_OLLAMA_CHAT_MODEL).trim();
}

export function getOllamaModel() {
  return getOllamaOcrModel();
}

export function getOllamaApiKey() {
  return String(process.env.OLLAMA_API_KEY || '').trim();
}

export function getGeminiApiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

export function getGeminiOcrModel() {
  return String(process.env.GEMINI_OCR_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_OCR_MODEL).trim();
}

export function getOllamaUrlSource() {
  return process.env.OLLAMA_URL ? 'env' : 'default-local';
}
