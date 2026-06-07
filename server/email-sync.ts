import { createHash, randomUUID } from 'node:crypto';
import { AuditLog, CrmFollowups, EmailSync, Metrics, Settings } from './db';
import { importMorososSource, importSiacSource, rowsFromSource } from './source-data-importer';

const DEFAULT_GMAIL_QUERY = 'has:attachment (filename:csv OR filename:xlsx OR filename:xls) newer_than:14d';
const SUPPORTED_FILE_RE = /\.(csv|xlsx|xlsm)$/i;

type SyncActor = { sub?: string; nombre?: string; username?: string; role?: string };
type SyncAttachmentInput = {
  accountId?: string | null;
  source?: 'gmail' | 'manual';
  messageId?: string | null;
  sender?: string | null;
  subject?: string | null;
  fileName: string;
  mimeType?: string | null;
  buffer: Buffer;
  actor?: SyncActor | null;
};

function fingerprint(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function clean(value: any) {
  const text = String(value ?? '').trim();
  return text && !/^null$/i.test(text) ? text : null;
}

function normalizeHeader(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function rowValue(row: Record<string, any>, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  for (const [key, value] of Object.entries(row || {})) {
    const normalized = normalizeHeader(key.replace(/__\d+$/, ''));
    if (normalizedAliases.includes(normalized) || normalizedAliases.some(alias => normalized.includes(alias))) {
      return clean(value);
    }
  }
  return null;
}

function detectType(fileName: string, rows: Record<string, any>[]) {
  const lower = fileName.toLowerCase();
  const headerText = Object.keys(rows[0] || {}).map(normalizeHeader).join(' ');
  const hay = `${lower} ${headerText}`;
  if (/moros|adeudo|cobranza|saldo|vencim/.test(hay)) return 'morosidad';
  if (/pago|deposito|monto|factura|comision/.test(hay)) return 'pagos';
  if (/seguimiento|comentario|proximo|contacto|gestor/.test(hay)) return 'seguimiento';
  if (/venta|captura|cliente|paquete|instalacion/.test(hay)) return 'ventas';
  if (/siac|folio|pisa|orden de servicio|os alta|tel pago/.test(hay)) return 'siac';
  return 'desconocido';
}

function validateRows(rows: Record<string, any>[], detectedType: string) {
  const warnings: string[] = [];
  if (!rows.length) warnings.push('El archivo no contiene filas utiles.');
  const sample = rows.slice(0, 50);
  const phoneLike = sample.filter(row => {
    const phone = rowValue(row, ['telefono', 'celular', 'tel', 'movil', 'numero']);
    return phone && String(phone).replace(/\D/g, '').length >= 10;
  }).length;
  if (['siac', 'seguimiento', 'ventas', 'morosidad'].includes(detectedType) && sample.length && phoneLike === 0) {
    warnings.push('No se detectaron telefonos validos en la muestra.');
  }
  if (detectedType === 'desconocido') {
    warnings.push('No se pudo clasificar el archivo automaticamente; se registro para revision manual.');
  }
  return warnings;
}

function buildOperationalSummary(detectedType: string, imported: number, skipped: number, warnings: string[]) {
  const label: Record<string, string> = {
    siac: 'SIAC',
    morosidad: 'morosidad',
    seguimiento: 'seguimiento operativo',
    pagos: 'pagos',
    ventas: 'ventas',
    desconocido: 'archivo no clasificado',
  };
  const base = `Archivo de ${label[detectedType] || detectedType} procesado: ${imported} registros actualizados y ${skipped} omitidos.`;
  return warnings.length ? `${base} Alertas: ${warnings.join(' ')}` : base;
}

async function importSeguimiento(rows: Record<string, any>[], actor?: SyncActor | null) {
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    const folio = rowValue(row, ['folio siac', 'folio', 'folio_siac']);
    const comment = rowValue(row, ['comentario', 'nota', 'observaciones', 'seguimiento']) || 'Seguimiento importado por email';
    if (!folio) { skipped++; continue; }
    CrmFollowups.create({
      id: randomUUID(),
      folio_siac: folio,
      action: rowValue(row, ['accion', 'action', 'tipo']) || 'seguimiento_importado',
      status: rowValue(row, ['estatus', 'status']) || 'pendiente',
      next_at: rowValue(row, ['proxima fecha', 'next_at', 'fecha seguimiento']) || null,
      responsible_id: null,
      responsible_name: rowValue(row, ['responsable', 'agente', 'gestor']),
      comment,
      metadata: {
        source: 'email-sync',
        raw: row,
      },
      created_by: actor?.sub || null,
      created_by_name: actor?.nombre || actor?.username || 'Email Worker',
    });
    imported++;
  }
  return { imported, skipped };
}

async function importGenericRows(rows: Record<string, any>[], detectedType: string, actor?: SyncActor | null) {
  if (detectedType === 'seguimiento') return importSeguimiento(rows, actor);
  return { imported: 0, skipped: rows.length };
}

export async function processSyncAttachment(input: SyncAttachmentInput) {
  const hash = fingerprint(input.buffer);
  const startedAt = new Date().toISOString();
  const createdBy = input.actor?.sub || null;

  if (!SUPPORTED_FILE_RE.test(input.fileName)) {
    const job = EmailSync.createJob({
      account_id: input.accountId,
      provider: 'gmail',
      source: input.source || 'manual',
      message_id: input.messageId,
      sender: input.sender,
      subject: input.subject,
      file_name: input.fileName,
      file_type: input.mimeType || 'unsupported',
      detected_type: 'unsupported',
      status: 'failed',
      errors: ['Formato no soportado. Usa CSV, XLSX o XLSM.'],
      fingerprint: hash,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      created_by: createdBy,
    });
    return job;
  }

  const duplicate = input.messageId ? EmailSync.findJobByMessageFile(input.messageId, input.fileName) as any : null;
  if (duplicate?.status === 'completed') {
    return { ...duplicate, skippedDuplicate: true };
  }

  const rows = await rowsFromSource({ buffer: input.buffer, fileName: input.fileName });
  const detectedType = detectType(input.fileName, rows.rows);
  const warnings = validateRows(rows.rows, detectedType);
  const job = EmailSync.createJob({
    account_id: input.accountId,
    provider: 'gmail',
    source: input.source || 'manual',
    message_id: input.messageId,
    sender: input.sender,
    subject: input.subject,
    file_name: input.fileName,
    file_type: input.mimeType || null,
    detected_type: detectedType,
    status: 'processing',
    warnings,
    metadata: { rowCount: rows.rows.length },
    fingerprint: hash,
    started_at: startedAt,
    created_by: createdBy,
  });
  EmailSync.addAttachment({
    job_id: job.id,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.buffer.length,
    fingerprint: hash,
  });

  try {
    let result = { imported: 0, skipped: 0, source: input.fileName, fingerprint: hash };
    if (detectedType === 'siac') {
      result = await importSiacSource({ buffer: input.buffer, fileName: input.fileName, replace: false });
    } else if (detectedType === 'morosidad') {
      result = await importMorososSource({ buffer: input.buffer, fileName: input.fileName, replace: false });
    } else {
      result = { ...(await importGenericRows(rows.rows, detectedType, input.actor)), source: input.fileName, fingerprint: hash };
    }

    const summary = buildOperationalSummary(detectedType, result.imported, result.skipped, warnings);
    EmailSync.updateJob(job.id, {
      status: 'completed',
      imported: result.imported,
      skipped: result.skipped,
      warnings,
      metadata: {
        rowCount: rows.rows.length,
        source: result.source,
        summary,
        ai: {
          classifier: 'local-rules-v1',
          detectedType,
          suggestions: warnings.length ? ['Revisar columnas y registros omitidos antes de usar el archivo en operacion.'] : [],
        },
      },
      fingerprint: result.fingerprint || hash,
      finished_at: new Date().toISOString(),
    });
    Metrics.insert({
      id: randomUUID(),
      name: 'email_sync_imported',
      value: result.imported,
      tags: JSON.stringify({ type: detectedType, fileName: input.fileName }),
    });
    AuditLog.insert({
      accion: 'EMAIL_SYNC_PROCESS_FILE',
      entidad: 'email_sync_jobs',
      entidad_id: job.id,
      user_id: createdBy,
      user_nombre: input.actor?.nombre || input.actor?.username || 'Email Worker',
      detalle: `${detectedType};imported:${result.imported};skipped:${result.skipped};file:${input.fileName}`,
    });
    return { ...job, status: 'completed', detected_type: detectedType, imported: result.imported, skipped: result.skipped, warnings };
  } catch (err: any) {
    EmailSync.updateJob(job.id, {
      status: 'failed',
      errors: [err?.message || 'Error procesando archivo'],
      finished_at: new Date().toISOString(),
    });
    AuditLog.insert({
      accion: 'EMAIL_SYNC_FILE_ERROR',
      entidad: 'email_sync_jobs',
      entidad_id: job.id,
      user_id: createdBy,
      user_nombre: input.actor?.nombre || input.actor?.username || 'Email Worker',
      detalle: `${input.fileName};${err?.message || err}`,
    });
    throw err;
  }
}

function gmailConfig(account?: any) {
  return {
    clientId: account?.client_id || process.env.GMAIL_SYNC_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: account?.client_secret || process.env.GMAIL_SYNC_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    refreshToken: account?.refresh_token || process.env.GMAIL_SYNC_REFRESH_TOKEN,
    query: account?.query || process.env.GMAIL_SYNC_QUERY || DEFAULT_GMAIL_QUERY,
  };
}

async function gmailAccessToken(account?: any) {
  const config = gmailConfig(account);
  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    throw new Error('Gmail Sync no configurado. Define client_id, client_secret y refresh_token.');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(data?.error_description || data?.error || 'No se pudo renovar token de Gmail.');
  return data.access_token as string;
}

function decodeGmailData(data: string) {
  const normalized = String(data || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function gmailHeaders(payload: any) {
  const out: Record<string, string> = {};
  for (const h of payload?.headers || []) out[String(h.name || '').toLowerCase()] = String(h.value || '');
  return out;
}

function gmailParts(payload: any): any[] {
  const parts = payload?.parts || [];
  return parts.flatMap((part: any) => part.parts?.length ? gmailParts(part) : [part]);
}

async function gmailJson(path: string, token: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Gmail API error ${res.status}`);
  return data;
}

export async function runGmailSync(input: { accountId?: string; limit?: number; actor?: SyncActor | null } = {}) {
  const account = input.accountId ? EmailSync.getAccount(input.accountId) : (EmailSync.getDefaultAccount() || {
    id: 'env-gmail',
    provider: 'gmail',
    label: 'Gmail ENV',
    query: process.env.GMAIL_SYNC_QUERY || DEFAULT_GMAIL_QUERY,
  }) as any;

  let token: string;
  try {
    token = await gmailAccessToken(account);
  } catch (err: any) {
    EmailSync.markAccountRun(account.id, err?.message || 'Error renovando token');
    throw err;
  }

  const query = gmailConfig(account).query;
  const limit = Math.max(1, Math.min(Number(input.limit || 10), 25));
  const processed: any[] = [];

  let list: any;
  try {
    list = await gmailJson(`messages?q=${encodeURIComponent(query)}&maxResults=${limit}`, token);
  } catch (err: any) {
    EmailSync.markAccountRun(account.id, err?.message || 'Error listando mensajes Gmail');
    throw err;
  }

  for (const msg of list.messages || []) {
    let message: any;
    try {
      message = await gmailJson(`messages/${msg.id}?format=full`, token);
    } catch (err: any) {
      console.warn(`[EmailSync] No se pudo obtener mensaje ${msg.id}:`, err?.message || err);
      continue;
    }
    const headers = gmailHeaders(message.payload);
    for (const part of gmailParts(message.payload)) {
      const fileName = String(part.filename || '').trim();
      const attachmentId = part.body?.attachmentId;
      if (!fileName || !attachmentId || !SUPPORTED_FILE_RE.test(fileName)) continue;
      if (EmailSync.findJobByMessageFile(message.id, fileName)) continue;
      let attachment: any;
      try {
        attachment = await gmailJson(`messages/${message.id}/attachments/${attachmentId}`, token);
      } catch (err: any) {
        console.warn(`[EmailSync] No se pudo descargar adjunto ${fileName} del mensaje ${message.id}:`, err?.message || err);
        continue;
      }
      const buffer = decodeGmailData(attachment.data);
      try {
        const result = await processSyncAttachment({
          accountId: account.id,
          source: 'gmail',
          messageId: message.id,
          sender: headers.from,
          subject: headers.subject,
          fileName,
          mimeType: part.mimeType || null,
          buffer,
          actor: input.actor || null,
        });
        processed.push(result);
      } catch (err: any) {
        console.warn(`[EmailSync] Error procesando adjunto ${fileName}:`, err?.message || err);
      }
    }
  }

  EmailSync.markAccountRun(account.id, null);
  Settings.set('email_sync_last_run', { at: new Date().toISOString(), processed: processed.length, query });
  return { ok: true, account: { id: account.id, label: account.label, email: account.email }, query, processed };
}

export function emailSyncStatus() {
  const summary = EmailSync.summary() as any;
  return {
    configured: Boolean(process.env.GMAIL_SYNC_REFRESH_TOKEN) || (summary.accounts?.c || 0) > 0,
    defaultQuery: DEFAULT_GMAIL_QUERY,
    lastRun: Settings.get('email_sync_last_run'),
    ...summary,
  };
}
