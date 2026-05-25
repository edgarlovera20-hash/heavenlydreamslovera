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
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
]);

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/webm': '.webm',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
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

function validateStoredDocument(mimeType: string, sizeBytes: number) {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Tipo de archivo no permitido: ${mimeType || 'desconocido'}`);
  }
  const maxBytes = parseMaxBytes();
  if (sizeBytes > maxBytes) {
    throw new Error(`Archivo demasiado grande. Maximo permitido: ${Math.round(maxBytes / 1024 / 1024)} MB`);
  }
}

export function storeDocument(input: StoredDocumentInput): StoredDocumentResult {
  const id = randomUUID();
  const mimeType = (input.mimeType || mimeFromDataUrl(input.contentBase64) || 'application/octet-stream').toLowerCase();
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
