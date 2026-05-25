import "dotenv/config";
import express from "express";
import { createServer as createHttpServer } from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { randomUUID } from "crypto";
import { createApp } from "./server/app";
import { hasPagingQuery, parseLimit, parseOffset, queryString, wrap } from "./server/http";
import {
  initWhatsApp,
  getWhatsAppStatus,
  getWhatsAppQR,
  sendWhatsAppMessage,
  sendWhatsAppClientMessage,
  logoutWhatsApp,
  getRecentMessages,
  setWhatsAppMessageHandler,
  normalizeWhatsAppAccount,
  type WaMessage,
} from "./server/whatsapp";
import { initTelegram, stopTelegram, getTelegramStatus, getTelegramMessages, sendTelegramMessage, setTelegramMessageHandler, type TgMessage } from "./server/telegram";
import { runIneOcr, runComprobanteOcr, runSiacOcr, checkOcrStatus } from "./server/ocr-service";
import db, {
  Users, Ventas, SiacRecords, Tickets, AuditLog, Settings,
  Referrals, Quotas, CommissionRules, PackageCatalog,
  Nominas, Territories, ValidationRequests, Announcements,
  InventoryItems, AutomationRules, AiJobs, Metrics, Sessions,
  Capturas, DocumentosCliente, DocumentFiles, ClientesCrm, EstatusFolios, LogsSistema,
  AgentOutbox, AgentProfiles,
} from "./server/db";
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
  makeAuthenticationOptions,
  makeRegistrationOptions,
  isWebAuthnRequired,
  userHasPasskey,
  verifyAuthentication,
  verifyRegistration,
} from "./server/webauthn";
import { getEnterpriseReadiness } from "./server/readiness";
import { readStoredDocument, storeDocument } from "./server/document-storage";
import { buildValidationTwiML, createTwilioCall, twilioConfigured } from "./server/twilio";
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
import { createTelmexAutomationJob, getTelmexJob, listTelmexJobs, updateTelmexAutomationJob } from "./server/telmex-automation";
import {
  assignConversation,
  getChannelAccounts,
  getChannelConversations,
  getChannelMessages,
  getConversationAutomation,
  getRecentChannelMessages,
  setIncomingMessageHandler,
} from "./server/messaging";
import {
  approveAgentOutbox,
  rejectAgentOutbox,
  runAgentForConversation,
  runAgentForMessage,
} from "./server/agent-orchestrator";

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
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
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

const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
const CURP_STATES: Record<string, string> = {
  AS: 'Aguascalientes',
  BC: 'Baja California',
  BS: 'Baja California Sur',
  CC: 'Campeche',
  CL: 'Coahuila',
  CM: 'Colima',
  CS: 'Chiapas',
  CH: 'Chihuahua',
  DF: 'Ciudad de Mexico',
  DG: 'Durango',
  GT: 'Guanajuato',
  GR: 'Guerrero',
  HG: 'Hidalgo',
  JC: 'Jalisco',
  MC: 'Estado de Mexico',
  MN: 'Michoacan',
  MS: 'Morelos',
  NT: 'Nayarit',
  NL: 'Nuevo Leon',
  OC: 'Oaxaca',
  PL: 'Puebla',
  QT: 'Queretaro',
  QR: 'Quintana Roo',
  SP: 'San Luis Potosi',
  SL: 'Sinaloa',
  SR: 'Sonora',
  TC: 'Tabasco',
  TS: 'Tamaulipas',
  TL: 'Tlaxcala',
  VZ: 'Veracruz',
  YN: 'Yucatan',
  ZS: 'Zacatecas',
  NE: 'Nacido en el extranjero',
};

function normalizeCurp(value: any) {
  return String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 18);
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

function normalizeCurpNamePart(value: any) {
  return String(value || '')
    .replace(/[Ññ]/g, 'X')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
}

function firstInternalVowel(value: string) {
  return value.slice(1).match(/[AEIOU]/)?.[0] || 'X';
}

function firstInternalConsonant(value: string) {
  return value.slice(1).match(/[BCDFGHJKLMNPQRSTVWXYZ]/)?.[0] || 'X';
}

function generateCurpFromPersonalData(input: any) {
  const paterno = normalizeCurpNamePart(input.apellidoPaterno);
  const materno = normalizeCurpNamePart(input.apellidoMaterno);
  const nombres = normalizeCurpNamePart(input.nombres);
  const fecha = String(input.fechaNacimiento || '').trim();
  const sexo = String(input.sexo || '').trim().toUpperCase().slice(0, 1);
  const estado = String(input.estadoNacimiento || '').trim().toUpperCase();
  if (!paterno || !nombres || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !['H', 'M'].includes(sexo) || !CURP_STATES[estado]) {
    return '';
  }
  const yy = fecha.slice(2, 4);
  const mm = fecha.slice(5, 7);
  const dd = fecha.slice(8, 10);
  return `${paterno[0] || 'X'}${firstInternalVowel(paterno)}${materno[0] || 'X'}${nombres[0] || 'X'}${yy}${mm}${dd}${sexo}${estado}${firstInternalConsonant(paterno)}${firstInternalConsonant(materno)}${firstInternalConsonant(nombres)}00`;
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

async function startServer() {
  const app = createApp();
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST?.trim();
  const loginLimiter = rateLimit('login', 12, 15 * 60 * 1000);
  const registrationLimiter = rateLimit('registration', 8, 60 * 60 * 1000);
  const authOnly = requireAuth;
  const opsOnly = requireRole('GERENTE', 'SUPERVISOR');
  const chatUserOnly = requireRole('GERENTE', 'SUPERVISOR', 'ASESOR');
  const managerOnly = requireRole('GERENTE');

  function canManage(auth: any) {
    return ['GERENTE', 'SUPERVISOR'].includes(auth?.role);
  }

  function canAccessVenta(auth: any, venta: any) {
    if (!auth || !venta) return false;
    return canManage(auth) || venta.asesor_id === auth.sub;
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
    const fallbacks = String(process.env.VOICE_PROVIDER_FALLBACKS || 'twilio-basic')
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
    return ['ASESOR', 'SUPERVISOR', 'GERENTE'].includes(role) ? role : 'ASESOR';
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
      role: publicRegistration ? (requestedRole === 'GERENTE' ? 'ASESOR' : requestedRole) : requestedRole,
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
    if (user.role !== 'GERENTE') {
      res.status(403).json({ error: 'Permisos insuficientes' });
      return null;
    }
    return { ...auth, role: user.role, name: user.nombre };
  }

  // ── USUARIOS ────────────────────────────────────────────────
  app.get("/api/users", opsOnly, wrap((_req: any, res: any) => {
    res.setHeader('Cache-Control', 'no-store');
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
    } else if (process.env.NODE_ENV === 'production' && process.env.PUBLIC_REGISTRATION_ENABLED !== 'true') {
      return res.status(403).json({
        error: 'Registro público deshabilitado en producción. Solicita una invitación a gerencia.',
        code: 'PUBLIC_REGISTRATION_DISABLED',
      });
    }
    const data = normalizeUserPayload(req.body, { publicRegistration });
    if (!data.nombre || !data.email || !data.username || !data.password) {
      return res.status(400).json({ error: 'Nombre, email, usuario y contraseña son requeridos.' });
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
    const managerRequiresWebAuthn = user.role === 'GERENTE' && isWebAuthnRequired(req);
    if (managerRequiresWebAuthn && userHasPasskey(user.uid)) {
      return res.json({ requiresWebAuthn: true, webAuthnUserId: user.uid, nombre: user.nombre, role: user.role });
    }
    const session = issueSessionCookie(res, user, req, user.role === 'GERENTE'
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

  app.get("/api/auth/oauth/:provider/start", loginLimiter, wrap((req: any, res: any) => {
    oauthStart(req, res);
  }));

  app.get("/api/auth/oauth/:provider/callback", loginLimiter, wrap(async (req: any, res: any) => {
    await oauthCallback(req, res);
  }));

  app.post("/api/curp/lookup", authOnly, wrap(async (req: any, res: any) => {
    const curp = normalizeCurp(req.body?.curp);
    if (!curp) return res.status(400).json({ error: 'CURP requerida' });
    if (!CURP_RE.test(curp)) return res.status(400).json({ error: 'Formato de CURP inválido' });

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
      status: official ? normalized.status : 'VALIDADA_FORMATO_LOCAL',
      message: official
        ? 'CURP consultada con proveedor externo configurado.'
        : 'CURP validada por formato local. Para expediente oficial descarga y adjunta el PDF desde gob.mx.',
      providerError: providerError || undefined,
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
    const curpDraft = CURP_RE.test(payload.curp) ? payload.curp : generateCurpFromPersonalData(payload);
    if (!curpDraft) {
      return res.status(400).json({
        ok: false,
        error: 'Datos incompletos para preparar la consulta oficial. Revisa nombre, apellido paterno, fecha, sexo y estado.',
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
    Users.update(req.params.uid, { activo: 1 });
    const u = Users.getById(req.params.uid) as any;
    AuditLog.insert({ accion: 'APPROVE_USER', entidad: 'users', entidad_id: req.params.uid, user_id: req.body.by || null, user_nombre: null, detalle: u?.nombre || null });
    res.json({ ok: true });
  }));

  // Rechazar / desactivar cuenta
  app.post("/api/users/:uid/reject", managerOnly, wrap((req: any, res: any) => {
    Users.update(req.params.uid, { activo: 0 });
    const u = Users.getById(req.params.uid) as any;
    AuditLog.insert({ accion: 'REJECT_USER', entidad: 'users', entidad_id: req.params.uid, user_id: req.body.by || null, user_nombre: null, detalle: u?.nombre || null });
    res.json({ ok: true });
  }));

  // Editar datos de usuario
  app.put("/api/users/:uid", managerOnly, wrap((req: any, res: any) => {
    const { password, uid: _uid, ...data } = req.body;
    Users.update(req.params.uid, data);
    res.json({ ok: true });
  }));

  // Eliminar cuenta permanentemente
  app.delete("/api/users/:uid", managerOnly, wrap((req: any, res: any) => {
    const u = Users.getById(req.params.uid) as any;
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    Users.delete(req.params.uid);
    AuditLog.insert({ accion: 'DELETE_USER', entidad: 'users', entidad_id: req.params.uid, user_id: null, user_nombre: null, detalle: u.nombre || u.username || null });
    res.json({ ok: true });
  }));

  // Contar pendientes (para notificaciones)
  app.get("/api/users/pending-count", opsOnly, wrap((_req: any, res: any) => {
    const count = Users.getAll().filter((u: any) => u.activo === 2).length;
    res.json({ count });
  }));

  app.get("/api/users/:uid", authOnly, wrap((req: any, res: any) => {
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
      const rows = asesorId ? Nominas.getByAsesor(asesorId) : Nominas.getAll();
      return rows.slice(0, limit);
    }
    return Nominas.getByAsesor(req.auth.sub).slice(0, limit);
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

  app.get("/api/mobile/bootstrap", authOnly, wrap((req: any, res: any) => {
    const sales = mobileSales(req, 60);
    const captures = mobileCaptures(req, 40);
    const clients = mobileClients(req, 40);
    const followUps = mobileFollowUps(req, 40);
    const payroll = mobilePayroll(req, 12);
    const conversations = getChannelConversations(80);
    const pendingOutbox = AgentOutbox.getAll(100).filter((item: any) => item.status === 'pending_approval');
    const today = new Date().toISOString().slice(0, 10);
    const pendingSales = sales.filter((sale: any) => String(sale.status || 'pendiente').toLowerCase() === 'pendiente').length;
    const todaySales = sales.filter((sale: any) => String(sale.fecha_solicitud || sale.created_at || '').startsWith(today)).length;
    const pendingDocs = captures.filter((capture: any) => String(capture.status_documentos || '').toUpperCase() !== 'SUBIDO').length;
    const openConversations = conversations.filter((conversation: any) => !['cerrado', 'closed'].includes(String(conversation.status || '').toLowerCase())).length;
    res.json({
      user: mobileUser(req.auth),
      permissions: { role: req.auth.role, canManage: canManage(req.auth), mobile: true },
      featureFlags: {
        mobilePwaPrimary: true,
        offlineQueue: true,
        moduleCache: true,
        agentApprovals: true,
      },
      nav: ['inicio', 'venta', 'folios', 'clientes', 'documentos', 'seguimiento', 'nominas', 'chats', 'perfil', 'ajustes'],
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

  app.post("/api/mobile/capturas", authOnly, wrap(async (req: any, res: any) => {
    const body = req.body || {};
    const nombres = String(body.nombres || '').trim();
    const apellidoPaterno = String(body.apellidoPaterno || body.apellido_paterno || '').trim();
    const apellidoMaterno = String(body.apellidoMaterno || body.apellido_materno || '').trim();
    const telefono = normalizePhone10(body.telefono || body.telefono_titular || body.whatsapp);
    if (!nombres) return res.status(400).json({ error: 'nombres requerido' });
    if (telefono.length !== 10) return res.status(400).json({ error: 'telefono debe tener 10 digitos' });

    const user = Users.getById(req.auth.sub) as any;
    const incomingMeta = parseMetadata(body.metadata);
    const meta = {
      ...incomingMeta,
      source: 'mobile-pwa',
      mobileVersion: 1,
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

  app.get("/api/mobile/clientes", authOnly, wrap((req: any, res: any) => {
    res.json(filterUpdatedSince(mobileClients(req, 100), req.query?.updatedSince));
  }));

  app.get("/api/mobile/documentos", authOnly, wrap((req: any, res: any) => {
    const captures = filterUpdatedSince(mobileCaptures(req, 60), req.query?.updatedSince).map((capture: any) => ({
      ...capture,
      documentos: DocumentosCliente.getByCaptura(capture.id),
      files: DocumentFiles.getByCapture(capture.id).map((file: any) => ({ ...file, storage_path: undefined })),
    }));
    res.json({ captures });
  }));

  app.get("/api/mobile/seguimiento", authOnly, wrap((req: any, res: any) => {
    res.json(filterUpdatedSince(mobileFollowUps(req, 100), req.query?.updatedSince));
  }));

  app.get("/api/mobile/nominas", authOnly, wrap((req: any, res: any) => {
    res.json(filterUpdatedSince(mobilePayroll(req, 80), req.query?.updatedSince));
  }));

  app.get("/api/mobile/chats", chatUserOnly, wrap((req: any, res: any) => {
    const messages = filterUpdatedSince(getRecentChannelMessages(120), req.query?.updatedSince);
    const conversations = getChannelConversations(120).map((conversation: any) => ({
      ...conversation,
      pending_outbox: Number(conversation.pending_outbox || 0),
    }));
    res.json({ conversations, messages });
  }));

  app.post("/api/mobile/whatsapp/send", chatUserOnly, wrap(async (req: any, res: any) => {
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

  app.post("/api/document-files", authOnly, wrap((req: any, res: any) => {
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

  app.patch("/api/document-files/:id/review", opsOnly, wrap((req: any, res: any) => {
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

  app.patch("/api/documentos-cliente/:id", opsOnly, wrap((req: any, res: any) => {
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
    });
    Settings.set('morosos_source_fingerprint', result.fingerprint);
    AuditLog.insert({ accion: 'IMPORT_MOROSOS_SOURCE', entidad: 'morosidad', entidad_id: null, user_id: req.auth?.sub || null, user_nombre: null, detalle: `imported:${result.imported};skipped:${result.skipped};source:${result.source}` });
    res.json({ ok: true, ...result });
  }));

  app.post("/api/morosidad/import-file", managerOnly, wrap(async (req: any, res: any) => {
    const content = String(req.body?.contentBase64 || '');
    if (!content) return res.status(400).json({ error: 'contentBase64 requerido' });
    const result = await importMorososSource({
      buffer: Buffer.from(content, 'base64'),
      fileName: req.body?.fileName || 'morosos.csv',
      replace: req.body?.replace === true,
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
    res.json(SiacRecords.search(folio));
  }));

  app.get("/api/siac/:folio", authOnly, wrap((req: any, res: any) => {
    const record = SiacRecords.getByFolio(req.params.folio);
    if (!record) return res.status(404).json({ error: 'Folio no encontrado' });
    res.json(record);
  }));

  app.get("/api/siac", authOnly, wrap((req: any, res: any) => {
    if (hasPagingQuery(req.query as any)) {
      return res.json(SiacRecords.getPage({
        limit: parseLimit(req.query.limit, 200, 1000),
        offset: parseOffset(req.query.offset),
        q: queryString(req.query.q),
        updatedSince: queryString(req.query.updatedSince),
      }));
    }
    res.json(SiacRecords.getAll());
  }));

  app.post("/api/siac/import-source", managerOnly, wrap(async (req: any, res: any) => {
    const result = await importSiacSource({
      sourcePath: req.body?.sourcePath || DEFAULT_SIAC_SOURCE,
      replace: req.query.replace === '1' || req.body?.replace !== false,
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

  app.post("/api/siac/import-file", managerOnly, wrap(async (req: any, res: any) => {
    const content = String(req.body?.contentBase64 || '');
    if (!content) return res.status(400).json({ error: 'contentBase64 requerido' });
    const result = await importSiacSource({
      buffer: Buffer.from(content, 'base64'),
      fileName: req.body?.fileName || 'siac.xlsx',
      replace: req.body?.replace === true,
    });
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
  app.get("/api/tickets", authOnly, wrap((_req: any, res: any) => res.json(Tickets.getAll())));

  app.post("/api/tickets", authOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'abierto', prioridad: 'media', categoria: null, ...req.body };
    Tickets.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/tickets/:id", authOnly, wrap((req: any, res: any) => {
    Tickets.update(req.params.id, req.body);
    res.json({ ok: true });
  }));

  // ── VALIDACIONES ───────────────────────────────────────────
  app.get("/api/voice-providers/status", opsOnly, wrap((_req: any, res: any) => {
    res.json({
      defaultProvider: configuredVoiceProvider(),
      fallbacks: String(process.env.VOICE_PROVIDER_FALLBACKS || 'twilio-basic').split(',').map(item => item.trim()).filter(Boolean),
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

  app.post("/api/validations/:id/call", opsOnly, wrap(async (req: any, res: any) => {
    const validation = await startValidationCallForRequest(req.params.id, req.body?.provider || null);
    logSystem(req, 'VALIDATION_CALL_STARTED', 'validation_requests', req.params.id, validation.provider || null, {
      provider: validation.provider,
      callSid: validation.call_sid,
      conversationId: validation.conversation_id,
    });
    recordMetric('validation.call.started', 1, { provider: validation.provider || 'unknown' });
    res.json({ ok: true, validation });
  }));

  app.post("/api/validations/:id/retry", opsOnly, wrap(async (req: any, res: any) => {
    const validation = await startValidationCallForRequest(req.params.id, req.body?.provider || null);
    logSystem(req, 'VALIDATION_CALL_RETRY', 'validation_requests', req.params.id, validation.provider || null, {
      attempts: validation.attempts,
      provider: validation.provider,
    });
    res.json({ ok: true, validation });
  }));

  app.post("/api/validations/:id/sync", opsOnly, wrap(async (req: any, res: any) => {
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

  app.post("/api/validations/:id/approve", opsOnly, wrap((req: any, res: any) => {
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

  app.post("/api/validations/:id/reject", opsOnly, wrap((req: any, res: any) => {
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

  app.put("/api/validations/:id", opsOnly, wrap((req: any, res: any) => {
    ValidationRequests.update(req.params.id, req.body);
    res.json({ ok: true, validation: ValidationRequests.getById(req.params.id) });
  }));

  // ── REFERIDOS ──────────────────────────────────────────────
  app.get("/api/referrals", authOnly, wrap((_req: any, res: any) => res.json(Referrals.getAll())));

  app.post("/api/referrals", authOnly, wrap((req: any, res: any) => {
    const data = { id: randomUUID(), status: 'pendiente', convertido: 0, ...req.body };
    Referrals.create(data);
    res.json({ ok: true, id: data.id });
  }));

  app.put("/api/referrals/:id", authOnly, wrap((req: any, res: any) => {
    Referrals.update(req.params.id, req.body);
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

  app.put("/api/quotas/:userId", opsOnly, wrap((req: any, res: any) => {
    Quotas.set(req.params.userId, req.body.meta);
    res.json({ ok: true });
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
  app.get("/api/nominas", opsOnly, wrap((req: any, res: any) => {
    const { asesor_id } = req.query;
    res.json(asesor_id ? Nominas.getByAsesor(asesor_id as string) : Nominas.getAll());
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

  // ── ENTERPRISE CONTROL PLANE ──────────────────────────────
  app.get("/api/enterprise/health", wrap((_req: any, res: any) => {
    res.json(enterpriseHealth());
  }));

  app.get("/api/enterprise/readiness", requireRole('GERENTE', 'SUPERVISOR'), wrap(async (_req: any, res: any) => {
    res.json(await getEnterpriseReadiness());
  }));

  app.post("/api/enterprise/events", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
    res.json(recordEvent(req.body.event, req.body.payload || {}, (req as any).auth));
  }));

  app.get("/api/enterprise/metrics", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 1000);
    res.json(Metrics.getRecent(limit));
  }));

  app.post("/api/enterprise/metrics", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
    recordMetric(req.body.name, Number(req.body.value ?? 1), req.body.tags || {});
    res.json({ ok: true });
  }));

  app.get("/api/inventory", opsOnly, wrap((_req: any, res: any) => res.json(InventoryItems.getAll())));

  app.post("/api/inventory", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
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

  app.patch("/api/inventory/:id", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
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

  app.get("/api/automation/rules", requireRole('GERENTE', 'SUPERVISOR'), wrap((_req: any, res: any) => {
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

  app.get("/api/telmex/jobs", requireRole('GERENTE', 'SUPERVISOR'), wrap((_req: any, res: any) => {
    res.json(listTelmexJobs());
  }));

  app.get("/api/telmex/status/:id", authOnly, wrap((req: any, res: any) => {
    const job = getTelmexJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'trabajo Telmex no encontrado' });
    res.json(job);
  }));

  app.patch("/api/telmex/status/:id", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
    const job = updateTelmexAutomationJob(req.params.id, req.body || {}, req.auth);
    if (!job) return res.status(404).json({ error: 'trabajo Telmex no encontrado' });
    res.json(job);
  }));

  app.post("/api/telmex/login", requireRole('GERENTE', 'SUPERVISOR', 'ASESOR'), enqueueTelmexAction('login'));
  app.post("/api/telmex/coverage", requireRole('GERENTE', 'SUPERVISOR', 'ASESOR'), enqueueTelmexAction('coverage'));
  app.post("/api/telmex/create-order", requireRole('GERENTE', 'SUPERVISOR', 'ASESOR'), enqueueTelmexAction('create-order'));
  app.post("/api/telmex/send-otp", requireRole('GERENTE', 'SUPERVISOR', 'ASESOR'), enqueueTelmexAction('send-otp'));
  app.post("/api/telmex/confirm-otp", requireRole('GERENTE', 'SUPERVISOR', 'ASESOR'), enqueueTelmexAction('confirm-otp'));
  app.get("/telmex/status/:id", authOnly, wrap((req: any, res: any) => {
    const job = getTelmexJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'trabajo Telmex no encontrado' });
    res.json(job);
  }));
  app.post("/telmex/login", requireRole('GERENTE', 'SUPERVISOR', 'ASESOR'), enqueueTelmexAction('login'));
  app.post("/telmex/coverage", requireRole('GERENTE', 'SUPERVISOR', 'ASESOR'), enqueueTelmexAction('coverage'));
  app.post("/telmex/create-order", requireRole('GERENTE', 'SUPERVISOR', 'ASESOR'), enqueueTelmexAction('create-order'));
  app.post("/telmex/send-otp", requireRole('GERENTE', 'SUPERVISOR', 'ASESOR'), enqueueTelmexAction('send-otp'));
  app.post("/telmex/confirm-otp", requireRole('GERENTE', 'SUPERVISOR', 'ASESOR'), enqueueTelmexAction('confirm-otp'));

  app.post("/api/ai/run", requireRole('GERENTE', 'SUPERVISOR'), wrap(async (req: any, res: any) => {
    if (!req.body.prompt) return res.status(400).json({ error: 'prompt requerido' });
    res.json(await runAiWithFallback(req.body.prompt));
  }));

  app.post("/api/ai/morosity/classify", authOnly, wrap(async (req: any, res: any) => {
    if (!req.body.text) return res.status(400).json({ error: 'text requerido' });
    res.json(await classifyMorosityReply(req.body.text));
  }));

  app.get("/api/ai/jobs", requireRole('GERENTE', 'SUPERVISOR'), wrap((_req: any, res: any) => {
    res.json(AiJobs.getAll());
  }));

  app.post("/api/ai/jobs", requireRole('GERENTE', 'SUPERVISOR'), wrap((req: any, res: any) => {
    res.json(enqueueAiJob(req.body.type || 'generic', req.body.payload || {}, Number(req.body.priority ?? 5)));
  }));

  app.post("/api/ai/jobs/process-next", requireRole('GERENTE', 'SUPERVISOR'), wrap(async (_req: any, res: any) => {
    res.json(await processNextAiJob() || { ok: true, idle: true });
  }));

  // ── MIGRACIÓN DESDE LOCALSTORAGE ──────────────────────────
  // El frontend puede enviar su localStorage para persistirlo
  app.post("/api/migrate", managerOnly, wrap((req: any, res: any) => {
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

    res.json({ ok: true, migrated: results });
  }));

  // ── WHATSAPP ───────────────────────────────────────────────
  function whatsappAccountFromReq(req: any) {
    return normalizeWhatsAppAccount(req.params?.account || req.query?.account || req.body?.account);
  }

  const safeWhatsAppStatus = (status: any, role?: string) => {
    if (role === 'GERENTE' || role === 'SUPERUSER' || role === 'ADMIN') return status;
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
  app.get("/api/whatsapp/qr", opsOnly, (req: any, res) => {
    const account = whatsappAccountFromReq(req);
    res.json({ account, qr: getWhatsAppQR(account), status: getWhatsAppStatus(account) });
  });

  app.post("/api/whatsapp/init", opsOnly, wrap(async (req: any, res: any) => {
    const account = whatsappAccountFromReq(req);
    await initWhatsApp(account); res.json({ ok: true, account });
  }));

  app.post("/api/whatsapp/send", chatUserOnly, wrap(async (req: any, res: any) => {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' });
    res.json(await sendWhatsAppMessage(phone, message, whatsappAccountFromReq(req)));
  }));

  app.post("/api/whatsapp/logout", opsOnly, wrap(async (req: any, res: any) => {
    const account = whatsappAccountFromReq(req);
    await logoutWhatsApp(account); res.json({ ok: true, account });
  }));

  // Mensajes recibidos (para panel admin/gerente)
  app.get("/api/whatsapp/messages", chatUserOnly, wrap((req: any, res: any) => {
    const limit = parseLimit(req.query.limit, 100, 500);
    res.json(getRecentChannelMessages(limit, queryString(req.query.updatedSince)).filter((msg: any) => msg.channel === 'whatsapp'));
  }));

  // ── TELEGRAM ──────────────────────────────────────────────
  app.get("/api/telegram/status", chatUserOnly, wrap((_req: any, res: any) => {
    res.json(getTelegramStatus());
  }));

  app.get("/api/telegram/messages", chatUserOnly, wrap((req: any, res: any) => {
    const limit = parseLimit(req.query.limit, 100, 500);
    res.json(getRecentChannelMessages(limit, queryString(req.query.updatedSince)).filter((msg: any) => msg.channel === 'telegram'));
  }));

  app.post("/api/telegram/init", opsOnly, wrap(async (req: any, res: any) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token requerido' });
    const result = await initTelegram(token);
    if (result.ok) {
      // Persistir token solo en servidor para sobrevivir reinicios.
      Settings.set('telegram_bot_token', token);
    }
    res.json(result);
  }));

  app.post("/api/telegram/stop", opsOnly, wrap((_req: any, res: any) => {
    stopTelegram();
    Settings.set('telegram_bot_token', '');
    res.json({ ok: true });
  }));

  app.post("/api/telegram/send", chatUserOnly, wrap(async (req: any, res: any) => {
    const { chatId, message } = req.body;
    if (!chatId || !message) return res.status(400).json({ error: 'chatId y message requeridos' });
    res.json(await sendTelegramMessage(chatId, message));
  }));

  async function sendChannelMessage(channel: string, target: string, message: string) {
    if (channel === 'whatsapp') return sendWhatsAppMessage(target, message);
    if (channel === 'telegram') return sendTelegramMessage(target, message);
    throw new Error('Canal no soportado');
  }

  app.get("/api/channels/accounts", opsOnly, wrap((_req: any, res: any) => {
    res.json(getChannelAccounts());
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

  app.post("/api/agents/outbox/:id/approve", chatUserOnly, wrap(async (req: any, res: any) => {
    res.json(await approveAgentOutbox(req.params.id, req.auth, sendChannelMessage));
  }));

  app.post("/api/agents/outbox/:id/reject", chatUserOnly, wrap((req: any, res: any) => {
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
  app.get("/api/twilio/status", opsOnly, wrap((_req: any, res: any) => {
    res.json({ configured: twilioConfigured(), from: process.env.TWILIO_FROM_NUMBER || null });
  }));

  app.post("/api/twilio/calls", opsOnly, wrap(async (req: any, res: any) => {
    const to = normalizePhone10(req.body?.to || req.body?.phone);
    if (to.length !== 10) return res.status(400).json({ error: 'Telefono destino debe tener 10 digitos' });
    const message = String(req.body?.message || 'Hola, te llamamos de Heavenly Dreams para validar tu solicitud.').slice(0, 900);
    const result = await createTwilioCall(`+52${to}`, message);
    logSystem(req, 'TWILIO_CALL_CREATED', 'twilio', result.sid || to, `to:${to}`, { sid: result.sid, status: result.status });
    recordMetric('twilio.call.created', 1, { status: result.status || 'created' });
    res.json({ ok: true, sid: result.sid, status: result.status, to });
  }));

  app.get("/api/twilio/voice-agent", wrap((req: any, res: any) => {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.send(buildValidationTwiML(String(req.query.message || '')));
  }));

  app.post("/api/voice-providers/openai-realtime/twiml", wrap((req: any, res: any) => {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.send(buildOpenAIRealtimeTwiML(String(req.query.validationId || req.body?.validationId || ''), String(req.query.message || req.body?.message || '')));
  }));

  app.get("/api/voice-providers/openai-realtime/twiml", wrap((req: any, res: any) => {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.send(buildOpenAIRealtimeTwiML(String(req.query.validationId || ''), String(req.query.message || '')));
  }));

  // ── AGENTES AUTÓNOMOS ─────────────────────────────────────
  // Estado de agentes en memoria
  const agentState: Record<string, { active: boolean; lastRun: string | null; processed: number; errors: number }> = {
    capturista:  { active: false, lastRun: null, processed: 0, errors: 0 },
    archivero:   { active: false, lastRun: null, processed: 0, errors: 0 },
    consultor:   { active: false, lastRun: null, processed: 0, errors: 0 },
    validador:   { active: false, lastRun: null, processed: 0, errors: 0 },
  };

  const agentTimers: Record<string, ReturnType<typeof setInterval> | null> = {
    capturista: null, archivero: null, consultor: null, validador: null,
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
          ? `Folio ${record.folio_siac}\nEstatus: ${record.estatus_siac || 'N/D'}\nPromotora: ${record.promotor || 'N/D'}\nFecha: ${record.fecha_captura || 'N/D'}`
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
        if (result && !result.duplicate && !result.idle) agentState.capturista.processed++;
      } catch { agentState.capturista.errors++; }
    }
    agentState.capturista.lastRun = new Date().toISOString();
  }

  // Agente Consultor: responde consultas de folio SIAC en WA + Telegram
  async function runConsultorAgent() {
    const conversations = getChannelConversations(80).filter((conversation: any) => conversation.intent === 'consulta_folio' || conversation.status === 'nuevo');
    for (const conversation of conversations) {
      try {
        const result: any = await runAgentForConversation(conversation.id);
        if (result && !result.duplicate && !result.idle) agentState.consultor.processed++;
      } catch { agentState.consultor.errors++; }
    }
    agentState.consultor.lastRun = new Date().toISOString();
  }

  // Registrar handler durable en tiempo real para WhatsApp/Baileys y Telegram.
  setIncomingMessageHandler(async ({ conversation, message }) => {
    if (conversation?.channel === 'whatsapp' && String(conversation.external_chat_id || '').startsWith('clientes:')) return;
    if (!agentState.capturista.active && !agentState.consultor.active) return;
    const result: any = await runAgentForMessage(conversation, message);
    if (!result || result.duplicate) return;
    const intent = result.decision?.intent;
    if (intent === 'venta') {
      agentState.capturista.processed++;
      agentState.capturista.lastRun = new Date().toISOString();
    } else if (intent === 'consulta_folio') {
      agentState.consultor.processed++;
      agentState.consultor.lastRun = new Date().toISOString();
    }
  });

  setWhatsAppMessageHandler(null);
  setTelegramMessageHandler(() => {});

  const AGENT_RUNNERS: Record<string, () => Promise<void>> = {
    capturista: runCapturistaAgent,
    consultor: runConsultorAgent,
    archivero: async () => { agentState.archivero.lastRun = new Date().toISOString(); },
    validador: async () => { agentState.validador.lastRun = new Date().toISOString(); },
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
    if (state.active) startAgentTimer(agent).catch(() => {
      agentState[agent].active = false;
      agentState[agent].errors++;
      persistAgentState();
    });
  }

  app.get("/api/agents/status", chatUserOnly, wrap((_req: any, res: any) => {
    res.json(agentState);
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

    if (replace) (db as any).prepare(`DELETE FROM ${table}`).run();

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
    AuditLog.insert({ accion: 'IMPORT_TABLE', entidad: table, entidad_id: null, user_id: null, user_nombre: null, detalle: `imported:${imported}` });
    res.json({ imported, skipped });
  }));

  app.delete("/api/db/clear/:table", managerOnly, wrap((req: any, res: any) => {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ error: 'Tabla no permitida' });
    (db as any).prepare(`DELETE FROM ${table}`).run();
    AuditLog.insert({ accion: 'CLEAR_TABLE', entidad: table, entidad_id: null, user_id: null, user_nombre: null, detalle: null });
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
    const startedAt = Date.now();
    try {
      const result = await runner(imgs);
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
        images: imgs.length,
        manualRequired: Boolean(result.manualRequired),
        warning: result.warning,
      };
      console.log(`[OCR-${docType}]`, result.provider, result.model, `${result.durationMs}ms`, `total=${totalDurationMs}ms`, `${imgs.length}img`, JSON.stringify(result.fields));
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
      });
    } catch (err: any) {
      recordOcrTelemetry(req, 'failed', docType, { error: err?.message || String(err), images: imgs.length });
      throw err;
    }
  }

  // ── OCR MULTI-MODELO Y AUTOMATIZABLE ──────────────────────────────────────
  // Acepta { image: "..." } o { images: ["frente","reverso"] } — múltiples mejoran precisión.
  app.post("/api/vision/ocr", authOnly, wrap(async (req: any, res: any) => {
    return runOcrEndpoint(req, res, 'ine', runIneOcr);
  }));

  app.post("/api/vision/siac", authOnly, wrap(async (req: any, res: any) => {
    return runOcrEndpoint(req, res, 'siac', runSiacOcr);
  }));

  app.post("/api/vision/comprobante", authOnly, wrap(async (req: any, res: any) => {
    return runOcrEndpoint(req, res, 'comprobante', runComprobanteOcr);
  }));

  app.get("/api/vision/status", authOnly, wrap(async (_req: any, res: any) => {
    const status = await checkOcrStatus();
    res.json(status);
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

  // Auto-reconectar Telegram si había token guardado
  const savedToken = Settings.get('telegram_bot_token');
  if (savedToken) {
    initTelegram(savedToken)
      .then(r => r.ok
        ? console.log(`[TG] Auto-reconectado como @${r.botName}`)
        : console.warn('[TG] Token guardado inválido:', r.error))
      .catch(e => console.warn('[TG] Error auto-reconectando:', e.message));
  }

  const onListening = () => {
    console.log(`[DB] Base de datos: data/heavenlydreams.db`);
    console.log(`[SIAC] Registros en DB: ${SiacRecords.count()}`);
    console.log(`Server running on http://${HOST || 'localhost'}:${PORT}`);
  };
  const server = createHttpServer(app);
  attachOpenAIRealtimeStream(server);
  if (HOST) server.listen(PORT, HOST, onListening);
  else server.listen(PORT, onListening);
}

startServer();
