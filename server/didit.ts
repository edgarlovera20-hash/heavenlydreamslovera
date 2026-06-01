import { randomUUID } from 'node:crypto';
import type { Express, Request } from 'express';
import { DiditChecks, DocumentFiles } from './db';
import { readStoredDocument } from './document-storage';
import { createHttpError, parseLimit, wrap } from './http';
import { requireRole } from './security';
import { getSecretValue } from './secret-vault';

type ParsedFile = {
  fieldName: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  documentId?: string | null;
};

type ParsedInput = {
  fields: Record<string, any>;
  files: ParsedFile[];
};

const DIDIT_BASE_URL = (process.env.DIDIT_BASE_URL || 'https://verification.didit.me').replace(/\/+$/, '');
const DEFAULT_UPLOAD_MAX_BYTES = 60 * 1024 * 1024;

function diditApiKey() {
  const key = getSecretValue('DIDIT_API_KEY');
  if (!key) {
    throw createHttpError(503, 'DIDIT_API_KEY no esta configurada en el servidor.', 'DIDIT_NOT_CONFIGURED');
  }
  return key;
}

function isMultipart(req: Request) {
  return String(req.headers['content-type'] || '').toLowerCase().includes('multipart/form-data');
}

function multipartBoundary(req: Request) {
  const contentType = String(req.headers['content-type'] || '');
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return (match?.[1] || match?.[2] || '').trim();
}

function maxUploadBytes() {
  const value = Number(process.env.DIDIT_UPLOAD_MAX_BYTES || process.env.DOCUMENT_MAX_BYTES);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_UPLOAD_MAX_BYTES;
}

async function readRequestBuffer(req: Request) {
  const chunks: Buffer[] = [];
  let total = 0;
  const maxBytes = maxUploadBytes();
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw createHttpError(413, `Archivo demasiado grande para Didit. Maximo: ${Math.round(maxBytes / 1024 / 1024)} MB`, 'DIDIT_UPLOAD_TOO_LARGE');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function stripTrailingCrlf(buffer: Buffer) {
  if (buffer.length >= 2 && buffer[buffer.length - 2] === 13 && buffer[buffer.length - 1] === 10) {
    return buffer.subarray(0, buffer.length - 2);
  }
  return buffer;
}

function parseHeaderValue(headers: string, name: string) {
  const match = headers.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match?.[1] || '';
}

function parseMultipartBuffer(buffer: Buffer, boundary: string): ParsedInput {
  const fields: Record<string, any> = {};
  const files: ParsedFile[] = [];
  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = buffer.indexOf(delimiter);

  while (cursor >= 0) {
    const partStart = cursor + delimiter.length;
    const next = buffer.indexOf(delimiter, partStart);
    if (next < 0) break;

    let part = buffer.subarray(partStart, next);
    if (part.subarray(0, 2).toString() === '--') break;
    if (part.subarray(0, 2).toString() === '\r\n') part = part.subarray(2);
    part = stripTrailingCrlf(part);

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd > 0) {
      const headerText = part.subarray(0, headerEnd).toString('utf8');
      const content = part.subarray(headerEnd + 4);
      const fieldName = parseHeaderValue(headerText, 'name');
      const fileName = parseHeaderValue(headerText, 'filename');
      const mimeType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';

      if (fieldName && fileName) {
        files.push({
          fieldName,
          fileName,
          mimeType,
          buffer: content,
        });
      } else if (fieldName) {
        fields[fieldName] = content.toString('utf8').trim();
      }
    }

    cursor = next;
  }

  return { fields, files };
}

async function parseInput(req: Request): Promise<ParsedInput> {
  if (!isMultipart(req)) return { fields: req.body || {}, files: [] };
  const boundary = multipartBoundary(req);
  if (!boundary) throw createHttpError(400, 'Falta boundary multipart/form-data.', 'DIDIT_MULTIPART_BOUNDARY_MISSING');
  return parseMultipartBuffer(await readRequestBuffer(req), boundary);
}

function normalizeBool(value: any, fallback = true) {
  if (typeof value === 'boolean') return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (['true', '1', 'yes', 'si', 'on'].includes(raw)) return true;
  if (['false', '0', 'no', 'off'].includes(raw)) return false;
  return fallback;
}

function dataUrlToFile(value: string, fieldName: string, fileName = `${fieldName}.jpg`, mimeType = ''): ParsedFile {
  const raw = String(value || '').trim();
  const match = raw.match(/^data:([^;]+);base64,([\s\S]+)$/i);
  const contentBase64 = match?.[2] || raw;
  const resolvedMime = (mimeType || match?.[1] || 'application/octet-stream').toLowerCase();
  const buffer = Buffer.from(contentBase64, 'base64');
  if (!buffer.length) throw createHttpError(400, `Archivo ${fieldName} vacio o base64 invalido.`, 'DIDIT_FILE_INVALID');
  return { fieldName, fileName, mimeType: resolvedMime, buffer };
}

function storedDocumentToFile(documentId: string, fieldName: string): ParsedFile {
  const file = DocumentFiles.getById(documentId) as any;
  if (!file) throw createHttpError(404, `Documento no encontrado: ${documentId}`, 'DIDIT_DOCUMENT_NOT_FOUND');
  return {
    fieldName,
    fileName: file.archivo_nombre || `${fieldName}.bin`,
    mimeType: file.mime_type || 'application/octet-stream',
    buffer: readStoredDocument(file.storage_path),
    documentId,
  };
}

function firstValue(fields: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = fields[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function firstMultipartFile(input: ParsedInput, fieldNames: string[]) {
  return input.files.find((file) => fieldNames.includes(file.fieldName));
}

function resolveFile(input: ParsedInput, fieldName: string, options: { fields?: string[]; documentIds?: string[]; base64?: string[]; fileName?: string; mimeType?: string }) {
  const multipart = firstMultipartFile(input, options.fields || [fieldName]);
  if (multipart) return { ...multipart, fieldName };

  const documentId = firstValue(input.fields, options.documentIds || [`${fieldName}DocumentId`, `${fieldName}_document_id`, 'documentId']);
  if (documentId) return storedDocumentToFile(String(documentId), fieldName);

  const contentBase64 = firstValue(input.fields, options.base64 || [`${fieldName}Base64`, `${fieldName}_base64`, fieldName]);
  if (contentBase64) {
    const fileName = String(firstValue(input.fields, [`${fieldName}FileName`, `${fieldName}_file_name`, 'fileName']) || options.fileName || `${fieldName}.jpg`);
    const mimeType = String(firstValue(input.fields, [`${fieldName}MimeType`, `${fieldName}_mime_type`, 'mimeType']) || options.mimeType || '');
    return dataUrlToFile(String(contentBase64), fieldName, fileName, mimeType);
  }
  return null;
}

function requireFile(input: ParsedInput, fieldName: string, options: Parameters<typeof resolveFile>[2]) {
  const file = resolveFile(input, fieldName, options);
  if (!file) throw createHttpError(400, `Falta archivo requerido: ${fieldName}`, 'DIDIT_FILE_REQUIRED');
  return file;
}

function appendCommonFormFields(form: FormData, fields: Record<string, any>) {
  form.append('save_api_request', String(normalizeBool(fields.save_api_request, true)));
  const vendorData = firstValue(fields, ['vendor_data', 'vendorData', 'captureId', 'captura_id', 'folio']);
  if (vendorData) form.append('vendor_data', String(vendorData));
}

function commonJsonPayload(fields: Record<string, any>) {
  return {
    ...fields,
    save_api_request: normalizeBool(fields.save_api_request, true),
  };
}

function appendFile(form: FormData, file: ParsedFile) {
  form.append(file.fieldName, new Blob([file.buffer], { type: file.mimeType }), file.fileName);
}

async function diditFetch(endpoint: string, init: RequestInit) {
  const response = await fetch(`${DIDIT_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      'x-api-key': diditApiKey(),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    throw createHttpError(response.status, data?.message || data?.error || `Didit rechazo la solicitud (${response.status})`, 'DIDIT_API_ERROR', data);
  }
  return data;
}

async function diditMultipart(endpoint: string, input: ParsedInput, files: ParsedFile[]) {
  const form = new FormData();
  appendCommonFormFields(form, input.fields);
  for (const file of files) appendFile(form, file);
  return diditFetch(endpoint, { method: 'POST', body: form });
}

async function diditJson(endpoint: string, payload: Record<string, any>) {
  return diditFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(commonJsonPayload(payload)),
  });
}

function resultStatus(result: any, key: string) {
  return String(result?.[key]?.status || result?.status || '').trim() || null;
}

function providerRequestId(result: any) {
  return String(result?.request_id || result?.id || '').trim() || null;
}

function routeVendorData(fields: Record<string, any>) {
  return String(firstValue(fields, ['vendor_data', 'vendorData', 'captureId', 'captura_id', 'folio']) || '').trim() || null;
}

function routeCaptureId(fields: Record<string, any>) {
  return String(firstValue(fields, ['captureId', 'captura_id']) || '').trim() || null;
}

function summarizeFiles(files: ParsedFile[]) {
  return files.map((file) => ({
    fieldName: file.fieldName,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.buffer.length,
    documentId: file.documentId || null,
  }));
}

function recordCheck(req: any, kind: string, resultKey: string, fields: Record<string, any>, files: ParsedFile[], result: any) {
  const row = {
    id: randomUUID(),
    kind,
    provider_request_id: providerRequestId(result),
    status: resultStatus(result, resultKey),
    vendor_data: routeVendorData(fields),
    capture_id: routeCaptureId(fields),
    document_file_ids: files.map((file) => file.documentId).filter(Boolean),
    request_summary: {
      endpointKind: kind,
      files: summarizeFiles(files),
      vendor_data: routeVendorData(fields),
      save_api_request: normalizeBool(fields.save_api_request, true),
    },
    response_json: result,
    created_by: req.auth?.sub || null,
  };
  DiditChecks.create(row);
  return { ...result, didit_check_id: row.id };
}

async function runMultipartCheck(req: any, kind: string, resultKey: string, endpoint: string, files: ParsedFile[]) {
  const input = (req as any).diditInput as ParsedInput;
  const result = await diditMultipart(endpoint, input, files);
  return recordCheck(req, kind, resultKey, input.fields, files, result);
}

export function registerDiditRoutes(app: Express) {
  const diditOnly = requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR');

  const withInput = wrap(async (req: any, _res: any, next: any) => {
    req.diditInput = await parseInput(req);
    if (next) next();
  });

  app.get('/api/didit/status', diditOnly, wrap((_req: any, res: any) => {
    res.json({
      configured: Boolean(getSecretValue('DIDIT_API_KEY')),
      baseUrl: DIDIT_BASE_URL,
      uploadMaxBytes: maxUploadBytes(),
      supported: [
        'id-verification',
        'poa',
        'database-validation',
        'passive-liveness',
        'face-match',
        'face-search',
        'age-estimation',
        'aml',
        'email/send',
        'email/check',
        'phone/send',
        'phone/check',
      ],
    });
  }));

  app.get('/api/didit/checks', diditOnly, wrap((req: any, res: any) => {
    res.json(DiditChecks.getRecent(parseLimit(req.query.limit, 100, 500)));
  }));

  app.get('/api/didit/checks/:id', diditOnly, wrap((req: any, res: any) => {
    const row = DiditChecks.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Verificacion Didit no encontrada' });
    res.json(row);
  }));

  app.post('/api/didit/id-verification', diditOnly, withInput, wrap(async (req: any, res: any) => {
    const input = req.diditInput as ParsedInput;
    const front = requireFile(input, 'front_image', {
      fields: ['front_image', 'frontImage', 'ine_front', 'ineFrontal'],
      documentIds: ['frontDocumentId', 'front_image_document_id', 'ineFrontDocumentId'],
      base64: ['frontImageBase64', 'front_image_base64', 'front_image', 'ineFrontBase64'],
      fileName: 'front_image.jpg',
    });
    const back = resolveFile(input, 'back_image', {
      fields: ['back_image', 'backImage', 'ine_back', 'ineReverso'],
      documentIds: ['backDocumentId', 'back_image_document_id', 'ineBackDocumentId'],
      base64: ['backImageBase64', 'back_image_base64', 'back_image', 'ineBackBase64'],
      fileName: 'back_image.jpg',
    });
    const files = back ? [front, back] : [front];
    res.json(await runMultipartCheck(req, 'id_verification', 'id_verification', '/v3/id-verification/', files));
  }));

  app.post('/api/didit/poa', diditOnly, withInput, wrap(async (req: any, res: any) => {
    const input = req.diditInput as ParsedInput;
    const document = requireFile(input, 'document', {
      fields: ['document', 'poa', 'comprobante'],
      documentIds: ['documentId', 'poaDocumentId', 'comprobanteDocumentId'],
      base64: ['documentBase64', 'poaBase64', 'comprobanteBase64', 'document'],
      fileName: 'proof_of_address.pdf',
    });
    res.json(await runMultipartCheck(req, 'poa', 'poa', '/v3/poa/', [document]));
  }));

  app.post('/api/didit/passive-liveness', diditOnly, withInput, wrap(async (req: any, res: any) => {
    const input = req.diditInput as ParsedInput;
    const userImage = requireFile(input, 'user_image', {
      fields: ['user_image', 'userImage', 'selfie'],
      documentIds: ['userImageDocumentId', 'selfieDocumentId'],
      base64: ['userImageBase64', 'user_image_base64', 'selfieBase64', 'user_image'],
      fileName: 'user_image.jpg',
    });
    res.json(await runMultipartCheck(req, 'passive_liveness', 'passive_liveness', '/v3/passive-liveness/', [userImage]));
  }));

  app.post('/api/didit/face-match', diditOnly, withInput, wrap(async (req: any, res: any) => {
    const input = req.diditInput as ParsedInput;
    const userImage = requireFile(input, 'user_image', {
      fields: ['user_image', 'userImage', 'selfie'],
      documentIds: ['userImageDocumentId', 'selfieDocumentId'],
      base64: ['userImageBase64', 'user_image_base64', 'selfieBase64', 'user_image'],
      fileName: 'user_image.jpg',
    });
    const refImage = requireFile(input, 'ref_image', {
      fields: ['ref_image', 'refImage', 'reference_image'],
      documentIds: ['refImageDocumentId', 'referenceDocumentId'],
      base64: ['refImageBase64', 'ref_image_base64', 'referenceImageBase64', 'ref_image'],
      fileName: 'ref_image.jpg',
    });
    res.json(await runMultipartCheck(req, 'face_match', 'face_match', '/v3/face-match/', [userImage, refImage]));
  }));

  app.post('/api/didit/face-search', diditOnly, withInput, wrap(async (req: any, res: any) => {
    const input = req.diditInput as ParsedInput;
    const userImage = requireFile(input, 'user_image', {
      fields: ['user_image', 'userImage', 'selfie'],
      documentIds: ['userImageDocumentId', 'selfieDocumentId'],
      base64: ['userImageBase64', 'user_image_base64', 'selfieBase64', 'user_image'],
      fileName: 'user_image.jpg',
    });
    res.json(await runMultipartCheck(req, 'face_search', 'face_search', '/v3/face-search/', [userImage]));
  }));

  app.post('/api/didit/age-estimation', diditOnly, withInput, wrap(async (req: any, res: any) => {
    const input = req.diditInput as ParsedInput;
    const userImage = requireFile(input, 'user_image', {
      fields: ['user_image', 'userImage', 'selfie'],
      documentIds: ['userImageDocumentId', 'selfieDocumentId'],
      base64: ['userImageBase64', 'user_image_base64', 'selfieBase64', 'user_image'],
      fileName: 'user_image.jpg',
    });
    res.json(await runMultipartCheck(req, 'age_estimation', 'age_estimation', '/v3/age-estimation/', [userImage]));
  }));

  app.post('/api/didit/database-validation', diditOnly, wrap(async (req: any, res: any) => {
    const result = await diditJson('/v3/database-validation/', req.body || {});
    res.json(recordCheck(req, 'database_validation', 'database_validation', req.body || {}, [], result));
  }));

  app.post('/api/didit/aml', diditOnly, wrap(async (req: any, res: any) => {
    const result = await diditJson('/v3/aml/', req.body || {});
    res.json(recordCheck(req, 'aml', 'aml', req.body || {}, [], result));
  }));

  app.post('/api/didit/email/send', diditOnly, wrap(async (req: any, res: any) => {
    const result = await diditJson('/v3/email/send/', req.body || {});
    res.json(recordCheck(req, 'email_send', 'email', req.body || {}, [], result));
  }));

  app.post('/api/didit/email/check', diditOnly, wrap(async (req: any, res: any) => {
    const result = await diditJson('/v3/email/check/', req.body || {});
    res.json(recordCheck(req, 'email_check', 'email', req.body || {}, [], result));
  }));

  app.post('/api/didit/phone/send', diditOnly, wrap(async (req: any, res: any) => {
    const result = await diditJson('/v3/phone/send/', req.body || {});
    res.json(recordCheck(req, 'phone_send', 'phone', req.body || {}, [], result));
  }));

  app.post('/api/didit/phone/check', diditOnly, wrap(async (req: any, res: any) => {
    const result = await diditJson('/v3/phone/check/', req.body || {});
    res.json(recordCheck(req, 'phone_check', 'phone', req.body || {}, [], result));
  }));
}
