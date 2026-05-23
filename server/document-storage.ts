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
  if (mimeType.includes('pdf')) return '.pdf';
  if (mimeType.includes('png')) return '.png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
  if (mimeType.includes('mp4')) return '.mp4';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3';
  return '.bin';
}

export function storeDocument(input: StoredDocumentInput): StoredDocumentResult {
  const id = randomUUID();
  const mimeType = input.mimeType || 'application/octet-stream';
  const buffer = Buffer.from(stripDataUrl(input.contentBase64), 'base64');
  if (!buffer.length) throw new Error('Archivo vacío o base64 inválido');

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
