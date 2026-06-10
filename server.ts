import "dotenv/config";
import "./server/domain";
import { initSentry } from "./server/sentry";
initSentry();
import express from "express";
import { createServer as createHttpServer } from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { randomUUID, timingSafeEqual } from "crypto";
import { createApp } from "./server/app";
import { createHttpError, hasPagingQuery, parseLimit, parseOffset, queryString, wrap } from "./server/http";
import {
  initWhatsApp,
  getWhatsAppStatus,
  getWhatsAppQR,
  sendWhatsAppMessage,
  sendWhatsAppVideo,
  sendWhatsAppClientMessage,
  logoutWhatsApp,
  getRecentMessages,
  setWhatsAppMessageHandler,
  normalizeWhatsAppAccount,
  hasWhatsAppCredentials,
  type WaMessage,
} from "./server/whatsapp";
import {
  isCloudConfigured,
  sendCloudMessage,
  handleWebhookVerification,
  handleWebhookPayload,
} from "./server/whatsapp-cloud";
import { initTelegram, stopTelegram, getTelegramStatus, getTelegramMessages, sendTelegramMessage, sendTelegramVideo, setTelegramMessageHandler, type TgMessage } from "./server/telegram";
import { runIneOcr, runComprobanteOcr, runSiacOcr, checkOcrStatus } from "./server/ocr-service";
import db, {
  Users, Ventas, SiacRecords, Tickets, AuditLog, Settings,
  Referrals, Quotas, CommissionRules, PackageCatalog,
  Nominas, Territories, ValidationRequests, Announcements,
  InventoryItems, AutomationRules, AiJobs, Metrics, Sessions,
  Capturas, DocumentosCliente, DocumentFiles, ClientesCrm, EstatusFolios, LogsSistema,
  AgentOutbox, AgentProfiles, AgentTasks, ChannelConversations, CrmFollowups, CrmNotes, CrmVisibilityRules, CrmSavedSearches,
  EmailSync,
} from "./server/db";
import {
  canAccessUserRecord,
  canApproveHumanAuth,
  canManageAuth,
  canOperateAuth,
  isManagerAuth,
  normalizeRole,
} from "./server/services/rbac-service";
import {
  buildSiacWeekPayroll,
  normalizePayrollIdentity,
  payrollOwnerMatches,
  payrollRowsForAuth,
} from "./server/services/payroll-service";
import { getSiacCSVFingerprint, importSiacCSV } from "./server/siac-importer";
import {
  DEFAULT_MOROSOS_SOURCE,
  DEFAULT_SIAC_SOURCE,
  SIAC_IMPORTER_VERSION,
  getSourceFingerprint,
  importMorososSource,
  importSiacSource,
} from "./server/source-data-importer";
import { clearRefreshCookie, getBearerAuth, getRefreshTokenFromRequest, issueSessionCookie, rateLimit, requireAuth, requireRole, rotateRefreshToken } from "./server/security";
import { hashPassword, needsPasswordRehash, verifyPassword } from "./server/passwords";
import {
  classifyMorosityReply,
  enqueueAiJob,
  enterpriseHealth,
  processNextAiJob,
  recordEvent,
  recordMetric,
  runAiWithFallback,
} from "./server/enterprise";
import {
  deleteSecret,
  getSecretForServerUse,
  getSecretValue,
  listMaskedSecrets,
  patchSecret,
  revokeSecret,
  saveSecret,
} from "./server/secret-vault";
import {
  makeAuthenticationOptions,
  makeRegistrationOptions,
  isWebAuthnRequired,
  userHasPasskey,
  verifyAuthentication,
  verifyRegistration,
} from "./server/webauthn";
import { getEnterpriseReadiness } from "./server/readiness";
import { readStoredDocument, storeDocument } from "./server/document-storage";
import { buildValidationTwiML, createTwilioCall, getTwilioFromNumber, getTwilioWebhookToken, twilioConfigured } from "./server/twilio";
import {
  attachOpenAIRealtimeStream,
  buildOpenAIRealtimeTwiML,
  buildValidationCallPayload,
  getDefaultVoiceProvider,
  listVoiceProviderStatus,
  normalizeProviderStartResult,
  startValidationCallWithProvider,
  syncValidationWithProvider,
} from "./server/voice-providers";
import { oauthCallback, oauthStart, oauthStatus } from "./server/oauth";
import { emailSyncStatus, processSyncAttachment, runGmailSync } from "./server/email-sync";
import {
  createCalendarEvent, createContact, createSpreadsheet, appendToSheet, readSheet,
  deleteCalendarEvent, exchangeGoogleServiceCode, getGoogleServiceAuthUrl,
  googleServicesStatus, listCalendarEvents, listContacts, refreshGoogleToken,
  auditGoogleService,
} from "./server/google-services";
import {
  appendExcelRows, createOneDriveFolder, createOutlookEvent, deleteOutlookEvent,
  exchangeMicrosoftServiceCode, getMicrosoftServiceAuthUrl, listChannels,
  listExcelWorksheets, listOneDriveFiles, listOutlookEvents, listTeams,
  microsoftServicesStatus, readExcelRange, sendTeamsMessage, sendTeamsWebhookMessage,
  uploadToOneDrive, auditMicrosoftService,
} from "./server/microsoft-graph";
import { createTelmexAutomationJob, getTelmexJob, listTelmexJobs, updateTelmexAutomationJob } from "./server/telmex-automation";
import {
  assignConversation,
  getChannelAccounts,
  getChannelConversations,
  getChannelMessages,
  getConversationAutomation,
  getRecentChannelMessages,
  setIncomingMessageHandler,
  upsertChannelAccount,
} from "./server/messaging";
import {
  approveAgentOutbox,
  formatSiacFolioReply,
  rejectAgentOutbox,
  runAgentForConversation,
  runAgentForMessage,
} from "./server/agent-orchestrator";
import { registerFinanceEnterpriseRoutes } from "./server/finance-enterprise";
import { registerDiditRoutes } from "./server/didit";
import { registerAvatarRoutes } from "./server/avatar/avatar.service";
import { answerTelmexQuestion, shouldUseTelmexInfo } from "./server/telmex-info-agent";
import { agentVideoDirectory, deleteAgentVideo, listAgentVideos, uploadAgentVideo } from "./server/agent-video-library";
import {
  CURP_REGEX,
  CURP_STATE_NAMES,
  generateCurpCandidate,
  normalizeCurpValue,
  validateCurpChecksum,
} from "./src/lib/curp";

// ── CSV helpers ────────────────────────────────────────────────
function toCsv(rows: any[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\r\n');
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
    } else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function parseCsvToRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(l => {
    const cols = parseCsvLine(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

const ALLOWED_TABLES = [
  'users', 'ventas', 'siac_records', 'tickets', 'referrals',
  'territories', 'nominas', 'announcements', 'package_catalog',
  'commission_rules', 'quotas', 'validation_requests', 'inventory_items',
  'automation_rules', 'ai_jobs', 'metrics', 'system_events', 'sessions',
  'capturas', 'documentos_cliente', 'clientes_crm', 'morosidad',
  'estatus_folios', 'logs_sistema', 'document_files', 'oauth_accounts',
  'weekly_financial_cycles', 'financial_movements', 'financial_alerts',
  'financial_invoices', 'financial_deposits', 'financial_predictions',
  'financial_audit_logs', 'financial_files', 'didit_checks',
  'user_avatars',
];

const DOCUMENT_TYPES = [
  'INE_FRONTAL',
  'INE_REVERSO',
  'COMPROBANTE_DOMICILIO',
  'ANEXO_PORTABILIDAD_1',
  'ANEXO_PORTABILIDAD_2',
  'CAPTURA_SIAC',
  'SOLICITUD_FIRMADA',
  'VIDEO_FIRMA',
  'AUDIO_LLAMADA',
  'EVIDENCIA_MULTIMEDIA',
  'PAGARE',
  'CONTRATO',
  'FOTO_CASA',
  'UBICACION_GPS',
  'RFC',
  'CURP',
  'ESTADO_CUENTA',
] as const;

function escapeXml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toExcelXml(rows: any[], sheetName = 'Exportacion') {
  const headers = rows.length ? Object.keys(rows[0]) : ['Sin datos'];
  const rowXml = [
    `<Row>${headers.map(h => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}</Row>`,
    ...rows.map(row => `<Row>${headers.map(h => `<Cell><Data ss:Type="String">${escapeXml(row[h])}</Data></Cell>`).join('')}</Row>`),
  ].join('');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName).slice(0, 31)}"><Table>${rowXml}</Table></Worksheet>
</Workbook>`;
}

function escapePdfText(value: any) {
  return String(value ?? '')
    .replace(/[✓⚠✖]/g, m => ({ '✓': '+', '⚠': '!', '✖': 'x' }[m] || m))
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\\()]/g, '\\$&');
}

function toSimplePdf(rows: any[], title: string) {
  const headers = rows.length ? Object.keys(rows[0]) : ['Sin datos'];
  const lines = [
    title,
    `Generado: ${new Date().toISOString()}`,
    `Registros: ${rows.length}`,
    '',
    headers.join(' | '),
    '-'.repeat(110),
    ...rows.map(row => headers.map(h => String(row[h] ?? '').replace(/\s+/g, ' ').slice(0, 42)).join(' | ')),
  ];
  const wrapped: string[] = [];
  for (const line of lines) {
    if (line.length <= 115) wrapped.push(line);
    else for (let i = 0; i < line.length; i += 115) wrapped.push(line.slice(i, i + 115));
  }
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += 44) pages.push(wrapped.slice(i, i + 44));

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = add('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesId = add('');
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const pageIds: number[] = [];
  for (const pageLines of pages) {
    const stream = `BT /F1 8 Tf 36 806 Td 11 TL ${pageLines.map(l => `(${escapePdfText(l)}) Tj`).join(' T* ')} ET`;
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function normalizeDocumentStatus(status: any) {
  const value = String(status || 'PENDIENTE').toUpperCase();
  if (['SUBIDO', 'VALIDADO'].includes(value)) return `✓ ${value}`;
  if (value === 'RECHAZADO') return '✖ RECHAZADO';
  if (value === 'VENCIDO') return '✖ VENCIDO';
  return `⚠ ${value || 'PENDIENTE'}`;
}

const CURP_RE = CURP_REGEX;
const CURP_STATES = CURP_STATE_NAMES;

function normalizeCurp(value: any) {
  return normalizeCurpValue(value);
}

function pickProviderField(source: any, ...keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function inferBirthDateFromCurp(curp: string) {
  const yy = Number(curp.slice(4, 6));
  const mm = curp.slice(6, 8);
  const dd = curp.slice(8, 10);
  const currentYY = Number(String(new Date().getFullYear()).slice(-2));
  const year = yy <= currentYY ? 2000 + yy : 1900 + yy;
  return `${year}-${mm}-${dd}`;
}

function normalizeCurpProviderPayload(raw: any, input: any) {
  const source = raw?.data || raw?.result || raw?.persona || raw?.curp || raw || {};
  const curp = normalizeCurp(pickProviderField(source, 'curp', 'CURP') || input.curp);
  return {
    curp,
    nombres: pickProviderField(source, 'nombres', 'nombre', 'name') || input.nombres || '',
    apellidoPaterno: pickProviderField(source, 'apellidoPaterno', 'apellido_paterno', 'primerApellido', 'paterno') || input.apellidoPaterno || '',
    apellidoMaterno: pickProviderField(source, 'apellidoMaterno', 'apellido_materno', 'segundoApellido', 'materno') || input.apellidoMaterno || '',
    sexo: pickProviderField(source, 'sexo', 'genero', 'gender') || (curp[10] === 'M' ? 'Mujer' : curp[10] === 'H' ? 'Hombre' : ''),
    fechaNacimiento: pickProviderField(source, 'fechaNacimiento', 'fecha_nacimiento', 'birthDate') || (curp ? inferBirthDateFromCurp(curp) : ''),
    entidadNacimiento: pickProviderField(source, 'entidadNacimiento', 'estadoNacimiento', 'entidad', 'estado') || CURP_STATES[curp.slice(11, 13)] || '',
    status: pickProviderField(source, 'status', 'estatus', 'estadoCurp') || 'CONSULTADO',
    pdfUrl: pickProviderField(source, 'pdfUrl', 'pdf_url', 'PDF_URL', 'downloadUrl', 'download_url'),
  };
}

function generateCurpFromPersonalData(input: any) {
  const generated = generateCurpCandidate(input);
  return generated.ok ? generated.curp : '';
}

function buildCurpOfficialClipboard(payload: any, curpDraft = '') {
  return [
    'Consulta oficial CURP gob.mx',
    curpDraft ? `CURP capturada/sugerida: ${curpDraft}` : '',
    `Nombre(s): ${payload.nombres || ''}`,
    `Apellido paterno: ${payload.apellidoPaterno || ''}`,
    `Apellido materno: ${payload.apellidoMaterno || ''}`,
    `Fecha de nacimiento: ${payload.fechaNacimiento || ''}`,
    `Sexo: ${payload.sexo || ''}`,
    `Estado de nacimiento: ${CURP_STATES[payload.estadoNacimiento] || payload.estadoNacimiento || ''}`,
    'Despues de consultar, descarga el PDF oficial y adjuntalo en Heavenly Dreams.',
  ].filter(Boolean).join('\n');
}

async function checkGobMxCurpPortal() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://www.gob.mx/curp/', {
      headers: {
        'User-Agent': 'HeavenlyDreamsCRM/1.0 (+https://www.gob.mx/curp/)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    const html = await response.text();
    const challengeDetected = /Challenge Validation|sec-container|sec-cpt-if/i.test(html);
    return {
      status: response.status,
      ok: response.ok && !challengeDetected,
      challengeDetected,
      url: 'https://www.gob.mx/curp/',
    };
  } catch (err: any) {
    return {
      status: 0,
      ok: false,
      challengeDetected: false,
      url: 'https://www.gob.mx/curp/',
      error: err?.message || 'No se pudo consultar gob.mx',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function consultCurpProvider(payload: any) {
  const providerUrl = process.env.CURP_API_URL || process.env.CURP_API_BASE_URL;
  if (!providerUrl) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.CURP_API_KEY) headers.Authorization = `Bearer ${process.env.CURP_API_KEY}`;
    const response = await fetch(providerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data?.error || data?.message || `Proveedor CURP respondió ${response.status}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

const FIXED_LADA_CATALOG: Record<string, { ciudad: string; estado: string }> = {
  '55': { ciudad: 'Ciudad de Mexico y area metropolitana', estado: 'Ciudad de Mexico' },
  '33': { ciudad: 'Guadalajara', estado: 'Jalisco' },
  '81': { ciudad: 'Monterrey', estado: 'Nuevo Leon' },
  '222': { ciudad: 'Puebla', estado: 'Puebla' },
  '221': { ciudad: 'Puebla zona conurbada', estado: 'Puebla' },
  '228': { ciudad: 'Xalapa', estado: 'Veracruz' },
  '229': { ciudad: 'Veracruz', estado: 'Veracruz' },
  '442': { ciudad: 'Queretaro', estado: 'Queretaro' },
  '449': { ciudad: 'Aguascalientes', estado: 'Aguascalientes' },
  '477': { ciudad: 'Leon', estado: 'Guanajuato' },
  '722': { ciudad: 'Toluca', estado: 'Estado de Mexico' },
  '664': { ciudad: 'Tijuana', estado: 'Baja California' },
  '686': { ciudad: 'Mexicali', estado: 'Baja California' },
  '667': { ciudad: 'Culiacan', estado: 'Sinaloa' },
  '669': { ciudad: 'Mazatlan', estado: 'Sinaloa' },
  '662': { ciudad: 'Hermosillo', estado: 'Sonora' },
  '614': { ciudad: 'Chihuahua', estado: 'Chihuahua' },
  '618': { ciudad: 'Durango', estado: 'Durango' },
  '871': { ciudad: 'Torreon', estado: 'Coahuila' },
  '844': { ciudad: 'Saltillo', estado: 'Coahuila' },
  '833': { ciudad: 'Tampico', estado: 'Tamaulipas' },
  '444': { ciudad: 'San Luis Potosi', estado: 'San Luis Potosi' },
  '998': { ciudad: 'Cancun', estado: 'Quintana Roo' },
  '999': { ciudad: 'Merida', estado: 'Yucatan' },
  '961': { ciudad: 'Tuxtla Gutierrez', estado: 'Chiapas' },
  '951': { ciudad: 'Oaxaca', estado: 'Oaxaca' },
  '777': { ciudad: 'Cuernavaca', estado: 'Morelos' },
  '744': { ciudad: 'Acapulco', estado: 'Guerrero' },
  '443': { ciudad: 'Morelia', estado: 'Michoacan' },
  '311': { ciudad: 'Tepic', estado: 'Nayarit' },
  '312': { ciudad: 'Colima', estado: 'Colima' },
  '246': { ciudad: 'Tlaxcala', estado: 'Tlaxcala' },
  '771': { ciudad: 'Pachuca', estado: 'Hidalgo' },
  '981': { ciudad: 'Campeche', estado: 'Campeche' },
  '993': { ciudad: 'Villahermosa', estado: 'Tabasco' },
  '492': { ciudad: 'Zacatecas', estado: 'Zacatecas' },
};

function normalizePhone10(value: any) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function lookupFixedLada(number: string) {
  const two = number.slice(0, 2);
  const three = number.slice(0, 3);
  if (FIXED_LADA_CATALOG[two]) return { lada: two, ...FIXED_LADA_CATALOG[two] };
  if (FIXED_LADA_CATALOG[three]) return { lada: three, ...FIXED_LADA_CATALOG[three] };
  return null;
}

const EXPORT_HEADERS: Record<string, string[]> = {
  capturas: ['Folio', 'Cliente', 'Vendedor', 'Telefono', 'Colonia', 'Ciudad', 'Paquete', 'INE', 'Contrato', 'Comprobante', 'StatusCaptura', 'StatusValidacion', 'StatusInstalacion', 'StatusDocumentos', 'FechaCaptura', 'FechaInstalacion', 'Direccion', 'Latitud', 'Longitud'],
  clientes: ['Folio', 'Cliente', 'Telefono', 'WhatsApp', 'Correo', 'Direccion', 'FechaAlta', 'Pipeline', 'UltimoContacto', 'ProximoSeguimiento', 'Satisfaccion', 'RiesgoCancelacion', 'Vendedor'],
  morosidad: ['Folio', 'Cliente', 'Telefono', 'WhatsApp', 'Correo', 'Direccion', 'Paquete', 'Promotor', 'Mercado', 'Area', 'MontoAdeudo', 'DiasAtraso', 'NivelMorosidad', 'FechaVencimiento', 'UltimoPago', 'StatusCobranza', 'Gestor', 'Convenio', 'Observaciones'],
  folios: ['Folio', 'Cliente', 'Telefono', 'StatusActual', 'Subestatus', 'AreaActual', 'Tecnico', 'Avance', 'DocumentosFaltantes', 'FechaInstalacion', 'Observaciones', 'FechaMovimiento'],
  usuarios: ['Id', 'Nombre', 'Correo', 'Usuario', 'Rol', 'Zona', 'Puesto', 'Status', 'Creado'],
};

function emptyRowForHeaders(dataset: string) {
  const headers = EXPORT_HEADERS[dataset] || ['Sin datos'];
  return Object.fromEntries(headers.map(header => [header, '']));
}

function parseGoogleDriveSource(value: string) {
  const input = String(value || '').trim();
  if (!input) throw new Error('Pega el enlace o ID de Google Drive.');
  if (/\/folders\//i.test(input)) {
    const folderId = input.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1] || '';
    return { kind: 'folder' as const, id: folderId };
  }
  const sheetId = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i)?.[1];
  if (sheetId) return { kind: 'sheet' as const, id: sheetId };
  const fileId = input.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i)?.[1]
    || input.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1]
    || (/^[a-zA-Z0-9_-]{12,}$/.test(input) ? input : '');
  if (!fileId) throw new Error('No pude detectar el ID del archivo o Google Sheet.');
  return { kind: 'file' as const, id: fileId };
}

function fileNameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded.replace(/^"+|"+$/g, '')); } catch {}
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  return plain ? plain.trim() : fallback;
}

function looksLikeHtml(buffer: Buffer, contentType: string | null) {
  if (String(contentType || '').toLowerCase().includes('text/html')) return true;
  const prefix = buffer.subarray(0, 500).toString('utf8').toLowerCase();
  return prefix.includes('<!doctype html') || prefix.includes('<html');
}

async function fetchPublicDriveBuffer(url: string, fallbackName: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'HeavenlyDreamsCRM/1.0',
        Accept: 'text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
      },
    });
    if (!response.ok) throw new Error(`Google Drive respondió ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (looksLikeHtml(buffer, response.headers.get('content-type'))) {
      throw new Error('Google Drive no permitió descargar el archivo. Compártelo como "cualquier persona con el enlace puede ver" o configura OAuth de Drive.');
    }
    return {
      buffer,
      fileName: fileNameFromDisposition(response.headers.get('content-disposition'), fallbackName),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadPublicSiacFromGoogleDrive(input: string) {
  const source = parseGoogleDriveSource(input);
  if (source.kind === 'folder') {
    throw new Error('La importación de carpetas requiere OAuth de Google Drive; pega un archivo/Sheet público o configura VITE_GOOGLE_DRIVE_CLIENT_ID.');
  }

  if (source.kind === 'sheet') {
    const url = `https://docs.google.com/spreadsheets/d/${source.id}/export?format=csv&gid=0`;
    return {
      ...(await fetchPublicDriveBuffer(url, 'SIAC-PPIES-google-sheet.csv')),
      fileId: source.id,
      sourceUrl: url,
    };
  }

  const urls = [
    `https://docs.google.com/spreadsheets/d/${source.id}/export?format=csv&gid=0`,
    `https://drive.google.com/uc?export=download&id=${source.id}`,
    `https://drive.usercontent.google.com/download?id=${source.id}&export=download&confirm=t`,
  ];
  let lastError: any = null;
  for (const url of urls) {
    try {
      const downloaded = await fetchPublicDriveBuffer(url, 'SIAC-PPIES-google-drive.csv');
      return { ...downloaded, fileId: source.id, sourceUrl: url };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('No se pudo descargar el archivo de Google Drive.');
}

async function testIntegrationSecret(secret: any) {
  const provider = String(secret.provider || '').toLowerCase();
  const keyName = String(secret.keyName || '').toUpperCase();
  const metadata = secret.metadata || {};
  try {
    if (provider === 'gemini' || keyName === 'GEMINI_API_KEY') {
      const model = metadata.model || metadata.ocrModel || getSecretValue('GEMINI_MODEL', process.env.GEMINI_MODEL || 'gemini-2.5-flash');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(secret.value)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Responde solo OK' }] }], generationConfig: { maxOutputTokens: 8, temperature: 0 } }),
      });
      if (!response.ok) return { ok: false, provider, message: `Gemini HTTP ${response.status}: ${(await response.text()).slice(0, 180)}` };
      return { ok: true, provider, message: `Gemini respondió con ${model}` };
    }
    if (provider === 'openai' || keyName === 'OPENAI_API_KEY') {
      const response = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${secret.value}` } });
      if (!response.ok) return { ok: false, provider, message: `OpenAI HTTP ${response.status}: ${(await response.text()).slice(0, 180)}` };
      return { ok: true, provider, message: 'OpenAI API respondió correctamente' };
    }
    if (provider === 'telegram' || keyName === 'TELEGRAM_BOT_TOKEN') {
      const response = await fetch(`https://api.telegram.org/bot${secret.value}/getMe`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) return { ok: false, provider, message: data?.description || `Telegram HTTP ${response.status}` };
      return { ok: true, provider, message: `Telegram bot @${data?.result?.username || 'desconocido'} válido` };
    }
    if (provider === 'ollama') {
      const baseUrl = String(metadata.baseUrl || getSecretValue('OLLAMA_URL', process.env.OLLAMA_URL || 'http://127.0.0.1:11434')).replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/api/tags`, { headers: secret.value ? { Authorization: `Bearer ${secret.value}` } : {} });
      if (!response.ok) return { ok: false, provider, message: `Ollama HTTP ${response.status}` };
      return { ok: true, provider, message: `Ollama respondió en ${baseUrl}` };
    }
    if (provider === 'elevenlabs' || keyName === 'ELEVENLABS_API_KEY') {
      const response = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': secret.value } });
      if (!response.ok) return { ok: false, provider, message: `ElevenLabs HTTP ${response.status}: ${(await response.text()).slice(0, 180)}` };
      return { ok: true, provider, message: 'ElevenLabs API respondió correctamente' };
    }
    if (provider === 'twilio' || keyName.startsWith('TWILIO_')) {
      return { ok: true, provider, message: 'Clave guardada. Twilio se valida cuando SID, token y número estén activos.' };
    }
    if (provider === 'didit' || keyName === 'DIDIT_API_KEY') {
      return { ok: true, provider, message: 'Clave Didit guardada. Se validará en la siguiente verificación KYC.' };
    }
    return { ok: true, provider: provider || 'custom', message: 'Clave guardada. Proveedor personalizado sin prueba automática.' };
  } catch (err: any) {
    return { ok: false, provider: provider || 'custom', message: err?.message || String(err) };
  }
}

async function startServer() {
  const app = createApp();
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST?.trim();
  const loginLimiter = rateLimit('login', 12, 15 * 60 * 1000);
  const oauthLimiter = rateLimit('oauth', 60, 15 * 60 * 1000);
  const registrationLimiter = rateLimit('registration', 8, 60 * 60 * 1000);
  const uploadLimiter = rateLimit('upload', 40, 15 * 60 * 1000);
  const authOnly = requireAuth;
  const adminOnly = requireRole('GERENTE');
  const opsOnly = requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR');
  const chatUserOnly = requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'RECLUTADOR', 'VENDEDOR', 'ASESOR');
  const mobileOnly = requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'RECLUTADOR', 'VENDEDOR', 'ASESOR');
  const managerOnly = adminOnly;
  if (process.env.NODE_ENV === 'production' && !process.env.HIGH_IMPACT_CONFIRMATION) {
    throw new Error('HIGH_IMPACT_CONFIRMATION es obligatorio en producción');
  }
  const highImpactConfirmation = process.env.HIGH_IMPACT_CONFIRMATION || 'HEAVENLY_DREAMS_CONFIRM';
  const sqliteDbPath = path.join(process.cwd(), 'data', 'heavenlydreams.db');

  app.get('/agent-videos/:fileName', chatUserOnly, wrap((req: any, res: any) => {
    const requested = String(req.params.fileName || '');
    const fileName = path.basename(requested);
    if (!requested || requested !== fileName) return res.status(400).json({ error: 'Archivo invalido' });
    res.sendFile(path.join(agentVideoDirectory(), fileName));
  }));

  function safeEqual(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  function trustedVoiceWebhook(req: any) {
    const expected = getTwilioWebhookToken();
    const provided = String(req.query?.token || req.body?.token || req.headers?.['x-hd-webhook-token'] || '').trim();
    if (expected) return safeEqual(provided, expected);
    return process.env.NODE_ENV !== 'production';
  }

  function requireTrustedVoiceWebhook(req: any, res: any) {
    if (trustedVoiceWebhook(req)) return true;
    res.status(403).json({ error: 'Webhook de voz no autorizado' });
    return false;
  }

  function authAudit(req: any, accion: string, entidad: string, detalle: string | null = null) {
    AuditLog.insert({
      accion,
      entidad,
      entidad_id: null,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.name || req.auth?.username || null,
      detalle,
    });
  }

  function requireHighImpactConfirmation(req: any, action: string, entidad: string) {
    const provided = String(
      req.headers?.['x-hd-confirm']
      || req.body?.confirm
      || req.body?.confirmation
      || '',
    ).trim();
    if (provided !== highImpactConfirmation) {
      authAudit(req, 'BLOCKED_HIGH_IMPACT_ACTION', entidad, `${action};missing_confirmation`);
      throw createHttpError(428, `Confirmacion requerida para ${action}`, 'CONFIRMATION_REQUIRED');
    }
  }

  function backupDatabaseBefore(action: string) {
    if (!existsSync(sqliteDbPath)) return null;
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    mkdirSync(backupDir, { recursive: true });
    const safeAction = action.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const backupPath = path.join(backupDir, `${Date.now()}-${safeAction}.db`);
    copyFileSync(sqliteDbPath, backupPath);
    return backupPath;
  }

  function isGerente(auth: any) {
    return isManagerAuth(auth);
  }

  function canManage(auth: any) {
    return canManageAuth(auth);
  }

  function canApproveHuman(auth: any) {
    return canApproveHumanAuth(auth);
  }

  function canAccessVenta(auth: any, venta: any) {
    if (!auth || !venta) return false;
    return canManage(auth) || venta.asesor_id === auth.sub;
  }

  function crmRole(auth: any) {
    return normalizeRole(auth?.role);
  }

  function crmCanManage(auth: any) {
    return canManageAuth(auth);
  }

  function crmCanOperate(auth: any) {
    return canOperateAuth(auth);
  }

  const CRM_SENSITIVE_FIELDS = new Set([
    'telefono_asignado',
    'telefono_portado',
    'telefono_referencia',
    'correo',
    'morosidad',
    'observaciones',
    'respuesta_telmex',
    'motivo_rechazo',
  ]);

  function maskPhone(value: any) {
    const raw = String(value || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7) return raw ? '***' : raw;
    return `${digits.slice(0, 4)}******${digits.slice(-2)}`;
  }

  function crmVisibility(auth: any) {
    const role = crmRole(auth);
    const defaults: Record<string, boolean> = {};
    CRM_SENSITIVE_FIELDS.forEach(field => {
      defaults[field] = crmCanManage(auth) || role === 'SUPERVISOR';
    });
    if (role === 'SUPERVISOR') {
      defaults.morosidad = true;
      defaults.observaciones = true;
      defaults.respuesta_telmex = false;
      defaults.motivo_rechazo = false;
    }
    if (crmCanManage(auth)) {
      CRM_SENSITIVE_FIELDS.forEach(field => { defaults[field] = true; });
    }
    for (const rule of CrmVisibilityRules.getForScope('role', role) as any[]) {
      defaults[rule.field] = rule.visible === true;
    }
    for (const rule of CrmVisibilityRules.getForScope('user', auth?.sub || '') as any[]) {
      defaults[rule.field] = rule.visible === true;
    }
    return defaults;
  }

  function maskSiacRecord(record: any, auth: any) {
    if (!record) return record;
    const visible = crmVisibility(auth);
    const out = { ...record };
    for (const field of CRM_SENSITIVE_FIELDS) {
      if (visible[field]) continue;
      if (field.startsWith('telefono_')) out[field] = maskPhone(out[field]);
      else if (field === 'correo') out[field] = out[field] ? 'correo restringido' : out[field];
      else if (field === 'morosidad') out[field] = out[field] ? 'restringido' : out[field];
      else out[field] = out[field] ? 'Información restringida' : out[field];
    }
    out.permisos = {
      canExport: crmCanManage(auth),
      canEditStatus: crmCanOperate(auth),
      canViewSensitive: crmCanManage(auth),
      visibleFields: visible,
    };
    return out;
  }

  function crmCanAccessRecord(auth: any, record: any) {
    if (!auth || !record) return false;
    const role = crmRole(auth);
    if (crmCanOperate(auth)) return true;
    const name = String(auth.name || '').toLowerCase();
    const sub = String(auth.sub || '').toLowerCase();
    return [record.usuario, record.promotor].some((value: any) => {
      const raw = String(value || '').toLowerCase();
      return raw && (raw === name || raw === sub);
    });
  }

  function crmRisk(record: any, followups: any[] = []) {
    const alerts: string[] = [];
    const missing: string[] = [];
    const status = String(record?.estatus_siac || record?.estatus_pisa || '').toLowerCase();
    if (record?.morosidad) alerts.push('Cliente con morosidad registrada.');
    if (status.includes('cancel') || status.includes('rechaz')) alerts.push('Estatus con riesgo operativo.');
    if (!record?.telefono_asignado && !record?.telefono_referencia) missing.push('teléfono');
    if (!record?.correo) missing.push('correo');
    if (!record?.zona && !record?.tienda) missing.push('zona/tienda');
    if (missing.length) alerts.push(`Datos incompletos: ${missing.join(', ')}.`);
    const openFollowups = followups.filter(item => String(item.status || '').toLowerCase() !== 'cerrado').length;
    if (openFollowups) alerts.push(`${openFollowups} seguimiento(s) pendiente(s).`);
    const priority = record?.morosidad || status.includes('cancel') || status.includes('rechaz') ? 'alta' : missing.length || openFollowups ? 'media' : 'normal';
    return {
      priority,
      alerts,
      summary: alerts.length ? alerts.join(' ') : 'Registro estable. No hay riesgos operativos evidentes.',
      suggestions: [
        record?.morosidad ? 'Priorizar contacto y promesa de pago.' : null,
        missing.length ? 'Completar datos faltantes antes de avanzar.' : null,
        openFollowups ? 'Cerrar o reagendar seguimientos pendientes.' : null,
      ].filter(Boolean),
    };
  }

  function logSystem(req: any, accion: string, entidad?: string, entidadId?: string | null, detalle?: string, metadata?: any) {
    try {
      LogsSistema.insert({
        id: randomUUID(),
        accion,
        entidad: entidad || null,
        entidad_id: entidadId || null,
        user_id: req.auth?.sub || null,
        detalle: detalle || null,
        ip: req.ip || req.headers['x-forwarded-for'] || null,
        dispositivo: req.headers['user-agent'] || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    } catch (err) {
      console.warn('[logs_sistema] No se pudo registrar evento:', err);
    }
  }

  function parseMetadata(value: any) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return {}; }
  }

  function parseCoords(coords: any) {
    const match = String(coords || '').match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
    return match ? { lat: Number(match[1]), lng: Number(match[2]) } : { lat: null, lng: null };
  }

  function buildOperationalAddress(meta: any, venta: any) {
    const parts = [
      [meta.prefijoCalle || meta.tipoVialidad, meta.calle || venta.calle].filter(Boolean).join(' '),
      meta.numeroExterior ? `Ext. ${meta.numeroExterior}` : '',
      meta.numeroInterior ? `Int. ${meta.numeroInterior}` : '',
      meta.edificio ? `Edif. ${meta.edificio}` : '',
      meta.departamento ? `Dept. ${meta.departamento}` : '',
      meta.piso ? `Piso ${meta.piso}` : '',
      meta.torre ? `Torre ${meta.torre}` : '',
      meta.manzana ? `Mz. ${meta.manzana}` : '',
      meta.lote ? `Lt. ${meta.lote}` : '',
      meta.privada ? `Privada ${meta.privada}` : '',
      meta.sector ? `Sector ${meta.sector}` : '',
      meta.etapa ? `Etapa ${meta.etapa}` : '',
      meta.unidadHabitacional || meta.unidad_habitacional,
      meta.colonia || venta.colonia ? `Col. ${meta.colonia || venta.colonia}` : '',
      meta.delegacion || venta.municipio,
      meta.ciudad,
      meta.codigoPostal || meta.codigo_postal ? `CP ${meta.codigoPostal || meta.codigo_postal}` : '',
    ];
    return parts.filter(Boolean).join(', ') || venta.direccion || null;
  }

  function clientChatAgentEnabled() {
    return Settings.get('client_chat_agent_enabled') === true;
  }

  function validationAutoEnabled() {
    const saved = Settings.get('validation_calls_auto_enabled');
    if (saved !== null) return saved === true;
    return String(process.env.VALIDATION_CALLS_AUTO_ENABLED || 'false').toLowerCase() === 'true';
  }

  function configuredVoiceProvider() {
    return Settings.get('voice_provider_default') || getDefaultVoiceProvider();
  }

  function saleClientName(sale: any) {
    return [sale?.nombres, sale?.apellidos].filter(Boolean).join(' ').trim() || sale?.cliente_nombre || 'Cliente';
  }

  function validationMissingFields(sale: any) {
    const meta = parseMetadata(sale?.metadata);
    const required = [
      ['titular', saleClientName(sale) && saleClientName(sale) !== 'Cliente'],
      ['telefono', normalizePhone10(sale?.telefono || meta.telefonoTitular).length === 10],
      ['tipo_servicio', Boolean(sale?.tipo_servicio || meta.tipoServicio)],
      ['paquete', Boolean(sale?.plan || meta.paqueteNombre)],
      ['renta_mensual', Number(sale?.renta_mensual || meta.rentaMensual || 0) > 0],
      ['domicilio', Boolean(sale?.direccion || meta.calle)],
      ['correo', Boolean(meta.correo)],
    ];
    const serviceText = [sale?.tipo_servicio, sale?.tipo_cliente, meta.tipoServicio, meta.tipoCliente].join(' ').toLowerCase();
    if (/porta|portabil/.test(serviceText)) {
      required.push(['numero_a_portar', normalizePhone10(meta.numeroAPortar || meta.numero_a_portar).length === 10]);
    }
    return required.filter(([, ok]) => !ok).map(([field]) => field as string);
  }

  function createValidationForSale(sale: any, req: any, extra: Record<string, any> = {}) {
    const meta = parseMetadata(sale?.metadata);
    const missing = validationMissingFields(sale);
    const validation = {
      id: randomUUID(),
      sale_id: sale.id,
      client_name: saleClientName(sale),
      client_phone: normalizePhone10(sale?.telefono || meta.telefonoTitular || ''),
      status: missing.length ? 'PENDIENTE_DATOS' : 'PENDIENTE',
      notas: missing.length ? `Faltan datos para llamar: ${missing.join(', ')}` : null,
      review_status: 'pending',
      attempts: 0,
      sale_snapshot_json: JSON.stringify({ ...sale, metadata: meta }),
      ...extra,
    };
    ValidationRequests.create(validation);
    return ValidationRequests.getById(validation.id) as any;
  }

  async function startValidationCallForRequest(validationId: string, provider?: string | null) {
    const validation = ValidationRequests.getById(validationId) as any;
    if (!validation) throw new Error('Solicitud de validacion no encontrada');
    const sale = validation.sale_id ? Ventas.getById(validation.sale_id) as any : null;
    const missing = sale ? validationMissingFields(sale) : [];
    if (missing.length) {
      ValidationRequests.update(validationId, {
        status: 'PENDIENTE_DATOS',
        last_error: `Faltan datos para llamar: ${missing.join(', ')}`,
        notas: `Faltan datos para llamar: ${missing.join(', ')}`,
      });
      return ValidationRequests.getById(validationId) as any;
    }
    const attempts = Number(validation.attempts || 0) + 1;
    const fallbacks = String(getSecretValue('VOICE_PROVIDER_FALLBACKS', process.env.VOICE_PROVIDER_FALLBACKS || 'twilio-basic'))
      .split(',')
      .map(item => item.trim())
      .filter(Boolean) as any[];
    const { result, payload } = await startValidationCallWithProvider(validation, sale, provider || configuredVoiceProvider(), provider ? [] : fallbacks);
    ValidationRequests.update(validationId, normalizeProviderStartResult(result, attempts, payload));
    return ValidationRequests.getById(validationId) as any;
  }

  async function maybeAutoStartValidation(sale: any, req: any) {
    const validation = createValidationForSale(sale, req);
    if (!validationAutoEnabled() || validation.status === 'PENDIENTE_DATOS') return validation;
    try {
      return await startValidationCallForRequest(validation.id);
    } catch (err: any) {
      ValidationRequests.update(validation.id, {
        status: 'ERROR',
        last_error: err?.message || String(err),
        attempts: Number(validation.attempts || 0) + 1,
      });
      return ValidationRequests.getById(validation.id) as any;
    }
  }

  function clientChatMeta(client: any) {
    return parseMetadata(client?.metadata);
  }

  function clientChatName(client: any) {
    return String(client?.nombre || client?.cliente || 'cliente').trim() || 'cliente';
  }

  function clientChatPhone(client: any) {
    return String(client?.whatsapp || client?.telefono || '').replace(/\D/g, '').slice(-10);
  }

  function buildClientChatMessage(type: string, client: any, question = '') {
    const name = clientChatName(client);
    const amount = Number(client?.monto_adeudo || 0);
    const days = Number(client?.dias_atraso || 0);
    const folio = client?.folio ? ` Folio: ${client.folio}.` : '';
    const trimmedQuestion = String(question || '').trim();
    if (type === 'welcome') {
      return `Hola ${name}, bienvenido a Heavenly Dreams. Soy ARIUX Clientes y estoy aqui para ayudarte con dudas, seguimiento de tu servicio y pagos.${folio} Guardaremos este canal para cualquier apoyo que necesites.`;
    }
    if (type === 'autopay') {
      return `Hola ${name}, para que tu servicio no tenga interrupciones te invitamos a domiciliar tu pago. Es una forma sencilla de mantenerlo al corriente. Si te interesa, responde DOMICILIAR y un asesor te comparte los pasos.`;
    }
    if (type === 'payment') {
      const debt = amount > 0 ? ` de $${amount.toLocaleString('es-MX')}` : '';
      const delay = days > 0 ? ` con ${days} dias de atraso` : '';
      return `Hola ${name}, detectamos un saldo pendiente${debt}${delay}. Queremos ayudarte a regularizar tu servicio hoy. Responde PAGAR y te compartimos opciones de pago o convenio.`;
    }
    if (type === 'question') {
      const lower = trimmedQuestion.toLowerCase();
      if (lower.includes('domicil')) return buildClientChatMessage('autopay', client);
      if (lower.includes('pago') || lower.includes('adeudo') || lower.includes('saldo')) return buildClientChatMessage(client?.morosidad_id ? 'payment' : 'autopay', client);
      if (lower.includes('falla') || lower.includes('internet') || lower.includes('modem')) {
        return `Hola ${name}, gracias por avisarnos. Para revisar tu servicio, responde con tu folio, telefono de contacto y una breve descripcion de la falla. ARIUX Clientes lo deja listo para seguimiento.`;
      }
      if (lower.includes('folio') || lower.includes('estatus')) {
        return `Hola ${name}, claro. Enviame tu folio SIAC o telefono registrado y revisamos el estatus disponible.`;
      }
      return `Hola ${name}, gracias por escribir. Soy ARIUX Clientes. Sobre tu duda: ${trimmedQuestion || 'cuentame que necesitas revisar'}. Te apoyamos con seguimiento, pagos, domiciliacion o estatus de servicio.`;
    }
    return String(question || '').trim();
  }

  function getClientChatRows(req: any, limit = 400) {
    const sql = `
      SELECT
        c.*,
        m.id AS morosidad_id,
        m.monto_adeudo,
        m.dias_atraso,
        m.fecha_vencimiento,
        m.ultimo_pago,
        m.status_cobranza,
        m.convenio,
        m.observaciones AS morosidad_observaciones
      FROM clientes_crm c
      LEFT JOIN morosidad m ON m.cliente_id=c.id OR (m.folio IS NOT NULL AND m.folio=c.folio)
      ${canManage(req.auth) ? '' : 'WHERE c.vendedor_asignado=@userId'}
      ORDER BY COALESCE(m.dias_atraso, 0) DESC, c.created_at DESC
      LIMIT @limit
    `;
    return (db as any).prepare(sql).all({ userId: req.auth?.sub, limit });
  }

  function getClientChatById(req: any, id: string) {
    const row = getClientChatRows(req, 1000).find((client: any) => client.id === id);
    return row || null;
  }

  function markClientChatContact(client: any, type: string, message: string) {
    const now = new Date().toISOString();
    const metadata = clientChatMeta(client);
    const clientChat = {
      ...(metadata.clientChat || {}),
      lastMessageType: type,
      lastMessageAt: now,
      lastMessage: message.slice(0, 500),
    };
    if (type === 'welcome') clientChat.welcomeSentAt = now;
    if (type === 'autopay') clientChat.domiciliationInvitedAt = now;
    if (type === 'payment') clientChat.paymentReminderSentAt = now;
    ClientesCrm.update(client.id, {
      ultimo_contacto: now,
      status_cliente: type === 'payment' ? 'COBRANZA' : 'CONTACTADO',
      proximo_seguimiento: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: JSON.stringify({ ...metadata, clientChat }),
    });
  }

  async function sendClientChatMessage(client: any, type: string, message: string) {
    const phone = clientChatPhone(client);
    if (phone.length !== 10) throw new Error('Cliente sin WhatsApp valido de 10 digitos');
    const result = await sendWhatsAppClientMessage(phone, message);
    markClientChatContact(client, type, message);
    return result;
  }

  function maybeAutoWelcomeClient(client: any) {
    if (!client || !clientChatAgentEnabled()) return;
    const metadata = clientChatMeta(client);
    if (metadata.clientChat?.welcomeSentAt) return;
    const phone = clientChatPhone(client);
    if (phone.length !== 10) return;
    setTimeout(() => {
      const fresh = ClientesCrm.getById(client.id) as any;
      if (!fresh || clientChatMeta(fresh).clientChat?.welcomeSentAt) return;
      const message = buildClientChatMessage('welcome', fresh);
      sendClientChatMessage(fresh, 'welcome', message).catch((err) => {
        console.warn('[client-chat-agent] Bienvenida no enviada:', err?.message || err);
      });
    }, 1500);
  }

  function syncOperationalTablesFromSale(req: any, sale: any) {
    const meta = parseMetadata(req.body?.metadata || sale.metadata);
    const folio = sale.folio || req.body?.folio || `CAP-${String(sale.id).slice(0, 8).toUpperCase()}`;
    const capturaId = sale.id;
    const fullName = [
      req.body?.nombres || sale.nombres || meta.nombres,
      req.body?.apellidos || [meta.apellidoPaterno, meta.apellidoMaterno].filter(Boolean).join(' '),
    ].filter(Boolean).join(' ').trim() || null;
    const coords = parseCoords(meta.coordenadas || sale.coordenadas);
    const direccion = buildOperationalAddress(meta, sale);
    const now = new Date();
    const nextFollowUp = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const docMap: Array<{ type: typeof DOCUMENT_TYPES[number]; value: any; name: string }> = [
      { type: 'INE_FRONTAL', value: meta.ineFrente, name: 'INE frontal' },
      { type: 'INE_REVERSO', value: meta.ineReverso, name: 'INE reverso' },
      { type: 'CURP', value: meta.curpDoc || meta.curp, name: 'CURP' },
      { type: 'COMPROBANTE_DOMICILIO', value: meta.comprobanteDomicilio, name: 'Comprobante domicilio' },
      { type: 'ANEXO_PORTABILIDAD_1', value: meta.anexoPortabilidad, name: 'Anexo portabilidad 1' },
      { type: 'ANEXO_PORTABILIDAD_2', value: meta.anexoPortabilidad2, name: 'Anexo portabilidad 2' },
      { type: 'CAPTURA_SIAC', value: meta.capturaSiac || meta.folioSiac, name: 'Captura SIAC' },
      { type: 'SOLICITUD_FIRMADA', value: meta.contratoFirmado || meta.solicitudFirmada || meta.contratoPdf, name: 'Solicitud firmada' },
      { type: 'VIDEO_FIRMA', value: meta.videofirma, name: 'Video firma' },
      { type: 'AUDIO_LLAMADA', value: meta.audioLlamada, name: 'Audio llamada validacion' },
      { type: 'EVIDENCIA_MULTIMEDIA', value: meta.evidenciaMultimedia, name: 'Evidencia multimedia' },
      { type: 'UBICACION_GPS', value: meta.coordenadas || sale.coordenadas, name: 'Ubicacion GPS' },
    ];
    const missingDocs = docMap.filter(doc => !doc.value).map(doc => doc.type);
    const docsStatus = missingDocs.length ? 'PENDIENTE' : 'SUBIDO';

    Capturas.create({
      id: capturaId,
      venta_id: sale.id,
      folio,
      fecha_captura: sale.fecha_solicitud || new Date().toISOString(),
      vendedor_id: sale.asesor_id,
      supervisor_id: req.body?.supervisor_id || null,
      cliente_nombre: fullName,
      telefono: sale.telefono || req.body?.telefono_titular || meta.telefonoTitular || null,
      correo: sale.correo || meta.correo || null,
      curp: sale.curp || meta.curp || null,
      rfc: meta.rfc || null,
      ine_numero: meta.folioIne || meta.ineNumero || null,
      tipo_servicio: sale.tipo_servicio || meta.tipoServicio || null,
      paquete: sale.plan || sale.paquete_nombre || meta.paqueteNombre || null,
      status_captura: 'CAPTURADO',
      status_validacion: 'PENDIENTE',
      status_instalacion: 'PENDIENTE',
      status_documentos: docsStatus,
      fecha_instalacion: sale.fecha_instalacion || meta.fechaInstalacion || null,
      tipo_vialidad: meta.prefijoCalle || meta.tipoVialidad || null,
      calle: meta.calle || sale.calle || null,
      numero_exterior: meta.numeroExterior || null,
      numero_interior: meta.numeroInterior || null,
      edificio: meta.edificio || null,
      departamento: meta.departamento || null,
      piso: meta.piso || null,
      torre: meta.torre || null,
      manzana: meta.manzana || null,
      lote: meta.lote || null,
      privada: meta.privada || null,
      sector: meta.sector || null,
      etapa: meta.etapa || null,
      unidad_habitacional: meta.unidadHabitacional || null,
      referencias: meta.referencias || [meta.entrecalle1, meta.entrecalle2].filter(Boolean).join(' / ') || null,
      codigo_postal: meta.codigoPostal || req.body?.codigo_postal || null,
      colonia: meta.colonia || sale.colonia || null,
      ciudad: meta.ciudad || req.body?.ciudad || null,
      delegacion: meta.delegacion || sale.municipio || null,
      direccion_completa: direccion,
      latitud: meta.gpsLatitud || coords.lat,
      longitud: meta.gpsLongitud || coords.lng,
      precision_gps: meta.gpsPrecision || null,
      gps_timestamp: meta.gpsTimestamp || (coords.lat ? new Date().toISOString() : null),
      observaciones: sale.notas || meta.observaciones || null,
      metadata: JSON.stringify(meta),
    });

    for (const doc of docMap) {
      DocumentosCliente.upsert({
        id: randomUUID(),
        captura_id: capturaId,
        tipo_documento: doc.type,
        archivo_url: doc.value ? String(doc.value).slice(0, 4096) : null,
        archivo_nombre: doc.value ? doc.name : null,
        status_documento: doc.value ? 'SUBIDO' : 'PENDIENTE',
        validado_por: null,
        fecha_validacion: null,
        observaciones: doc.value ? null : 'Documento pendiente de carga',
      });
    }

    ClientesCrm.upsert({
      id: randomUUID(),
      captura_id: capturaId,
      folio,
      nombre: fullName,
      telefono: sale.telefono || meta.telefonoTitular || null,
      whatsapp: meta.whatsapp || sale.telefono || meta.telefonoTitular || null,
      correo: sale.correo || meta.correo || null,
      direccion,
      fecha_alta: null,
      status_cliente: 'NUEVO',
      ultimo_contacto: null,
      proximo_seguimiento: nextFollowUp,
      nivel_satisfaccion: null,
      riesgo_cancelacion: 'BAJO',
      vendedor_asignado: sale.asesor_id,
      metadata: JSON.stringify({ origen: 'captura', venta_id: sale.id }),
    });
    const crmClient = (db as any).prepare('SELECT * FROM clientes_crm WHERE folio=?').get(folio);
    maybeAutoWelcomeClient(crmClient);

    EstatusFolios.upsert({
      id: randomUUID(),
      captura_id: capturaId,
      folio,
      status_actual: 'CAPTURADO',
      subestatus: docsStatus === 'SUBIDO' ? 'DOCUMENTOS_SUBIDOS' : 'PENDIENTE_DOCUMENTOS',
      area_actual: 'CAPTURA',
      tecnico_asignado: null,
      fecha_movimiento: new Date().toISOString(),
      observaciones: sale.notas || null,
      documentos_faltantes: missingDocs.join(','),
      avance: docsStatus === 'SUBIDO' ? 35 : 20,
      metadata: JSON.stringify({ venta_id: sale.id }),
    });
  }

  function normalizeSiacRow(row: any) {
    return {
      id: row.id || randomUUID(),
      source_id: row.source_id || row.sourceId || row.ID || row.idOrigen || null,
      folio_siac: row.folio_siac || row.folioSiac || row.folio || '',
      fecha_captura: row.fecha_captura || row.fechaCaptura || null,
      estrategia: row.estrategia || null,
      promotor: row.promotor || null,
      estatus_siac: row.estatus_siac || row.estatusSiac || row.estatus || null,
      tipo_linea: row.tipo_linea || row.tipoLinea || null,
      linea_contratada: row.linea_contratada || row.lineaContratada || null,
      area: row.area || null,
      division: row.division || null,
      tienda: row.tienda || null,
      paquete: row.paquete || null,
      observaciones: row.observaciones || null,
      respuesta_telmex: row.respuesta_telmex || row.respuestaTelmex || null,
      motivo_rechazo: row.motivo_rechazo || row.motivoRechazo || null,
      telefono_asignado: row.telefono_asignado || row.telefonoAsignado || null,
      telefono_portado: row.telefono_portado || row.telefonoPortado || null,
      os_alta: row.os_alta || row.osAlta || null,
      fecha_os_alta: row.fecha_os_alta || row.fechaOsAlta || null,
      estatus_pisa: row.estatus_pisa || row.estatusPisa || null,
      fecha_cambio_estatus: row.fecha_cambio_estatus || row.fechaCambioEstatus || null,
      tipo_cliente: row.tipo_cliente || row.tipoCliente || null,
      tipo_servicio: row.tipo_servicio || row.tipoServicio || null,
      correo: row.correo || row.email || null,
      estatus_etapa: row.estatus_etapa || row.estatusEtapa || null,
      campana: row.campana || row.campaña || null,
      telefono_referencia: row.telefono_referencia || row.telefonoReferencia || null,
      zona: row.zona || null,
      distrito: row.distrito || null,
      colonia: row.colonia || null,
      usuario: row.usuario || row.usuarioPromotor || null,
      morosidad: row.morosidad || null,
    };
  }

  function safeUser(user: any) {
    if (!user) return user;
    const { password: _password, ...safe } = user;
    return safe;
  }

  function safeUserRole(value: any) {
    const role = String(value || 'ASESOR').trim().toUpperCase();
    return ['ASESOR', 'VENDEDOR', 'RECLUTADOR', 'SUPERVISOR', 'GERENTE', 'ADMINISTRACION'].includes(role) ? role : 'ASESOR';
  }

  function safeActivo(value: any, fallback: number) {
    const n = Number(value);
    return [0, 1, 2].includes(n) ? n : fallback;
  }

  function normalizeUserPayload(body: any, options: { publicRegistration: boolean }) {
    const publicRegistration = options.publicRegistration;
    const requestedRole = safeUserRole(body?.role);
    return {
      uid: randomUUID(),
      nombre: String(body?.nombre || body?.displayName || body?.username || '').trim(),
      email: String(body?.email || '').trim().toLowerCase(),
      username: String(body?.username || '').trim(),
      password: body?.password,
      role: publicRegistration ? (['GERENTE', 'ADMINISTRACION'].includes(requestedRole) ? 'ASESOR' : requestedRole) : requestedRole,
      zona: body?.zona ?? body?.zonaOperativa ?? null,
      puesto: body?.puesto ?? null,
      activo: publicRegistration ? 2 : safeActivo(body?.activo, 1),
    };
  }

  function assertManager(req: any, res: any) {
    const auth = getBearerAuth(req);
    const user = auth ? Users.getById(auth.sub) as any : null;
    if (!user || user.activo !== 1) {
      res.status(403).json({ error: 'Cuenta no autorizada.' });
      return null;
    }
    if (!canApproveHuman(user)) {
      res.status(403).json({ error: 'Permisos insuficientes' });
      return null;
    }
    return { ...auth, role: user.role, name: user.nombre };
  }

  const FIXED_MANAGER_EMAIL = (process.env.FIXED_MANAGER_EMAIL || '').toLowerCase().trim();
  const FIXED_MANAGER_USERNAME = (process.env.FIXED_MANAGER_USERNAME || FIXED_MANAGER_EMAIL).toLowerCase().trim();

  function isFixedManagerUser(user: any) {
    return String(user?.email || '').toLowerCase() === FIXED_MANAGER_EMAIL
      || String(user?.username || '').toLowerCase() === FIXED_MANAGER_USERNAME;
  }

  function ensureFixedManagerAccount() {
    if (!FIXED_MANAGER_EMAIL) return;
    const passwordHash = String(process.env.FIXED_MANAGER_PASSWORD_HASH || '').trim();
    const existing = (Users.getByEmail(FIXED_MANAGER_EMAIL) || Users.getByUsername(FIXED_MANAGER_USERNAME)) as any;
    if (!existing && !passwordHash) return;
    if (existing) {
      const update: Record<string, any> = {
        nombre: existing.nombre || 'Edgar Lovera',
        email: FIXED_MANAGER_EMAIL,
        username: FIXED_MANAGER_USERNAME,
        role: 'GERENTE',
        activo: 1,
      };
      if (passwordHash) update.password = passwordHash;
      Users.update(existing.uid, update);
      return;
    }
    Users.create({
      uid: 'uid_edgarlovera20',
      nombre: 'Edgar Lovera',
      email: FIXED_MANAGER_EMAIL,
      username: FIXED_MANAGER_USERNAME,
      role: 'GERENTE',
      password: passwordHash,
      zona: null,
      puesto: 'Gerente',
      activo: 1,
    });
    console.log('[DB] Gerente fijo creado desde FIXED_MANAGER_PASSWORD_HASH.');
  }

  ensureFixedManagerAccount();

  // ── USUARIOS ────────────────────────────────────────────────
  app.get("/api/users", authOnly, wrap((req: any, res: any) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!canManage(req.auth)) {
      const user = Users.getById(req.auth.sub) as any;
      return res.json(user ? [safeUser(user)] : []);
    }
    res.json(Users.getAll().map(safeUser));
  }));

  app.post("/api/users", registrationLimiter, wrap((req: any, res: any) => {
    const publicRegistration = req.body?.fromRegistration === true;
    if (!publicRegistration) {
      try {
        if (!assertManager(req, res)) return;
      } catch {
        return res.status(401).json({ error: 'Token requerido' });
      }
    } else if (process.env.PUBLIC_REGISTRATION_ENABLED !== 'true') {
      return res.status(403).json({
        error: 'Registro público deshabilitado. Solicita una invitación a gerencia.',
        code: 'PUBLIC_REGISTRATION_DISABLED',
      });
    }
    const data = normalizeUserPayload(req.body, { publicRegistration });
    if (!data.nombre || !data.email || !data.username || !data.password) {
      return res.status(400).json({ error: 'Nombre, email, usuario y contraseña son requeridos.' });
    }
    if (Users.getByEmail(data.email)) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo.' });
    }
    if (Users.getByUsername(data.username)) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese nombre de usuario.' });
    }
    Users.create(data);
    AuditLog.insert({
      accion: publicRegistration ? 'CREATE_USER_PENDING_APPROVAL' : 'CREATE_USER',
      entidad: 'users',
      entidad_id: data.uid,
      user_id: publicRegistration ? null : req.auth?.sub || null,
      user_nombre: data.nombre,
      detalle: publicRegistration ? 'Registro público: cuenta bloqueada hasta aprobación gerencial' : null,
    });
    res.json(safeUser(Users.getById(data.uid)));
  }));

  // Login
  app.post("/api/auth/login", loginLimiter, wrap(async (req: any, res: any) => {
    const { username, password } = req.body;
    // Buscar por username o email
    const user = (Users.getByUsername(username) || Users.getByEmail(username) || Users.getByUsername(username + '@adhdreams.local')) as any;
    if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    if (!verifyPassword(password, user.password))
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    if (needsPasswordRehash(user.password)) {
      Users.update(user.uid, { password: hashPassword(password) });
    }
    if (user.activo === 2)
      return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación por el administrador.', code: 'PENDING' });
    if (user.activo === 0)
      return res.status(403).json({ error: 'Tu cuenta ha sido desactivada. Contacta al administrador.', code: 'INACTIVE' });
    AuditLog.insert({ accion: 'LOGIN', entidad: 'users', entidad_id: user.uid, user_id: user.uid, user_nombre: user.nombre, detalle: null });
    const { password: _, ...safe } = user;
    const managerRequiresWebAuthn = ['GERENTE', 'ADMINISTRACION'].includes(user.role) && isWebAuthnRequired(req);
    if (managerRequiresWebAuthn && userHasPasskey(user.uid)) {
      return res.json({ requiresWebAuthn: true, webAuthnUserId: user.uid, nombre: user.nombre, role: user.role });
    }
    const session = issueSessionCookie(res, user, req, ['GERENTE', 'ADMINISTRACION'].includes(user.role)
      ? { webAuthnVerified: !managerRequiresWebAuthn, webAuthnEnrollmentRequired: managerRequiresWebAuthn }
      : {});
    res.json({ ...safe, ...session, webAuthnEnrollmentRequired: managerRequiresWebAuthn });
  }));

  app.post("/api/auth/refresh", loginLimiter, wrap((req: any, res: any) => {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken requerido' });
    const { user, session } = rotateRefreshToken(refreshToken, req, res);
    const { password: _, ...safe } = user;
    res.json({ ...safe, ...session });
  }));

  app.post("/api/auth/logout", wrap((req: any, res: any) => {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) Sessions.revoke(refreshToken);
    clearRefreshCookie(res, req);
    res.json({ ok: true });
  }));

  app.get("/api/auth/oauth/status", wrap((_req: any, res: any) => {
    res.json(oauthStatus());
  }));

  app.get("/api/auth/oauth/:provider/start", oauthLimiter, wrap((req: any, res: any) => {
    oauthStart(req, res);
  }));

  app.get("/api/auth/oauth/:provider/callback", oauthLimiter, wrap(async (req: any, res: any) => {
    await oauthCallback(req, res);
  }));

  app.post("/api/curp/lookup", authOnly, wrap(async (req: any, res: any) => {
    const curp = normalizeCurp(req.body?.curp);
    if (!curp) return res.status(400).json({ error: 'CURP requerida' });
    if (!CURP_RE.test(curp)) return res.status(400).json({ error: 'Formato de CURP inválido' });
    if (!validateCurpChecksum(curp)) return res.status(400).json({ error: 'Dígito verificador de CURP inválido' });

    const payload = {
      curp,
      nombres: String(req.body?.nombres || '').trim(),
      apellidoPaterno: String(req.body?.apellidoPaterno || '').trim(),
      apellidoMaterno: String(req.body?.apellidoMaterno || '').trim(),
    };

    let providerError = '';
    let normalized = normalizeCurpProviderPayload(null, payload);
    let official = false;
    let source = 'local';
    try {
      const providerData = await consultCurpProvider(payload);
      if (providerData) {
        normalized = normalizeCurpProviderPayload(providerData, payload);
        official = true;
        source = 'provider';
      }
    } catch (err: any) {
      providerError = err?.message || 'Proveedor CURP no disponible';
    }

    logSystem(
      req,
      'curp.lookup',
      'curp',
      curp,
      official ? 'Consulta CURP con proveedor externo' : 'Validacion local de CURP',
      { source, providerError: providerError || null }
    );
    res.json({
      ok: true,
      ...normalized,
      official,
      source,
      checksumValid: validateCurpChecksum(curp),
      status: official ? normalized.status : 'VALIDADA_DIGITO_LOCAL',
      message: official
        ? 'CURP consultada con proveedor externo configurado.'
        : 'CURP validada por formato y digito verificador local. Para expediente oficial descarga y adjunta el PDF desde gob.mx.',
      providerError: providerError || undefined,
    });
  }));

  app.post("/api/curp/generate", authOnly, wrap((req: any, res: any) => {
    const generated = generateCurpCandidate(req.body || {});
    if (!generated.ok) {
      return res.status(400).json({
        ok: false,
        error: 'Datos incompletos para calcular la CURP preliminar.',
        missing: generated.missing,
        warnings: generated.warnings,
        metadata: generated.metadata,
      });
    }

    logSystem(
      req,
      'curp.generate',
      'curp',
      generated.curp,
      'CURP preliminar generada con algoritmo local',
      { missing: generated.missing, warnings: generated.warnings, metadata: generated.metadata }
    );

    res.json({
      ok: true,
      curp: generated.curp,
      curpDraft: generated.curp,
      curp17: generated.curp17,
      homoclave: generated.homoclave,
      checkDigit: generated.checkDigit,
      checksumValid: validateCurpChecksum(generated.curp),
      status: 'GENERADA_LOCAL_PRELIMINAR',
      source: 'local-algorithm',
      official: false,
      message: 'CURP preliminar generada localmente. Confirma y adjunta el PDF oficial desde gob.mx/RENAPO para expediente.',
      warnings: generated.warnings,
      metadata: generated.metadata,
    });
  }));

  app.post("/api/curp/gobmx-agent", authOnly, wrap(async (req: any, res: any) => {
    const payload = {
      nombres: String(req.body?.nombres || '').trim(),
      apellidoPaterno: String(req.body?.apellidoPaterno || '').trim(),
      apellidoMaterno: String(req.body?.apellidoMaterno || '').trim(),
      fechaNacimiento: String(req.body?.fechaNacimiento || '').trim(),
      sexo: String(req.body?.sexo || '').trim().toUpperCase().slice(0, 1),
      estadoNacimiento: String(req.body?.estadoNacimiento || '').trim().toUpperCase(),
      curp: normalizeCurp(req.body?.curp),
    };
    const generated = generateCurpCandidate(payload);
    const curpDraft = CURP_RE.test(payload.curp) ? payload.curp : (generated.ok ? generated.curp : '');
    if (!curpDraft) {
      return res.status(400).json({
        ok: false,
        error: 'Datos incompletos para preparar la consulta oficial. Revisa nombre, apellido paterno, fecha, sexo y estado.',
        missing: generated.missing,
        warnings: generated.warnings,
      });
    }

    const portal = await checkGobMxCurpPortal();
    logSystem(
      req,
      'curp.gobmx_agent',
      'curp',
      curpDraft,
      portal.challengeDetected ? 'gob.mx requiere validacion humana antes de descargar PDF oficial' : 'gob.mx listo para consulta oficial asistida',
      { ...payload, curpDraft, portal }
    );

    res.json({
      ok: true,
      curp: CURP_RE.test(payload.curp) ? payload.curp : undefined,
      curpDraft,
      nombres: payload.nombres,
      apellidoPaterno: payload.apellidoPaterno,
      apellidoMaterno: payload.apellidoMaterno,
      sexo: payload.sexo === 'M' ? 'Mujer' : 'Hombre',
      fechaNacimiento: payload.fechaNacimiento,
      entidadNacimiento: CURP_STATES[payload.estadoNacimiento] || payload.estadoNacimiento,
      status: 'GOBMX_PDF_OFICIAL_REQUERIDO',
      source: 'gobmx-agent',
      official: false,
      gobMxUrl: portal.url,
      challengeDetected: portal.challengeDetected,
      requiresManualDownload: true,
      clipboardText: buildCurpOfficialClipboard(payload, curpDraft),
      curp17: generated.ok ? generated.curp17 : undefined,
      homoclave: generated.ok ? generated.homoclave : undefined,
      checkDigit: generated.ok ? generated.checkDigit : undefined,
      checksumValid: validateCurpChecksum(curpDraft),
      warnings: generated.ok ? generated.warnings : undefined,
      message: portal.challengeDetected
        ? 'gob.mx activo una validacion humana. Abre el portal oficial, consulta con los datos capturados, descarga el PDF oficial y adjuntalo en la app.'
        : 'Portal oficial disponible. Consulta en gob.mx, descarga el PDF oficial y adjuntalo en la app.',
      providerError: portal.error || undefined,
    });
  }));

  app.post("/api/portabilidad/verificar-numero", authOnly, wrap((req: any, res: any) => {
    const number = normalizePhone10(req.body?.numero);
    if (number.length !== 10) {
      return res.status(400).json({
        ok: false,
        fixedLocal: false,
        error: 'Favor de ingresar un telefono valido de 10 digitos.',
      });
    }
    const origin = lookupFixedLada(number);
    if (!origin) {
      logSystem(req, 'portabilidad.verify_rejected', 'portabilidad', number, 'LADA no reconocida como fijo/local', {
        number,
      });
      return res.status(422).json({
        ok: false,
        fixedLocal: false,
        number,
        error: 'Solo se aceptan numeros fijos/locales. LADA no reconocida.',
        source: 'ift-local-catalog',
      });
    }
    const payload = {
      ok: true,
      fixedLocal: true,
      number,
      lada: origin.lada,
      ciudad: origin.ciudad,
      estado: origin.estado,
      tipo: 'FIJO_LOCAL',
      source: 'ift-local-catalog',
      message: 'Numero fijo/local verificado para portabilidad.',
    };
    logSystem(req, 'portabilidad.verify', 'portabilidad', number, `${origin.ciudad}, ${origin.estado}`, payload);
    res.json(payload);
  }));

  app.post("/api/auth/passkey/continue", authOnly, wrap((req: any, res: any) => {
    if (isWebAuthnRequired(req)) {
      return res.status(403).json({ error: 'Passkey obligatoria en este entorno.', code: 'WEBAUTHN_REQUIRED' });
    }
    const user = Users.getById(req.auth.sub) as any;
    if (!user || user.activo !== 1) return res.status(401).json({ error: 'Usuario inválido' });
    if (user.role !== 'GERENTE') return res.status(403).json({ error: 'Solo gerencia puede continuar este flujo' });
    const previousRefreshToken = getRefreshTokenFromRequest(req);
    if (previousRefreshToken) Sessions.revoke(previousRefreshToken);
    AuditLog.insert({
      accion: 'WEBAUTHN_LOCAL_CONTINUE',
      entidad: 'users',
      entidad_id: user.uid,
      user_id: user.uid,
      user_nombre: user.nombre,
      detalle: 'WebAuthn no requerido por configuracion del entorno',
    });
    const { password: _, ...safe } = user;
    res.json({ ...safe, ...issueSessionCookie(res, user, req, { webAuthnVerified: true, webAuthnEnrollmentRequired: false }) });
  }));

  app.post("/api/webauthn/register/options", authOnly, wrap(async (req: any, res: any) => {
    res.json(await makeRegistrationOptions(req.auth.sub, req));
  }));

  app.post("/api/webauthn/register/verify", authOnly, wrap(async (req: any, res: any) => {
    res.json(await verifyRegistration(req.auth.sub, req.body.response, req, res));
  }));

  app.post("/api/webauthn/login/options", loginLimiter, wrap(async (req: any, res: any) => {
    const { userId, username } = req.body;
    const user = userId ? Users.getById(userId) as any : username ? (Users.getByUsername(username) || Users.getByEmail(username)) as any : null;
    if (!user) return res.status(400).json({ error: 'usuario requerido' });
    res.json({ ...(await makeAuthenticationOptions(user.uid, req)), userId: user.uid });
  }));

  app.post("/api/webauthn/login/verify", loginLimiter, wrap(async (req: any, res: any) => {
    const { userId, response } = req.body;
    if (!userId || !response) return res.status(400).json({ error: 'userId y response son requeridos' });
    res.json(await verifyAuthentication(userId, response, req, res));
  }));

  // Usuarios pendientes de aprobación
  app.get("/api/users/pending", managerOnly, wrap((_req: any, res: any) => {
    res.json(Users.getAll().filter((u: any) => u.activo === 2));
  }));

  // Aprobar cuenta
  app.post("/api/users/:uid/approve", managerOnly, wrap((req: any, res: any) => {
    const u = Users.getById(req.params.uid) as any;
    Users.update(req.params.uid, isFixedManagerUser(u) ? { activo: 1, role: 'GERENTE' } : { activo: 1 });
    AuditLog.insert({ accion: 'APPROVE_USER', entidad: 'users', entidad_id: req.params.uid, user_id: req.body.by || null, user_nombre: null, detalle: u?.nombre || null });
    res.json({ ok: true });
  }));

  // Rechazar / desactivar cuenta
  app.post("/api/users/:uid/reject", managerOnly, wrap((req: any, res: any) => {
    const u = Users.getById(req.params.uid) as any;
    if (isFixedManagerUser(u)) return res.status(403).json({ error: 'La cuenta gerente fija no puede desactivarse.' });
    Users.update(req.params.uid, { activo: 0 });
    AuditLog.insert({ accion: 'REJECT_USER', entidad: 'users', entidad_id: req.params.uid, user_id: req.body.by || null, user_nombre: null, detalle: u?.nombre || null });
    res.json({ ok: true });
  }));

  // Editar datos de usuario
  app.put("/api/users/:uid", managerOnly, wrap((req: any, res: any) => {
    const { password, uid: _uid, ...data } = req.body;
    const u = Users.getById(req.params.uid) as any;
    if (isFixedManagerUser(u)) {
      data.email = FIXED_MANAGER_EMAIL;
      data.username = FIXED_MANAGER_USERNAME;
      data.role = 'GERENTE';
      data.activo = 1;
    }
    Users.update(req.params.uid, data);
    res.json({ ok: true });
  }));

  // Eliminar cuenta permanentemente
  app.delete("/api/users/:uid", managerOnly, wrap((req: any, res: any) => {
    const u = Users.getById(req.params.uid) as any;
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (isFixedManagerUser(u)) return res.status(403).json({ error: 'La cuenta gerente fija no puede eliminarse.' });
    Users.delete(req.params.uid);
    AuditLog.insert({ accion: 'DELETE_USER', entidad: 'users', entidad_id: req.params.uid, user_id: null, user_nombre: null, detalle: u.nombre || u.username || null });
    res.json({ ok: true });
  }));

  // Contar pendientes (para notificaciones)
  app.get("/api/users/pending-count", adminOnly, wrap((_req: any, res: any) => {
    const count = Users.getAll().filter((u: any) => u.activo === 2).length;
    res.json({ count });
  }));

  app.get("/api/users/:uid", authOnly, wrap((req: any, res: any) => {
    if (!canAccessUserRecord(req.auth, req.params.uid)) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    const user = Users.getById(req.params.uid) as any;
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const { password: _, ...safe } = user;
    res.json(safe);
  }));

  app.get("/api/dashboard/summary", opsOnly, wrap((_req: any, res: any) => {
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    const userStats = db.prepare(`
      SELECT
        SUM(CASE WHEN activo=1 THEN 1 ELSE 0 END) AS activeUsers,
        SUM(CASE WHEN activo=2 THEN 1 ELSE 0 END) AS pendingUsers
      FROM users
    `).get() as any;
    const salesStats = db.prepare(`
      SELECT
        COUNT(*) AS saleCount,
        SUM(CASE WHEN COALESCE(status, 'pendiente')='pendiente' THEN 1 ELSE 0 END) AS pendingSales,
        SUM(CASE WHEN status IN ('aprobada', 'procedio') THEN 1 ELSE 0 END) AS approvedSales,
        SUM(CASE WHEN status='rechazada' THEN 1 ELSE 0 END) AS rejectedSales,
        SUM(CASE WHEN COALESCE(fecha_solicitud, created_at, '') LIKE @today THEN 1 ELSE 0 END) AS todaySales,
        SUM(CASE WHEN COALESCE(fecha_solicitud, created_at, '') LIKE @month THEN COALESCE(renta_mensual, 0) ELSE 0 END) AS monthRevenue
      FROM ventas
    `).get({ today: `${today}%`, month: `${month}%` }) as any;
    res.json({
      userCount: Number(userStats?.activeUsers || 0),
      pendingUsers: Number(userStats?.pendingUsers || 0),
      saleCount: Number(salesStats?.saleCount || 0),
      pendingSales: Number(salesStats?.pendingSales || 0),
      approvedSales: Number(salesStats?.approvedSales || 0),
      rejectedSales: Number(salesStats?.rejectedSales || 0),
      todaySales: Number(salesStats?.todaySales || 0),
      monthRevenue: Number(salesStats?.monthRevenue || 0),
    });
  }));

  registerFinanceEnterpriseRoutes(app);
  registerDiditRoutes(app);
  registerAvatarRoutes(app, { authOnly, wrap, createHttpError });

  // ── MOBILE PWA: endpoints compactos para asesores en campo ───────────────
  function mobileUser(auth: any) {
    const user = Users.getById(auth.sub) as any;
    if (!user) return { uid: auth.sub, nombre: auth.name, role: auth.role };
    const { password: _password, ...safe } = user;
    return { ...safe, displayName: safe.nombre || auth.name };
  }

  function mobileSales(req: any, limit = 80) {
    if (canManage(req.auth)) {
      const asesorId = String(req.query?.asesor_id || '').trim();
      if (asesorId) {
        return (db as any).prepare('SELECT * FROM ventas WHERE asesor_id=? ORDER BY created_at DESC LIMIT ?').all(asesorId, limit);
      }
      return (db as any).prepare('SELECT * FROM ventas ORDER BY created_at DESC LIMIT ?').all(limit);
    }
    return (db as any).prepare('SELECT * FROM ventas WHERE asesor_id=? ORDER BY created_at DESC LIMIT ?').all(req.auth.sub, limit);
  }

  function mobileCaptures(req: any, limit = 80) {
    if (canManage(req.auth)) {
      return (db as any).prepare('SELECT * FROM capturas ORDER BY fecha_captura DESC LIMIT ?').all(limit);
    }
    return (db as any).prepare('SELECT * FROM capturas WHERE vendedor_id=? ORDER BY fecha_captura DESC LIMIT ?').all(req.auth.sub, limit);
  }

  function mobileClients(req: any, limit = 80) {
    if (canManage(req.auth)) {
      return (db as any).prepare('SELECT * FROM clientes_crm ORDER BY created_at DESC LIMIT ?').all(limit);
    }
    return (db as any).prepare('SELECT * FROM clientes_crm WHERE vendedor_asignado=? ORDER BY created_at DESC LIMIT ?').all(req.auth.sub, limit);
  }

  function mobileFollowUps(req: any, limit = 80) {
    if (canManage(req.auth)) {
      return (db as any).prepare(`
        SELECT e.*, c.cliente_nombre, c.telefono
        FROM estatus_folios e
        LEFT JOIN capturas c ON c.id=e.captura_id
        ORDER BY e.fecha_movimiento DESC
        LIMIT ?
      `).all(limit);
    }
    return (db as any).prepare(`
      SELECT e.*, c.cliente_nombre, c.telefono
      FROM estatus_folios e
      JOIN capturas c ON c.id=e.captura_id
      WHERE c.vendedor_id=?
      ORDER BY e.fecha_movimiento DESC
      LIMIT ?
    `).all(req.auth.sub, limit);
  }

  function mobilePayroll(req: any, limit = 40) {
    if (canManage(req.auth)) {
      const asesorId = String(req.query?.asesor_id || '').trim();
      const rows = asesorId
        ? (Nominas.getAll() as any[]).filter(row => payrollOwnerMatches(row?.asesor_id, [normalizePayrollIdentity(asesorId)]))
        : (Nominas.getAll() as any[]);
      return rows.slice(0, limit);
    }
    return payrollRowsForAuth(req.auth).slice(0, limit);
  }

  function filterUpdatedSince(rows: any[], updatedSince: any) {
    const since = Number(updatedSince || 0);
    if (!since) return rows;
    return rows.filter((row: any) => {
      const value = row.updated_at || row.created_at || row.timestamp || row.last_message_at || row.fecha_movimiento || row.fecha_captura || row.fecha_solicitud || row.fecha || 0;
      const time = typeof value === 'number' ? value : new Date(value).getTime();
      return Number.isFinite(time) && time >= since;
    });
  }

  app.get("/api/mobile/bootstrap", mobileOnly, wrap((req: any, res: any) => {
    const managerAccess = canManage(req.auth);
    // Parallelize all synchronous DB reads to reduce sequential latency
    const [sales, captures, clients, followUps, payroll, conversations, pendingOutbox, pendingUsers] = [
      mobileSales(req, 60),
      mobileCaptures(req, 40),
      mobileClients(req, 40),
      mobileFollowUps(req, 40),
      mobilePayroll(req, 12),
      managerAccess ? getChannelConversations(80) : [],
      managerAccess ? (AgentOutbox.getAll(100) as any[]).filter((item: any) => item.status === 'pending_approval') : [],
      managerAccess ? (Users.getAll() as any[]).filter((u: any) => u.activo === 2).length : 0,
    ];
    const today = new Date().toISOString().slice(0, 10);
    const pendingSales = sales.filter((sale: any) => String(sale.status || 'pendiente').toLowerCase() === 'pendiente').length;
    const todaySales = sales.filter((sale: any) => String(sale.fecha_solicitud || sale.created_at || '').startsWith(today)).length;
    const pendingDocs = captures.filter((capture: any) => String(capture.status_documentos || '').toUpperCase() !== 'SUBIDO').length;
    const openConversations = conversations.filter((conversation: any) => !['cerrado', 'closed'].includes(String(conversation.status || '').toLowerCase())).length;
    res.json({
      user: mobileUser(req.auth),
      permissions: { role: req.auth.role, canManage: canManage(req.auth), canApproveHuman: canApproveHuman(req.auth), mobile: true },
      featureFlags: {
        mobilePwaPrimary: true,
        offlineQueue: true,
        moduleCache: true,
        agentApprovals: true,
      },
      nav: managerAccess
        ? ['inicio', 'venta', 'folios', 'clientes', 'documentos', 'seguimiento', 'nominas', 'chats', 'usuarios', 'aprobaciones', 'perfil', 'ajustes']
        : ['inicio', 'venta', 'folios', 'clientes', 'documentos', 'seguimiento', 'nominas', 'perfil', 'ajustes'],
      sync: {
        serverTime: Date.now(),
        staleAfterMs: 45000,
        supportsUpdatedSince: true,
      },
      agentInboxSummary: {
        pendingApproval: pendingOutbox.length,
        conversationsOpen: openConversations,
        latestDecisionAt: pendingOutbox[0]?.created_at || null,
      },
      counts: {
        ventas: sales.length,
        pendientes: pendingSales,
        hoy: todaySales,
        clientes: clients.length,
        documentosPendientes: pendingDocs,
        folios: followUps.length,
        chatsAbiertos: openConversations,
        aprobaciones: pendingOutbox.length,
        usuariosPendientes: pendingUsers,
      },
      channels: {
        whatsapp: getWhatsAppStatus('promotores'),
        whatsappPromotores: getWhatsAppStatus('promotores'),
        whatsappClientes: getWhatsAppStatus('clientes'),
        telegram: getTelegramStatus(),
      },
      recentSales: sales.slice(0, 8),
      pendingFollowUps: followUps.slice(0, 8),
      recentPayroll: payroll.slice(0, 5),
    });
  }));

  app.post("/api/mobile/capturas", mobileOnly, wrap(async (req: any, res: any) => {
    const body = req.body || {};
    const nombres = String(body.nombres || '').trim();
    const apellidoPaterno = String(body.apellidoPaterno || body.apellido_paterno || '').trim();
    const apellidoMaterno = String(body.apellidoMaterno || body.apellido_materno || '').trim();
    const telefono = normalizePhone10(body.telefono || body.telefono_titular || body.whatsapp);
    if (!nombres) return res.status(400).json({ error: 'nombres requerido' });
    if (telefono.length !== 10) return res.status(400).json({ error: 'telefono debe tener 10 digitos' });

    const user = Users.getById(req.auth.sub) as any;
    const incomingMeta = parseMetadata(body.metadata);
    const clientMutationId = String(body.clientMutationId || body.client_mutation_id || incomingMeta.clientMutationId || '').trim();
    if (clientMutationId) {
      const existingSale = (db as any).prepare(`
        SELECT * FROM ventas
        WHERE json_valid(metadata)
          AND json_extract(metadata, '$.clientMutationId') = @clientMutationId
        ORDER BY fecha_solicitud DESC, created_at DESC
        LIMIT 1
      `).get({ clientMutationId }) as any;
      if (existingSale) {
        if (!canAccessVenta(req.auth, existingSale)) {
          return res.status(409).json({ error: 'La captura ya existe para otro asesor.' });
        }
        const existingValidation = (ValidationRequests.getBySaleId(existingSale.id) as any[])[0] || null;
        return res.json({ ...existingSale, validation: existingValidation, idempotent: true });
      }
    }
    const meta = {
      ...incomingMeta,
      source: 'mobile-pwa',
      mobileVersion: 1,
      clientMutationId: clientMutationId || null,
      apellidoPaterno,
      apellidoMaterno,
      curp: normalizeCurp(body.curp || incomingMeta.curp),
      telefonoTitular: telefono,
      correo: String(body.correo || incomingMeta.correo || '').trim(),
      tipoVialidad: body.tipoVialidad || incomingMeta.tipoVialidad || incomingMeta.prefijoCalle || null,
      calle: body.calle || incomingMeta.calle || null,
      numeroExterior: body.numeroExterior || incomingMeta.numeroExterior || null,
      numeroInterior: body.numeroInterior || incomingMeta.numeroInterior || null,
      colonia: body.colonia || incomingMeta.colonia || null,
      delegacion: body.delegacion || body.municipio || incomingMeta.delegacion || null,
      ciudad: body.ciudad || incomingMeta.ciudad || null,
      codigoPostal: body.codigoPostal || body.codigo_postal || incomingMeta.codigoPostal || null,
      referencias: body.referencias || incomingMeta.referencias || null,
      coordenadas: body.coordenadas || incomingMeta.coordenadas || null,
      gpsLatitud: body.gpsLatitud || incomingMeta.gpsLatitud || null,
      gpsLongitud: body.gpsLongitud || incomingMeta.gpsLongitud || null,
      tipoCliente: body.tipoCliente || body.tipo_cliente || incomingMeta.tipoCliente || null,
      tipoServicio: body.tipoServicio || body.tipo_servicio || incomingMeta.tipoServicio || null,
      paqueteNombre: body.paqueteNombre || body.plan || incomingMeta.paqueteNombre || null,
      folioSiac: body.folioSiac || body.folio_siac || incomingMeta.folioSiac || null,
      servicioSiac: body.servicioSiac || body.servicio_siac || incomingMeta.servicioSiac || null,
    };
    const data = {
      id: randomUUID(),
      folio: String(body.folio || '').trim() || null,
      asesor_id: canManage(req.auth) && body.asesor_id ? String(body.asesor_id) : req.auth.sub,
      asesor_nombre: body.asesor_nombre || user?.nombre || req.auth.name || null,
      status: 'pendiente',
      nombres,
      apellidos: String(body.apellidos || [apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ')).trim() || null,
      telefono,
      direccion: body.direccion || buildOperationalAddress(meta, body),
      colonia: body.colonia || meta.colonia || null,
      municipio: body.municipio || body.delegacion || meta.delegacion || null,
      tipo_cliente: body.tipo_cliente || body.tipoCliente || meta.tipoCliente || null,
      tipo_servicio: body.tipo_servicio || body.tipoServicio || meta.tipoServicio || null,
      plan: body.plan || body.paqueteNombre || meta.paqueteNombre || null,
      renta_mensual: Number(body.renta_mensual || body.rentaMensual || 0) || null,
      zona: body.zona || body.ciudad || body.delegacion || meta.ciudad || null,
      notas: body.notas || body.observaciones || null,
      fecha_solicitud: new Date().toISOString(),
      metadata: JSON.stringify(meta),
    };
    Ventas.create(data);
    try {
      syncOperationalTablesFromSale({ ...req, body: { ...body, nombres, apellidos: data.apellidos, telefono_titular: telefono, metadata: meta } }, data);
      logSystem(req, 'CREATE_MOBILE_CAPTURA', 'capturas', data.id, data.folio || null, { venta_id: data.id });
    } catch (syncErr) {
      console.warn('[mobile/capturas] No se pudo sincronizar tablas operativas:', syncErr);
    }
    AuditLog.insert({ accion: 'CREATE_MOBILE_VENTA', entidad: 'ventas', entidad_id: data.id, user_id: data.asesor_id, user_nombre: data.asesor_nombre, detalle: data.folio });
    const savedSale = Ventas.getById(data.id) as any;
    const validation = await maybeAutoStartValidation(savedSale, req);
    res.json({ ...savedSale, validation });
  }));

  app.get("/api/mobile/clientes", mobileOnly, wrap((req: any, res: any) => {
    res.json(filterUpdatedSince(mobileClients(req, 100), req.query?.updatedSince));
  }));

  app.get("/api/mobile/documentos", mobileOnly, wrap((req: any, res: any) => {
    const captures = filterUpdatedSince(mobileCaptures(req, 60), req.query?.updatedSince).map((capture: any) => ({
      ...capture,
      documentos: DocumentosCliente.getByCaptura(capture.id),
      files: DocumentFiles.getByCapture(capture.id).map((file: any) => ({ ...file, storage_path: undefined })),
    }));
    res.json({ captures });
  }));

  app.get("/api/mobile/seguimiento", mobileOnly, wrap((req: any, res: any) => {
    res.json(filterUpdatedSince(mobileFollowUps(req, 100), req.query?.updatedSince));
  }));

  app.get("/api/mobile/nominas", mobileOnly, wrap((req: any, res: any) => {
    res.json(filterUpdatedSince(mobilePayroll(req, 80), req.query?.updatedSince));
  }));

  app.get("/api/mobile/chats", mobileOnly, wrap((req: any, res: any) => {
    const messages = filterUpdatedSince(getRecentChannelMessages(120), req.query?.updatedSince);
    const conversations = getChannelConversations(120).map((conversation: any) => ({
      ...conversation,
      pending_outbox: Number(conversation.pending_outbox || 0),
    }));
    res.json({ conversations, messages });
  }));

  app.post("/api/mobile/whatsapp/send", mobileOnly, wrap(async (req: any, res: any) => {
    const phone = normalizePhone10(req.body?.phone || req.body?.telefono);
    const message = String(req.body?.message || req.body?.mensaje || '').trim();
    if (phone.length !== 10 || !message) return res.status(400).json({ error: 'phone de 10 digitos y message son requeridos' });
    const result = await sendWhatsAppMessage(phone, message);
    logSystem(req, 'MOBILE_WHATSAPP_SEND', 'whatsapp', phone, message.slice(0, 80), { ok: result?.ok !== false });
    res.json(result);
  }));

  // ── VENTAS ─────────────────────────────────────────────────
  app.get("/api/ventas", authOnly, wrap((req: any, res: any) => {
    const { asesor_id } = req.query;
    const auth = req.auth;
    if (!canManage(auth)) return res.json(Ventas.getByAsesor(auth.sub));
    res.json(asesor_id ? Ventas.getByAsesor(asesor_id as string) : Ventas.getAll());
  }));

  app.post("/api/ventas", authOnly, wrap(async (req: any, res: any) => {
    const auth = req.auth;
    const data = {
      id: randomUUID(),
      folio: null,
      asesor_id: auth.sub,
      asesor_nombre: null,
      status: 'pendiente',
      nombres: null,
      apellidos: null,
      telefono: null,
      direccion: null,
      colonia: null,
      municipio: null,
      tipo_cliente: null,
      tipo_servicio: null,
      plan: null,
      renta_mensual: null,
      zona: null,
      notas: null,
      fecha_solicitud: new Date().toISOString(),
      ...req.body,
      metadata: req.body.metadata
        ? typeof req.body.metadata === 'string' ? req.body.metadata : JSON.stringify(req.body.metadata)
        : null,
    };
    if (!canManage(auth)) data.asesor_id = auth.sub;
    Ventas.create(data);
    try {
      syncOperationalTablesFromSale(req, data);
      logSystem(req, 'CREATE_CAPTURA', 'capturas', data.id, data.folio || null, { venta_id: data.id });
    } catch (syncErr) {
      console.warn('[capturas] No se pudo sincronizar tablas operativas:', syncErr);
    }
    AuditLog.insert({ accion: 'CREATE_VENTA', entidad: 'ventas', entidad_id: data.id, user_id: data.asesor_id, user_nombre: data.asesor_nombre, detalle: data.folio });
    const savedSale = Ventas.getById(data.id) as any;
    const validation = await maybeAutoStartValidation(savedSale, req);
    res.json({ ...savedSale, validation });
  }));

  const updateVenta = wrap((req: any, res: any) => {
    const current = Ventas.getById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Venta no encontrada' });
    if (!canAccessVenta(req.auth, current)) return res.status(403).json({ error: 'Permisos insuficientes' });
    const update = { ...req.body };
    if (!canManage(req.auth)) {
      delete update.asesor_id;
      delete update.asesor_nombre;
    }
    if (update.metadata && typeof update.metadata === 'object') update.metadata = JSON.stringify(update.metadata);
    Ventas.update(req.params.id, update);
    try {
      const updatedVenta = Ventas.getById(req.params.id) as any;
      const status = String(update.status || updatedVenta?.status || '').toUpperCase();
      if (updatedVenta && Capturas.getById(req.params.id)) {
        const capturaUpdate: Record<string, any> = {};
        if (status.includes('RECHAZ')) capturaUpdate.status_validacion = 'RECHAZADO';
        if (status.includes('APROB') || status.includes('PROCED')) capturaUpdate.status_validacion = 'VALIDADO';
        if (status.includes('INSTAL')) capturaUpdate.status_instalacion = 'INSTALADO';
        if (update.notas) capturaUpdate.observaciones = update.notas;
        if (Object.keys(capturaUpdate).length) Capturas.update(req.params.id, capturaUpdate);
        EstatusFolios.upsert({
          id: randomUUID(),
          captura_id: req.params.id,
          folio: updatedVenta.folio || `CAP-${String(req.params.id).slice(0, 8).toUpperCase()}`,
          status_actual: status.includes('RECHAZ') ? 'RECHAZADO' : status.includes('INSTAL') ? 'INSTALADO' : 'EN_REVISION',
          subestatus: update.status || null,
          area_actual: status.includes('INSTAL') ? 'INSTALACION' : 'VALIDACION',
          tecnico_asignado: update.tecnico_asignado || null,
          fecha_movimiento: new Date().toISOString(),
          observaciones: update.notas || null,
          documentos_faltantes: null,
          avance: status.includes('INSTAL') ? 100 : status.includes('RECHAZ') ? 0 : 60,
          metadata: JSON.stringify({ venta_id: req.params.id, status: update.status || null }),
        });
      }
    } catch (syncErr) {
      console.warn('[folios] No se pudo sincronizar estatus operativo:', syncErr);
    }
    AuditLog.insert({ accion: 'UPDATE_VENTA', entidad: 'ventas', entidad_id: req.params.id, user_id: update.by || null, user_nombre: update.byName || null, detalle: update.status || null });
    res.json(Ventas.getById(req.params.id));
  });
  app.put("/api/ventas/:id", authOnly, updateVenta);
  app.patch("/api/ventas/:id", authOnly, updateVenta);

  app.delete("/api/ventas/:id", opsOnly, wrap((req: any, res: any) => {
    Ventas.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── TABLAS OPERATIVAS: CAPTURAS / CRM / FOLIOS / DOCUMENTOS ─────────────
  app.get("/api/capturas", authOnly, wrap((req: any, res: any) => {
    if (canManage(req.auth)) return res.json(Capturas.getAll());
    res.json((db as any).prepare('SELECT * FROM capturas WHERE vendedor_id=? ORDER BY fecha_captura DESC').all(req.auth.sub));
  }));

  app.get("/api/capturas/:id/documentos", authOnly, wrap((req: any, res: any) => {
    const captura = Capturas.getById(req.params.id) as any;
    if (!captura) return res.status(404).json({ error: 'Captura no encontrada' });
    if (!canManage(req.auth) && captura.vendedor_id !== req.auth.sub) return res.status(403).json({ error: 'Permisos insuficientes' });
    res.json(DocumentosCliente.getByCaptura(req.params.id));
  }));

  app.get("/api/document-files", authOnly, wrap((req: any, res: any) => {
    const capturaId = String(req.query.captura_id || req.query.captureId || '');
    const limit = parseLimit(req.query.limit, 300, 1000);
    const offset = parseOffset(req.query.offset);
    const updatedSince = queryString(req.query.updatedSince);
    if (capturaId) {
      const captura = Capturas.getById(capturaId) as any;
      if (captura && !canManage(req.auth) && captura.vendedor_id !== req.auth.sub) {
        return res.status(403).json({ error: 'Permisos insuficientes' });
      }
      return res.json(DocumentFiles.getByCapture(capturaId));
    }
    if (!canManage(req.auth)) return res.status(403).json({ error: 'Permisos insuficientes' });
    if (hasPagingQuery(req.query as any)) {
      return res.json(DocumentFiles.getPage({ limit, offset, updatedSince }));
    }
    res.json(DocumentFiles.getAll(300));
  }));

  app.post("/api/document-files", authOnly, uploadLimiter, wrap((req: any, res: any) => {
    const body = req.body || {};
    if (!body.contentBase64 || !body.fileName || !body.docType) {
      return res.status(400).json({ error: 'contentBase64, fileName y docType son requeridos' });
    }

    const captura = body.captureId ? Capturas.getById(body.captureId) as any : null;
    if (captura && !canManage(req.auth) && captura.vendedor_id !== req.auth.sub) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    const stored = storeDocument({
      contentBase64: body.contentBase64,
      fileName: body.fileName,
      mimeType: body.mimeType,
      captureId: body.captureId || null,
      saleId: body.saleId || null,
      docType: body.docType,
    });

    const row = {
      id: stored.id,
      captura_id: body.captureId || null,
      venta_id: body.saleId || null,
      tipo_documento: String(body.docType).toUpperCase(),
      archivo_nombre: stored.fileName,
      mime_type: stored.mimeType,
      size_bytes: stored.sizeBytes,
      sha256: stored.sha256,
      storage_provider: stored.storageProvider,
      storage_path: stored.storagePath,
      review_status: 'PENDIENTE',
      manipulation_score: null,
      review_notes: null,
      uploaded_by: req.auth?.sub || null,
    };
    DocumentFiles.create(row);
    if (row.captura_id) {
      DocumentosCliente.upsert({
        id: randomUUID(),
        captura_id: row.captura_id,
        tipo_documento: row.tipo_documento,
        archivo_url: `/api/document-files/${row.id}/download`,
        archivo_nombre: row.archivo_nombre,
        status_documento: 'SUBIDO',
        validado_por: null,
        fecha_validacion: null,
        observaciones: `sha256:${row.sha256}`,
      });
    }
    logSystem(req, 'UPLOAD_DOCUMENT_FILE', 'document_files', row.id, row.tipo_documento, {
      captureId: row.captura_id,
      saleId: row.venta_id,
      sha256: row.sha256,
      sizeBytes: row.size_bytes,
    });
    recordMetric('document.uploaded', 1, { tipo: row.tipo_documento });
    res.json({ ok: true, file: { ...row, storage_path: undefined } });
  }));

  app.get("/api/document-files/:id/download", authOnly, wrap((req: any, res: any) => {
    const file = DocumentFiles.getById(req.params.id) as any;
    if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
    if (file.captura_id) {
      const captura = Capturas.getById(file.captura_id) as any;
      if (captura && !canManage(req.auth) && captura.vendedor_id !== req.auth.sub) {
        return res.status(403).json({ error: 'Permisos insuficientes' });
      }
    } else if (!canManage(req.auth)) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    const buffer = readStoredDocument(file.storage_path);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${String(file.archivo_nombre || file.id).replace(/"/g, '')}"`);
    res.setHeader('X-Document-SHA256', file.sha256);
    res.send(buffer);
  }));

  app.patch("/api/document-files/:id/review", adminOnly, wrap((req: any, res: any) => {
    const allowed = new Set(['PENDIENTE', 'VALIDADO', 'SOSPECHOSO', 'RECHAZADO']);
    const review_status = String(req.body?.review_status || '').toUpperCase();
    if (!allowed.has(review_status)) return res.status(400).json({ error: 'review_status invalido' });
    DocumentFiles.updateReview(req.params.id, {
      review_status,
      manipulation_score: req.body?.manipulation_score ?? null,
      review_notes: req.body?.review_notes || null,
    });
    logSystem(req, 'REVIEW_DOCUMENT_FILE', 'document_files', req.params.id, review_status, req.body || {});
    res.json(DocumentFiles.getById(req.params.id));
  }));

  app.patch("/api/documentos-cliente/:id", adminOnly, wrap((req: any, res: any) => {
    const allowed = ['status_documento', 'validado_por', 'fecha_validacion', 'observaciones'];
    const update: Record<string, any> = {};
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(req.body, key)) update[key] = req.body[key];
    if (!Object.keys(update).length) return res.status(400).json({ error: 'Sin cambios validos' });
    const fields = Object.keys(update).map(k => `${k}=@${k}`).join(',');
    (db as any).prepare(`UPDATE documentos_cliente SET ${fields}, updated_at=datetime('now') WHERE id=@id`).run({ ...update, id: req.params.id });
    logSystem(req, 'VALIDATE_DOCUMENT', 'documentos_cliente', req.params.id, update.status_documento || null);
    res.json((db as any).prepare('SELECT * FROM documentos_cliente WHERE id=?').get(req.params.id));
  }));

  app.post("/api/drive/expedientes/audit", authOnly, wrap((req: any, res: any) => {
    const body = req.body || {};
    const action = body.action === 'import' ? 'IMPORT_DRIVE_FOLDER' : 'EXPORT_DRIVE_FOLDER';
    const count = Number(body.salesImported ?? body.salesExported ?? 0);
    const files = Number(body.filesUploaded ?? 0);
    const folderId = body.folderId || body.rootFolderId || body.sourceFolderId || null;
    logSystem(
      req,
      action,
      'google_drive',
      folderId,
      `expedientes:${count};files:${files}`,
      {
        folderInput: body.folderInput || null,
        rootFolderUrl: body.rootFolderUrl || null,
        importedAt: body.importedAt || null,
      },
    );
    res.json({ ok: true });
  }));

  app.get("/api/clientes-crm", authOnly, wrap((req: any, res: any) => {
    if (canManage(req.auth)) return res.json(ClientesCrm.getAll());
    res.json((db as any).prepare('SELECT * FROM clientes_crm WHERE vendedor_asignado=? ORDER BY created_at DESC').all(req.auth.sub));
  }));

  app.get("/api/client-chat-crm", authOnly, wrap((req: any, res: any) => {
    const clients = getClientChatRows(req, parseLimit(req.query.limit, 400, 1000)).map((client: any) => ({
      ...client,
      metadata: clientChatMeta(client),
      clientChat: clientChatMeta(client).clientChat || {},
      phone10: clientChatPhone(client),
      suggestedAction: client.morosidad_id ? 'payment' : clientChatMeta(client).clientChat?.welcomeSentAt ? 'autopay' : 'welcome',
    }));
    const analytics = {
      total: clients.length,
      nuevos: clients.filter((client: any) => String(client.status_cliente || '').toUpperCase() === 'NUEVO').length,
      bienvenidasPendientes: clients.filter((client: any) => !client.clientChat?.welcomeSentAt && client.phone10.length === 10).length,
      morosos: clients.filter((client: any) => client.morosidad_id).length,
      domiciliarPendiente: clients.filter((client: any) => !client.clientChat?.domiciliationInvitedAt && !client.morosidad_id).length,
      montoMoroso: clients.reduce((sum: number, client: any) => sum + (Number(client.monto_adeudo) || 0), 0),
    };
    res.json({
      agent: {
        name: 'ARIUX Clientes',
        active: clientChatAgentEnabled(),
        channel: 'whatsapp_clientes',
      },
      analytics,
      clients,
    });
  }));

  app.post("/api/client-chat-crm/agent", opsOnly, wrap((req: any, res: any) => {
    const active = req.body?.active === true;
    Settings.set('client_chat_agent_enabled', active);
    AuditLog.insert({
      accion: active ? 'CLIENT_CHAT_AGENT_ENABLED' : 'CLIENT_CHAT_AGENT_DISABLED',
      entidad: 'settings',
      entidad_id: 'client_chat_agent_enabled',
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.name || null,
      detalle: null,
    });
    res.json({ ok: true, active });
  }));

  app.post("/api/client-chat-crm/:id/message", authOnly, wrap(async (req: any, res: any) => {
    const client = getClientChatById(req, req.params.id);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    const type = String(req.body?.type || 'question');
    const custom = String(req.body?.message || req.body?.question || '').trim();
    const message = type === 'custom' && custom ? custom : buildClientChatMessage(type, client, custom);
    if (req.body?.preview === true || req.body?.send === false) {
      return res.json({ ok: true, preview: true, message, clientId: client.id });
    }
    const result = await sendClientChatMessage(client, type, message);
    logSystem(req, 'CLIENT_CHAT_MESSAGE_SENT', 'clientes_crm', client.id, type, { phone: clientChatPhone(client), result });
    res.json({ ok: true, message, result, client: ClientesCrm.getById(client.id) });
  }));

  app.post("/api/client-chat-crm/run", opsOnly, wrap(async (req: any, res: any) => {
    const mode = String(req.body?.mode || 'welcome_pending');
    const max = Math.min(Number(req.body?.limit || 20) || 20, 50);
    const clients = getClientChatRows(req, 1000).filter((client: any) => {
      const meta = clientChatMeta(client);
      if (clientChatPhone(client).length !== 10) return false;
      if (mode === 'morosos') return Boolean(client.morosidad_id) && !meta.clientChat?.paymentReminderSentAt;
      if (mode === 'autopay') return !client.morosidad_id && !meta.clientChat?.domiciliationInvitedAt;
      return !meta.clientChat?.welcomeSentAt;
    }).slice(0, max);
    const results: any[] = [];
    for (const client of clients) {
      const type = mode === 'morosos' ? 'payment' : mode === 'autopay' ? 'autopay' : 'welcome';
      const message = buildClientChatMessage(type, client);
      try {
        const result = await sendClientChatMessage(client, type, message);
        results.push({ id: client.id, ok: true, type, result });
      } catch (err: any) {
        results.push({ id: client.id, ok: false, type, error: err?.message || String(err) });
      }
    }
    logSystem(req, 'CLIENT_CHAT_AGENT_RUN', 'clientes_crm', null, mode, { total: results.length, ok: results.filter(item => item.ok).length });
    res.json({ ok: true, mode, processed: results.length, results });
  }));

  app.get("/api/morosidad", opsOnly, wrap((_req: any, res: any) => {
    res.json((db as any).prepare(`
      SELECT
        m.*,
        c.nombre AS cliente,
        c.telefono AS telefono,
        c.whatsapp AS whatsapp,
        c.correo AS correo,
        c.direccion AS direccion,
        c.status_cliente AS status_cliente,
        c.riesgo_cancelacion AS riesgo_cancelacion,
        c.metadata AS cliente_metadata
      FROM morosidad m
      LEFT JOIN clientes_crm c ON c.id=m.cliente_id
      ORDER BY m.dias_atraso DESC, m.monto_adeudo DESC, m.created_at DESC
    `).all());
  }));

  app.get("/api/morosidad/analytics", opsOnly, wrap((_req: any, res: any) => {
    const rows: any[] = (db as any).prepare(`
      SELECT
        m.*,
        c.nombre AS cliente,
        c.telefono,
        c.correo,
        c.metadata AS cliente_metadata,
        COALESCE(CASE WHEN json_valid(c.metadata) THEN json_extract(c.metadata, '$.promotor') END, CASE WHEN json_valid(m.metadata) THEN json_extract(m.metadata, '$.promotor') END, 'SIN PROMOTOR') AS promotor,
        COALESCE(CASE WHEN json_valid(c.metadata) THEN json_extract(c.metadata, '$.usuario') END, CASE WHEN json_valid(m.metadata) THEN json_extract(m.metadata, '$.usuario') END, 'SIN USUARIO') AS usuario,
        COALESCE(CASE WHEN json_valid(c.metadata) THEN json_extract(c.metadata, '$.area') END, CASE WHEN json_valid(m.metadata) THEN json_extract(m.metadata, '$.area') END, 'SIN AREA') AS area,
        COALESCE(CASE WHEN json_valid(c.metadata) THEN json_extract(c.metadata, '$.mercado') END, CASE WHEN json_valid(m.metadata) THEN json_extract(m.metadata, '$.mercado') END, 'SIN MERCADO') AS mercado,
        COALESCE(CASE WHEN json_valid(c.metadata) THEN json_extract(c.metadata, '$.paquete') END, CASE WHEN json_valid(m.metadata) THEN json_extract(m.metadata, '$.paquete') END, 'SIN PAQUETE') AS paquete
      FROM morosidad m
      LEFT JOIN clientes_crm c ON c.id=m.cliente_id
    `).all();
    const siacRows: any[] = (db as any).prepare(`
      SELECT folio_siac, zona, tienda, estrategia, usuario, promotor, morosidad
      FROM siac_records
    `).all();
    const siacByFolio = new Map(siacRows.map(row => [String(row.folio_siac), row]));
    const enriched = rows.map(row => ({ ...row, ...(siacByFolio.get(String(row.folio)) || {}) }));
    const group = (field: string) => Object.values(enriched.reduce((acc: any, row: any) => {
      const key = String(row[field] || `SIN ${field.toUpperCase()}`).trim() || `SIN ${field.toUpperCase()}`;
      if (!acc[key]) acc[key] = { name: key, total: 0, monto: 0 };
      acc[key].total += 1;
      acc[key].monto += Number(row.monto_adeudo) || 0;
      return acc;
    }, {})).sort((a: any, b: any) => b.monto - a.monto || b.total - a.total).slice(0, 12);
    res.json({
      total: enriched.length,
      montoTotal: enriched.reduce((sum, row) => sum + (Number(row.monto_adeudo) || 0), 0),
      byUsuario: group('usuario'),
      byPromotor: group('promotor'),
      byZona: group('zona'),
      byTienda: group('tienda'),
      byEstrategia: group('estrategia'),
      byArea: group('area'),
      byMercado: group('mercado'),
      byStatus: group('status_cobranza'),
    });
  }));

  app.post("/api/morosidad/import-source", managerOnly, wrap(async (req: any, res: any) => {
    const result = await importMorososSource({
      sourcePath: req.body?.sourcePath || DEFAULT_MOROSOS_SOURCE,
      replace: req.query.replace === '1' || req.body?.replace !== false,
      sheetName: queryString(req.body?.sheetName),
    });
    Settings.set('morosos_source_fingerprint', result.fingerprint);
    AuditLog.insert({ accion: 'IMPORT_MOROSOS_SOURCE', entidad: 'morosidad', entidad_id: null, user_id: req.auth?.sub || null, user_nombre: null, detalle: `imported:${result.imported};skipped:${result.skipped};source:${result.source}` });
    res.json({ ok: true, ...result });
  }));

  app.post("/api/morosidad/import-file", managerOnly, uploadLimiter, wrap(async (req: any, res: any) => {
    const content = String(req.body?.contentBase64 || '');
    if (!content) return res.status(400).json({ error: 'contentBase64 requerido' });
    const result = await importMorososSource({
      buffer: Buffer.from(content, 'base64'),
      fileName: req.body?.fileName || 'morosos.csv',
      replace: req.body?.replace === true,
      sheetName: queryString(req.body?.sheetName),
    });
    AuditLog.insert({ accion: 'IMPORT_MOROSOS_FILE', entidad: 'morosidad', entidad_id: null, user_id: req.auth?.sub || null, user_nombre: null, detalle: `imported:${result.imported};skipped:${result.skipped};source:${result.source}` });
    res.json({ ok: true, ...result });
  }));

  app.get("/api/estatus-folios", authOnly, wrap((req: any, res: any) => {
    if (canManage(req.auth)) {
      return res.json((db as any).prepare('SELECT * FROM estatus_folios ORDER BY fecha_movimiento DESC').all());
    }
    res.json((db as any).prepare(`
      SELECT e.* FROM estatus_folios e
      JOIN capturas c ON c.id=e.captura_id
      WHERE c.vendedor_id=?
      ORDER BY e.fecha_movimiento DESC
    `).all(req.auth.sub));
  }));

  app.get("/api/folios/status", authOnly, wrap((req: any, res: any) => {
    const q = `%${String(req.query.q || '').trim()}%`;
    if (q.length < 4) return res.json([]);
    const vendedorClause = canManage(req.auth) ? '' : 'AND c.vendedor_id=@userId';
    const rows = (db as any).prepare(`
      SELECT e.folio, c.cliente_nombre, c.telefono, e.status_actual, e.subestatus,
             e.area_actual, e.tecnico_asignado, e.avance, e.documentos_faltantes,
             c.fecha_instalacion, e.observaciones, e.fecha_movimiento
      FROM estatus_folios e
      LEFT JOIN capturas c ON c.id=e.captura_id
      WHERE (e.folio LIKE @q OR c.telefono LIKE @q OR c.cliente_nombre LIKE @q) ${vendedorClause}
      ORDER BY e.fecha_movimiento DESC
      LIMIT 50
    `).all({ q, userId: req.auth.sub });
    res.json(rows);
  }));

  app.post("/api/duplicates/check", authOnly, wrap((req: any, res: any) => {
    const telefono = normalizePhone10(req.body?.telefono || req.body?.telefonoTitular);
    const celular = normalizePhone10(req.body?.celular);
    const numeroPortar = normalizePhone10(req.body?.numeroAPortar || req.body?.numero_a_portar);
    const correo = String(req.body?.correo || req.body?.email || '').trim().toLowerCase();
    const values = [
      telefono && { field: 'telefono', label: 'Teléfono celular', value: telefono },
      celular && { field: 'celular', label: 'Celular', value: celular },
      numeroPortar && { field: 'numero_portar', label: 'Teléfono a portar', value: numeroPortar },
      correo && { field: 'correo', label: 'Correo electrónico', value: correo },
    ].filter(Boolean) as Array<{ field: string; label: string; value: string }>;

    const matches: any[] = [];
    for (const item of values) {
      if (item.field === 'correo') {
        matches.push(...(db as any).prepare(`
          SELECT 'SIAC' AS source, folio_siac AS folio, correo AS value, COALESCE(promotor, usuario, '') AS owner,
                 tienda, zona, 'Correo electrónico ya registrado en SIAC' AS reason
          FROM siac_records WHERE lower(correo)=@value LIMIT 10
        `).all({ value: item.value }));
        matches.push(...(db as any).prepare(`
          SELECT 'CRM' AS source, folio, correo AS value, nombre AS owner, NULL AS tienda, NULL AS zona,
                 'Correo electrónico ya registrado en clientes' AS reason
          FROM clientes_crm WHERE lower(correo)=@value LIMIT 10
        `).all({ value: item.value }));
        matches.push(...(db as any).prepare(`
          SELECT 'CAPTURA' AS source, folio, json_extract(metadata, '$.correo') AS value, cliente_nombre AS owner, NULL AS tienda, ciudad AS zona,
                 'Correo electrónico ya usado en captura' AS reason
          FROM capturas WHERE json_valid(metadata) AND lower(json_extract(metadata, '$.correo'))=@value LIMIT 10
        `).all({ value: item.value }));
      } else {
        matches.push(...(db as any).prepare(`
          SELECT 'SIAC' AS source, folio_siac AS folio, @value AS value, COALESCE(promotor, usuario, '') AS owner,
                 tienda, zona, @reason AS reason
          FROM siac_records
          WHERE telefono_asignado=@value OR telefono_portado=@value OR telefono_referencia=@value
          LIMIT 10
        `).all({ value: item.value, reason: `${item.label} ya registrado en SIAC` }));
        matches.push(...(db as any).prepare(`
          SELECT 'CRM' AS source, folio, @value AS value, nombre AS owner, NULL AS tienda, NULL AS zona,
                 @reason AS reason
          FROM clientes_crm
          WHERE telefono=@value OR whatsapp=@value
          LIMIT 10
        `).all({ value: item.value, reason: `${item.label} ya registrado en clientes` }));
        matches.push(...(db as any).prepare(`
          SELECT 'CAPTURA' AS source, folio, @value AS value, cliente_nombre AS owner, NULL AS tienda, ciudad AS zona,
                 @reason AS reason
          FROM capturas
          WHERE telefono=@value
             OR (json_valid(metadata) AND (
                json_extract(metadata, '$.telefonoTitular')=@value
                OR json_extract(metadata, '$.numeroAPortar')=@value
                OR json_extract(metadata, '$.numero_a_portar')=@value
             ))
          LIMIT 10
        `).all({ value: item.value, reason: `${item.label} ya usado en captura` }));
      }
    }

    const uniqueMatches = Array.from(new Map(matches.map(match => [`${match.source}:${match.folio}:${match.reason}`, match])).values());
    if (uniqueMatches.length) {
      logSystem(req, 'DUPLICATE_CAPTURE_ALERT', 'capturas', req.body?.folio || null, `matches:${uniqueMatches.length}`, {
        values,
        matches: uniqueMatches.slice(0, 20),
      });
      AuditLog.insert({
        accion: 'DUPLICATE_CAPTURE_ALERT',
        entidad: 'capturas',
        entidad_id: req.body?.folio || null,
        user_id: req.auth?.sub || null,
        user_nombre: req.auth?.name || null,
        detalle: `Coincidencias: ${uniqueMatches.length}`,
      });
    }
    res.json({ duplicate: uniqueMatches.length > 0, matches: uniqueMatches.slice(0, 30) });
  }));

  // ── SIAC ───────────────────────────────────────────────────
  // Buscar por Folio SIAC (columna fija clave)
  app.get("/api/siac/search", authOnly, wrap((req: any, res: any) => {
    const folio = (req.query.folio as string || '').trim();
    if (!folio) return res.json([]);
    const exact = SiacRecords.getByFolio(folio);
    const records = exact ? [exact] : SiacRecords.search(folio);
    const allowed = (records as any[]).filter(record => crmCanAccessRecord(req.auth, record));
    AuditLog.insert({
      accion: 'CRM_SEARCH_SIAC',
      entidad: 'siac_records',
      entidad_id: folio || null,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.name || null,
      detalle: `resultados:${allowed.length}`,
    });
    res.json(allowed.map(record => maskSiacRecord(record, req.auth)));
  }));

  app.get("/api/siac/analytics", authOnly, wrap((req: any, res: any) => {
    const filters = {
      estatus_siac: queryString(req.query.estatus),
      usuario: queryString(req.query.usuario),
      zona: queryString(req.query.zona),
      tienda: queryString(req.query.tienda),
      estrategia: queryString(req.query.estrategia),
      morosidad: queryString(req.query.morosidad),
      tipo_linea: queryString(req.query.tipoLinea),
      paquete: queryString(req.query.paquete),
      area: queryString(req.query.area),
      colonia: queryString(req.query.colonia),
      dateFrom: queryString(req.query.dateFrom),
      dateTo: queryString(req.query.dateTo),
    };
    const rows = SiacRecords.getPage({
      limit: 1000000,
      offset: 0,
      q: queryString(req.query.q),
      updatedSince: queryString(req.query.updatedSince),
      filters,
      auth: req.auth,
    }) as any[];
    const isEffective = (record: any) => {
      const status = String(record.estatus_siac || '').toUpperCase();
      const etapa = String(record.estatus_pisa || record.estatus_etapa || '').toUpperCase();
      return status.includes('POSTEA') || status.includes('PAGADO') || etapa.includes('POSTEA') || etapa === 'PF';
    };
    const group = (field: string) => Object.values(rows.reduce((acc: any, row: any) => {
      const key = String(row[field] || 'Sin dato').trim() || 'Sin dato';
      if (!acc[key]) acc[key] = { name: key, total: 0, efectivas: 0, efectividad: 0 };
      acc[key].total += 1;
      if (isEffective(row)) acc[key].efectivas += 1;
      acc[key].efectividad = Math.round((acc[key].efectivas / acc[key].total) * 1000) / 10;
      return acc;
    }, {})).sort((a: any, b: any) => b.efectivas - a.efectivas || b.total - a.total).slice(0, 12);
    const total = rows.length;
    const efectivas = rows.filter(isEffective).length;
    res.json({
      total,
      efectivas,
      efectividad: total ? Math.round((efectivas / total) * 1000) / 10 : 0,
      byStatus: group('estatus_siac'),
      byZona: group('zona'),
      byTienda: group('tienda'),
      byPromotor: group('promotor'),
      byUsuario: group('usuario'),
      byEstrategia: group('estrategia'),
      byArea: group('area'),
      byPaquete: group('paquete'),
      byTipoLinea: group('tipo_linea'),
    });
  }));

  app.get("/api/siac/:folio/360", authOnly, wrap((req: any, res: any) => {
    const record = SiacRecords.getByFolio(req.params.folio) as any;
    if (!record) return res.status(404).json({ error: 'Folio no encontrado' });
    if (!crmCanAccessRecord(req.auth, record)) return res.status(403).json({ error: 'No tienes permiso para ver este folio' });
    const followups = CrmFollowups.getByFolio(record.folio_siac) as any[];
    const notes = CrmNotes.getByFolio(record.folio_siac, crmCanManage(req.auth)) as any[];
    const ai = crmRisk(record, followups);
    AuditLog.insert({
      accion: 'CRM_VIEW_360',
      entidad: 'siac_records',
      entidad_id: record.folio_siac,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.name || null,
      detalle: ai.priority,
    });
    res.json({
      record: maskSiacRecord(record, req.auth),
      followups,
      notes,
      ai,
      links: {
        whatsapp: record.telefono_asignado ? `https://wa.me/521${String(record.telefono_asignado).replace(/\D/g, '')}` : null,
        maps: record.colonia ? `https://maps.google.com/?q=${encodeURIComponent([record.colonia, record.distrito, record.zona].filter(Boolean).join(' '))}` : null,
      },
      permissions: {
        canAddFollowup: crmCanOperate(req.auth),
        canAddNote: true,
        canManageVisibility: crmCanManage(req.auth),
      },
    });
  }));

  app.get("/api/siac/:folio", authOnly, wrap((req: any, res: any) => {
    const record = SiacRecords.getByFolio(req.params.folio);
    if (!record) return res.status(404).json({ error: 'Folio no encontrado' });
    if (!crmCanAccessRecord(req.auth, record)) return res.status(403).json({ error: 'No tienes permiso para ver este folio' });
    res.json(maskSiacRecord(record, req.auth));
  }));

  app.get("/api/siac", authOnly, wrap((req: any, res: any) => {
    if (hasPagingQuery(req.query as any)) {
      const filters = {
        estatus_siac: queryString(req.query.estatus),
        usuario: queryString(req.query.usuario),
        zona: queryString(req.query.zona),
        tienda: queryString(req.query.tienda),
        estrategia: queryString(req.query.estrategia),
        morosidad: queryString(req.query.morosidad),
        tipo_linea: queryString(req.query.tipoLinea),
        paquete: queryString(req.query.paquete),
        area: queryString(req.query.area),
        colonia: queryString(req.query.colonia),
        dateFrom: queryString(req.query.dateFrom),
        dateTo: queryString(req.query.dateTo),
      };
      const limit = parseLimit(req.query.limit, 50, 500);
      const offset = parseOffset(req.query.offset);
      const q = queryString(req.query.q);
      const rows = SiacRecords.getPage({
        limit,
        offset,
        q,
        updatedSince: queryString(req.query.updatedSince),
        filters,
        auth: req.auth,
      }) as any[];
      const total = SiacRecords.countPage({ q, updatedSince: queryString(req.query.updatedSince), filters, auth: req.auth });
      return res.json({
        rows: rows.map(record => maskSiacRecord(record, req.auth)),
        total,
        limit,
        offset,
        permissions: {
          canExport: crmCanManage(req.auth),
          canEditStatus: crmCanOperate(req.auth),
          canManageVisibility: crmCanManage(req.auth),
        },
      });
    }
    const rows = (SiacRecords.getAll() as any[]).filter(record => crmCanAccessRecord(req.auth, record));
    res.json(rows.map(record => maskSiacRecord(record, req.auth)));
  }));

  app.get("/api/crm/visibility-rules", managerOnly, wrap((_req: any, res: any) => {
    res.json(CrmVisibilityRules.getAll());
  }));

  app.put("/api/crm/visibility-rules", managerOnly, wrap((req: any, res: any) => {
    const rules = Array.isArray(req.body?.rules) ? req.body.rules : [];
    CrmVisibilityRules.setMany(rules, req.auth?.sub || null);
    AuditLog.insert({
      accion: 'CRM_UPDATE_VISIBILITY',
      entidad: 'crm_visibility_rules',
      entidad_id: null,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.name || null,
      detalle: `rules:${rules.length}`,
    });
    res.json({ ok: true, rules: CrmVisibilityRules.getAll() });
  }));

  app.get("/api/crm/saved-searches", authOnly, wrap((req: any, res: any) => {
    res.json(CrmSavedSearches.getByUser(req.auth.sub));
  }));

  app.post("/api/crm/saved-searches", authOnly, wrap((req: any, res: any) => {
    const name = String(req.body?.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    CrmSavedSearches.create({ user_id: req.auth.sub, name, filters: req.body?.filters || {} });
    AuditLog.insert({
      accion: 'CRM_SAVE_SEARCH',
      entidad: 'crm_saved_searches',
      entidad_id: null,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.name || null,
      detalle: name,
    });
    res.json({ ok: true, searches: CrmSavedSearches.getByUser(req.auth.sub) });
  }));

  app.post("/api/crm/followups", authOnly, wrap((req: any, res: any) => {
    const folio = String(req.body?.folio_siac || req.body?.folio || '').trim();
    const record = SiacRecords.getByFolio(folio) as any;
    if (!record) return res.status(404).json({ error: 'Folio no encontrado' });
    if (!crmCanOperate(req.auth) || !crmCanAccessRecord(req.auth, record)) return res.status(403).json({ error: 'Permisos insuficientes' });
    const action = String(req.body?.action || '').trim().slice(0, 120);
    if (!action) return res.status(400).json({ error: 'Acción requerida' });
    CrmFollowups.create({
      folio_siac: record.folio_siac,
      action,
      status: String(req.body?.status || 'pendiente').trim().slice(0, 40),
      next_at: req.body?.next_at || null,
      responsible_id: req.body?.responsible_id || req.auth.sub,
      responsible_name: req.body?.responsible_name || req.auth.name,
      comment: String(req.body?.comment || '').trim().slice(0, 2000),
      metadata: req.body?.metadata || {},
      created_by: req.auth.sub,
      created_by_name: req.auth.name,
    });
    AuditLog.insert({
      accion: 'CRM_CREATE_FOLLOWUP',
      entidad: 'siac_records',
      entidad_id: record.folio_siac,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.name || null,
      detalle: action,
    });
    res.json({ ok: true, followups: CrmFollowups.getByFolio(record.folio_siac), ai: crmRisk(record, CrmFollowups.getByFolio(record.folio_siac) as any[]) });
  }));

  app.post("/api/crm/notes", authOnly, wrap((req: any, res: any) => {
    const folio = String(req.body?.folio_siac || req.body?.folio || '').trim();
    const record = SiacRecords.getByFolio(folio) as any;
    if (!record) return res.status(404).json({ error: 'Folio no encontrado' });
    if (!crmCanAccessRecord(req.auth, record)) return res.status(403).json({ error: 'Permisos insuficientes' });
    const note = String(req.body?.note || '').trim().slice(0, 3000);
    if (!note) return res.status(400).json({ error: 'Nota requerida' });
    const requestedVisibility = String(req.body?.visibility || 'equipo').trim();
    const visibility = requestedVisibility === 'gerencia' && !crmCanManage(req.auth) ? 'equipo' : requestedVisibility;
    CrmNotes.create({
      folio_siac: record.folio_siac,
      note,
      priority: String(req.body?.priority || 'media').trim().slice(0, 30),
      visibility,
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
      created_by: req.auth.sub,
      created_by_name: req.auth.name,
    });
    AuditLog.insert({
      accion: 'CRM_CREATE_NOTE',
      entidad: 'siac_records',
      entidad_id: record.folio_siac,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.name || null,
      detalle: visibility,
    });
    res.json({ ok: true, notes: CrmNotes.getByFolio(record.folio_siac, crmCanManage(req.auth)) });
  }));

  app.post("/api/crm/export-audit", authOnly, wrap((req: any, res: any) => {
    if (!crmCanManage(req.auth)) return res.status(403).json({ error: 'No tienes permiso para exportar' });
    AuditLog.insert({
      accion: 'CRM_EXPORT_SIAC',
      entidad: 'siac_records',
      entidad_id: null,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.name || null,
      detalle: JSON.stringify(req.body?.filters || {}),
    });
    res.json({ ok: true });
  }));

  app.post("/api/siac/import-source", managerOnly, wrap(async (req: any, res: any) => {
    const result = await importSiacSource({
      sourcePath: req.body?.sourcePath || DEFAULT_SIAC_SOURCE,
      replace: req.query.replace === '1' || req.body?.replace !== false,
      sheetName: queryString(req.body?.sheetName),
    });
    Settings.set('siac_primary_source_fingerprint', result.fingerprint);
    Settings.set('siac_primary_importer_version', SIAC_IMPORTER_VERSION);
    AuditLog.insert({
      accion: 'IMPORT_SIAC_PRIMARY_SOURCE',
      entidad: 'siac_records',
      entidad_id: null,
      user_id: req.auth?.sub || null,
      user_nombre: null,
      detalle: `imported:${result.imported};skipped:${result.skipped};source:${result.source}`,
    });
    res.json({ ok: true, ...result });
  }));

  app.post("/api/siac/import-file", managerOnly, uploadLimiter, wrap(async (req: any, res: any) => {
    const content = String(req.body?.contentBase64 || '');
    if (!content) return res.status(400).json({ error: 'contentBase64 requerido' });
    const result = await importSiacSource({
      buffer: Buffer.from(content, 'base64'),
      fileName: req.body?.fileName || 'siac.xlsx',
      replace: req.body?.replace === true,
      sheetName: queryString(req.body?.sheetName),
    });
    Settings.set('siac_primary_source_fingerprint', result.fingerprint);
    Settings.set('siac_primary_importer_version', SIAC_IMPORTER_VERSION);
    AuditLog.insert({
      accion: 'IMPORT_SIAC_FILE',
      entidad: 'siac_records',
      entidad_id: null,
      user_id: req.auth?.sub || null,
      user_nombre: null,
      detalle: `imported:${result.imported};skipped:${result.skipped};source:${result.source}`,
    });
    res.json({ ok: true, ...result });
  }));

  app.post("/api/siac/import-google-drive", managerOnly, wrap(async (req: any, res: any) => {
    const input = String(req.body?.input || req.body?.url || '').trim();
    if (!input) return res.status(400).json({ error: 'input requerido' });
    const downloaded = await downloadPublicSiacFromGoogleDrive(input);
    const result = await importSiacSource({
      buffer: downloaded.buffer,
      fileName: downloaded.fileName,
      replace: req.body?.replace === true,
    });
    Settings.set('siac_primary_source_fingerprint', result.fingerprint);
    Settings.set('siac_primary_importer_version', SIAC_IMPORTER_VERSION);
    Settings.set('siac_primary_drive_source', downloaded.sourceUrl);
    AuditLog.insert({
      accion: 'IMPORT_SIAC_GOOGLE_DRIVE',
      entidad: 'siac_records',
      entidad_id: null,
      user_id: req.auth?.sub || null,
      user_nombre: null,
      detalle: `imported:${result.imported};skipped:${result.skipped};file:${downloaded.fileName};drive:${downloaded.fileId}`,
    });
    res.json({ ok: true, ...result, fileName: downloaded.fileName, fileId: downloaded.fileId });
  }));

  // Reimportar CSV
  app.post("/api/siac/import", managerOnly, wrap((req: any, res: any) => {
    const replace = req.query.replace === '1' || req.query.replace === 'true' || req.body?.replace === true;
    const result = importSiacCSV({ replace });
    const fingerprint = getSiacCSVFingerprint();
    if (fingerprint) Settings.set('siac_csv_fingerprint', fingerprint);
    AuditLog.insert({
      accion: replace ? 'REPLACE_IMPORT_SIAC' : 'IMPORT_SIAC',
      entidad: 'siac_records',
      entidad_id: null,
      user_id: req.auth?.sub || null,
      user_nombre: null,
      detalle: `imported:${result.imported};skipped:${result.skipped};source:${result.source}`,
    });
    res.json({ ok: true, ...result });
  }));

  app.delete("/api/siac", managerOnly, wrap((_req: any, res: any) => {
    SiacRecords.deleteAll();
    res.json({ ok: true });
  }));

  app.post("/api/siac/bulk", managerOnly, wrap((req: any, res: any) => {
    const rows = Array.isArray(req.body) ? req.body : Array.isArray(req.body?.records) ? req.body.records : [];
    if (!rows.length) return res.status(400).json({ error: 'records requerido' });
    let imported = 0, skipped = 0;
    for (const row of rows) {
      const data = normalizeSiacRow(row);
      if (!data.folio_siac) { skipped++; continue; }
      try {
        SiacRecords.upsert(data);
        imported++;
      } catch {
        skipped++;
      }
    }
    AuditLog.insert({ accion: 'BULK_IMPORT_SIAC', entidad: 'siac_records', entidad_id: null, user_id: req.auth?.sub || null, user_nombre: null, detalle: `imported:${imported};skipped:${skipped}` });
    res.json({ imported, skipped });
  }));

  // ── TICKETS ────────────────────────────────────────────────
  app.get("/api/tickets", authOnly, wrap((req: any, res: any) => {
    if (canOperateAuth(req.auth)) return res.json(Tickets.getAll());
    const rows = (db as any).prepare(`
      SELECT * FROM tickets
      WHERE asesor_id=@userId OR asignado_a=@userId
      ORDER BY created_at DESC
    `).all({ userId: req.auth.sub });
    res.json(rows);
  }));

  app.post("/api/tickets", authOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'abierto', prioridad: 'media', categoria: null, ...req.body };
    if (!canOperateAuth(req.auth)) {
      data.asesor_id = req.auth.sub;
      delete data.asignado_a;
    }
    Tickets.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/tickets/:id", authOnly, wrap((req: any, res: any) => {
    const current = (db as any).prepare('SELECT * FROM tickets WHERE id=?').get(req.params.id) as any;
    if (!current) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!canOperateAuth(req.auth) && current.asesor_id !== req.auth.sub && current.asignado_a !== req.auth.sub) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    const payload = canOperateAuth(req.auth)
      ? req.body
      : {
          descripcion: req.body?.descripcion ?? current.descripcion,
          status: req.body?.status ?? current.status,
          prioridad: req.body?.prioridad ?? current.prioridad,
        };
    Tickets.update(req.params.id, payload);
    res.json({ ok: true });
  }));

  // ── VALIDACIONES ───────────────────────────────────────────
  app.get("/api/voice-providers/status", opsOnly, wrap((_req: any, res: any) => {
    res.json({
      defaultProvider: configuredVoiceProvider(),
      fallbacks: String(getSecretValue('VOICE_PROVIDER_FALLBACKS', process.env.VOICE_PROVIDER_FALLBACKS || 'twilio-basic')).split(',').map(item => item.trim()).filter(Boolean),
      autoEnabled: validationAutoEnabled(),
      providers: listVoiceProviderStatus(),
    });
  }));

  app.put("/api/voice-providers/config", managerOnly, wrap((req: any, res: any) => {
    const provider = String(req.body?.defaultProvider || '').trim();
    const validProviders = new Set(listVoiceProviderStatus().map(item => item.id));
    if (provider && !validProviders.has(provider as any)) return res.status(400).json({ error: 'Proveedor invalido' });
    if (provider) Settings.set('voice_provider_default', provider);
    if (typeof req.body?.autoEnabled === 'boolean') Settings.set('validation_calls_auto_enabled', req.body.autoEnabled);
    res.json({
      ok: true,
      defaultProvider: configuredVoiceProvider(),
      autoEnabled: validationAutoEnabled(),
      providers: listVoiceProviderStatus(),
    });
  }));

  app.get("/api/validations", opsOnly, wrap((_req: any, res: any) => res.json(ValidationRequests.getAll())));

  app.post("/api/validations", authOnly, wrap((req: any, res: any) => {
    const sale = req.body?.sale_id ? Ventas.getById(req.body.sale_id) as any : null;
    if (sale) {
      const validation = createValidationForSale(sale, req, req.body || {});
      return res.json({ ok: true, id: validation.id, validation });
    }
    const data = { id: randomUUID(), status: 'PENDIENTE', notas: null, review_status: 'pending', attempts: 0, ...req.body };
    ValidationRequests.create(data);
    res.json({ ok: true, id: data.id, validation: ValidationRequests.getById(data.id) });
  }));

  app.post("/api/validations/:id/call", adminOnly, wrap(async (req: any, res: any) => {
    const validation = await startValidationCallForRequest(req.params.id, req.body?.provider || null);
    logSystem(req, 'VALIDATION_CALL_STARTED', 'validation_requests', req.params.id, validation.provider || null, {
      provider: validation.provider,
      callSid: validation.call_sid,
      conversationId: validation.conversation_id,
    });
    recordMetric('validation.call.started', 1, { provider: validation.provider || 'unknown' });
    res.json({ ok: true, validation });
  }));

  app.post("/api/validations/:id/retry", adminOnly, wrap(async (req: any, res: any) => {
    const validation = await startValidationCallForRequest(req.params.id, req.body?.provider || null);
    logSystem(req, 'VALIDATION_CALL_RETRY', 'validation_requests', req.params.id, validation.provider || null, {
      attempts: validation.attempts,
      provider: validation.provider,
    });
    res.json({ ok: true, validation });
  }));

  app.post("/api/validations/:id/sync", adminOnly, wrap(async (req: any, res: any) => {
    const current = ValidationRequests.getById(req.params.id) as any;
    if (!current) return res.status(404).json({ error: 'Validacion no encontrada' });
    const result = await syncValidationWithProvider(current);
    ValidationRequests.update(req.params.id, {
      call_status: result.status,
      proposed_result: result.proposedResult,
      summary: result.summary || null,
      transcript_json: result.transcript ? JSON.stringify(result.transcript) : current.transcript_json || null,
      provider_payload_json: JSON.stringify({ previous: parseMetadata(current.provider_payload_json), sync: result.raw || result }),
      status: result.status === 'failed' ? 'ERROR' : result.proposedResult ? 'ESPERANDO_REVISION' : current.status,
    });
    res.json({ ok: true, validation: ValidationRequests.getById(req.params.id) });
  }));

  app.post("/api/validations/:id/approve", adminOnly, wrap((req: any, res: any) => {
    const current = ValidationRequests.getById(req.params.id) as any;
    if (!current) return res.status(404).json({ error: 'Validacion no encontrada' });
    ValidationRequests.update(req.params.id, {
      status: 'VALIDADO',
      resultado: 'validada',
      review_status: 'approved',
      reviewed_by: req.auth?.sub || null,
      reviewed_at: new Date().toISOString(),
      notas: req.body?.notes || current.notas || null,
    });
    if (current.sale_id) Ventas.update(current.sale_id, { status: 'validada', notas: req.body?.notes || current.summary || current.notas || null });
    res.json({ ok: true, validation: ValidationRequests.getById(req.params.id), sale: current.sale_id ? Ventas.getById(current.sale_id) : null });
  }));

  app.post("/api/validations/:id/reject", adminOnly, wrap((req: any, res: any) => {
    const current = ValidationRequests.getById(req.params.id) as any;
    if (!current) return res.status(404).json({ error: 'Validacion no encontrada' });
    ValidationRequests.update(req.params.id, {
      status: 'RECHAZADO',
      resultado: 'rechazada',
      review_status: 'rejected',
      reviewed_by: req.auth?.sub || null,
      reviewed_at: new Date().toISOString(),
      notas: req.body?.notes || current.notas || null,
    });
    if (current.sale_id) Ventas.update(current.sale_id, { status: 'rechazada_validacion', notas: req.body?.notes || current.summary || current.notas || null });
    res.json({ ok: true, validation: ValidationRequests.getById(req.params.id), sale: current.sale_id ? Ventas.getById(current.sale_id) : null });
  }));

  app.put("/api/validations/:id", adminOnly, wrap((req: any, res: any) => {
    ValidationRequests.update(req.params.id, req.body);
    res.json({ ok: true, validation: ValidationRequests.getById(req.params.id) });
  }));

  // ── REFERIDOS ──────────────────────────────────────────────
  app.get("/api/referrals", authOnly, wrap((req: any, res: any) => {
    if (canOperateAuth(req.auth)) return res.json(Referrals.getAll());
    const rows = (db as any).prepare('SELECT * FROM referrals WHERE referred_by=? ORDER BY created_at DESC').all(req.auth.sub);
    res.json(rows);
  }));

  app.post("/api/referrals", authOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'pendiente', convertido: 0, ...req.body };
    if (!canOperateAuth(req.auth)) data.referred_by = req.auth.sub;
    Referrals.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/referrals/:id", authOnly, wrap((req: any, res: any) => {
    const current = (db as any).prepare('SELECT * FROM referrals WHERE id=?').get(req.params.id) as any;
    if (!current) return res.status(404).json({ error: 'Referido no encontrado' });
    if (!canOperateAuth(req.auth) && current.referred_by !== req.auth.sub) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    const payload = canOperateAuth(req.auth)
      ? req.body
      : {
          nombre: req.body?.nombre ?? current.nombre,
          telefono: req.body?.telefono ?? current.telefono,
          status: req.body?.status ?? current.status,
        };
    Referrals.update(req.params.id, payload);
    res.json({ ok: true });
  }));

  // ── TERRITORIOS ────────────────────────────────────────────
  app.get("/api/territories", authOnly, wrap((_req: any, res: any) => res.json(Territories.getAll())));

  app.post("/api/territories", opsOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), poligono: null, color: null, ...req.body };
    Territories.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/territories/:id", opsOnly, wrap((req: any, res: any) => {
    Territories.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  app.delete("/api/territories/:id", opsOnly, wrap((req: any, res: any) => {
    Territories.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── CUOTAS ─────────────────────────────────────────────────
  app.get("/api/quotas", opsOnly, wrap((_req: any, res: any) => res.json(Quotas.getAll())));

  app.get("/api/quotas/me", authOnly, wrap((req: any, res: any) => {
    const quota = Quotas.getByUser(req.auth.sub) as any;
    res.json(quota || {
      user_id: req.auth.sub,
      meta: 10,
      periodo: new Date().toISOString().slice(0, 7),
      mensaje: '',
      updated_by: null,
      notified_at: null,
      updated_at: null,
    });
  }));

  app.put("/api/quotas/:userId", opsOnly, wrap((req: any, res: any) => {
    const meta = Number.parseInt(String(req.body?.meta ?? 0), 10);
    if (!Number.isFinite(meta) || meta < 0) return res.status(400).json({ error: 'Meta invalida.' });
    const periodo = String(req.body?.periodo || new Date().toISOString().slice(0, 7)).slice(0, 7);
    const mensaje = String(req.body?.mensaje || '').trim().slice(0, 700);
    const notify = req.body?.notify !== false;
    const user = Users.getById(req.params.userId) as any;
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const notifiedAt = notify ? new Date().toISOString() : null;
    Quotas.set(req.params.userId, {
      meta,
      periodo,
      mensaje,
      updated_by: req.auth?.sub || null,
      notified_at: notifiedAt,
    });
    const quota = Quotas.getByUser(req.params.userId) as any;
    AuditLog.insert({
      accion: 'META_ESTABLECIDA',
      entidad: 'quotas',
      entidad_id: req.params.userId,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.name || null,
      detalle: `Meta ${meta} ventas para ${user.nombre || user.username} (${periodo})`,
    });
    if (notify) {
      const content = mensaje || `Tu meta para ${periodo} es de ${meta} ventas aprobadas. Revisa tu progreso en Mi Perfil.`;
      Announcements.create({
        id: randomUUID(),
        titulo: `Meta actualizada: ${user.nombre || user.username}`,
        contenido: content,
        tipo: 'goal',
        autor_id: req.auth?.sub || null,
      });
    }
    res.json({ ok: true, quota });
  }));

  // ── COMISIONES ─────────────────────────────────────────────
  app.get("/api/commissions", opsOnly, wrap((_req: any, res: any) => res.json(CommissionRules.getAll())));

  app.post("/api/commissions", managerOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), ...req.body };
    CommissionRules.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.delete("/api/commissions/:id", managerOnly, wrap((req: any, res: any) => {
    CommissionRules.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── CATÁLOGO PAQUETES ──────────────────────────────────────
  app.get("/api/packages", authOnly, wrap((_req: any, res: any) => res.json(PackageCatalog.getAll())));

  app.post("/api/packages", managerOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), descripcion: null, ...req.body };
    PackageCatalog.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/packages/:id", managerOnly, wrap((req: any, res: any) => {
    PackageCatalog.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  app.delete("/api/packages/:id", managerOnly, wrap((req: any, res: any) => {
    PackageCatalog.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── NÓMINAS ────────────────────────────────────────────────
  app.get("/api/nominas", authOnly, wrap((req: any, res: any) => {
    if (!canManage(req.auth)) return res.json(payrollRowsForAuth(req.auth));
    const asesorId = String(req.query?.asesor_id || '').trim();
    if (asesorId) {
      const aliases = [normalizePayrollIdentity(asesorId)];
      return res.json((Nominas.getAll() as any[]).filter(row => payrollOwnerMatches(row?.asesor_id, aliases)));
    }
    res.json(Nominas.getAll());
  }));

  app.get("/api/nominas/siac-week", authOnly, wrap((req: any, res: any) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const week = Number(req.query.week) || 21;
    const commission = Number(req.query.comision || req.query.commission || 200) || 200;
    res.json(buildSiacWeekPayroll({
      auth: req.auth,
      year,
      week,
      commission,
      selectedName: req.query.userName || req.query.usuario || '',
    }));
  }));

  app.post("/api/nominas", managerOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'borrador', ...req.body };
    Nominas.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/nominas/:id", managerOnly, wrap((req: any, res: any) => {
    Nominas.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  // ── ANUNCIOS ───────────────────────────────────────────────
  app.get("/api/announcements", authOnly, wrap((_req: any, res: any) => res.json(Announcements.getAll())));

  app.post("/api/announcements", opsOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), tipo: 'info', autor_id: null, ...req.body };
    Announcements.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.delete("/api/announcements/:id", opsOnly, wrap((req: any, res: any) => {
    Announcements.delete(req.params.id);
    res.json({ ok: true });
  }));

  // ── CONFIGURACIÓN ──────────────────────────────────────────
  app.get("/api/settings/:key", managerOnly, wrap((req: any, res: any) => {
    const val = Settings.get(req.params.key);
    res.json({ key: req.params.key, value: val });
  }));

  app.put("/api/settings/:key", managerOnly, wrap((req: any, res: any) => {
    Settings.set(req.params.key, req.body.value);
    res.json({ ok: true });
  }));

  app.get("/api/admin/integration-secrets", managerOnly, wrap((_req: any, res: any) => {
    res.json({ value: listMaskedSecrets() });
  }));

  app.post("/api/admin/integration-secrets", managerOnly, wrap((req: any, res: any) => {
    const saved = saveSecret({
      id: req.body?.id,
      provider: req.body?.provider,
      label: req.body?.label,
      keyName: req.body?.keyName || req.body?.key_name,
      value: req.body?.value,
      status: req.body?.status || 'active',
      metadata: req.body?.metadata || {},
    }, req.auth);
    res.json({ ok: true, value: saved });
  }));

  app.patch("/api/admin/integration-secrets/:id", managerOnly, wrap((req: any, res: any) => {
    const saved = patchSecret(req.params.id, req.body || {}, req.auth);
    if (!saved) return res.status(404).json({ error: 'Clave API no encontrada' });
    res.json({ ok: true, value: saved });
  }));

  app.post("/api/admin/integration-secrets/:id/revoke", managerOnly, wrap((req: any, res: any) => {
    const saved = revokeSecret(req.params.id, req.auth);
    if (!saved) return res.status(404).json({ error: 'Clave API no encontrada' });
    res.json({ ok: true, value: saved });
  }));

  app.delete("/api/admin/integration-secrets/:id", managerOnly, wrap((req: any, res: any) => {
    if (!deleteSecret(req.params.id, req.auth)) return res.status(404).json({ error: 'Clave API no encontrada' });
    res.json({ ok: true });
  }));

  app.post("/api/admin/integration-secrets/:id/test", managerOnly, wrap(async (req: any, res: any) => {
    const secret = getSecretForServerUse(req.params.id) as any;
    if (!secret) return res.status(404).json({ error: 'Clave API no encontrada o revocada' });
    const result = await testIntegrationSecret(secret);
    AuditLog.insert({
      accion: 'INTEGRATION_SECRET_TESTED',
      entidad: 'integration_secrets',
      entidad_id: req.params.id,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.name || null,
      detalle: JSON.stringify({ provider: secret.provider, keyName: secret.keyName, ok: result.ok, message: result.message }).slice(0, 900),
    });
    res.status(result.ok ? 200 : 502).json(result);
  }));

  // ── EMAIL SYNC: Gmail/CSV/XLSX -> CRM ─────────────────────
  app.get("/api/email-sync/status", managerOnly, wrap((_req: any, res: any) => {
    res.json(emailSyncStatus());
  }));

  app.get("/api/email-sync/accounts", managerOnly, wrap((_req: any, res: any) => {
    res.json(EmailSync.listAccounts());
  }));

  app.post("/api/email-sync/accounts", managerOnly, wrap((req: any, res: any) => {
    const body = req.body || {};
    EmailSync.upsertAccount({
      id: body.id || 'gmail-primary',
      provider: 'gmail',
      label: String(body.label || 'Gmail principal').trim(),
      email: String(body.email || '').trim().toLowerCase() || null,
      query: String(body.query || '').trim() || null,
      client_id: String(body.clientId || body.client_id || '').trim() || null,
      client_secret: String(body.clientSecret || body.client_secret || '').trim() || null,
      refresh_token: String(body.refreshToken || body.refresh_token || '').trim() || null,
      enabled: body.enabled !== false,
      created_by: req.auth?.sub || null,
    });
    AuditLog.insert({
      accion: 'EMAIL_SYNC_CONFIG',
      entidad: 'email_sync_accounts',
      entidad_id: body.id || 'gmail-primary',
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.nombre || req.auth?.username || null,
      detalle: `gmail:${body.email || ''};query:${body.query || ''}`.slice(0, 2000),
    });
    res.json({ ok: true, accounts: EmailSync.listAccounts() });
  }));

  app.get("/api/email-sync/jobs", managerOnly, wrap((req: any, res: any) => {
    res.json(EmailSync.listJobs(parseLimit(req.query.limit, 100, 500)));
  }));

  app.post("/api/email-sync/run", managerOnly, wrap(async (req: any, res: any) => {
    const result = await runGmailSync({
      accountId: req.body?.accountId || req.body?.account_id || undefined,
      limit: Number(req.body?.limit || 10),
      actor: req.auth,
    });
    AuditLog.insert({
      accion: 'EMAIL_SYNC_RUN_GMAIL',
      entidad: 'email_sync_jobs',
      entidad_id: null,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.nombre || req.auth?.username || null,
      detalle: `processed:${result.processed.length};query:${result.query}`.slice(0, 2000),
    });
    res.json(result);
  }));

  app.post("/api/email-sync/upload", managerOnly, uploadLimiter, wrap(async (req: any, res: any) => {
    const fileName = String(req.body?.fileName || req.body?.filename || '').trim();
    const contentBase64 = String(req.body?.contentBase64 || req.body?.content || '').trim();
    if (!fileName || !contentBase64) return res.status(400).json({ error: 'fileName y contentBase64 son requeridos.' });
    const raw = contentBase64.includes(',') ? contentBase64.split(',').pop() || '' : contentBase64;
    const buffer = Buffer.from(raw, 'base64');
    const result = await processSyncAttachment({
      source: 'manual',
      sender: req.auth?.email || req.auth?.username || null,
      subject: 'Carga manual desde Sync Center',
      fileName,
      mimeType: req.body?.mimeType || req.body?.type || null,
      buffer,
      actor: req.auth,
    });
    res.json({ ok: true, result });
  }));

  // ── GOOGLE SERVICES ────────────────────────────────────────
  app.get("/api/integrations/google/status", authOnly, wrap((_req: any, res: any) => {
    res.json(googleServicesStatus());
  }));

  app.get("/api/integrations/google/:service/connect", authOnly, wrap((req: any, res: any) => {
    const service = req.params.service as any;
    const base = String(process.env.APP_URL || process.env.OAUTH_CALLBACK_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const url = getGoogleServiceAuthUrl(service, base, req.auth?.sub);
    res.json({ url });
  }));

  app.get("/api/integrations/google/:service/callback", wrap(async (req: any, res: any) => {
    try {
      const service = req.params.service as any;
      const code = String(req.query.code || '');
      const base = String(process.env.APP_URL || process.env.OAUTH_CALLBACK_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      if (!code) throw new Error('Código OAuth faltante');
      const tokens = await exchangeGoogleServiceCode(service, code, base);
      const stateRaw = String(req.query.state || '');
      const state = stateRaw ? JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8')) : {};
      auditGoogleService(`GOOGLE_${String(service).toUpperCase()}_CONNECTED`, state.userId || null, { service, scope: tokens.scope });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!doctype html><html><head><script>window.opener&&window.opener.postMessage({type:'google_connected',service:'${service}',hasRefreshToken:${Boolean(tokens.refresh_token)}},location.origin);setTimeout(()=>window.close(),800);</script></head><body style="background:#071323;color:#e5f4ff;font-family:sans-serif;display:grid;place-items:center;min-height:100vh"><p>✅ Google ${service} conectado. Cerrando…</p></body></html>`);
    } catch (err: any) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(400).send(`<!doctype html><html><body style="background:#071323;color:#ef4444;font-family:sans-serif;padding:24px"><p>${err?.message || 'Error al conectar'}</p></body></html>`);
    }
  }));

  app.get("/api/integrations/google/calendar/events", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-google-token'] || '').trim();
    if (!token) return res.status(400).json({ error: 'x-google-token requerido' });
    const events = await listCalendarEvents(token, String(req.query.calendarId || 'primary'), Number(req.query.maxResults || 20));
    res.json({ events });
  }));

  app.post("/api/integrations/google/calendar/events", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-google-token'] || '').trim();
    if (!token) return res.status(400).json({ error: 'x-google-token requerido' });
    const event = await createCalendarEvent(token, req.body);
    auditGoogleService('GOOGLE_CALENDAR_EVENT_CREATED', req.auth?.sub, { summary: req.body?.summary });
    res.json(event);
  }));

  app.delete("/api/integrations/google/calendar/events/:id", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-google-token'] || '').trim();
    if (!token) return res.status(400).json({ error: 'x-google-token requerido' });
    await deleteCalendarEvent(token, req.params.id, String(req.query.calendarId || 'primary'));
    res.json({ ok: true });
  }));

  app.get("/api/integrations/google/sheets/read", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-google-token'] || '').trim();
    const spreadsheetId = String(req.query.spreadsheetId || '').trim();
    const range = String(req.query.range || 'A1:ZZ').trim();
    if (!token || !spreadsheetId) return res.status(400).json({ error: 'x-google-token y spreadsheetId requeridos' });
    const values = await readSheet(token, spreadsheetId, range);
    res.json({ values });
  }));

  app.post("/api/integrations/google/sheets/append", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-google-token'] || '').trim();
    const { spreadsheetId, range, rows } = req.body || {};
    if (!token || !spreadsheetId || !rows) return res.status(400).json({ error: 'x-google-token, spreadsheetId y rows requeridos' });
    const result = await appendToSheet(token, spreadsheetId, range || 'A1', rows);
    res.json(result);
  }));

  app.post("/api/integrations/google/sheets/create", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-google-token'] || '').trim();
    const { title, headers } = req.body || {};
    if (!token || !title) return res.status(400).json({ error: 'x-google-token y title requeridos' });
    const sheet = await createSpreadsheet(token, title, Array.isArray(headers) ? headers : []);
    auditGoogleService('GOOGLE_SHEET_CREATED', req.auth?.sub, { title });
    res.json(sheet);
  }));

  app.get("/api/integrations/google/contacts", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-google-token'] || '').trim();
    if (!token) return res.status(400).json({ error: 'x-google-token requerido' });
    const contacts = await listContacts(token, Number(req.query.pageSize || 50));
    res.json({ contacts });
  }));

  app.post("/api/integrations/google/contacts", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-google-token'] || '').trim();
    if (!token) return res.status(400).json({ error: 'x-google-token requerido' });
    const contact = await createContact(token, req.body);
    auditGoogleService('GOOGLE_CONTACT_CREATED', req.auth?.sub, { email: req.body?.email });
    res.json(contact);
  }));

  app.post("/api/integrations/google/token/refresh", authOnly, wrap(async (req: any, res: any) => {
    const refreshToken = String(req.body?.refreshToken || '').trim();
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken requerido' });
    const accessToken = await refreshGoogleToken(refreshToken);
    res.json({ accessToken });
  }));

  // ── MICROSOFT GRAPH ────────────────────────────────────────
  app.get("/api/integrations/microsoft/status", authOnly, wrap((_req: any, res: any) => {
    res.json(microsoftServicesStatus());
  }));

  app.get("/api/integrations/microsoft/:service/connect", authOnly, wrap((req: any, res: any) => {
    const service = req.params.service as any;
    const base = String(process.env.APP_URL || process.env.OAUTH_CALLBACK_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const url = getMicrosoftServiceAuthUrl(service, base, req.auth?.sub);
    res.json({ url });
  }));

  app.get("/api/integrations/microsoft/:service/callback", wrap(async (req: any, res: any) => {
    try {
      const service = req.params.service as any;
      const code = String(req.query.code || '');
      const base = String(process.env.APP_URL || process.env.OAUTH_CALLBACK_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      if (!code) throw new Error('Código OAuth faltante');
      const tokens = await exchangeMicrosoftServiceCode(service, code, base);
      const stateRaw = String(req.query.state || '');
      const state = stateRaw ? JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8')) : {};
      auditMicrosoftService(`MICROSOFT_${String(service).toUpperCase()}_CONNECTED`, state.userId || null, { service, scope: tokens.scope });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!doctype html><html><head><script>window.opener&&window.opener.postMessage({type:'microsoft_connected',service:'${service}',hasRefreshToken:${Boolean(tokens.refresh_token)}},location.origin);setTimeout(()=>window.close(),800);</script></head><body style="background:#071323;color:#e5f4ff;font-family:sans-serif;display:grid;place-items:center;min-height:100vh"><p>✅ Microsoft ${service} conectado. Cerrando…</p></body></html>`);
    } catch (err: any) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(400).send(`<!doctype html><html><body style="background:#071323;color:#ef4444;font-family:sans-serif;padding:24px"><p>${err?.message || 'Error al conectar'}</p></body></html>`);
    }
  }));

  app.get("/api/integrations/microsoft/calendar/events", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-ms-token'] || '').trim();
    if (!token) return res.status(400).json({ error: 'x-ms-token requerido' });
    const events = await listOutlookEvents(token, Number(req.query.maxResults || 20));
    res.json({ events });
  }));

  app.post("/api/integrations/microsoft/calendar/events", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-ms-token'] || '').trim();
    if (!token) return res.status(400).json({ error: 'x-ms-token requerido' });
    const event = await createOutlookEvent(token, req.body);
    auditMicrosoftService('MICROSOFT_CALENDAR_EVENT_CREATED', req.auth?.sub, { subject: req.body?.subject });
    res.json(event);
  }));

  app.delete("/api/integrations/microsoft/calendar/events/:id", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-ms-token'] || '').trim();
    if (!token) return res.status(400).json({ error: 'x-ms-token requerido' });
    await deleteOutlookEvent(token, req.params.id);
    res.json({ ok: true });
  }));

  app.get("/api/integrations/microsoft/teams/list", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-ms-token'] || '').trim();
    if (!token) return res.status(400).json({ error: 'x-ms-token requerido' });
    const teams = await listTeams(token);
    res.json({ teams });
  }));

  app.get("/api/integrations/microsoft/teams/:teamId/channels", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-ms-token'] || '').trim();
    if (!token) return res.status(400).json({ error: 'x-ms-token requerido' });
    const channels = await listChannels(token, req.params.teamId);
    res.json({ channels });
  }));

  app.post("/api/integrations/microsoft/teams/message", authOnly, wrap(async (req: any, res: any) => {
    const { teamId, channelId, message } = req.body || {};
    const webhookUrl = process.env.MICROSOFT_TEAMS_WEBHOOK_URL || '';
    if (webhookUrl) {
      await sendTeamsWebhookMessage(webhookUrl, { title: 'Heavenly Dreams CRM', text: String(message || '') });
      return res.json({ ok: true, via: 'webhook' });
    }
    const token = String(req.headers['x-ms-token'] || '').trim();
    if (!token || !teamId || !channelId) return res.status(400).json({ error: 'x-ms-token, teamId y channelId requeridos' });
    const result = await sendTeamsMessage(token, teamId, channelId, String(message || ''));
    auditMicrosoftService('MICROSOFT_TEAMS_MESSAGE_SENT', req.auth?.sub, { teamId, channelId });
    res.json(result);
  }));

  app.post("/api/integrations/microsoft/teams/webhook", authOnly, wrap(async (req: any, res: any) => {
    const { title, text, themeColor } = req.body || {};
    const webhookUrl = process.env.MICROSOFT_TEAMS_WEBHOOK_URL || '';
    if (!webhookUrl) return res.status(400).json({ error: 'MICROSOFT_TEAMS_WEBHOOK_URL no configurada' });
    await sendTeamsWebhookMessage(webhookUrl, { title: String(title || ''), text: String(text || ''), themeColor });
    auditMicrosoftService('MICROSOFT_TEAMS_WEBHOOK_SENT', req.auth?.sub, { title });
    res.json({ ok: true });
  }));

  app.get("/api/integrations/microsoft/onedrive/files", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-ms-token'] || '').trim();
    if (!token) return res.status(400).json({ error: 'x-ms-token requerido' });
    const files = await listOneDriveFiles(token, String(req.query.folderId || 'root'), Number(req.query.top || 50));
    res.json({ files });
  }));

  app.post("/api/integrations/microsoft/onedrive/upload", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-ms-token'] || '').trim();
    const { fileName, contentBase64, folderId } = req.body || {};
    if (!token || !fileName || !contentBase64) return res.status(400).json({ error: 'x-ms-token, fileName y contentBase64 requeridos' });
    const raw = contentBase64.includes(',') ? contentBase64.split(',').pop() || '' : contentBase64;
    const buffer = Buffer.from(raw, 'base64');
    const result = await uploadToOneDrive(token, fileName, buffer, folderId || 'root');
    auditMicrosoftService('MICROSOFT_ONEDRIVE_FILE_UPLOADED', req.auth?.sub, { fileName });
    res.json(result);
  }));

  app.post("/api/integrations/microsoft/onedrive/folder", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-ms-token'] || '').trim();
    const { name, parentId } = req.body || {};
    if (!token || !name) return res.status(400).json({ error: 'x-ms-token y name requeridos' });
    const folder = await createOneDriveFolder(token, name, parentId || 'root');
    res.json(folder);
  }));

  app.get("/api/integrations/microsoft/excel/worksheets", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-ms-token'] || '').trim();
    const driveItemId = String(req.query.driveItemId || '').trim();
    if (!token || !driveItemId) return res.status(400).json({ error: 'x-ms-token y driveItemId requeridos' });
    const sheets = await listExcelWorksheets(token, driveItemId);
    res.json({ sheets });
  }));

  app.get("/api/integrations/microsoft/excel/read", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-ms-token'] || '').trim();
    const { driveItemId, worksheetId, address } = req.query as any;
    if (!token || !driveItemId || !worksheetId) return res.status(400).json({ error: 'x-ms-token, driveItemId y worksheetId requeridos' });
    const values = await readExcelRange(token, driveItemId, worksheetId, address || 'A1:ZZ1000');
    res.json({ values });
  }));

  app.post("/api/integrations/microsoft/excel/append", authOnly, wrap(async (req: any, res: any) => {
    const token = String(req.headers['x-ms-token'] || '').trim();
    const { driveItemId, worksheetId, rows } = req.body || {};
    if (!token || !driveItemId || !worksheetId || !rows) return res.status(400).json({ error: 'x-ms-token, driveItemId, worksheetId y rows requeridos' });
    const result = await appendExcelRows(token, driveItemId, worksheetId, rows);
    res.json(result);
  }));

  app.post("/api/integrations/microsoft/token/refresh", authOnly, wrap(async (req: any, res: any) => {
    const refreshToken = String(req.body?.refreshToken || '').trim();
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken requerido' });
    const { refreshMicrosoftToken } = await import("./server/microsoft-graph");
    const accessToken = await refreshMicrosoftToken(refreshToken);
    res.json({ accessToken });
  }));

  // ── AUDIT LOG ──────────────────────────────────────────────
  app.get("/api/audit", managerOnly, wrap((req: any, res: any) => {
    const limit = parseLimit(req.query.limit, 200, 1000);
    const offset = parseOffset(req.query.offset);
    const updatedSince = queryString(req.query.updatedSince);
    if (hasPagingQuery(req.query as any)) {
      return res.json(AuditLog.getPage({ limit, offset, updatedSince }));
    }
    res.json(AuditLog.getAll(limit));
  }));

  app.post("/api/audit", authOnly, wrap((req: any, res: any) => {
    const auth = req.auth || {};
    const accion = String(req.body?.accion || req.body?.action || '').trim().slice(0, 80);
    const entidad = String(req.body?.entidad || req.body?.entity || 'frontend').trim().slice(0, 80);
    if (!accion) return res.status(400).json({ error: 'accion requerida' });
    const entidadId = req.body?.entidad_id || req.body?.entityId || req.body?.targetId || null;
    const detalle = req.body?.detalle || req.body?.detail || req.body?.details || null;
    AuditLog.insert({
      accion,
      entidad,
      entidad_id: entidadId == null ? null : String(entidadId).slice(0, 160),
      user_id: auth.sub || req.body?.user_id || null,
      user_nombre: auth.nombre || auth.username || req.body?.user_nombre || null,
      detalle: detalle == null ? null : String(detalle).slice(0, 2000),
    });
    res.json({ ok: true });
  }));

  // ── ENTERPRISE CONTROL PLANE ──────────────────────────────
  app.get("/api/enterprise/health", wrap((_req: any, res: any) => {
    const health = enterpriseHealth();
    if (process.env.PUBLIC_HEALTH_DETAILED === 'true') return res.json(health);
    res.json({
      ok: health.readiness.critical === 0,
      mode: health.mode,
      readiness: {
        status: health.readiness.critical > 0 ? 'critical' : health.readiness.warning > 0 ? 'warning' : 'ok',
      },
    });
  }));

  app.get("/api/enterprise/readiness", managerOnly, wrap(async (_req: any, res: any) => {
    res.json(await getEnterpriseReadiness());
  }));

  app.post("/api/enterprise/events", managerOnly, wrap((req: any, res: any) => {
    res.json(recordEvent(req.body.event, req.body.payload || {}, (req as any).auth));
  }));

  app.get("/api/enterprise/metrics", managerOnly, wrap((req: any, res: any) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 1000);
    res.json(Metrics.getRecent(limit));
  }));

  app.post("/api/enterprise/metrics", managerOnly, wrap((req: any, res: any) => {
    recordMetric(req.body.name, Number(req.body.value ?? 1), req.body.tags || {});
    res.json({ ok: true });
  }));

  app.get("/api/inventory", opsOnly, wrap((_req: any, res: any) => res.json(InventoryItems.getAll())));

  app.post("/api/inventory", managerOnly, wrap((req: any, res: any) => {
    const allowedTypes = new Set(['modem', 'sim', 'uniforme', 'herramienta', 'otro']);
    const allowedStates = new Set(['disponible', 'asignado', 'danado', 'baja']);
    const data = {
      id: randomUUID(),
      sku: null,
      serial: null,
      estado: 'disponible',
      assigned_to: null,
      sale_id: null,
      notes: null,
      ...req.body,
    };
    if (!data.nombre || !data.tipo) return res.status(400).json({ error: 'nombre y tipo son requeridos' });
    if (!allowedTypes.has(data.tipo)) return res.status(400).json({ error: 'tipo de activo invalido' });
    if (!allowedStates.has(data.estado)) return res.status(400).json({ error: 'estado de activo invalido' });
    InventoryItems.create(data);
    AuditLog.insert({ accion: 'CREATE_INVENTORY_ITEM', entidad: 'inventory_items', entidad_id: data.id, user_id: (req as any).auth?.sub || null, user_nombre: null, detalle: data.nombre });
    recordEvent('inventory.created', data, (req as any).auth);
    res.json(InventoryItems.getById(data.id));
  }));

  app.patch("/api/inventory/:id", managerOnly, wrap((req: any, res: any) => {
    const allowedTypes = new Set(['modem', 'sim', 'uniforme', 'herramienta', 'otro']);
    const allowedStates = new Set(['disponible', 'asignado', 'danado', 'baja']);
    if (req.body.tipo && !allowedTypes.has(req.body.tipo)) return res.status(400).json({ error: 'tipo de activo invalido' });
    if (req.body.estado && !allowedStates.has(req.body.estado)) return res.status(400).json({ error: 'estado de activo invalido' });
    InventoryItems.update(req.params.id, req.body);
    AuditLog.insert({ accion: 'UPDATE_INVENTORY_ITEM', entidad: 'inventory_items', entidad_id: req.params.id, user_id: (req as any).auth?.sub || null, user_nombre: null, detalle: req.body.estado || null });
    recordEvent('inventory.updated', { id: req.params.id, ...req.body }, (req as any).auth);
    res.json(InventoryItems.getById(req.params.id));
  }));

  app.delete("/api/inventory/:id", managerOnly, wrap((req: any, res: any) => {
    InventoryItems.delete(req.params.id);
    AuditLog.insert({ accion: 'DELETE_INVENTORY_ITEM', entidad: 'inventory_items', entidad_id: req.params.id, user_id: req.auth?.sub || null, user_nombre: null, detalle: null });
    recordEvent('inventory.deleted', { id: req.params.id }, req.auth);
    res.json({ ok: true });
  }));

  app.get("/api/automation/rules", managerOnly, wrap((_req: any, res: any) => {
    res.json(AutomationRules.getAll());
  }));

  app.post("/api/automation/rules", requireRole('GERENTE'), wrap((req: any, res: any) => {
    const data = {
      id: randomUUID(),
      name: req.body.name,
      event: req.body.event,
      conditions: JSON.stringify(req.body.conditions || {}),
      actions: JSON.stringify(req.body.actions || []),
      enabled: req.body.enabled === false ? 0 : 1,
    };
    if (!data.name || !data.event) return res.status(400).json({ error: 'name y event son requeridos' });
    AutomationRules.create(data);
    AuditLog.insert({ accion: 'CREATE_AUTOMATION_RULE', entidad: 'automation_rules', entidad_id: data.id, user_id: (req as any).auth?.sub || null, user_nombre: null, detalle: data.name });
    res.json({ ...data, conditions: JSON.parse(data.conditions), actions: JSON.parse(data.actions) });
  }));

  app.patch("/api/automation/rules/:id", requireRole('GERENTE'), wrap((req: any, res: any) => {
    const update = { ...req.body };
    if (update.conditions && typeof update.conditions === 'object') update.conditions = JSON.stringify(update.conditions);
    if (update.actions && typeof update.actions === 'object') update.actions = JSON.stringify(update.actions);
    AutomationRules.update(req.params.id, update);
    AuditLog.insert({ accion: 'UPDATE_AUTOMATION_RULE', entidad: 'automation_rules', entidad_id: req.params.id, user_id: (req as any).auth?.sub || null, user_nombre: null, detalle: null });
    res.json({ ok: true });
  }));

  app.delete("/api/automation/rules/:id", requireRole('GERENTE'), wrap((req: any, res: any) => {
    AutomationRules.delete(req.params.id);
    AuditLog.insert({ accion: 'DELETE_AUTOMATION_RULE', entidad: 'automation_rules', entidad_id: req.params.id, user_id: (req as any).auth?.sub || null, user_nombre: null, detalle: null });
    res.json({ ok: true });
  }));

  const enqueueTelmexAction = (action: string) => wrap(async (req: any, res: any) => {
    const job = await createTelmexAutomationJob(action, {
      ...req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    }, req.auth);
    AuditLog.insert({
      accion: 'CREATE_TELMEX_AUTOMATION_JOB',
      entidad: 'telmex_automation_jobs',
      entidad_id: job.id,
      user_id: req.auth?.sub || null,
      user_nombre: null,
      detalle: `${action}: ${job.folio || job.sale_id || 'sin folio'}`,
    });
    res.json(job);
  });

  app.get("/api/telmex/jobs", managerOnly, wrap((_req: any, res: any) => {
    res.json(listTelmexJobs());
  }));

  app.get("/api/telmex/status/:id", authOnly, wrap((req: any, res: any) => {
    const job = getTelmexJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'trabajo Telmex no encontrado' });
    res.json(job);
  }));

  app.patch("/api/telmex/status/:id", managerOnly, wrap((req: any, res: any) => {
    const job = updateTelmexAutomationJob(req.params.id, req.body || {}, req.auth);
    if (!job) return res.status(404).json({ error: 'trabajo Telmex no encontrado' });
    res.json(job);
  }));

  app.post("/api/telmex/login", requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'VENDEDOR', 'ASESOR'), enqueueTelmexAction('login'));
  app.post("/api/telmex/coverage", requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'VENDEDOR', 'ASESOR'), enqueueTelmexAction('coverage'));
  app.post("/api/telmex/create-order", requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'VENDEDOR', 'ASESOR'), enqueueTelmexAction('create-order'));
  app.post("/api/telmex/send-otp", requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'VENDEDOR', 'ASESOR'), enqueueTelmexAction('send-otp'));
  app.post("/api/telmex/confirm-otp", requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'VENDEDOR', 'ASESOR'), enqueueTelmexAction('confirm-otp'));
  app.get("/telmex/status/:id", authOnly, wrap((req: any, res: any) => {
    const job = getTelmexJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'trabajo Telmex no encontrado' });
    res.json(job);
  }));
  app.post("/telmex/login", requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'VENDEDOR', 'ASESOR'), enqueueTelmexAction('login'));
  app.post("/telmex/coverage", requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'VENDEDOR', 'ASESOR'), enqueueTelmexAction('coverage'));
  app.post("/telmex/create-order", requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'VENDEDOR', 'ASESOR'), enqueueTelmexAction('create-order'));
  app.post("/telmex/send-otp", requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'VENDEDOR', 'ASESOR'), enqueueTelmexAction('send-otp'));
  app.post("/telmex/confirm-otp", requireRole('GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'VENDEDOR', 'ASESOR'), enqueueTelmexAction('confirm-otp'));

  app.post("/api/ai/run", managerOnly, wrap(async (req: any, res: any) => {
    if (!req.body.prompt) return res.status(400).json({ error: 'prompt requerido' });
    res.json(await runAiWithFallback(req.body.prompt));
  }));

  app.post("/api/ai/morosity/classify", authOnly, wrap(async (req: any, res: any) => {
    if (!req.body.text) return res.status(400).json({ error: 'text requerido' });
    res.json(await classifyMorosityReply(req.body.text));
  }));

  app.get("/api/ai/jobs", managerOnly, wrap((_req: any, res: any) => {
    res.json(AiJobs.getAll());
  }));

  app.post("/api/ai/jobs", managerOnly, wrap((req: any, res: any) => {
    res.json(enqueueAiJob(req.body.type || 'generic', req.body.payload || {}, Number(req.body.priority ?? 5)));
  }));

  app.post("/api/ai/jobs/process-next", managerOnly, wrap(async (_req: any, res: any) => {
    res.json(await processNextAiJob() || { ok: true, idle: true });
  }));

  // ── MIGRACIÓN DESDE LOCALSTORAGE ──────────────────────────
  // El frontend puede enviar su localStorage para persistirlo
  app.post("/api/migrate", managerOnly, wrap((req: any, res: any) => {
    requireHighImpactConfirmation(req, 'MIGRATE_LOCALSTORAGE', 'migration');
    const backupPath = backupDatabaseBefore('migrate-localstorage');
    const { key, data } = req.body as { key: string; data: any[] };
    const results: Record<string, number> = {};

    if (key === 'adhdreams_users' && Array.isArray(data)) {
      let count = 0;
      for (const u of data) {
        try {
          const existing = Users.getByUsername(u.username || u.email);
          if (!existing) {
            Users.create({
              uid: u.uid || randomUUID(), nombre: u.nombre || u.displayName || u.name,
              email: u.email || `${u.username}@app.local`, username: u.username || u.email,
              role: u.role || 'ASESOR', password: u.password || 'temporal123',
              zona: u.zona || null, puesto: u.puesto || null, activo: u.activo ?? 1,
            });
            count++;
          }
        } catch {}
      }
      results.users = count;
    }

    if (key === 'adhdreams_sales' && Array.isArray(data)) {
      let count = 0;
      for (const s of data) {
        try {
          if (!Ventas.getById(s.id)) {
            Ventas.create({
              id: s.id || randomUUID(), folio: s.folio || null,
              asesor_id: s.asesorId || s.asesor_id || 'uid_edgar',
              asesor_nombre: s.asesorNombre || s.asesor_nombre || null,
              status: s.status || s.estatus || 'pendiente',
              nombres: s.nombres || s.clienteNombre || null,
              apellidos: s.apellidos || null, telefono: s.telefono || null,
              direccion: s.direccion || null, colonia: s.colonia || null,
              municipio: s.municipio || null, tipo_cliente: s.tipoCliente || null,
              tipo_servicio: s.tipoServicio || null, plan: s.plan || null,
              renta_mensual: s.rentaMensual || null, zona: s.zona || null,
              notas: s.notas || null,
              fecha_solicitud: s.fechaSolicitud || s.fecha_solicitud || null,
              metadata: JSON.stringify(s),
            });
            count++;
          }
        } catch {}
      }
      results.ventas = count;
    }

    authAudit(req, 'MIGRATE_LOCALSTORAGE', 'migration', `key:${key};backup:${backupPath || 'none'};results:${JSON.stringify(results)}`);
    res.json({ ok: true, migrated: results });
  }));

  // ── WHATSAPP ───────────────────────────────────────────────
  function whatsappAccountFromReq(req: any) {
    return normalizeWhatsAppAccount(req.params?.account || req.query?.account || req.body?.account);
  }

  function whatsappAccountFromRow(row: any) {
    const metadata = parseMetadata(row?.metadata);
    const key = String(metadata.key || '').toLowerCase();
    const audience = String(metadata.audience || '').toLowerCase();
    const account = String(metadata.account || '').toLowerCase();
    const label = String(row?.label || '').toLowerCase();
    const externalId = String(row?.external_id || row?.externalId || row?.id || '').toLowerCase();
    const fingerprint = `${account} ${key} ${audience} ${label} ${externalId}`;
    if (/(cliente|clientes|whatsappclientes|gestion de clientes|gestión de clientes)/i.test(fingerprint)) {
      return normalizeWhatsAppAccount('clientes');
    }
    if (/(promotor|promotores|vendedor|vendedores|whatsappvendedores|heavenly-dreams-main|heavenly-dreams-promotores)/i.test(fingerprint)) {
      return normalizeWhatsAppAccount('promotores');
    }
    return normalizeWhatsAppAccount(metadata.account || 'promotores');
  }

  function withLiveChannelAccountStatus(row: any) {
    if (row?.channel !== 'whatsapp') return row;
    const account = whatsappAccountFromRow(row);
    const live = getWhatsAppStatus(account) as any;
    const metadata = parseMetadata(row.metadata);
    return {
      ...row,
      status: live.status || row.status,
      metadata: JSON.stringify({
        ...metadata,
        account,
        liveStatus: live.status || row.status,
        credentialsPresent: live.credentialsPresent === true,
        engine: live.engine || metadata.engine,
        error: live.error || null,
      }),
    };
  }

  const safeWhatsAppStatus = (status: any, role?: string) => {
    if (role === 'GERENTE' || role === 'ADMINISTRACION' || role === 'SUPERUSER' || role === 'ADMIN') return status;
    if (status?.promotores || status?.clientes) {
      return Object.fromEntries(Object.entries(status).map(([key, value]: any) => {
        const { sessionPath: _sessionPath, ...safe } = value || {};
        return [key, safe];
      }));
    }
    const { sessionPath: _sessionPath, ...safeStatus } = status as any;
    return safeStatus;
  };

  app.get("/api/whatsapp/status", chatUserOnly, (req: any, res) => {
    const account = req.query?.account ? whatsappAccountFromReq(req) : undefined;
    res.json(safeWhatsAppStatus(getWhatsAppStatus(account), req.auth?.role));
  });
  app.get("/api/whatsapp/qr", managerOnly, (req: any, res) => {
    const account = whatsappAccountFromReq(req);
    res.json({ account, qr: getWhatsAppQR(account), status: getWhatsAppStatus(account) });
  });

  app.post("/api/whatsapp/init", managerOnly, wrap(async (req: any, res: any) => {
    const account = whatsappAccountFromReq(req);
    await initWhatsApp(account); res.json({ ok: true, account });
  }));

  app.post("/api/whatsapp/send", chatUserOnly, wrap(async (req: any, res: any) => {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });
    res.json(await sendWhatsAppMessage(phone, message, whatsappAccountFromReq(req)));
  }));

  app.post("/api/whatsapp/logout", managerOnly, wrap(async (req: any, res: any) => {
    const account = whatsappAccountFromReq(req);
    await logoutWhatsApp(account); res.json({ ok: true, account });
  }));

  // Mensajes recibidos (para panel admin/gerente)
  app.get("/api/whatsapp/messages", chatUserOnly, wrap((req: any, res: any) => {
    const limit = parseLimit(req.query.limit, 100, 500);
    res.json(getRecentChannelMessages(limit, queryString(req.query.updatedSince)).filter((msg: any) => msg.channel === 'whatsapp'));
  }));

  // ── WHATSAPP CLOUD API (Meta Business Platform) ───────────
  // Verificación del webhook (Meta hace GET para confirmar la URL)
  app.get("/api/whatsapp/cloud/webhook", (req: any, res) => {
    const result = handleWebhookVerification(req.query as Record<string, any>);
    res.status(result.status).send(result.body);
  });

  // Recepción de mensajes entrantes desde Meta
  app.post("/api/whatsapp/cloud/webhook", express.raw({ type: 'application/json' }), wrap(async (req: any, res: any) => {
    try {
      const signature = String(req.headers['x-hub-signature-256'] ?? '');
      await handleWebhookPayload(req.body as Buffer, signature);
      res.status(200).json({ status: 'ok' });
    } catch (err: any) {
      console.error('[WA-Cloud] Error procesando webhook:', err?.message);
      res.status(400).json({ error: err?.message });
    }
  }));

  // Estado de la integración Cloud
  app.get("/api/whatsapp/cloud/status", chatUserOnly, (_req: any, res: any) => {
    res.json({ configured: isCloudConfigured(), provider: 'meta_cloud' });
  });

  // Enviar mensaje de texto vía Cloud API
  app.post("/api/whatsapp/cloud/send", chatUserOnly, wrap(async (req: any, res: any) => {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });
    const result = await sendCloudMessage({ to: phone, text: message });
    if (!result.ok) return res.status(502).json({ error: result.error });
    res.json({ ok: true, messageId: result.messageId });
  }));

  // ── RECLUTAMIENTO ─────────────────────────────────────────
  {
    const { Candidates } = await import('./server/db/recruitment');
    const {
      PLANTILLAS, VACANTES, listarVacantesActivas, renderPlantilla, resumenVacante,
    } = await import('./server/recruitment-templates');

    const recruiterOnly = (req: any, res: any, next: any) => {
      const role = req.auth?.role;
      if (!['GERENTE','ADMINISTRACION','RECLUTADOR'].includes(role)) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }
      next();
    };

    // Vacantes públicas (sin auth)
    app.get('/api/recruitment/vacantes', (_req, res) => {
      res.json(listarVacantesActivas().map(v => ({
        slug: v.slug, titulo: v.titulo, descripcion: v.descripcion,
        requisitos: v.requisitos, ofrecemos: v.ofrecemos,
        comision_detalle: v.comision_detalle, horario: v.horario, modalidad: v.modalidad,
      })));
    });

    // Detalle de vacante
    app.get('/api/recruitment/vacantes/:slug', (req: any, res) => {
      const v = VACANTES[req.params.slug as keyof typeof VACANTES];
      if (!v) return res.status(404).json({ error: 'Vacante no encontrada' });
      res.json(v);
    });

    // Listado de plantillas
    app.get('/api/recruitment/plantillas', recruiterOnly, (_req, res) => {
      res.json(PLANTILLAS.map(p => ({
        id: p.id, nombre: p.nombre, etapa: p.etapa,
        descripcion: p.descripcion, variables_requeridas: p.variables_requeridas,
      })));
    });

    // Render de plantilla con variables
    app.post('/api/recruitment/plantillas/:id/render', recruiterOnly, wrap(async (req: any, res: any) => {
      const rendered = renderPlantilla(req.params.id, req.body);
      if (!rendered) return res.status(404).json({ error: 'Plantilla no encontrada' });
      res.json({ ok: true, mensaje: rendered });
    }));

    // Crear candidato
    app.post('/api/recruitment/candidates', recruiterOnly, wrap(async (req: any, res: any) => {
      const { nombre, telefono } = req.body;
      if (!nombre || !telefono) return res.status(400).json({ error: 'nombre y telefono son requeridos' });
      const existente = Candidates.getByPhone(telefono);
      if (existente) return res.status(409).json({ error: 'Ya existe un candidato con ese teléfono', candidato: existente });
      const cand = Candidates.create({ ...req.body, reclutador_id: req.auth?.uid, reclutador_nombre: req.auth?.nombre });
      logSystem(req, 'RECRUIT_CANDIDATE_CREATE', 'recruitment_candidates', cand.id, cand.nombre);
      res.status(201).json(cand);
    }));

    // Listar candidatos
    app.get('/api/recruitment/candidates', recruiterOnly, wrap(async (req: any, res: any) => {
      const { status, vacante, limit, offset } = req.query;
      const reclutador_id = req.auth?.role === 'RECLUTADOR' ? req.auth?.uid : (req.query.reclutador_id ?? undefined);
      const candidates = Candidates.list({
        status: status as any, vacante: vacante as any,
        reclutador_id, limit: Number(limit) || 100, offset: Number(offset) || 0,
      });
      const total = Candidates.count({ status: status as any, vacante: vacante as any });
      res.json({ candidates, total });
    }));

    // Detalle de candidato
    app.get('/api/recruitment/candidates/:id', recruiterOnly, wrap(async (req: any, res: any) => {
      const cand = Candidates.getById(req.params.id);
      if (!cand) return res.status(404).json({ error: 'Candidato no encontrado' });
      res.json(cand);
    }));

    // Actualizar status
    app.patch('/api/recruitment/candidates/:id/status', recruiterOnly, wrap(async (req: any, res: any) => {
      const { status, motivo_rechazo, detalle } = req.body;
      if (!status) return res.status(400).json({ error: 'status requerido' });
      const cand = Candidates.updateStatus(req.params.id, status, {
        autor: req.auth?.nombre, detalle, motivo_rechazo,
      });
      if (!cand) return res.status(404).json({ error: 'Candidato no encontrado' });
      logSystem(req, 'RECRUIT_STATUS_CHANGE', 'recruitment_candidates', cand.id, `${cand.nombre} → ${status}`);
      res.json(cand);
    }));

    // Agendar entrevista
    app.patch('/api/recruitment/candidates/:id/entrevista', recruiterOnly, wrap(async (req: any, res: any) => {
      const { fecha, hora, tipo } = req.body;
      if (!fecha || !hora) return res.status(400).json({ error: 'fecha y hora son requeridas' });
      const cand = Candidates.scheduleInterview(req.params.id, fecha, hora, tipo, req.auth?.nombre);
      if (!cand) return res.status(404).json({ error: 'Candidato no encontrado' });
      res.json(cand);
    }));

    // Agregar nota
    app.post('/api/recruitment/candidates/:id/notas', recruiterOnly, wrap(async (req: any, res: any) => {
      const { nota } = req.body;
      if (!nota) return res.status(400).json({ error: 'nota requerida' });
      const cand = Candidates.addNote(req.params.id, nota, req.auth?.nombre);
      if (!cand) return res.status(404).json({ error: 'Candidato no encontrado' });
      res.json(cand);
    }));

    // Entrevistas de hoy
    app.get('/api/recruitment/entrevistas/hoy', recruiterOnly, (_req, res) => {
      res.json(Candidates.getEntrevistasHoy());
    });

    // Candidatos con seguimiento pendiente
    app.get('/api/recruitment/seguimiento/pendiente', recruiterOnly, (req: any, res) => {
      const dias = Number(req.query.dias) || 3;
      res.json(Candidates.getSeguimientoPendiente(dias));
    });

    // Funnel / estadísticas
    app.get('/api/recruitment/stats/funnel', recruiterOnly, (_req, res) => {
      res.json(Candidates.getFunnelStats());
    });

    // Resumen de vacantes (texto WhatsApp-friendly)
    app.get('/api/recruitment/vacantes/resumen/texto', (_req, res) => {
      const texto = listarVacantesActivas().map(resumenVacante).join('\n\n─────────────\n\n');
      res.type('text/plain').send(texto);
    });
  }

  // ── TELEGRAM ──────────────────────────────────────────────
  app.get("/api/telegram/status", chatUserOnly, wrap((_req: any, res: any) => {
    res.json(getTelegramStatus());
  }));

  app.get("/api/telegram/messages", chatUserOnly, wrap((req: any, res: any) => {
    const limit = parseLimit(req.query.limit, 100, 500);
    res.json(getRecentChannelMessages(limit, queryString(req.query.updatedSince)).filter((msg: any) => msg.channel === 'telegram'));
  }));

  app.post("/api/telegram/init", managerOnly, wrap(async (req: any, res: any) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token requerido' });
    const result = await initTelegram(token);
    if (result.ok) {
      saveSecret({
        provider: 'telegram',
        label: 'Telegram Bot',
        keyName: 'TELEGRAM_BOT_TOKEN',
        value: token,
        status: 'active',
        metadata: { botName: result.botName || '' },
      }, req.auth);
      Settings.set('telegram_bot_token', '');
    }
    res.json(result);
  }));

  app.post("/api/telegram/stop", managerOnly, wrap((_req: any, res: any) => {
    stopTelegram();
    Settings.set('telegram_bot_token', '');
    res.json({ ok: true });
  }));

  app.post("/api/telegram/send", chatUserOnly, wrap(async (req: any, res: any) => {
    const { chatId, message } = req.body;
    if (!chatId || !message) return res.status(400).json({ error: 'chatId y message requeridos' });
    res.json(await sendTelegramMessage(chatId, message));
  }));

  async function sendChannelMessage(channel: string, target: string, message: string, payload?: any) {
    if (payload?.video?.storagePath) {
      const video = payload.video;
      if (channel === 'whatsapp') return sendWhatsAppVideo(target, video.storagePath, message);
      if (channel === 'telegram') return sendTelegramVideo(target, video.storagePath, message, video.mimeType || 'video/mp4');
    }
    if (channel === 'whatsapp') return sendWhatsAppMessage(target, message);
    if (channel === 'telegram') return sendTelegramMessage(target, message);
    throw new Error('Canal no soportado');
  }

  app.get("/api/channels/accounts", managerOnly, wrap((_req: any, res: any) => {
    res.json((getChannelAccounts() as any[]).map(withLiveChannelAccountStatus));
  }));

  app.post("/api/channels/accounts", managerOnly, wrap((req: any, res: any) => {
    const channel = String(req.body?.channel || '').trim();
    const externalId = String(req.body?.externalId || req.body?.external_id || '').trim();
    const label = String(req.body?.label || channel || 'canal').trim();
    const status = String(req.body?.status || 'connected').trim();
    if (!['whatsapp', 'telegram'].includes(channel)) return res.status(400).json({ error: 'channel invalido' });
    if (!externalId) return res.status(400).json({ error: 'externalId requerido' });
    upsertChannelAccount({
      channel: channel as any,
      label,
      externalId,
      status,
      metadata: req.body?.metadata || {},
    });
    AuditLog.insert({
      accion: 'UPSERT_CHANNEL_ACCOUNT',
      entidad: 'channel_accounts',
      entidad_id: `${channel}:${externalId}`,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.username || null,
      detalle: label,
    });
    res.json({ ok: true });
  }));

  app.get("/api/channels/conversations", chatUserOnly, wrap((req: any, res: any) => {
    res.json(getChannelConversations(parseLimit(req.query.limit, 200, 500)));
  }));

  app.get("/api/channels/conversations/:id/messages", chatUserOnly, wrap((req: any, res: any) => {
    res.json(getChannelMessages(req.params.id, parseLimit(req.query.limit, 200, 500), queryString(req.query.updatedSince)));
  }));

  app.get("/api/channels/conversations/:id/automation", chatUserOnly, wrap((req: any, res: any) => {
    const data = getConversationAutomation(req.params.id);
    if (!data.conversation) return res.status(404).json({ error: 'Conversacion no encontrada' });
    res.json(data);
  }));

  app.patch("/api/agents/conversations/:id/assign", chatUserOnly, wrap((req: any, res: any) => {
    const updated = assignConversation(req.params.id, req.body.assignedTo || req.body.assigned_to || null);
    if (!updated) return res.status(404).json({ error: 'Conversacion no encontrada' });
    res.json(updated);
  }));

  app.post("/api/agents/conversations/:id/run", chatUserOnly, wrap(async (req: any, res: any) => {
    res.json(await runAgentForConversation(req.params.id) || { ok: true, idle: true });
  }));

  app.get("/api/agents/outbox", chatUserOnly, wrap((req: any, res: any) => {
    res.json(AgentOutbox.getAll(parseLimit(req.query.limit, 200, 500)));
  }));

  app.post("/api/agents/outbox/:id/approve", adminOnly, wrap(async (req: any, res: any) => {
    res.json(await approveAgentOutbox(req.params.id, req.auth, sendChannelMessage));
  }));

  app.post("/api/agents/outbox/:id/reject", adminOnly, wrap((req: any, res: any) => {
    res.json(rejectAgentOutbox(req.params.id, req.auth, req.body?.reason));
  }));

  app.post("/api/channels/send", chatUserOnly, wrap(async (req: any, res: any) => {
    const { channel, target, message, account } = req.body;
    if (!channel || !target || !message) return res.status(400).json({ error: 'channel, target y message son requeridos' });
    if (channel === 'whatsapp') return res.json(await sendWhatsAppMessage(target, message, normalizeWhatsAppAccount(account)));
    res.json(await sendChannelMessage(channel, target, message));
  }));

  // Mensajes combinados WA + Telegram (para panel unificado)
  app.get("/api/channels/messages", chatUserOnly, wrap((req: any, res: any) => {
    res.json(getRecentChannelMessages(parseLimit(req.query.limit, 150, 500), queryString(req.query.updatedSince)));
  }));

  // ── TWILIO VOICE AGENT ───────────────────────────────────
  app.get("/api/twilio/status", managerOnly, wrap((_req: any, res: any) => {
    res.json({ configured: twilioConfigured(), from: getTwilioFromNumber() });
  }));

  app.post("/api/twilio/calls", managerOnly, wrap(async (req: any, res: any) => {
    const to = normalizePhone10(req.body?.to || req.body?.phone);
    if (to.length !== 10) return res.status(400).json({ error: 'Telefono destino debe tener 10 digitos' });
    const message = String(req.body?.message || 'Hola, te llamamos de Heavenly Dreams para validar tu solicitud.').slice(0, 900);
    const result = await createTwilioCall(`+52${to}`, message);
    logSystem(req, 'TWILIO_CALL_CREATED', 'twilio', result.sid || to, `to:${to}`, { sid: result.sid, status: result.status });
    recordMetric('twilio.call.created', 1, { status: result.status || 'created' });
    res.json({ ok: true, sid: result.sid, status: result.status, to });
  }));

  app.get("/api/twilio/voice-agent", wrap((req: any, res: any) => {
    if (!requireTrustedVoiceWebhook(req, res)) return;
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.send(buildValidationTwiML(String(req.query.message || '')));
  }));

  app.post("/api/voice-providers/openai-realtime/twiml", wrap((req: any, res: any) => {
    if (!requireTrustedVoiceWebhook(req, res)) return;
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.send(buildOpenAIRealtimeTwiML(String(req.query.validationId || req.body?.validationId || ''), String(req.query.message || req.body?.message || '')));
  }));

  app.get("/api/voice-providers/openai-realtime/twiml", wrap((req: any, res: any) => {
    if (!requireTrustedVoiceWebhook(req, res)) return;
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.send(buildOpenAIRealtimeTwiML(String(req.query.validationId || ''), String(req.query.message || '')));
  }));

  // ── AGENTES AUTÓNOMOS ─────────────────────────────────────
  // Estado de agentes en memoria
  const agentState: Record<string, { active: boolean; lastRun: string | null; processed: number; errors: number }> = {
    capturista:  { active: false, lastRun: null, processed: 0, errors: 0 },
    archivero:   { active: false, lastRun: null, processed: 0, errors: 0 },
    consultor:   { active: false, lastRun: null, processed: 0, errors: 0 },
    telmex:      { active: false, lastRun: null, processed: 0, errors: 0 },
    validador:   { active: false, lastRun: null, processed: 0, errors: 0 },
    promotores:  { active: false, lastRun: null, processed: 0, errors: 0 },
    clientes:    { active: false, lastRun: null, processed: 0, errors: 0 },
    cobranza:    { active: false, lastRun: null, processed: 0, errors: 0 },
    seguimiento: { active: false, lastRun: null, processed: 0, errors: 0 },
    calidad:     { active: false, lastRun: null, processed: 0, errors: 0 },
  };

  const agentTimers: Record<string, ReturnType<typeof setInterval> | null> = {
    capturista: null, archivero: null, consultor: null, telmex: null, validador: null, promotores: null, clientes: null, cobranza: null, seguimiento: null, calidad: null,
  };

  const AGENT_STATE_SETTINGS_KEY = 'agent_runtime_state_v1';

  function persistAgentState() {
    const snapshot = Object.fromEntries(Object.entries(agentState).map(([key, state]) => [
      key,
      { active: state.active, lastRun: state.lastRun, processed: state.processed, errors: state.errors },
    ]));
    Settings.set(AGENT_STATE_SETTINGS_KEY, snapshot);
  }

  const savedAgentState = Settings.get(AGENT_STATE_SETTINGS_KEY) || {};
  for (const [key, saved] of Object.entries(savedAgentState as Record<string, any>)) {
    if (!agentState[key] || !saved) continue;
    agentState[key] = {
      ...agentState[key],
      active: Boolean(saved.active),
      lastRun: saved.lastRun || null,
      processed: Number(saved.processed || 0),
      errors: Number(saved.errors || 0),
    };
  }
  if (process.env.AGENT_AUTO_START !== 'false') {
    for (const key of Object.keys(agentState)) {
      agentState[key].active = true;
    }
    persistAgentState();
  }

  // ── Helpers compartidos por agentes ──────────────────────
  const extractField = (text: string, key: string) => {
    const re = new RegExp(`${key}[:\\s]+([^\\n,]+)`, 'i');
    return text.match(re)?.[1]?.trim() || null;
  };

  type AnyChannelMsg = { id: string; from: string; fromName: string; body: string; timestamp: number; channel: string; chatId?: number; account?: string };

  async function replyToMsg(msg: AnyChannelMsg, text: string) {
    try {
      if (msg.channel === 'whatsapp') {
        await sendWhatsAppMessage(msg.from, text, normalizeWhatsAppAccount(msg.account));
      } else if (msg.channel === 'telegram' && (msg as TgMessage).chatId) {
        await sendTelegramMessage((msg as TgMessage).chatId, text);
      }
    } catch { /* canal no disponible */ }
  }

  async function handleAssistantChannelMessage(msg: AnyChannelMsg) {
    if (agentState.capturista.active) {
      const body = msg.body.toLowerCase();
      if (body.includes('nombre:') && (body.includes('telefono:') || body.includes('tel:'))) {
        const nombres = extractField(msg.body, 'nombre');
        const telefono = extractField(msg.body, 'tel(?:efono)?');
        const plan = extractField(msg.body, 'plan');
        const direccion = extractField(msg.body, 'direcci[oó]n|domicilio');
        if (nombres && telefono) {
          try {
            Ventas.create({
              id: randomUUID(), folio: null,
              asesor_id: `agente_${msg.channel}`,
              asesor_nombre: msg.fromName, status: 'pendiente',
              nombres, apellidos: null, telefono, direccion, colonia: null, municipio: null,
              tipo_cliente: null, tipo_servicio: null, plan, renta_mensual: null, zona: null,
              notas: `Capturado por Agente vía ${msg.channel}: ${msg.from}`,
              fecha_solicitud: new Date().toISOString().split('T')[0],
              fecha_instalacion: null, contrato_pdf: null, ine_pdf: null, comprobante_pdf: null,
              metadata: JSON.stringify({ source: msg.channel, raw: msg.body }),
            });
            await replyToMsg(msg, `Venta registrada para ${nombres}. El equipo la procesará pronto.`);
            agentState.capturista.processed++;
            agentState.capturista.lastRun = new Date().toISOString();
          } catch { agentState.capturista.errors++; }
        }
        return;
      }
    }

    if (agentState.consultor.active) {
      const body = msg.body.toLowerCase().trim();
      const isQuery = body.startsWith('folio ') || body.startsWith('consulta ')
        || body.startsWith('estatus ') || body.includes('mi folio');
      if (!isQuery) return;

      const folioMatch = msg.body.match(/\b([A-Z0-9]{5,}|\d{5,})\b/i);
      if (folioMatch) {
        const record = SiacRecords.getByFolio(folioMatch[1]) as any;
        const reply = record
          ? formatSiacFolioReply(record)
          : `Folio ${folioMatch[1]} no encontrado. ¿Deseas que un asesor te contacte?`;
        try {
          await replyToMsg(msg, reply);
          agentState.consultor.processed++;
          agentState.consultor.lastRun = new Date().toISOString();
        } catch { agentState.consultor.errors++; }
      } else {
        await replyToMsg(msg, 'Envía el número de folio para consultar. Ej: folio 123456');
      }
    }
  }

  // Agente Capturista: detecta ventas en WA + Telegram
  async function runCapturistaAgent() {
    const conversations = getChannelConversations(80).filter((conversation: any) => conversation.intent === 'venta' || conversation.status === 'nuevo');
    for (const conversation of conversations) {
      try {
        const result: any = await runAgentForConversation(conversation.id);
        if (result && !result.duplicate && !result.idle) {
          await autoSendAriuxReplies(result);
          agentState.capturista.processed++;
        }
      } catch (err: any) {
        agentState.capturista.errors++;
        console.warn('[ARIUX] Capturista no pudo procesar conversacion:', err?.message || err);
      }
    }
    agentState.capturista.lastRun = new Date().toISOString();
  }

  // Agente Consultor: responde consultas de folio SIAC en WA + Telegram
  async function runConsultorAgent() {
    const conversations = getChannelConversations(80).filter((conversation: any) => conversation.intent === 'consulta_folio');
    for (const conversation of conversations) {
      try {
        const result: any = await runAgentForConversation(conversation.id);
        if (result && !result.duplicate && !result.idle) {
          await autoSendAriuxReplies(result);
          agentState.consultor.processed++;
        }
      } catch (err: any) {
        agentState.consultor.errors++;
        console.warn('[ARIUX] Consultor no pudo procesar conversacion:', err?.message || err);
      }
    }
    agentState.consultor.lastRun = new Date().toISOString();
  }

  // Agente Telmex: consulta paquetes, promociones y contacto desde fuente oficial Telmex Hogar.
  async function runTelmexAgent() {
    const conversations = getChannelConversations(80).filter((conversation: any) => (
      conversation.intent === 'busqueda_web' || shouldUseTelmexInfo(conversation.last_body || '')
    ));
    for (const conversation of conversations) {
      try {
        const result: any = await runAgentForConversation(conversation.id);
        if (result && !result.duplicate && !result.idle) {
          await autoSendAriuxReplies(result);
          agentState.telmex.processed++;
        }
      } catch (err: any) {
        agentState.telmex.errors++;
        console.warn('[ARIUX] Agente Telmex no pudo procesar conversacion:', err?.message || err);
      }
    }
    agentState.telmex.lastRun = new Date().toISOString();
  }

  function systemAgentConversation(agent: string, label: string) {
    return ChannelConversations.upsert({
      channel: 'system',
      external_chat_id: `agent:${agent}`,
      display_name: label,
      status: 'open',
      intent: 'agent_review',
      confidence: 1,
      memory: { agent, system: true },
      last_message_at: Date.now(),
    }) as any;
  }

  function hasAgentProposal(action: string, entityId: string) {
    return Boolean((db as any).prepare(`
      SELECT id FROM agent_outbox
      WHERE action=@action
        AND payload LIKE @needle
        AND status IN ('pending_approval','approved')
      LIMIT 1
    `).get({ action, needle: `%"entityId":"${String(entityId).replace(/"/g, '')}"%` }));
  }

  function createAgentProposal(agent: string, label: string, input: {
    action: string;
    entity: string;
    entityId: string;
    title: string;
    message: string;
    priority?: 'baja' | 'media' | 'alta';
    payload?: Record<string, any>;
    taskType?: string;
    dueAt?: string | null;
  }) {
    if (!input.entityId || hasAgentProposal(input.action, input.entityId)) return null;
    const conversation = systemAgentConversation(agent, label);
    const payload = {
      agent,
      entity: input.entity,
      entityId: input.entityId,
      priority: input.priority || 'media',
      ...(input.payload || {}),
    };
    const outbox = AgentOutbox.create({
      conversation_id: conversation.id,
      decision_id: null,
      type: 'action',
      status: 'pending_approval',
      channel: 'app',
      target: 'gerencia',
      message: input.message,
      action: input.action,
      payload,
      result: null,
      error: null,
    });
    AgentTasks.create({
      conversation_id: conversation.id,
      type: input.taskType || input.action,
      title: input.title,
      status: 'open',
      due_at: input.dueAt || null,
      assigned_to: null,
      metadata: payload,
    });
    recordMetric(`agent.${agent}.proposal`, 1, { action: input.action, priority: input.priority || 'media' });
    return outbox;
  }

  async function runArchiveroAgent() {
    const rows = (db as any).prepare(`
      SELECT df.*, c.cliente_nombre, c.folio
      FROM document_files df
      LEFT JOIN capturas c ON c.id=df.captura_id
      WHERE UPPER(COALESCE(df.review_status, 'PENDIENTE')) IN ('PENDIENTE','RECHAZADO','OBSERVADO')
         OR COALESCE(df.manipulation_score, 0) >= 0.7
      ORDER BY COALESCE(df.manipulation_score, 0) DESC, datetime(df.created_at) DESC
      LIMIT 30
    `).all() as any[];
    let processed = 0;
    for (const row of rows) {
      const risk = Number(row.manipulation_score || 0);
      const priority = risk >= 0.7 || String(row.review_status || '').toUpperCase() === 'RECHAZADO' ? 'alta' : 'media';
      const created = createAgentProposal('archivero', 'Agente Archivero', {
        action: 'review_document',
        entity: 'document_files',
        entityId: row.id,
        title: `Revisar documento ${row.tipo_documento}`,
        priority,
        message: [
          `Documento ${row.tipo_documento} pendiente de revisión.`,
          row.cliente_nombre ? `Cliente: ${row.cliente_nombre}.` : null,
          row.folio ? `Folio/captura: ${row.folio}.` : null,
          risk ? `Score de manipulación: ${Math.round(risk * 100)}%.` : null,
          `Archivo: ${row.archivo_nombre}.`,
        ].filter(Boolean).join(' '),
        payload: { reviewStatus: row.review_status, captureId: row.captura_id, saleId: row.venta_id, manipulationScore: risk },
        taskType: 'document_review',
      });
      if (created) processed++;
    }
    agentState.archivero.processed += processed;
    agentState.archivero.lastRun = new Date().toISOString();
  }

  async function runValidadorAgent() {
    const rows = (db as any).prepare(`
      SELECT * FROM validation_requests
      WHERE UPPER(COALESCE(status, 'PENDIENTE')) IN ('PENDIENTE','PENDING','ESPERANDO_REVISION','ERROR')
      ORDER BY datetime(created_at) ASC
      LIMIT 25
    `).all() as any[];
    let processed = 0;
    for (const row of rows) {
      const created = createAgentProposal('validador', 'Agente Validador', {
        action: 'review_validation',
        entity: 'validation_requests',
        entityId: row.id,
        title: `Validar solicitud ${row.client_name || row.sale_id || row.id}`,
        priority: String(row.status || '').toUpperCase() === 'ERROR' ? 'alta' : 'media',
        message: `Validación pendiente: ${row.client_name || 'cliente sin nombre'} ${row.client_phone ? `(${row.client_phone})` : ''}. Estado actual: ${row.status || 'PENDIENTE'}. Revisar llamada, reintentar o cerrar resultado.`,
        payload: { saleId: row.sale_id, clientName: row.client_name, clientPhone: row.client_phone, status: row.status },
        taskType: 'validation_review',
      });
      if (created) processed++;
    }
    agentState.validador.processed += processed;
    agentState.validador.lastRun = new Date().toISOString();
  }

  async function runCobranzaAgent() {
    const rows = (db as any).prepare(`
      SELECT m.*, c.nombre, c.telefono, c.whatsapp, c.folio AS cliente_folio
      FROM morosidad m
      LEFT JOIN clientes_crm c ON c.id=m.cliente_id
      WHERE COALESCE(m.monto_adeudo, 0) > 0
        AND COALESCE(m.convenio, 0) = 0
        AND UPPER(COALESCE(m.status_cobranza, '')) NOT IN ('PAGADO','CERRADO','CONVENIO')
      ORDER BY COALESCE(m.dias_atraso, 0) DESC, COALESCE(m.monto_adeudo, 0) DESC
      LIMIT 30
    `).all() as any[];
    let processed = 0;
    for (const row of rows) {
      const dias = Number(row.dias_atraso || 0);
      const priority = dias >= 30 ? 'alta' : dias >= 8 ? 'media' : 'baja';
      const contact = row.whatsapp || row.telefono || 'sin contacto';
      const created = createAgentProposal('cobranza', 'Agente Cobranza', {
        action: 'collect_payment',
        entity: 'morosidad',
        entityId: row.id,
        title: `Cobranza ${row.nombre || row.folio || row.id}`,
        priority,
        message: `Cliente ${row.nombre || row.folio || 'sin nombre'} con adeudo de $${Number(row.monto_adeudo || 0).toLocaleString('es-MX')} y ${dias} días de atraso. Contacto: ${contact}. Sugerencia: revisar convenio o enviar recordatorio aprobado.`,
        payload: { folio: row.folio, clienteId: row.cliente_id, montoAdeudo: row.monto_adeudo, diasAtraso: dias, contact },
        taskType: 'collections_followup',
      });
      if (created) processed++;
    }
    agentState.cobranza.processed += processed;
    agentState.cobranza.lastRun = new Date().toISOString();
  }

  async function runSeguimientoAgent() {
    const rows = (db as any).prepare(`
      SELECT * FROM clientes_crm
      WHERE (proximo_seguimiento IS NOT NULL AND date(proximo_seguimiento) <= date('now'))
         OR UPPER(COALESCE(riesgo_cancelacion, 'BAJO')) IN ('ALTO','CRITICO')
         OR (ultimo_contacto IS NULL AND datetime(created_at) <= datetime('now', '-3 days'))
      ORDER BY
        CASE UPPER(COALESCE(riesgo_cancelacion, 'BAJO')) WHEN 'CRITICO' THEN 0 WHEN 'ALTO' THEN 1 ELSE 2 END,
        date(COALESCE(proximo_seguimiento, created_at)) ASC
      LIMIT 30
    `).all() as any[];
    let processed = 0;
    for (const row of rows) {
      const priority = /ALTO|CRITICO/i.test(String(row.riesgo_cancelacion || '')) ? 'alta' : 'media';
      const created = createAgentProposal('seguimiento', 'Agente Seguimiento CRM', {
        action: 'customer_followup',
        entity: 'clientes_crm',
        entityId: row.id,
        title: `Seguimiento a ${row.nombre || row.folio || row.id}`,
        priority,
        dueAt: row.proximo_seguimiento || null,
        message: `Seguimiento pendiente para ${row.nombre || 'cliente sin nombre'}. Riesgo: ${row.riesgo_cancelacion || 'BAJO'}. Último contacto: ${row.ultimo_contacto || 'sin registro'}. Próximo seguimiento: ${row.proximo_seguimiento || 'sin fecha'}.`,
        payload: { folio: row.folio, telefono: row.telefono, whatsapp: row.whatsapp, vendedorAsignado: row.vendedor_asignado, riesgo: row.riesgo_cancelacion },
        taskType: 'customer_followup',
      });
      if (created) processed++;
    }
    agentState.seguimiento.processed += processed;
    agentState.seguimiento.lastRun = new Date().toISOString();
  }

  async function runCalidadAgent() {
    const rows = (db as any).prepare(`
      SELECT id, folio, cliente_nombre, telefono, correo, paquete, direccion_completa, colonia, ciudad, status_captura, status_documentos, created_at
      FROM capturas
      WHERE cliente_nombre IS NULL OR telefono IS NULL OR paquete IS NULL OR direccion_completa IS NULL OR colonia IS NULL
         OR UPPER(COALESCE(status_documentos, 'PENDIENTE')) NOT IN ('VALIDADO','COMPLETO')
      ORDER BY datetime(created_at) DESC
      LIMIT 35
    `).all() as any[];
    let processed = 0;
    for (const row of rows) {
      const missing = [
        !row.cliente_nombre && 'nombre',
        !row.telefono && 'telefono',
        !row.paquete && 'paquete',
        !row.direccion_completa && 'direccion',
        !row.colonia && 'colonia',
        !/VALIDADO|COMPLETO/i.test(String(row.status_documentos || '')) && 'documentos',
      ].filter(Boolean);
      if (!missing.length) continue;
      const created = createAgentProposal('calidad', 'Agente Calidad de Captura', {
        action: 'fix_capture_quality',
        entity: 'capturas',
        entityId: row.id,
        title: `Completar captura ${row.folio || row.cliente_nombre || row.id}`,
        priority: missing.includes('telefono') || missing.includes('documentos') ? 'alta' : 'media',
        message: `Captura ${row.folio || row.id} requiere corrección antes de operación. Faltan: ${missing.join(', ')}.`,
        payload: { folio: row.folio, missing, statusCaptura: row.status_captura, statusDocumentos: row.status_documentos },
        taskType: 'capture_quality',
      });
      if (created) processed++;
    }
    agentState.calidad.processed += processed;
    agentState.calidad.lastRun = new Date().toISOString();
  }

  async function autoSendAriuxReplies(result: any) {
    const replies = (result?.outbox || []).filter((item: any) => (item?.type === 'reply' && item?.message) || item?.action === 'send_video');
    let lastApproved: any = null;
    for (const item of replies) {
      try {
        if (!isOutboxChannelReady(item)) {
          console.log(`[ARIUX] Respuesta en espera: ${item.channel} aun no esta conectado (${item.target})`);
          continue;
        }
        lastApproved = await approveAgentOutbox(item.id, { sub: 'ariux-auto', uid: 'ariux-auto', nombre: 'ARIUX', name: 'ARIUX' }, sendChannelMessage);
        console.log(`[ARIUX] Respuesta automatica enviada por ${item.channel} a ${item.target}`);
      } catch (err: any) {
        AgentOutbox.update(item.id, { status: 'failed', error: err?.message || String(err) });
        throw err;
      }
    }
    return lastApproved;
  }

  function outboxWhatsAppAccount(item: any) {
    const target = String(item?.target || '');
    const match = target.match(/^(promotores|clientes):/i);
    return normalizeWhatsAppAccount(match?.[1] || item?.payload?.account || 'promotores');
  }

  function isOutboxChannelReady(item: any) {
    if (item?.channel === 'whatsapp') {
      return (getWhatsAppStatus(outboxWhatsAppAccount(item)) as any)?.status === 'connected';
    }
    if (item?.channel === 'telegram') return getTelegramStatus().status === 'polling';
    return false;
  }

  function isRetryableOutboxFailure(item: any) {
    return item?.status === 'failed' && /no est[aá] conectado|conecta primero|not connected|disconnected/i.test(String(item?.error || ''));
  }

  async function autoSendPendingAriuxReplies() {
    const candidates = (AgentOutbox.getAll(250) as any[])
      .filter(item => (item?.type === 'reply' && item?.message) || item?.action === 'send_video')
      .filter(item => item.status === 'pending_approval' || isRetryableOutboxFailure(item))
      .filter(isOutboxChannelReady);

    const latest = new Map<string, any>();
    const duplicates: any[] = [];
    for (const item of candidates) {
      const sourceMessageId = item.payload?.sourceMessageId || item.decision_id || item.id;
      const key = `${item.channel}:${item.target}:${sourceMessageId}:${item.message}`;
      const current = latest.get(key);
      if (!current) {
        latest.set(key, item);
      } else if (String(item.created_at || '') > String(current.created_at || '')) {
        duplicates.push(current);
        latest.set(key, item);
      } else {
        duplicates.push(item);
      }
    }

    for (const duplicate of duplicates) {
      if (duplicate.status === 'pending_approval') {
        AgentOutbox.update(duplicate.id, {
          status: 'rejected',
          error: 'Duplicado automatico omitido por ARIUX.',
          rejected_by: 'ariux-auto',
          rejected_at: new Date().toISOString(),
        });
      }
    }

    for (const item of latest.values()) {
      try {
        if (isRetryableOutboxFailure(item)) {
          AgentOutbox.update(item.id, { status: 'pending_approval', error: null });
        }
        await approveAgentOutbox(item.id, { sub: 'ariux-auto', uid: 'ariux-auto', nombre: 'ARIUX', name: 'ARIUX' }, sendChannelMessage);
        console.log(`[ARIUX] Respuesta automatica pendiente enviada por ${item.channel} a ${item.target}`);
      } catch (err: any) {
        AgentOutbox.update(item.id, { status: 'failed', error: err?.message || String(err) });
        console.warn('[ARIUX] No se pudo enviar respuesta pendiente:', err?.message || err);
      }
    }
  }

  // Registrar handler durable en tiempo real para WhatsApp/Baileys y Telegram.
  setIncomingMessageHandler(async ({ conversation, message }) => {
    try {
      const result: any = await runAgentForMessage(conversation, message);
      if (!result || result.duplicate) return;
      await autoSendAriuxReplies(result);
      const intent = result.decision?.intent;
      const audience = result.decision?.extractedFields?.audience || conversation.memory?.audience || (String(conversation.external_chat_id || '').startsWith('clientes:') ? 'clientes' : 'promotores');
      if (audience === 'clientes') {
        agentState.clientes.processed++;
        agentState.clientes.lastRun = new Date().toISOString();
      } else if (intent === 'venta') {
        agentState.capturista.processed++;
        agentState.promotores.processed++;
        agentState.capturista.lastRun = new Date().toISOString();
      } else if (intent === 'consulta_folio') {
        agentState.consultor.processed++;
        agentState.promotores.processed++;
        agentState.consultor.lastRun = new Date().toISOString();
      } else if (intent === 'busqueda_web' && shouldUseTelmexInfo(result.decision?.proposedReply || message.body || '')) {
        agentState.telmex.processed++;
        agentState.telmex.lastRun = new Date().toISOString();
      } else {
        agentState.promotores.processed++;
        agentState.capturista.lastRun = new Date().toISOString();
      }
      persistAgentState();
    } catch (err: any) {
      agentState.capturista.errors++;
      persistAgentState();
      console.warn('[ARIUX] Error procesando mensaje entrante:', err?.message || err);
    }
  });

  setWhatsAppMessageHandler(null);
  setTelegramMessageHandler(() => {});

  const AGENT_RUNNERS: Record<string, () => Promise<void>> = {
    capturista: async () => { await runCapturistaAgent(); await autoSendPendingAriuxReplies(); },
    consultor: async () => { await runConsultorAgent(); await autoSendPendingAriuxReplies(); },
    telmex: async () => { await runTelmexAgent(); await autoSendPendingAriuxReplies(); },
    promotores: async () => { await runCapturistaAgent(); await runConsultorAgent(); await autoSendPendingAriuxReplies(); agentState.promotores.lastRun = new Date().toISOString(); },
    clientes: async () => { await autoSendPendingAriuxReplies(); agentState.clientes.lastRun = new Date().toISOString(); },
    archivero: runArchiveroAgent,
    validador: runValidadorAgent,
    cobranza: runCobranzaAgent,
    seguimiento: runSeguimientoAgent,
    calidad: runCalidadAgent,
  };

  async function startAgentTimer(agent: string, runImmediately = false) {
    const runner = AGENT_RUNNERS[agent];
    if (!runner) return;
    if (agentTimers[agent]) clearInterval(agentTimers[agent]!);
    if (runImmediately) await runner();
    agentTimers[agent] = setInterval(async () => {
      try {
        await runner();
        persistAgentState();
      } catch {
        if (agentState[agent]) {
          agentState[agent].errors++;
          persistAgentState();
        }
      }
    }, 30_000);
  }

  for (const [agent, state] of Object.entries(agentState)) {
    if (state.active) startAgentTimer(agent, true).catch(() => {
      agentState[agent].active = false;
      agentState[agent].errors++;
      persistAgentState();
    });
  }
  setInterval(() => {
    autoSendPendingAriuxReplies().catch((err: any) => {
      console.warn('[ARIUX] Reintento de respuestas pendientes fallo:', err?.message || err);
    });
  }, 10_000);

  app.get("/api/agents/status", chatUserOnly, wrap((_req: any, res: any) => {
    res.json(agentState);
  }));

  app.post("/api/agents/telmex/query", chatUserOnly, wrap(async (req: any, res: any) => {
    const question = String(req.body?.question || req.body?.query || '').trim();
    if (!question) return res.status(400).json({ error: 'question requerido' });
    const answer = await answerTelmexQuestion(question);
    recordMetric('agent.telmex.query', 1, { live: answer.info.live ? '1' : '0' });
    res.json(answer);
  }));

  app.get("/api/agents/videos", chatUserOnly, wrap((_req: any, res: any) => {
    res.json(listAgentVideos());
  }));

  app.post("/api/agents/videos", managerOnly, uploadLimiter, wrap(async (req: any, res: any) => {
    const body = req.body || {};
    if (!String(body.title || body.topic || '').trim()) return res.status(400).json({ error: 'titulo o tema requerido' });
    if (!body.base64 || !body.mimeType) return res.status(400).json({ error: 'video base64 y mimeType requeridos' });
    const item = await uploadAgentVideo({
      title: String(body.title || body.topic).trim(),
      topic: String(body.topic || body.title).trim(),
      keywords: body.keywords || [],
      audience: body.audience,
      fileName: body.fileName,
      mimeType: body.mimeType,
      base64: body.base64,
    });
    AuditLog.insert({
      accion: 'UPLOAD_AGENT_VIDEO',
      entidad: 'agent_videos',
      entidad_id: item.id,
      user_id: req.auth?.sub || null,
      user_nombre: req.auth?.username || null,
      detalle: item.topic,
    });
    res.json(item);
  }));

  app.delete("/api/agents/videos/:id", managerOnly, wrap(async (req: any, res: any) => {
    const ok = await deleteAgentVideo(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Video no encontrado' });
    res.json({ ok: true });
  }));

  function agentProfileIdFrom(value: any) {
    const raw = String(value || '').trim().toLowerCase();
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
    return normalized || `agent_${randomUUID().slice(0, 8)}`;
  }

  app.get("/api/agents/profiles", chatUserOnly, wrap((_req: any, res: any) => {
    res.json(AgentProfiles.getAll());
  }));

  app.post("/api/agents/profiles", managerOnly, wrap((req: any, res: any) => {
    const body = req.body || {};
    const id = agentProfileIdFrom(body.id || body.name);
    const metadata = {
      ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
      custom: true,
      enabled: body.metadata?.enabled === false ? false : true,
    };
    if (!String(body.name || '').trim()) return res.status(400).json({ error: 'name requerido' });
    AgentProfiles.upsert({
      id,
      name: String(body.name || '').trim(),
      role: String(body.role || 'Agente personalizado').trim(),
      personality: String(body.personality || '').trim(),
      selfKnowledge: String(body.selfKnowledge || body.self_knowledge || '').trim(),
      knowledgeBase: String(body.knowledgeBase || body.knowledge_base || '').trim(),
      learnedNotes: Array.isArray(body.learnedNotes || body.learned_notes) ? (body.learnedNotes || body.learned_notes) : [],
      metadata,
    });
    const profile = AgentProfiles.getById(id);
    AuditLog.insert({
      accion: 'CREATE_AGENT_PROFILE',
      entidad: 'agent_profiles',
      entidad_id: id,
      user_id: req.auth?.sub || null,
      user_nombre: null,
      detalle: profile?.name || id,
    });
    res.json(profile);
  }));

  app.get("/api/agents/profiles/:id", chatUserOnly, wrap((req: any, res: any) => {
    const profile = AgentProfiles.getById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Perfil de agente no encontrado' });
    res.json(profile);
  }));

  app.patch("/api/agents/profiles/:id", chatUserOnly, wrap((req: any, res: any) => {
    const profile = AgentProfiles.update(req.params.id, req.body || {});
    if (!profile) return res.status(404).json({ error: 'Perfil de agente no encontrado' });
    AuditLog.insert({
      accion: 'UPDATE_AGENT_PROFILE',
      entidad: 'agent_profiles',
      entidad_id: req.params.id,
      user_id: req.auth?.sub || null,
      user_nombre: null,
      detalle: profile.name,
    });
    res.json(profile);
  }));

  app.delete("/api/agents/profiles/:id", managerOnly, wrap((req: any, res: any) => {
    if (['promoter_receptionist', 'customer_support_agent'].includes(req.params.id)) return res.status(400).json({ error: 'Los agentes base no se pueden eliminar' });
    AgentProfiles.delete(req.params.id);
    AuditLog.insert({
      accion: 'DELETE_AGENT_PROFILE',
      entidad: 'agent_profiles',
      entidad_id: req.params.id,
      user_id: req.auth?.sub || null,
      user_nombre: null,
      detalle: null,
    });
    res.json({ ok: true });
  }));

  app.post("/api/agents/:agent/toggle", chatUserOnly, wrap(async (req: any, res: any) => {
    const { agent } = req.params;
    if (!agentState[agent]) return res.status(404).json({ error: 'Agente no encontrado' });
    const current = agentState[agent].active;
    if (current) {
      // Detener
      if (agentTimers[agent]) { clearInterval(agentTimers[agent]!); agentTimers[agent] = null; }
      agentState[agent].active = false;
    } else {
      // Activar
      agentState[agent].active = true;
      await startAgentTimer(agent, true);
    }
    persistAgentState();
    res.json({ agent, active: agentState[agent].active });
  }));

  app.post("/api/agents/:agent/run", chatUserOnly, wrap(async (req: any, res: any) => {
    const { agent } = req.params;
    const runner = AGENT_RUNNERS[agent];
    if (!runner) return res.status(404).json({ error: 'Agente no encontrado' });
    await runner();
    persistAgentState();
    res.json({ ok: true, state: agentState[agent] });
  }));

  function queryValue(query: any, key: string) {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  }

  function addCommonFilters(alias: string, query: any, where: string[], params: Record<string, any>) {
    const fechaDesde = queryValue(query, 'fecha_desde') || queryValue(query, 'from');
    const fechaHasta = queryValue(query, 'fecha_hasta') || queryValue(query, 'to');
    const vendedor = queryValue(query, 'vendedor') || queryValue(query, 'vendedor_id');
    const supervisor = queryValue(query, 'supervisor') || queryValue(query, 'supervisor_id');
    const colonia = queryValue(query, 'colonia');
    const ciudad = queryValue(query, 'ciudad');
    const paquete = queryValue(query, 'paquete');
    if (fechaDesde) { where.push(`date(${alias}.fecha_captura) >= date(@fechaDesde)`); params.fechaDesde = fechaDesde; }
    if (fechaHasta) { where.push(`date(${alias}.fecha_captura) <= date(@fechaHasta)`); params.fechaHasta = fechaHasta; }
    if (vendedor) {
      where.push(`(${alias}.vendedor_id = @vendedor OR u.nombre LIKE @vendedorLike OR u.username LIKE @vendedorLike)`);
      params.vendedor = vendedor;
      params.vendedorLike = `%${vendedor}%`;
    }
    if (supervisor) { where.push(`${alias}.supervisor_id = @supervisor`); params.supervisor = supervisor; }
    if (colonia) { where.push(`${alias}.colonia LIKE @colonia`); params.colonia = `%${colonia}%`; }
    if (ciudad) { where.push(`${alias}.ciudad LIKE @ciudad`); params.ciudad = `%${ciudad}%`; }
    if (paquete) { where.push(`${alias}.paquete LIKE @paquete`); params.paquete = `%${paquete}%`; }
  }

  function exportRows(dataset: string, query: any) {
    if (dataset === 'capturas') {
      const where: string[] = [];
      const params: Record<string, any> = {};
      addCommonFilters('c', query, where, params);
      const estatus = queryValue(query, 'estatus');
      const instalacion = queryValue(query, 'instalacion');
      if (estatus) {
        where.push('(c.status_captura=@estatus OR c.status_validacion=@estatus OR c.status_instalacion=@estatus OR c.status_documentos=@estatus)');
        params.estatus = estatus;
      }
      if (instalacion) { where.push('(c.status_instalacion=@instalacion OR date(c.fecha_instalacion)=date(@instalacion))'); params.instalacion = instalacion; }
      const rows: any[] = (db as any).prepare(`
        SELECT
          c.folio AS Folio,
          c.cliente_nombre AS Cliente,
          COALESCE(u.nombre, c.vendedor_id, '') AS Vendedor,
          c.telefono AS Telefono,
          c.colonia AS Colonia,
          c.ciudad AS Ciudad,
          c.paquete AS Paquete,
          COALESCE((SELECT status_documento FROM documentos_cliente d WHERE d.captura_id=c.id AND d.tipo_documento='INE_FRONTAL' LIMIT 1), 'PENDIENTE') AS INE,
          COALESCE((SELECT status_documento FROM documentos_cliente d WHERE d.captura_id=c.id AND d.tipo_documento='CONTRATO' LIMIT 1), 'PENDIENTE') AS Contrato,
          COALESCE((SELECT status_documento FROM documentos_cliente d WHERE d.captura_id=c.id AND d.tipo_documento='COMPROBANTE_DOMICILIO' LIMIT 1), 'PENDIENTE') AS Comprobante,
          c.status_captura AS StatusCaptura,
          c.status_validacion AS StatusValidacion,
          c.status_instalacion AS StatusInstalacion,
          c.status_documentos AS StatusDocumentos,
          c.fecha_captura AS FechaCaptura,
          c.fecha_instalacion AS FechaInstalacion,
          c.direccion_completa AS Direccion,
          c.latitud AS Latitud,
          c.longitud AS Longitud
        FROM capturas c
        LEFT JOIN users u ON u.uid = c.vendedor_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY c.fecha_captura DESC
      `).all(params);
      return rows.map(row => ({
        ...row,
        INE: normalizeDocumentStatus(row.INE),
        Contrato: normalizeDocumentStatus(row.Contrato),
        Comprobante: normalizeDocumentStatus(row.Comprobante),
      }));
    }

    if (dataset === 'clientes') {
      const where: string[] = [];
      const params: Record<string, any> = {};
      const fechaDesde = queryValue(query, 'fecha_desde') || queryValue(query, 'from');
      const fechaHasta = queryValue(query, 'fecha_hasta') || queryValue(query, 'to');
      const vendedor = queryValue(query, 'vendedor') || queryValue(query, 'vendedor_id');
      const estatus = queryValue(query, 'estatus');
      const colonia = queryValue(query, 'colonia');
      const ciudad = queryValue(query, 'ciudad');
      if (fechaDesde) { where.push('date(c.fecha_alta) >= date(@fechaDesde)'); params.fechaDesde = fechaDesde; }
      if (fechaHasta) { where.push('date(c.fecha_alta) <= date(@fechaHasta)'); params.fechaHasta = fechaHasta; }
      if (vendedor) {
        where.push('(c.vendedor_asignado=@vendedor OR u.nombre LIKE @vendedorLike OR u.username LIKE @vendedorLike)');
        params.vendedor = vendedor;
        params.vendedorLike = `%${vendedor}%`;
      }
      if (estatus) {
        where.push('(c.status_cliente=@estatus OR c.riesgo_cancelacion=@estatus)');
        params.estatus = estatus;
      }
      if (colonia) { where.push('c.direccion LIKE @colonia'); params.colonia = `%${colonia}%`; }
      if (ciudad) { where.push('c.direccion LIKE @ciudad'); params.ciudad = `%${ciudad}%`; }
      return (db as any).prepare(`
        SELECT
          c.folio AS Folio,
          c.nombre AS Cliente,
          c.telefono AS Telefono,
          c.whatsapp AS WhatsApp,
          c.correo AS Correo,
          c.direccion AS Direccion,
          c.fecha_alta AS FechaAlta,
          c.status_cliente AS Pipeline,
          c.ultimo_contacto AS UltimoContacto,
          c.proximo_seguimiento AS ProximoSeguimiento,
          c.nivel_satisfaccion AS Satisfaccion,
          c.riesgo_cancelacion AS RiesgoCancelacion,
          COALESCE(u.nombre, c.vendedor_asignado, '') AS Vendedor
        FROM clientes_crm c
        LEFT JOIN users u ON u.uid = c.vendedor_asignado
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY c.created_at DESC
      `).all(params);
    }

    if (dataset === 'morosidad') {
      const where: string[] = [];
      const params: Record<string, any> = {};
      const status = queryValue(query, 'estatus') || queryValue(query, 'morosidad');
      const fechaDesde = queryValue(query, 'fecha_desde') || queryValue(query, 'from');
      const fechaHasta = queryValue(query, 'fecha_hasta') || queryValue(query, 'to');
      const gestor = queryValue(query, 'vendedor') || queryValue(query, 'gestor');
      if (fechaDesde) { where.push('date(m.fecha_vencimiento) >= date(@fechaDesde)'); params.fechaDesde = fechaDesde; }
      if (fechaHasta) { where.push('date(m.fecha_vencimiento) <= date(@fechaHasta)'); params.fechaHasta = fechaHasta; }
      if (gestor) {
        where.push('(m.gestor_asignado=@gestor OR u.nombre LIKE @gestorLike OR u.username LIKE @gestorLike)');
        params.gestor = gestor;
        params.gestorLike = `%${gestor}%`;
      }
      if (status) {
        const normalizedStatus = String(status).toLowerCase();
        if (normalizedStatus === 'preventiva') where.push('m.dias_atraso BETWEEN 0 AND 7');
        else if (normalizedStatus === 'baja') where.push('m.dias_atraso BETWEEN 8 AND 30');
        else if (normalizedStatus === 'media') where.push('m.dias_atraso BETWEEN 31 AND 60');
        else if (normalizedStatus === 'alta') where.push('m.dias_atraso BETWEEN 61 AND 90');
        else if (normalizedStatus === 'critica' || normalizedStatus === 'crítica') where.push('m.dias_atraso > 90');
        else { where.push('m.status_cobranza=@status'); params.status = status; }
      }
      return (db as any).prepare(`
        SELECT
          m.folio AS Folio,
          COALESCE(c.nombre, '') AS Cliente,
          COALESCE(c.telefono, '') AS Telefono,
          COALESCE(c.whatsapp, '') AS WhatsApp,
          COALESCE(c.correo, '') AS Correo,
          COALESCE(c.direccion, '') AS Direccion,
          COALESCE(CASE WHEN json_valid(c.metadata) THEN json_extract(c.metadata, '$.paquete') END, CASE WHEN json_valid(m.metadata) THEN json_extract(m.metadata, '$.paquete') END, '') AS Paquete,
          COALESCE(CASE WHEN json_valid(c.metadata) THEN json_extract(c.metadata, '$.promotor') END, CASE WHEN json_valid(m.metadata) THEN json_extract(m.metadata, '$.promotor') END, '') AS Promotor,
          COALESCE(CASE WHEN json_valid(c.metadata) THEN json_extract(c.metadata, '$.mercado') END, CASE WHEN json_valid(m.metadata) THEN json_extract(m.metadata, '$.mercado') END, '') AS Mercado,
          COALESCE(CASE WHEN json_valid(c.metadata) THEN json_extract(c.metadata, '$.area') END, CASE WHEN json_valid(m.metadata) THEN json_extract(m.metadata, '$.area') END, '') AS Area,
          m.monto_adeudo AS MontoAdeudo,
          m.dias_atraso AS DiasAtraso,
          CASE
            WHEN m.dias_atraso <= 7 THEN 'Preventiva'
            WHEN m.dias_atraso <= 30 THEN 'Baja'
            WHEN m.dias_atraso <= 60 THEN 'Media'
            WHEN m.dias_atraso <= 90 THEN 'Alta'
            ELSE 'Critica'
          END AS NivelMorosidad,
          m.fecha_vencimiento AS FechaVencimiento,
          m.ultimo_pago AS UltimoPago,
          m.status_cobranza AS StatusCobranza,
          COALESCE(u.nombre, m.gestor_asignado, '') AS Gestor,
          CASE WHEN m.convenio=1 THEN 'SI' ELSE 'NO' END AS Convenio,
          m.observaciones AS Observaciones
        FROM morosidad m
        LEFT JOIN clientes_crm c ON c.id=m.cliente_id
        LEFT JOIN users u ON u.uid=m.gestor_asignado
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY m.dias_atraso DESC, m.created_at DESC
      `).all(params);
    }

    if (dataset === 'folios') {
      const where: string[] = [];
      const params: Record<string, any> = {};
      const q = queryValue(query, 'q');
      const estatus = queryValue(query, 'estatus');
      const instalacion = queryValue(query, 'instalacion');
      const fechaDesde = queryValue(query, 'fecha_desde') || queryValue(query, 'from');
      const fechaHasta = queryValue(query, 'fecha_hasta') || queryValue(query, 'to');
      const vendedor = queryValue(query, 'vendedor') || queryValue(query, 'vendedor_id');
      const supervisor = queryValue(query, 'supervisor') || queryValue(query, 'supervisor_id');
      const colonia = queryValue(query, 'colonia');
      const ciudad = queryValue(query, 'ciudad');
      if (q) { where.push('(e.folio LIKE @q OR c.cliente_nombre LIKE @q OR c.telefono LIKE @q)'); params.q = `%${q}%`; }
      if (estatus) { where.push('(e.status_actual=@estatus OR e.subestatus LIKE @estatusLike)'); params.estatus = estatus; params.estatusLike = `%${estatus}%`; }
      if (instalacion) { where.push('(date(c.fecha_instalacion)=date(@instalacion) OR c.status_instalacion=@instalacion)'); params.instalacion = instalacion; }
      if (fechaDesde) { where.push('date(e.fecha_movimiento) >= date(@fechaDesde)'); params.fechaDesde = fechaDesde; }
      if (fechaHasta) { where.push('date(e.fecha_movimiento) <= date(@fechaHasta)'); params.fechaHasta = fechaHasta; }
      if (vendedor) { where.push('c.vendedor_id=@vendedor'); params.vendedor = vendedor; }
      if (supervisor) { where.push('c.supervisor_id=@supervisor'); params.supervisor = supervisor; }
      if (colonia) { where.push('c.colonia LIKE @colonia'); params.colonia = `%${colonia}%`; }
      if (ciudad) { where.push('c.ciudad LIKE @ciudad'); params.ciudad = `%${ciudad}%`; }
      return (db as any).prepare(`
        SELECT
          e.folio AS Folio,
          c.cliente_nombre AS Cliente,
          c.telefono AS Telefono,
          e.status_actual AS StatusActual,
          e.subestatus AS Subestatus,
          e.area_actual AS AreaActual,
          e.tecnico_asignado AS Tecnico,
          e.avance AS Avance,
          e.documentos_faltantes AS DocumentosFaltantes,
          c.fecha_instalacion AS FechaInstalacion,
          e.observaciones AS Observaciones,
          e.fecha_movimiento AS FechaMovimiento
        FROM estatus_folios e
        LEFT JOIN capturas c ON c.id=e.captura_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY e.fecha_movimiento DESC
      `).all(params);
    }

    if (dataset === 'usuarios') {
      const where: string[] = [];
      const params: Record<string, any> = {};
      const estatus = queryValue(query, 'estatus');
      const q = queryValue(query, 'q') || queryValue(query, 'vendedor');
      if (estatus) {
        const active = ['activo', 'active', '1', 'true'].includes(String(estatus).toLowerCase()) ? 1
          : ['inactivo', 'inactive', '0', 'false'].includes(String(estatus).toLowerCase()) ? 0
            : null;
        if (active !== null) { where.push('activo=@active'); params.active = active; }
        else { where.push('role=@role'); params.role = estatus; }
      }
      if (q) { where.push('(nombre LIKE @q OR email LIKE @q OR username LIKE @q)'); params.q = `%${q}%`; }
      return (db as any).prepare(`
        SELECT
          uid AS Id,
          nombre AS Nombre,
          email AS Correo,
          username AS Usuario,
          role AS Rol,
          zona AS Zona,
          puesto AS Puesto,
          CASE WHEN activo=1 THEN 'ACTIVO' ELSE 'INACTIVO' END AS Status,
          created_at AS Creado
        FROM users
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY nombre
      `).all(params);
    }

    return null;
  }

  // ── DB STATS / EXPORT / IMPORT ────────────────────────────
  app.get("/api/db/stats", managerOnly, wrap((_req: any, res: any) => {
    const stats: Record<string, number> = {};
    for (const t of ALLOWED_TABLES) {
      try { stats[t] = (db as any).prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c; }
      catch { stats[t] = 0; }
    }
    res.json(stats);
  }));

  app.get("/api/export/:table", managerOnly, wrap((req: any, res: any) => {
    const { table } = req.params;
    const format = String(req.query.format || 'csv').toLowerCase();
    const smartRows = exportRows(table, req.query);
    if (!smartRows && !ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });

    const rows: any[] = smartRows || (db as any).prepare(`SELECT * FROM ${table}`).all();
    const date = new Date().toISOString().slice(0, 10);
    logSystem(req, 'EXPORT_DATASET', 'export', table, `format:${format};rows:${rows.length}`, { filtros: req.query });
    AuditLog.insert({ accion: 'EXPORT_TABLE', entidad: table, entidad_id: null, user_id: req.auth?.sub || null, user_nombre: null, detalle: `format:${format};rows:${rows.length}` });

    if (format === 'excel' || format === 'xls' || format === 'xlsx') {
      const excel = toExcelXml(rows.length ? rows : [emptyRowForHeaders(table)], table);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${table}_${date}.xls"`);
      return res.send(excel);
    }

    if (format === 'pdf') {
      const pdf = toSimplePdf(rows, `Heavenly Dreams CRM - ${table}`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${table}_${date}.pdf"`);
      return res.send(pdf);
    }

    let csv: string;
    if (rows.length === 0) {
      const cols = EXPORT_HEADERS[table] || ((db as any).prepare(`PRAGMA table_info(${table})`).all() as any[]).map((c: any) => c.name);
      csv = cols.join(',');
    } else {
      csv = toCsv(rows);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${table}_${date}.csv"`);
    res.send('﻿' + csv);
  }));

  app.get("/api/export-template/:table", managerOnly, wrap((req: any, res: any) => {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });
    const cols: any[] = (db as any).prepare(`PRAGMA table_info(${table})`).all();
    const csv = cols.map((c: any) => c.name).join(',');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="plantilla_${table}.csv"`);
    res.send('﻿' + csv);
  }));

  app.post("/api/import/:table", managerOnly, wrap((req: any, res: any) => {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });
    const { csv, replace } = req.body as { csv: string; replace?: boolean };
    if (!csv) return res.status(400).json({ error: 'Falta el campo csv' });

    const { headers, rows } = parseCsvToRows(csv);
    if (!headers.length || !rows.length) return res.json({ imported: 0, skipped: 0 });

    const tableCols: string[] = ((db as any).prepare(`PRAGMA table_info(${table})`).all() as any[]).map((c: any) => c.name);
    const validH = headers.filter(h => tableCols.includes(h));
    if (!validH.length) return res.status(400).json({ error: 'Ninguna columna del CSV coincide con la tabla' });

    let backupPath: string | null = null;
    if (replace) {
      requireHighImpactConfirmation(req, `REPLACE_TABLE_${table}`, table);
      backupPath = backupDatabaseBefore(`replace-${table}`);
      (db as any).prepare(`DELETE FROM ${table}`).run();
    }

    const stmt = (db as any).prepare(
      `INSERT OR REPLACE INTO ${table} (${validH.join(', ')}) VALUES (${validH.map(() => '?').join(', ')})`
    );

    let imported = 0, skipped = 0;
    const insertAll = (db as any).transaction((rs: any[]) => {
      for (const row of rs) {
        try {
          stmt.run(...validH.map(h => { const v = row[h]; return (v === '' || v === 'null') ? null : v; }));
          imported++;
        } catch { skipped++; }
      }
    });
    insertAll(rows);
    authAudit(req, 'IMPORT_TABLE', table, `imported:${imported};skipped:${skipped};replace:${Boolean(replace)};backup:${backupPath || 'none'}`);
    res.json({ imported, skipped });
  }));

  app.delete("/api/db/clear/:table", managerOnly, wrap((req: any, res: any) => {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });
    requireHighImpactConfirmation(req, `CLEAR_TABLE_${table}`, table);
    const backupPath = backupDatabaseBefore(`clear-${table}`);
    (db as any).prepare(`DELETE FROM ${table}`).run();
    authAudit(req, 'CLEAR_TABLE', table, `backup:${backupPath || 'none'}`);
    res.json({ ok: true });
  }));

  function countOcrFields(fields: Record<string, any> = {}) {
    return Object.values(fields).filter(value => String(value || '').trim()).length;
  }

  function recordOcrTelemetry(req: any, event: 'completed' | 'failed', docType: string, payload: any) {
    try {
      recordMetric(`ocr.${event}`, 1, {
        docType,
        provider: payload.provider || 'none',
        cached: String(Boolean(payload.cached)),
      });
      recordEvent(`ocr.${event}`, { docType, ...payload }, req.auth);
      logSystem(
        req,
        `ocr.${event}`,
        'ocr',
        docType,
        event === 'completed'
          ? `OCR ${docType} completado con ${payload.provider}; ${payload.fieldsCount || 0} campos`
          : `OCR ${docType} falló: ${payload.error || 'error desconocido'}`,
        payload
      );
    } catch (telemetryError) {
      console.warn('[OCR] No se pudo registrar telemetría:', telemetryError);
    }
  }

  const OCR_SUPPORTED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

  function imageMimeFromDataUrl(value: string) {
    return String(value || '').match(/^data:([^;]+);base64,/i)?.[1]?.toLowerCase() || '';
  }

  function ocrIntEnv(name: string, fallback: number, min: number, max: number) {
    const value = Number(process.env[name]);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(value)));
  }

  async function normalizeImageForServerOcr(value: string) {
    const match = String(value || '').match(/^data:(image\/[^;]+);base64,([\s\S]+)$/i);
    if (!match) {
      throw createHttpError(415, 'OCR requiere imagen en formato base64 con prefijo data:image.', 'OCR_UNSUPPORTED_FORMAT');
    }

    try {
      const buffer = Buffer.from(match[2], 'base64');
      const { default: sharp } = await import('sharp');
      const maxSide = ocrIntEnv('OCR_IMAGE_MAX_SIDE', 1200, 800, 1800);
      const quality = ocrIntEnv('OCR_IMAGE_JPEG_QUALITY', 74, 60, 88);
      const normalized = await sharp(buffer, { failOn: 'error', limitInputPixels: 60_000_000 })
        .rotate()
        .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
        .normalize()
        .sharpen({ sigma: 0.7 })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      return `data:image/jpeg;base64,${normalized.toString('base64')}`;
    } catch {
      throw createHttpError(
        415,
        'La imagen no se pudo leer para OCR. Usa foto JPG, PNG o WEBP; si viene de iPhone en HEIC, vuelve a subirla desde la app movil para convertirla.',
        'OCR_INVALID_IMAGE'
      );
    }
  }

  async function runOcrEndpoint(req: any, res: any, docType: 'ine' | 'siac' | 'comprobante', runner: (imgs: string[]) => Promise<any>) {
    const { image, images } = req.body;
    const imgs = Array.isArray(images) ? images.filter(Boolean) : (image ? [image] : []);
    if (imgs.length === 0) return res.status(400).json({ error: 'Falta image o images' });
    const pdf = imgs.find((img: string) => /^data:application\/pdf/i.test(String(img || '')));
    if (pdf) {
      return res.status(415).json({
        error: 'OCR de PDF no esta disponible todavia. Guarda el PDF en expediente o sube una foto/imagen del documento para escanearlo.',
      });
    }
    const nonImage = imgs.find((img: string) => /^data:/i.test(String(img || '')) && !/^data:image\//i.test(String(img || '')));
    if (nonImage) {
      return res.status(415).json({ error: 'OCR solo acepta imagenes. Para audio, video o PDF usa carga de expediente.' });
    }
    const unsupportedImage = imgs.find((img: string) => {
      const mime = imageMimeFromDataUrl(img);
      return mime && !OCR_SUPPORTED_IMAGE_MIMES.has(mime);
    });
    if (unsupportedImage) {
      const mime = imageMimeFromDataUrl(unsupportedImage);
      return res.status(415).json({
        error: `Formato de imagen no compatible para OCR: ${mime}. Usa JPG, PNG o WEBP; HEIC debe convertirse a JPG desde la app movil.`,
      });
    }
    const normalizedImgs = await Promise.all(imgs.map(normalizeImageForServerOcr));
    const startedAt = Date.now();
    try {
      const result = await runner(normalizedImgs);
      const totalDurationMs = Date.now() - startedAt;
      const fieldsCount = result.fieldsCount ?? countOcrFields(result.fields);
      const payload = {
        provider: result.provider,
        model: result.model,
        durationMs: result.durationMs,
        totalDurationMs,
        fallbackReason: result.fallbackReason,
        cached: Boolean(result.cached),
        strategy: result.strategy,
        providerOrder: result.providerOrder,
        attempts: result.attempts || [],
        fieldsCount,
        images: normalizedImgs.length,
        manualRequired: Boolean(result.manualRequired),
        warning: result.warning,
        quality: result.quality,
        documentType: result.documentType,
        fraudSignals: result.fraudSignals || [],
      };
      console.log(`[OCR-${docType}]`, result.provider, result.model, `${result.durationMs}ms`, `total=${totalDurationMs}ms`, `${normalizedImgs.length}img`, JSON.stringify(result.fields));
      recordOcrTelemetry(req, 'completed', docType, payload);
      res.json({
        text: result.text,
        fields: result.fields,
        provider: result.provider,
        model: result.model,
        durationMs: result.durationMs,
        totalDurationMs,
        fallbackReason: result.fallbackReason,
        cached: Boolean(result.cached),
        strategy: result.strategy,
        providerOrder: result.providerOrder,
        attempts: result.attempts || [],
        fieldsCount,
        manualRequired: Boolean(result.manualRequired),
        warning: result.warning,
        quality: result.quality,
        documentType: result.documentType,
        fraudSignals: result.fraudSignals || [],
      });
    } catch (err: any) {
      recordOcrTelemetry(req, 'failed', docType, { error: err?.message || String(err), images: normalizedImgs.length });
      throw err;
    }
  }

  // ── OCR LOCAL PRIVADO (rutas /api/vision/* mantenidas por compatibilidad) ──
  // Acepta { image: "..." } o { images: ["frente","reverso"] } — múltiples mejoran precisión.
  app.post("/api/vision/ocr", authOnly, uploadLimiter, wrap(async (req: any, res: any) => {
    return runOcrEndpoint(req, res, 'ine', runIneOcr);
  }));

  app.post("/api/vision/siac", authOnly, uploadLimiter, wrap(async (req: any, res: any) => {
    return runOcrEndpoint(req, res, 'siac', runSiacOcr);
  }));

  app.post("/api/vision/comprobante", authOnly, uploadLimiter, wrap(async (req: any, res: any) => {
    return runOcrEndpoint(req, res, 'comprobante', runComprobanteOcr);
  }));

  app.get("/api/vision/status", authOnly, wrap(async (_req: any, res: any) => {
    const status = await checkOcrStatus();
    res.json(status);
  }));

  app.post("/api/vision/face-match", authOnly, wrap(async (_req: any, res: any) => {
    res.json({
      status: 'pending_local_review',
      provider: 'local',
      manualRequired: true,
      message: 'Comparación rostro/video firma pendiente de modelo facial local instalado. No se llamó a APIs externas.',
    });
  }));

  // ── EMAIL DOMAIN VALIDATION (DNS MX check, no email sent) ──
  app.get("/api/validate/email", wrap(async (req: any, res: any) => {
    const email = (req.query.email as string || '').trim().toLowerCase();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRe.test(email)) return res.json({ ok: false, reason: 'Formato inválido' });

    const domain = email.split('@')[1];
    // Known disposable / invalid domains
    const disposable = ['mailinator.com','guerrillamail.com','tempmail.com','10minutemail.com','yopmail.com','throwam.com','trashmail.com','fakeinbox.com'];
    if (disposable.includes(domain)) return res.json({ ok: false, reason: 'Dominio desechable no permitido' });

    try {
      const { promises: dns } = await import('dns');
      const mx = await dns.resolveMx(domain).catch(() => null);
      if (!mx || mx.length === 0) return res.json({ ok: false, reason: 'El dominio no tiene servidores de correo (MX)' });
      return res.json({ ok: true, reason: 'Dominio válido' });
    } catch {
      return res.json({ ok: false, reason: 'No se pudo verificar el dominio' });
    }
  }));

  // ── VITE / STATIC ─────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    const serveMobileDev = async (req: any, res: any, next: any) => {
      try {
        const { readFile } = await import('fs/promises');
        const html = await readFile(path.join(process.cwd(), 'mobile.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(transformed);
      } catch (error) {
        next(error);
      }
    };
    app.get(/^\/m$/, (_req, res) => res.redirect('/m/'));
    app.get(/^\/m\/.*$/, serveMobileDev);
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Hashed assets (JS/CSS chunks) can be cached for 1 year; index.html must not be cached
    app.use('/assets', express.static(path.join(distPath, 'assets'), { maxAge: '1y', immutable: true }));
    app.use('/assets', (_req, res) => {
      res.status(404).type('text/plain').send('Asset not found');
    });
    app.get(/^\/m$/, (_req, res) => res.redirect('/m/'));
    app.get(/^\/m\/.*$/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'mobile.html'));
    });
    app.use(express.static(distPath, { maxAge: 0 }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Auto-import principal SIAC/Morosos when the source files change.
  try {
    const siacPrimaryFingerprint = getSourceFingerprint(DEFAULT_SIAC_SOURCE);
    const storedSiacPrimaryFingerprint = Settings.get('siac_primary_source_fingerprint');
    const storedSiacImporterVersion = Settings.get('siac_primary_importer_version');
    if (siacPrimaryFingerprint && (SiacRecords.count() === 0 || storedSiacPrimaryFingerprint !== siacPrimaryFingerprint || storedSiacImporterVersion !== SIAC_IMPORTER_VERSION)) {
      const result = await importSiacSource({ sourcePath: DEFAULT_SIAC_SOURCE, replace: true });
      Settings.set('siac_primary_source_fingerprint', result.fingerprint);
      Settings.set('siac_primary_importer_version', SIAC_IMPORTER_VERSION);
      console.log(`[SIAC] Fuente principal sincronizada: ${result.imported} registros válidos`);
    } else {
      const siacCsvFingerprint = getSiacCSVFingerprint();
      const storedSiacFingerprint = Settings.get('siac_csv_fingerprint');
      if (SiacRecords.count() === 0 || (siacCsvFingerprint && storedSiacFingerprint !== siacCsvFingerprint)) {
        const result = importSiacCSV({ replace: true });
        if (siacCsvFingerprint) Settings.set('siac_csv_fingerprint', siacCsvFingerprint);
        console.log(`[SIAC] CSV sincronizado: ${result.imported} registros válidos`);
      }
    }
  } catch (err: any) {
    console.warn('[SIAC] No se pudo sincronizar fuente principal:', err?.message || err);
  }
  try {
    const morososFingerprint = getSourceFingerprint(DEFAULT_MOROSOS_SOURCE);
    const storedMorososFingerprint = Settings.get('morosos_source_fingerprint');
    const morososCount = ((db as any).prepare('SELECT COUNT(*) AS c FROM morosidad').get() as any).c;
    if (morososFingerprint && (morososCount === 0 || storedMorososFingerprint !== morososFingerprint)) {
      const result = await importMorososSource({ sourcePath: DEFAULT_MOROSOS_SOURCE, replace: true });
      Settings.set('morosos_source_fingerprint', result.fingerprint);
      console.log(`[MOROSOS] Fuente principal sincronizada: ${result.imported} registros válidos`);
    }
  } catch (err: any) {
    console.warn('[MOROSOS] No se pudo sincronizar fuente principal:', err?.message || err);
  }

  // Auto-reconectar Telegram. El valor guardado en Settings tiene prioridad;
  // si nunca se guardo uno, usa el secreto del entorno del servidor.
  const storedTelegramToken = Settings.get('telegram_bot_token');
  const savedToken = typeof storedTelegramToken === 'string'
    ? storedTelegramToken
    : getSecretValue('TELEGRAM_BOT_TOKEN', process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || '');
  if (savedToken) {
    initTelegram(savedToken)
      .then(r => r.ok
        ? console.log(`[TG] Auto-reconectado como @${r.botName}`)
        : console.warn('[TG] Token guardado inválido:', r.error))
      .catch(e => console.warn('[TG] Error auto-reconectando:', e.message));
  }

  const restoreWhatsAppAccounts = () => {
    const accounts = new Set<ReturnType<typeof normalizeWhatsAppAccount>>();
    for (const row of getChannelAccounts() as any[]) {
      if (row?.channel !== 'whatsapp') continue;
      if (String(row.status || '').toLowerCase() === 'disconnected') continue;
      const metadata = parseMetadata(row.metadata);
      const key = String(metadata.key || '').toLowerCase();
      const audience = String(metadata.audience || '').toLowerCase();
      const account = normalizeWhatsAppAccount(
        metadata.account ||
        (key === 'whatsappclientes' || audience === 'clientes' ? 'clientes' : 'promotores')
      );
      accounts.add(account);
    }

    for (const account of accounts) {
      if (!hasWhatsAppCredentials(account)) {
        console.warn(`[WA:${account}] No hay credenciales locales; se requiere vincular QR desde Ajustes.`);
        continue;
      }
      initWhatsApp(account)
        .then(() => console.log(`[WA:${account}] Auto-restauracion iniciada desde cuenta vinculada.`))
        .catch((err: any) => console.warn(`[WA:${account}] No se pudo auto-restaurar:`, err?.message || err));
    }
  };
  restoreWhatsAppAccounts();

  const onListening = () => {
    console.log(`[DB] Base de datos: data/heavenlydreams.db`);
    console.log(`[SIAC] Registros en DB: ${SiacRecords.count()}`);
    console.log(`Server running on http://${HOST || 'localhost'}:${PORT}`);
  };
  // Sentry error handler (must be after all routes, before other error handlers)
  if (process.env.SENTRY_DSN) {
    const { Sentry } = await import('./server/sentry');
    app.use(Sentry.expressErrorHandler());
  }

  const server = createHttpServer(app);
  attachOpenAIRealtimeStream(server);
  if (HOST) server.listen(PORT, HOST, onListening);
  else server.listen(PORT, onListening);
}

startServer();
