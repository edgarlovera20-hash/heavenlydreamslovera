/**
 * OCR documental local con fallback en cascada:
 *   1. Ollama (local/remoto)   — primario, requiere OLLAMA_URL
 *   2. Tesseract.js            — fallback offline, sin red ni API key
 *
 * Si ambos fallan, lanza error.
 *
 * Variables de entorno:
 *   OLLAMA_URL         — URL del servidor Ollama (default: http://127.0.0.1:11434)
 *   OLLAMA_API_KEY     — opcional, solo si usas un proxy autenticado
 *   OLLAMA_MODEL       — modelo local/remoto para OCR visual (default: glm-ocr:latest)
 *   OLLAMA_TIMEOUT_MS  — timeout para OCR Ollama (default: 135000)
 *   OCR_PRIMARY        — opcional, fuerza proveedor primario: 'ollama' | 'tesseract'
 *   OCR_STRATEGY       — 'adaptive' | 'quality' | 'fast' | 'local'
 *   OCR_ORDER_INE      — opcional, orden por documento: "ollama,tesseract"
 *   OCR_IMAGE_MAX_SIDE — tamaño máximo recomendado por server.ts antes de llamar proveedores
 *   OCR_CACHE_TTL_MS   — cache anti-repetición de resultados OCR
 */

import { createHash } from 'node:crypto';
import { getOllamaApiKey, getOllamaOcrModel, getOllamaUrl, getOllamaUrlSource } from './ai-config';
import { runTesseractIne, runTesseractComprobante, runTesseractSiac, shutdownTesseract, parseOcrText } from './ocr-tesseract';

const OLLAMA_URL        = getOllamaUrl();
const OLLAMA_API_KEY    = getOllamaApiKey();
const OCR_PRIMARY       = (process.env.OCR_PRIMARY || 'ollama').toLowerCase();
const OCR_STRATEGY      = (process.env.OCR_STRATEGY || 'local').toLowerCase();

const OLLAMA_MODEL    = getOllamaOcrModel();

function parseTimeoutEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  if (Number.isFinite(value) && value === 0) return 0;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const TIMEOUT_MS_LLM       = parseTimeoutEnv('OCR_LLM_TIMEOUT_MS', 45_000);  // 0 desactiva timeout
const TIMEOUT_MS_OLLAMA    = parseTimeoutEnv('OLLAMA_TIMEOUT_MS', TIMEOUT_MS_LLM > 0 ? TIMEOUT_MS_LLM * 3 : 0);
const TIMEOUT_MS_TESSERACT = parseTimeoutEnv('OCR_TESSERACT_TIMEOUT_MS', 30_000);
const MAX_OUTPUT_TOKENS    = parsePositiveIntEnv('OCR_MAX_OUTPUT_TOKENS', 900);
const OLLAMA_NUM_CTX       = parsePositiveIntEnv('OCR_OLLAMA_NUM_CTX', 4096);
const OLLAMA_KEEP_ALIVE    = process.env.OLLAMA_KEEP_ALIVE || '30m';
const CACHE_TTL_MS         = parsePositiveIntEnv('OCR_CACHE_TTL_MS', 60 * 60 * 1000);
const CACHE_MAX_ENTRIES    = parsePositiveIntEnv('OCR_CACHE_MAX_ENTRIES', 250);

const VALID_PROVIDER_NAMES = ['ollama', 'tesseract'] as const;

export type OcrProvider = typeof VALID_PROVIDER_NAMES[number];
export type OcrDocType  = 'ine' | 'comprobante' | 'siac' | 'financial';
export type OcrStrategy = 'adaptive' | 'quality' | 'fast' | 'local';

export interface OcrResult {
  text: string;
  fields: Record<string, string>;
  provider: OcrProvider;
  model: string;
  durationMs: number;
  fallbackReason?: string; // por qué se cayó al siguiente proveedor
  strategy?: string;
  providerOrder?: OcrProvider[];
  attempts?: string[];
  fieldsCount?: number;
  manualRequired?: boolean;
  warning?: string;
  quality?: {
    blurry: boolean;
    cropped: boolean;
    dark: boolean;
    glare: boolean;
    illegible: boolean;
    notes: string[];
  };
  documentType?: 'INE' | 'CURP' | 'COMPROBANTE' | 'SIAC' | 'FINANCIERO' | 'DESCONOCIDO';
  fraudSignals?: string[];
}

type CachedOcrResult = OcrResult & { cached?: boolean };

const ocrCache = new Map<string, { expiresAt: number; result: OcrResult }>();
const inflightOcr = new Map<string, Promise<CachedOcrResult>>();

// ─── PROMPTS (compartidos por Ollama y fallback local) ───────────────────────

const INE_PROMPT = `You are a precise OCR system for Mexican INE/IFE identity cards. You may receive 1-2 images (front and/or back of the same card).

CRITICAL — read text EXACTLY as printed. Do not invent, guess, or auto-correct names.

STRUCTURE of an INE card (front side):
- Top: "INSTITUTO NACIONAL ELECTORAL — CREDENCIAL PARA VOTAR"
- "NOMBRE" label, then 3 lines in this exact order:
    line 1 = APELLIDO PATERNO (first surname, all uppercase)
    line 2 = APELLIDO MATERNO (second surname, all uppercase)
    line 3 = NOMBRE(S) (given names, all uppercase)
- "DOMICILIO" label, then 3-4 lines:
    line 1 = street + number (e.g. "C ELOY CAVAZOS MZA 12 LT 9")
    line 2 = colonia/neighborhood with CP (e.g. "57710 COL SAN MIGUEL TEOTONGO")
    line 3 = municipio + state (e.g. "IZTAPALAPA, CDMX")
- "CLAVE DE ELECTOR" — 18 alphanumeric chars (mix of letters + numbers)
- "CURP" — 18 chars: 4 LETTERS + 6 DIGITS + 1 LETTER (H or M for sex) + 5 LETTERS + 1 alphanumeric + 1 DIGIT
- "FECHA DE NACIMIENTO" — DD/MM/YYYY
- "SEXO" — H or M

VALIDATION rules — apply BEFORE outputting:
1. CURP MUST match pattern: [A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]
2. CLAVE DE ELECTOR is DIFFERENT from CURP (do not confuse them)
3. Surnames and names are in UPPERCASE Spanish letters only (A-Z, Ñ, accents)
4. If a field is unreadable, leave it as "" — DO NOT fabricate

Respond ONLY with this exact JSON (no markdown, no commentary):

{
  "nombres": "",
  "apellidoPaterno": "",
  "apellidoMaterno": "",
  "curp": "",
  "folioIne": "",
  "fechaNacimiento": "",
  "sexo": "",
  "estadoNacimiento": "",
  "calle": "",
  "numeroExterior": "",
  "numeroInterior": "",
  "colonia": "",
  "codigoPostal": "",
  "delegacion": "",
  "ciudad": "",
  "rawText": "every line of text you can read, separated by \\n"
}`;

const COMPROBANTE_PROMPT = `You are an OCR system for Mexican utility bills / proof of address documents (CFE electricity, Izzi cable, Totalplay, Telmex, water, gas).

These bills have the customer's name and full installation address printed near the top.

Respond ONLY with a valid JSON object (use "" if not found):

{
  "nombres": "given name(s)",
  "apellidoPaterno": "first surname",
  "apellidoMaterno": "second surname",
  "prefijoCalle": "street prefix/type if visible: Calle, Avenida, Av., Prolongación, Prol., Circuito, Calzada, Boulevard, Privada, Cerrada, etc.",
  "calle": "street name without prefix and without number when possible (e.g. SAN LORENZO)",
  "numeroExterior": "exterior number if separate",
  "numeroInterior": "interior/department number if exists",
  "edificio": "building/tower/block if visible",
  "departamento": "department/apartment/depto if visible",
  "piso": "floor/piso/nivel if visible",
  "torre": "tower/torre if visible",
  "manzana": "manzana/Mz. if visible",
  "lote": "lote/Lt. if visible",
  "privada": "private street/privada if visible",
  "sector": "sector if visible",
  "etapa": "stage/etapa if visible",
  "unidadHabitacional": "housing unit/unidad habitacional if visible",
  "referencias": "address references if visible",
  "colonia": "colonia/fraccionamiento/section",
  "codigoPostal": "5-digit postal code",
  "delegacion": "delegación/alcaldía/municipio",
  "ciudad": "city or state (e.g. Ciudad de México, MEX)",
  "proveedor": "company: CFE, Izzi, Totalplay, Telmex, etc.",
  "rawText": "all visible text exactly as it appears"
}

Do NOT include explanations, markdown, or text outside the JSON.`;

const SIAC_PROMPT = `You are an OCR system reading a SIAC (Telmex internal system) confirmation screenshot.

This screen confirms that a sale was registered. Typical fields shown:
- "Folio SIAC:" followed by 8-10 digit number
- "Servicio solicitado:" followed by a 3-4 digit code
- "Datos de contacto" with the customer's full name
- "Celular de contacto" with 10-digit phone
- "Correo electrónico" with an email address

Extract ONLY these fields. Respond with valid JSON (use "" if not found):

{
  "folioSiac": "Folio SIAC number, e.g. 151500304",
  "servicio": "service code, e.g. 389",
  "nombreCompleto": "customer full name as shown",
  "celular": "10-digit phone number",
  "correo": "email address",
  "gastosInstalacion": "installation fees text",
  "rawText": "all visible text"
}

Do NOT include explanations, markdown, or text outside the JSON.`;

const FINANCIAL_PROMPT = `You are an expert financial OCR system for Telmex/SocioMax weekly payment screenshots.

The screenshot may contain a table with financial amounts. Extract exactly these fields when visible.
Use numbers only for money fields. Do not invent values. If a field is missing, use "".

Respond ONLY with valid JSON:

{
  "semana": "",
  "anio": "",
  "empresa": "",
  "gerente": "",
  "pagoGerente": "",
  "pagoPromotor": "",
  "iva": "",
  "descuentos": "",
  "totalPagoGerente": "",
  "totalPagoPromotor": "",
  "totalFacturar": "",
  "rawText": "all visible text exactly as read"
}

Do NOT include markdown or explanations.`;

const PROMPTS: Record<OcrDocType, string> = {
  ine: INE_PROMPT,
  comprobante: COMPROBANTE_PROMPT,
  siac: SIAC_PROMPT,
  financial: FINANCIAL_PROMPT,
};

// ─── UTILS ───────────────────────────────────────────────────────────────────

function stripDataUrl(base64: string): string {
  return base64.replace(/^data:[^;]+;base64,/, '');
}

function parseJsonResponse(raw: string): Record<string, string> {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const obj = JSON.parse(match[0]);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function modelTagMatches(availableModel: string, configuredModel: string): boolean {
  if (availableModel === configuredModel) return true;
  if (!configuredModel.includes(':') && availableModel === `${configuredModel}:latest`) return true;
  if (!availableModel.includes(':') && configuredModel === `${availableModel}:latest`) return true;
  return false;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  if (!ms) return p;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number, label: string) {
  if (!ms) return fetch(url, init);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error(`${label} timeout (${ms}ms)`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── VALIDACIÓN DE OUTPUT (rechaza basura, fuerza fallback) ──────────────────

const CURP_RE        = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
const CP_RE          = /^\d{5}$/;
const PHONE_RE       = /^\d{10}$/;
const FOLIO_SIAC_RE  = /^\d{6,12}$/;
const PERSON_FIELDS  = ['nombres', 'apellidoPaterno', 'apellidoMaterno'];
const NAME_PARTICLES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'SAN', 'SANTA']);
const OCR_NAME_STOPWORDS = new Set([
  'NOMBRE', 'NOMBRES', 'APELLIDO', 'PATERNO', 'MATERNO', 'DOMICILIO', 'CALLE',
  'COLONIA', 'MUNICIPIO', 'ESTADO', 'MEXICO', 'INSTITUTO', 'NACIONAL',
  'ELECTORAL', 'CREDENCIAL', 'VOTAR', 'CLAVE', 'ELECTOR', 'CURP', 'SECCION',
  'VIGENCIA', 'EMISION', 'REGISTRO', 'FECHA', 'NACIMIENTO', 'SEXO', 'FIRMA',
]);

function deburr(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizePersonName(value: any) {
  return deburr(String(value || ''))
    .toUpperCase()
    .replace(/[^A-ZÑ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlausibleName(value: any) {
  const normalized = normalizePersonName(value);
  if (!normalized || normalized.length < 3 || normalized.length > 60) return false;
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0 || tokens.length > 6) return false;
  let significant = 0;
  for (const token of tokens) {
    if (NAME_PARTICLES.has(token)) continue;
    if (OCR_NAME_STOPWORDS.has(token)) return false;
    if (token.length < 3 || token.length > 24) return false;
    if (!/[AEIOU]/.test(token) || !/[BCDFGHJKLMNPQRSTVWXYZÑ]/.test(token)) return false;
    if (/^([A-ZÑ])\1+$/.test(token)) return false;
    significant++;
  }
  return significant > 0;
}

function hasSuspiciousNameSet(fields: Record<string, string>) {
  const parts = [fields.nombres, fields.apellidoPaterno, fields.apellidoMaterno]
    .map(normalizePersonName)
    .filter(Boolean);
  if (parts.length < 3) return false;
  return new Set(parts).size === 1 || (parts[0].length > 4 && (parts[0] === parts[1] || parts[0] === parts[2]));
}

const CURP_STATE_CODES: Record<string, string> = {
  AS: 'AGUASCALIENTES',
  BC: 'BAJA CALIFORNIA',
  BS: 'BAJA CALIFORNIA SUR',
  CC: 'CAMPECHE',
  CL: 'COAHUILA',
  CM: 'COLIMA',
  CS: 'CHIAPAS',
  CH: 'CHIHUAHUA',
  DF: 'CIUDAD DE MEXICO',
  DG: 'DURANGO',
  GT: 'GUANAJUATO',
  GR: 'GUERRERO',
  HG: 'HIDALGO',
  JC: 'JALISCO',
  MC: 'ESTADO DE MEXICO',
  MN: 'MICHOACAN',
  MS: 'MORELOS',
  NT: 'NAYARIT',
  NL: 'NUEVO LEON',
  OC: 'OAXACA',
  PL: 'PUEBLA',
  QT: 'QUERETARO',
  QR: 'QUINTANA ROO',
  SP: 'SAN LUIS POTOSI',
  SL: 'SINALOA',
  SR: 'SONORA',
  TC: 'TABASCO',
  TS: 'TAMAULIPAS',
  TL: 'TLAXCALA',
  VZ: 'VERACRUZ',
  YN: 'YUCATAN',
  ZS: 'ZACATECAS',
  NE: 'NACIDO EN EL EXTRANJERO',
};

function birthDateFromCurp(curp: string) {
  const yy = Number(curp.slice(4, 6));
  const mm = curp.slice(6, 8);
  const dd = curp.slice(8, 10);
  const currentYear = new Date().getFullYear() % 100;
  const century = yy > currentYear ? 1900 : 2000;
  return `${dd}/${mm}/${century + yy}`;
}

function enrichDerivedIneFields(fields: Record<string, string>) {
  const out = { ...fields };
  if (out.curp && CURP_RE.test(out.curp)) {
    if (!out.fechaNacimiento) out.fechaNacimiento = birthDateFromCurp(out.curp);
    if (!out.sexo) out.sexo = out.curp.charAt(10);
    const state = CURP_STATE_CODES[out.curp.slice(11, 13)];
    if (state && !out.estadoNacimiento) out.estadoNacimiento = state;
  }
  return out;
}

function enrichFieldsFromText(docType: OcrDocType, fields: Record<string, string>, text: string) {
  if (!text || docType === 'financial') return fields;
  const parsed = parseOcrText(docType, text);
  return {
    ...parsed,
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => String(value || '').trim())),
  };
}

function sanitizeFields(docType: OcrDocType, fields: Record<string, string>) {
  const clean: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(fields || {})) {
    const value = String(rawValue || '').trim();
    if (!value) continue;
    if (PERSON_FIELDS.includes(key)) {
      if (isPlausibleName(value)) clean[key] = normalizePersonName(value);
      continue;
    }
    if (key === 'curp') {
      const curp = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (CURP_RE.test(curp)) clean.curp = curp;
      continue;
    }
    if (key === 'fechaNacimiento') {
      const date = value.replace(/[^\d/-]/g, '').replace(/-/g, '/');
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) clean.fechaNacimiento = date;
      continue;
    }
    if (key === 'sexo') {
      const sex = value.trim().charAt(0).toUpperCase();
      if (sex === 'H' || sex === 'M') clean.sexo = sex;
      continue;
    }
    if (key === 'estadoNacimiento') {
      clean.estadoNacimiento = deburr(value).toUpperCase().replace(/[^A-ZÑ\s]/g, ' ').replace(/\s+/g, ' ').trim();
      continue;
    }
    if (key === 'codigoPostal') {
      const cp = value.replace(/\D/g, '').slice(0, 5);
      if (CP_RE.test(cp)) clean.codigoPostal = cp;
      continue;
    }
    if (key === 'folioIne' || key === 'claveElector') {
      const folio = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (/^[A-Z0-9]{9,18}$/.test(folio) && !CURP_RE.test(folio)) clean.folioIne = folio;
      continue;
    }
    if (docType === 'siac' && key === 'celular') {
      const phone = value.replace(/\D/g, '');
      if (PHONE_RE.test(phone)) clean.celular = phone;
      continue;
    }
    clean[key] = value;
  }
  return docType === 'ine' ? enrichDerivedIneFields(clean) : clean;
}

/**
 * Devuelve true si el output del modelo parece coherente con el tipo de documento.
 * Si devuelve false, el orquestador descarta el resultado y prueba el siguiente proveedor.
 */
function validateFields(docType: OcrDocType, fields: Record<string, string>): { ok: boolean; reason?: string } {
  if (docType === 'ine') {
    // CURP es el campo más fácil de validar — si está mal o ausente, casi seguro el OCR falló
    if (fields.curp && !CURP_RE.test(fields.curp.toUpperCase())) {
      return { ok: false, reason: `CURP inválido: "${fields.curp}"` };
    }
    if (fields.codigoPostal && !CP_RE.test(fields.codigoPostal)) {
      return { ok: false, reason: `CP inválido: "${fields.codigoPostal}"` };
    }
    const hasFullName = Boolean(fields.nombres && fields.apellidoPaterno && fields.apellidoMaterno);
    const hasTrustedId = Boolean(fields.curp || fields.folioIne);
    if (hasFullName && hasSuspiciousNameSet(fields)) {
      return { ok: false, reason: 'Nombre OCR repetido o sospechoso' };
    }
    if (!hasFullName && !hasTrustedId) {
      return { ok: false, reason: 'Sin identidad confiable detectada' };
    }
    if (!fields.curp && !hasFullName && (fields.nombres || fields.apellidoPaterno || fields.apellidoMaterno)) {
      return { ok: false, reason: 'Nombre incompleto o de baja confianza' };
    }
  }
  if (docType === 'siac') {
    if (fields.folioSiac && !FOLIO_SIAC_RE.test(fields.folioSiac)) {
      return { ok: false, reason: `Folio SIAC inválido: "${fields.folioSiac}"` };
    }
    if (fields.celular && !PHONE_RE.test(fields.celular)) {
      return { ok: false, reason: `Celular inválido: "${fields.celular}"` };
    }
  }
  if (docType === 'comprobante') {
    if (fields.codigoPostal && !CP_RE.test(fields.codigoPostal)) {
      return { ok: false, reason: `CP inválido: "${fields.codigoPostal}"` };
    }
  }
  return { ok: true };
}

function cacheKey(docType: OcrDocType, images: string[]) {
  const hash = createHash('sha256');
  hash.update(docType);
  for (const image of images) hash.update(stripDataUrl(image));
  return hash.digest('hex');
}

function getCached(key: string): OcrResult | null {
  const item = ocrCache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    ocrCache.delete(key);
    return null;
  }
  ocrCache.delete(key);
  ocrCache.set(key, item);
  return {
    ...item.result,
    durationMs: 0,
    fallbackReason: item.result.fallbackReason ? `${item.result.fallbackReason} | cache-hit` : 'cache-hit',
  };
}

function setCached(key: string, result: OcrResult) {
  if (ocrCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = ocrCache.keys().next().value;
    if (oldest) ocrCache.delete(oldest);
  }
  ocrCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result: { ...result } });
}

// ─── PROVIDER 1: Ollama (local/remoto privado) ──────────────────────────────

async function callOllama(prompt: string, base64Images: string[]): Promise<string> {
  if (!OLLAMA_URL) throw new Error('Ollama local no configurado');

  // Ollama espera el base64 PURO (sin prefijo data:image/...;base64,)
  const imageBlocks = base64Images.map(b64 => stripDataUrl(b64));

  const payload: any = {
    model: OLLAMA_MODEL,
    stream: false,
    format: 'json',
    keep_alive: OLLAMA_KEEP_ALIVE,
    messages: [{
      role: 'user',
      content: prompt,
      images: imageBlocks,
    }],
    options: {
      temperature: 0.0,
      num_predict: MAX_OUTPUT_TOKENS,
      num_ctx: OLLAMA_NUM_CTX,
    },
  };

  const res = await fetchWithTimeout(
    `${OLLAMA_URL}/api/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(OLLAMA_API_KEY && { 'Authorization': `Bearer ${OLLAMA_API_KEY}` }),
      },
      body: JSON.stringify(payload),
    },
    TIMEOUT_MS_OLLAMA, // Ollama local puede tardar más en primera ejecución
    'Ollama'
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  return data?.message?.content || data?.response || '';
}

async function checkOllamaHealth() {
  if (!OLLAMA_URL) {
    return {
      configured: false,
      reachable: false,
      model: OLLAMA_MODEL,
      url: OLLAMA_URL,
      source: getOllamaUrlSource(),
      timeoutMs: TIMEOUT_MS_OLLAMA,
      models: [] as string[],
      hasModel: false,
      error: 'Ollama local no configurado',
    };
  }

  try {
    const res = await fetchWithTimeout(
      `${OLLAMA_URL}/api/tags`,
      {
        method: 'GET',
        headers: {
          ...(OLLAMA_API_KEY && { 'Authorization': `Bearer ${OLLAMA_API_KEY}` }),
        },
      },
      Math.min(TIMEOUT_MS_OLLAMA, 10_000),
      'Ollama health'
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        configured: true,
        reachable: false,
        model: OLLAMA_MODEL,
        url: OLLAMA_URL,
        source: getOllamaUrlSource(),
        timeoutMs: TIMEOUT_MS_OLLAMA,
        models: [] as string[],
        hasModel: false,
        error: `Ollama ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = await res.json() as any;
    const models = Array.isArray(data?.models)
      ? data.models
          .map((item: any) => String(item?.name || item?.model || '').trim())
          .filter(Boolean)
      : [];
    return {
      configured: true,
      reachable: true,
      model: OLLAMA_MODEL,
      url: OLLAMA_URL,
      source: getOllamaUrlSource(),
      timeoutMs: TIMEOUT_MS_OLLAMA,
      models,
      hasModel: models.some(model => modelTagMatches(model, OLLAMA_MODEL)),
    };
  } catch (err: any) {
    return {
      configured: true,
      reachable: false,
      model: OLLAMA_MODEL,
      url: OLLAMA_URL,
      source: getOllamaUrlSource(),
      timeoutMs: TIMEOUT_MS_OLLAMA,
      models: [] as string[],
      hasModel: false,
      error: err?.message || String(err),
    };
  }
}

// ─── PROVIDER 4: Tesseract.js (delegado a ocr-tesseract.ts) ──────────────────

async function callTesseract(docType: OcrDocType, base64Images: string[]): Promise<{ text: string; fields: Record<string, string> }> {
  // Tesseract solo procesa 1 imagen a la vez — recorremos y mergeamos los campos
  const merged: Record<string, string> = {};
  const texts: string[] = [];
  const runner = docType === 'ine'
    ? runTesseractIne
    : docType === 'comprobante'
      ? runTesseractComprobante
      : runTesseractSiac;
  for (const b64 of base64Images) {
    const stripped = stripDataUrl(b64);
    let r: { text: string; fields: Record<string, string> };
    try {
      r = await withTimeout(runner(stripped), TIMEOUT_MS_TESSERACT, 'Tesseract');
    } catch (err: any) {
      if (String(err?.message || '').includes('Tesseract timeout')) {
        await shutdownTesseract().catch(() => undefined);
      }
      throw err;
    }
    texts.push(r.text);
    for (const [k, v] of Object.entries(r.fields)) {
      if (v && (!merged[k] || v.length > merged[k].length)) merged[k] = v;
    }
  }
  return { text: texts.join('\n---\n'), fields: merged };
}

// ─── ORQUESTADOR CON FALLBACK ────────────────────────────────────────────────

const VALID_PROVIDERS: OcrProvider[] = [...VALID_PROVIDER_NAMES];

const DOC_ORDERS: Record<OcrDocType, Record<OcrStrategy, OcrProvider[]>> = {
  ine: {
    adaptive: ['ollama', 'tesseract'],
    quality: ['ollama', 'tesseract'],
    fast: ['ollama', 'tesseract'],
    local: ['ollama', 'tesseract'],
  },
  comprobante: {
    adaptive: ['ollama', 'tesseract'],
    quality: ['ollama', 'tesseract'],
    fast: ['ollama', 'tesseract'],
    local: ['ollama', 'tesseract'],
  },
  siac: {
    adaptive: ['ollama', 'tesseract'],
    quality: ['ollama', 'tesseract'],
    fast: ['ollama', 'tesseract'],
    local: ['ollama', 'tesseract'],
  },
  financial: {
    adaptive: ['ollama', 'tesseract'],
    quality: ['ollama', 'tesseract'],
    fast: ['ollama', 'tesseract'],
    local: ['ollama', 'tesseract'],
  },
};

function currentStrategy(): OcrStrategy {
  return (['adaptive', 'quality', 'fast', 'local'].includes(OCR_STRATEGY) ? OCR_STRATEGY : 'local') as OcrStrategy;
}

function parseProviderList(value?: string | null): OcrProvider[] {
  if (!value) return [];
  const providers: OcrProvider[] = [];
  for (const item of value.split(',')) {
    const provider = item.trim().toLowerCase() as OcrProvider;
    if (VALID_PROVIDERS.includes(provider) && !providers.includes(provider)) {
      providers.push(provider);
    }
  }
  return providers;
}

function uniqueProviders(providers: OcrProvider[]): OcrProvider[] {
  const unique: OcrProvider[] = [];
  for (const provider of providers) {
    if (!unique.includes(provider)) unique.push(provider);
  }
  return unique;
}

function completeOrder(preferred: OcrProvider[]): OcrProvider[] {
  const uniquePreferred = uniqueProviders(preferred);
  return [...uniquePreferred, ...VALID_PROVIDERS.filter(provider => !uniquePreferred.includes(provider))];
}

function providerOrderFor(docType: OcrDocType): OcrProvider[] {
  const envOrder = parseProviderList(process.env[`OCR_ORDER_${docType.toUpperCase()}`]);
  const forcedPrimary = parseProviderList(OCR_PRIMARY);
  const strategy = currentStrategy();
  const baseOrder = envOrder.length ? envOrder : DOC_ORDERS[docType][strategy];
  return completeOrder([...forcedPrimary, ...baseOrder]);
}

function localDocumentType(docType: OcrDocType, fields: Record<string, string>, text: string): OcrResult['documentType'] {
  const haystack = `${Object.values(fields).join(' ')} ${text}`.toUpperCase();
  if (docType === 'ine' || /CREDENCIAL PARA VOTAR|INSTITUTO NACIONAL ELECTORAL|CLAVE DE ELECTOR/.test(haystack)) return 'INE';
  if (/CURP/.test(haystack) && /[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/.test(haystack)) return 'CURP';
  if (docType === 'comprobante' || /COMPROBANTE|DOMICILIO|CFE|TELMEX|RECIBO|PREDIAL/.test(haystack)) return 'COMPROBANTE';
  if (docType === 'siac' || /SIAC|FOLIO|POSTEADA|ABIERTA|CANCELADA/.test(haystack)) return 'SIAC';
  if (docType === 'financial' || /PAGO|ADEUDO|SALDO|MOROSIDAD|FACTURA/.test(haystack)) return 'FINANCIERO';
  return 'DESCONOCIDO';
}

function enrichLocalSignals(docType: OcrDocType, result: OcrResult): OcrResult {
  const normalizedText = (result.text || '').toLowerCase();
  const filledFields = Object.values(result.fields || {}).filter(value => String(value || '').trim()).length;
  const documentType = localDocumentType(docType, result.fields, result.text);
  const quality = {
    blurry: /borros|blur|desenfoc/.test(normalizedText),
    cropped: /cortad|recortad|incomplet/.test(normalizedText),
    dark: /oscur|dark|sombra/.test(normalizedText),
    glare: /reflej|brillo|glare/.test(normalizedText),
    illegible: filledFields === 0 || /ilegible|no legible|unreadable/.test(normalizedText),
    notes: [] as string[],
  };

  if (!result.text || result.text.trim().length < 40) {
    quality.notes.push('Texto insuficiente para validar legibilidad.');
    quality.illegible = true;
  }
  if (filledFields <= 1) quality.notes.push('Pocos campos detectados; se recomienda captura manual.');
  if (quality.blurry) quality.notes.push('Posible imagen borrosa.');
  if (quality.cropped) quality.notes.push('Posible documento cortado o incompleto.');
  if (quality.dark) quality.notes.push('Posible imagen oscura.');
  if (quality.glare) quality.notes.push('Posible reflejo en el documento.');

  const fraudSignals: string[] = [];
  if (/screenshot|captura de pantalla|screen capture/.test(normalizedText)) fraudSignals.push('captura pantalla');
  if (/editad|alterad|manipulad|fake|fals/.test(normalizedText)) fraudSignals.push('posible edición');
  if (documentType === 'INE' && result.fields?.curp && !/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i.test(String(result.fields.curp))) {
    fraudSignals.push('CURP inconsistente');
  }
  if (quality.illegible || quality.cropped || filledFields === 0) fraudSignals.push('documento incompleto');

  return {
    ...result,
    documentType,
    quality,
    fraudSignals: Array.from(new Set(fraudSignals)),
  };
}

async function tryProvider(provider: OcrProvider, docType: OcrDocType, images: string[]): Promise<OcrResult> {
  const t0 = Date.now();
  const prompt = PROMPTS[docType];

  if (provider === 'ollama') {
    const raw = await callOllama(prompt, images);
    if (!raw) throw new Error('Ollama devolvió respuesta vacía');
    const parsed = parseJsonResponse(raw);
    const text = parsed.rawText || raw;
    delete parsed.rawText;
    const fields = sanitizeFields(docType, enrichFieldsFromText(docType, parsed, text));
    return enrichLocalSignals(docType, { text, fields, provider, model: OLLAMA_MODEL, durationMs: Date.now() - t0 });
  }

  // tesseract
  const { text, fields } = await callTesseract(docType, images);
  return enrichLocalSignals(docType, {
    text,
    fields: sanitizeFields(docType, enrichFieldsFromText(docType, fields, text)),
    provider,
    model: 'tesseract-spa',
    durationMs: Date.now() - t0,
  });
}

export async function runOcrWithFallback(docType: OcrDocType, images: string | string[]): Promise<CachedOcrResult> {
  const imgs = (Array.isArray(images) ? images : [images]).filter(Boolean);
  if (imgs.length === 0) throw new Error('No se proporcionaron imágenes');

  const key = cacheKey(docType, imgs);
  const cached = getCached(key);
  if (cached) {
    console.log(`[OCR-${docType}] cache hit (${imgs.length}img)`);
    return { ...cached, cached: true };
  }
  const inflight = inflightOcr.get(key);
  if (inflight) {
    console.log(`[OCR-${docType}] reuse inflight (${imgs.length}img)`);
    const result = await inflight;
    return { ...result, cached: true, fallbackReason: result.fallbackReason ? `${result.fallbackReason} | inflight-hit` : 'inflight-hit' };
  }

  const run = (async (): Promise<CachedOcrResult> => {

    const errors: string[] = [];
    let bestPartial: OcrResult | null = null;

    const providerOrder = providerOrderFor(docType);
    const strategy = currentStrategy();

    for (const provider of providerOrder) {
      if (provider === 'ollama' && !OLLAMA_URL) { errors.push('ollama: sin servidor local'); continue; }

      try {
        const result = await tryProvider(provider, docType, imgs);

        // Validación de output — si parece basura, intentamos el siguiente proveedor
        const valid = validateFields(docType, result.fields);
        if (!valid.ok) {
          console.warn(`[OCR-${docType}] ${provider} output rechazado: ${valid.reason}`);
          errors.push(`${provider} output inválido (${valid.reason})`);
          const partialFieldsCount = Object.values(result.fields).filter(value => String(value || '').trim()).length;
          result.strategy = strategy;
          result.providerOrder = providerOrder;
          result.attempts = [...errors];
          result.fieldsCount = partialFieldsCount;
          result.manualRequired = true;
          result.warning = valid.reason || 'OCR sin campos confiables';
          if (!bestPartial || partialFieldsCount > (bestPartial.fieldsCount || 0) || result.text.length > bestPartial.text.length) {
            bestPartial = {
              ...result,
              fields: { ...result.fields },
              providerOrder: [...providerOrder],
              attempts: [...result.attempts],
            };
          }
          continue;
        }

        const fieldsCount = Object.values(result.fields).filter(value => String(value || '').trim()).length;
        if (errors.length) result.fallbackReason = errors.join(' | ');
        result.strategy = strategy;
        result.providerOrder = providerOrder;
        result.attempts = [...errors, `${provider}: ok`];
        result.fieldsCount = fieldsCount;
        console.log(`[OCR-${docType}] ${provider} OK in ${result.durationMs}ms (${fieldsCount} fields)`);
        setCached(key, result);
        return result;
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.warn(`[OCR-${docType}] ${provider} falló: ${msg}`);
        errors.push(`${provider}: ${msg}`);
      }
    }

    if (bestPartial) {
      bestPartial.fallbackReason = errors.join(' | ');
      bestPartial.attempts = errors;
      console.warn(`[OCR-${docType}] sin campos confiables; se devuelve respuesta parcial para captura manual`);
      setCached(key, bestPartial);
      return bestPartial;
    }

    throw new Error(`Todos los proveedores OCR fallaron — ${errors.join(' | ')}`);
  })();

  inflightOcr.set(key, run);
  try {
    return await run;
  } finally {
    inflightOcr.delete(key);
  }
}

// ─── API PÚBLICA ─────────────────────────────────────────────────────────────

export async function runIneOcr(images: string | string[]): Promise<CachedOcrResult> {
  return runOcrWithFallback('ine', images);
}

export async function runComprobanteOcr(images: string | string[]): Promise<CachedOcrResult> {
  return runOcrWithFallback('comprobante', images);
}

export async function runSiacOcr(images: string | string[]): Promise<CachedOcrResult> {
  return runOcrWithFallback('siac', images);
}

export async function runFinancialOcr(images: string | string[]): Promise<CachedOcrResult> {
  return runOcrWithFallback('financial', images);
}

export async function checkOcrStatus() {
  const ollamaHealth = await checkOllamaHealth();
  const orders = {
    ine: providerOrderFor('ine'),
    comprobante: providerOrderFor('comprobante'),
    siac: providerOrderFor('siac'),
    financial: providerOrderFor('financial'),
  };
  const providerReady = (provider: OcrProvider) => {
    if (provider === 'ollama') return Boolean(OLLAMA_URL) && ollamaHealth.reachable;
    return true;
  };
  const activePrimary = orders.ine.find(providerReady) || orders.ine[0];
  return {
    primary: activePrimary,
    strategy: currentStrategy(),
    mode: 'local-private',
    externalOcrProviders: [],
    order: orders.ine,
    orders,
    cache: {
      entries: ocrCache.size,
      inFlight: inflightOcr.size,
      ttlMs: CACHE_TTL_MS,
      maxEntries: CACHE_MAX_ENTRIES,
    },
    tuning: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      ollamaNumCtx: OLLAMA_NUM_CTX,
      ollamaKeepAlive: OLLAMA_KEEP_ALIVE,
      timeoutMs: {
        llm: TIMEOUT_MS_LLM,
        ollama: TIMEOUT_MS_OLLAMA,
        tesseract: TIMEOUT_MS_TESSERACT,
      },
    },
    providers: {
      ollama:    ollamaHealth,
      tesseract: { configured: true,                model: 'tesseract-spa (local)' },
    },
  };
}
