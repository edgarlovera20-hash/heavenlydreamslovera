import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

export interface StoredDocumentInput {
  contentBase64: string;
  fileName: string;
  mimeType?: string;
  captureId?: string | null;
  saleId?: string | null;
  docType: string;
}

export interface StoredDocumentResult {
  id: string;
  storageProvider: 'local';
  storagePath: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
}

const STORAGE_ROOT = process.env.DOCUMENT_STORAGE_DIR || join(process.cwd(), 'data', 'document_storage');
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/avif',
  'application/pdf',
  'application/xml',
  'text/xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/3gpp',
  'video/mpeg',
  'video/x-ms-wmv',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/opus',
  'audio/3gpp',
  'audio/amr',
]);

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/avif': '.avif',
  'application/pdf': '.pdf',
  'application/xml': '.xml',
  'text/xml': '.xml',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'video/3gpp': '.3gp',
  'video/mpeg': '.mpeg',
  'video/x-ms-wmv': '.wmv',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/webm': '.webm',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'audio/3gpp': '.3gp',
  'audio/amr': '.amr',
};

const EXTENSION_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.3gp': 'video/3gpp',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.wmv': 'video/x-ms-wmv',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.amr': 'audio/amr',
};

function parseMaxBytes() {
  const value = Number(process.env.DOCUMENT_MAX_BYTES);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_MAX_BYTES;
}

function safeSegment(value: string) {
  return String(value || 'unknown')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 90) || 'unknown';
}

function stripDataUrl(value: string) {
  return String(value || '').replace(/^data:[^;]+;base64,/, '');
}

function extensionFor(fileName: string, mimeType: string) {
  const ext = extname(fileName || '');
  if (ext) return ext.toLowerCase();
  return MIME_EXTENSIONS[mimeType] || '.bin';
}

function mimeFromDataUrl(value: string) {
  return String(value || '').match(/^data:([^;]+);base64,/)?.[1]?.toLowerCase() || '';
}

function mimeFromFileName(fileName: string) {
  return EXTENSION_MIME_TYPES[extname(fileName || '').toLowerCase()] || '';
}

function validateStoredDocument(mimeType: string, sizeBytes: number) {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Tipo de archivo no permitido: ${mimeType || 'desconocido'}. Se aceptan imagenes, PDF, audios y videos.`);
  }
  const maxBytes = parseMaxBytes();
  if (sizeBytes > maxBytes) {
    throw new Error(`Archivo demasiado grande. Maximo permitido: ${Math.round(maxBytes / 1024 / 1024)} MB`);
  }
}

export function storeDocument(input: StoredDocumentInput): StoredDocumentResult {
  const id = randomUUID();
  const incomingMime = (input.mimeType || mimeFromDataUrl(input.contentBase64) || '').toLowerCase();
  const mimeType = incomingMime && incomingMime !== 'application/octet-stream'
    ? incomingMime
    : mimeFromFileName(input.fileName) || 'application/octet-stream';
  const buffer = Buffer.from(stripDataUrl(input.contentBase64), 'base64');
  if (!buffer.length) throw new Error('Archivo vacío o base64 inválido');
  validateStoredDocument(mimeType, buffer.length);

  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const captureSegment = safeSegment(input.captureId || input.saleId || 'sin_captura');
  const docSegment = safeSegment(input.docType);
  const ext = extensionFor(input.fileName, mimeType);
  const folder = join(STORAGE_ROOT, captureSegment, docSegment);
  mkdirSync(folder, { recursive: true });
  const storagePath = join(folder, `${id}${ext}`);
  writeFileSync(storagePath, buffer);

  return {
    id,
    storageProvider: 'local',
    storagePath,
    sha256,
    sizeBytes: buffer.length,
    mimeType,
    fileName: input.fileName || `${docSegment}${ext}`,
  };
}

export function readStoredDocument(storagePath: string) {
  return readFileSync(storagePath);
}
