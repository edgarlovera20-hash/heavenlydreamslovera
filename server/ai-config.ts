export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_OCR_MODEL = 'glm-ocr:latest';
export const DEFAULT_OLLAMA_CHAT_MODEL = 'gemma4:e4b';
export const DEFAULT_GEMINI_OCR_MODEL = 'gemini-2.5-flash';

import { getProviderConfig, getSecretValue, secretSource } from './secret-vault';

function cleanBaseUrl(value: string) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function getOllamaUrl() {
  const config = getProviderConfig('ollama', 'OLLAMA_API_KEY');
  return cleanBaseUrl(config.metadata?.baseUrl || getSecretValue('OLLAMA_URL', process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL));
}

export function getOllamaOcrModel() {
  const config = getProviderConfig('ollama', 'OLLAMA_API_KEY');
  return String(config.metadata?.ocrModel || config.metadata?.model || process.env.OLLAMA_OCR_MODEL || process.env.OCR_OLLAMA_MODEL || process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_OCR_MODEL).trim();
}

export function getOllamaChatModel() {
  const config = getProviderConfig('ollama', 'OLLAMA_API_KEY');
  return String(config.metadata?.chatModel || config.metadata?.model || process.env.OLLAMA_CHAT_MODEL || process.env.QWEN_MODEL || process.env.AI_MODEL || DEFAULT_OLLAMA_CHAT_MODEL).trim();
}

export function getOllamaModel() {
  return getOllamaOcrModel();
}

export function getOllamaApiKey() {
  return getProviderSecretCompat('ollama', 'OLLAMA_API_KEY');
}

export function getGeminiApiKey() {
  return getSecretValue('GEMINI_API_KEY', process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '');
}

export function getGeminiOcrModel() {
  const config = getProviderConfig('gemini', 'GEMINI_API_KEY');
  return String(config.metadata?.ocrModel || config.metadata?.model || getSecretValue('GEMINI_MODEL', process.env.GEMINI_OCR_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_OCR_MODEL)).trim();
}

export function getOllamaUrlSource() {
  if (secretSource('OLLAMA_URL') === 'vault' || getProviderConfig('ollama', 'OLLAMA_API_KEY').source === 'vault') return 'vault';
  return process.env.OLLAMA_URL ? 'env' : 'default-local';
}

export function getGeminiSource() {
  return secretSource('GEMINI_API_KEY');
}

function getProviderSecretCompat(provider: string, fallbackKeyName: string) {
  const config = getProviderConfig(provider, fallbackKeyName);
  return String(config.value || '').trim();
}
