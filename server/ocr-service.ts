/**
 * OCR multi-proveedor con fallback en cascada:
 *   1. Claude (Anthropic)      — primario empresarial, requiere ANTHROPIC_API_KEY
 *   2. Gemini (Google)         — respaldo, requiere GEMINI_API_KEY
 *   3. GPT-4o-mini (OpenAI)    — respaldo, requiere OPENAI_API_KEY
 *   4. Ollama (local/remoto)   — flexible, requiere OLLAMA_URL
 *   5. Tesseract.js            — fallback offline, sin red ni API key
 *
 * Si los cuatro fallan, lanza error.
 *
 * Variables de entorno:
 *   GEMINI_API_KEY     — clave para Gemini 1.5 Pro
 *   OPENAI_API_KEY     — clave para GPT-4o-mini
 *   OLLAMA_URL         — URL del servidor Ollama (ej: http://localhost:11434)
 *   OLLAMA_API_KEY     — opcional, clave de autenticación para Ollama
 *   ANTHROPIC_API_KEY  — clave para Claude
 *   OCR_PRIMARY        — opcional, fuerza proveedor primario: 'claude' | 'gemini' | 'openai' | 'ollama' | 'tesseract'
 *   OCR_STRATEGY       — 'adaptive' | 'quality' | 'fast' | 'local'
 *   OCR_ORDER_INE      — opcional, orden por documento: "claude,gemini,openai,ollama,tesseract"
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash } from 'node:crypto';
import { runTesseractIne, runTesseractComprobante, runTesseractSiac } from './ocr-tesseract';

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY || '';
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OLLAMA_URL        = process.env.OLLAMA_URL || '';
const OLLAMA_API_KEY    = process.env.OLLAMA_API_KEY || '';
const OCR_PRIMARY       = (process.env.OCR_PRIMARY || 'claude').toLowerCase();
const OCR_STRATEGY      = (process.env.OCR_STRATEGY || 'adaptive').toLowerCase();

const GEMINI_MODEL    = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const OPENAI_MODEL    = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const CLAUDE_MODEL    = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-latest';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL || 'glm-ocr';

const TIMEOUT_MS_LLM       = 45_000;  // 45s para GPT/Claude
const TIMEOUT_MS_TESSERACT = 60_000;  // 60s para tesseract local
const CACHE_TTL_MS         = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES    = 100;

const VALID_PROVIDER_NAMES = ['claude', 'gemini', 'openai', 'ollama', 'tesseract'] as const;

export type OcrProvider = typeof VALID_PROVIDER_NAMES[number];
export type OcrDocType  = 'ine' | 'comprobante' | 'siac';
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
}

type CachedOcrResult = OcrResult & { cached?: boolean };

const ocrCache = new Map<string, { expiresAt: number; result: OcrResult }>();

// ─── PROMPTS (compartidos entre GPT y Claude) ────────────────────────────────

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

const PROMPTS: Record<OcrDocType, string> = {
  ine: INE_PROMPT,
  comprobante: COMPROBANTE_PROMPT,
  siac: SIAC_PROMPT,
};

// ─── UTILS ───────────────────────────────────────────────────────────────────

function stripDataUrl(base64: string): string {
  return base64.replace(/^data:[^;]+;base64,/, '');
}

function detectMediaType(base64Original: string): string {
  const m = base64Original.match(/^data:(image\/[a-z+]+);base64,/);
  return m ? m[1] : 'image/jpeg';
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

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// ─── VALIDACIÓN DE OUTPUT (rechaza basura, fuerza fallback) ──────────────────

const CURP_RE        = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
const CP_RE          = /^\d{5}$/;
const PHONE_RE       = /^\d{10}$/;
const FOLIO_SIAC_RE  = /^\d{6,12}$/;

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
    // Al menos uno de los campos de nombre debe existir
    const hasName = fields.nombres || fields.apellidoPaterno || fields.apellidoMaterno;
    if (!hasName && !fields.curp) {
      return { ok: false, reason: 'Sin nombres ni CURP detectados' };
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

// ─── PROVIDER 1: Claude ──────────────────────────────────────────────────────

async function callClaude(prompt: string, base64Images: string[]): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY no configurada');

  const imageBlocks = base64Images.map(b64 => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: detectMediaType(b64),
      data: stripDataUrl(b64),
    },
  }));

  const res = await withTimeout(
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: prompt }, ...imageBlocks],
        }],
      }),
    }),
    TIMEOUT_MS_LLM,
    'Claude'
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Claude ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  return data?.content?.[0]?.text || '';
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

async function callOpenAi(prompt: string, base64Images: string[]): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada');

  const imageBlocks = base64Images.map(b64 => {
    const mediaType = detectMediaType(b64);
    const data      = stripDataUrl(b64);
    return {
      type: 'image_url' as const,
      image_url: { url: `data:${mediaType};base64,${data}`, detail: 'high' as const },
    };
  });

  const res = await withTimeout(
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: prompt }, ...imageBlocks],
        }],
        response_format: { type: 'json_object' },
        temperature: 0.0,
        max_tokens: 2000,
      }),
    }),
    TIMEOUT_MS_LLM,
    'OpenAI'
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  return data?.choices?.[0]?.message?.content || '';
}

// ─── PROVIDER 2: Gemini ──────────────────────────────────────────────────────

async function callGemini(prompt: string, base64Images: string[]): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada');

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  // Convertir base64 a formato que Gemini espera
  const parts: any[] = [];

  for (const b64 of base64Images) {
    const mediaType = detectMediaType(b64);
    const data = stripDataUrl(b64);
    parts.push({
      inlineData: {
        mimeType: mediaType,
        data: data,
      },
    });
  }

  // Agregar el prompt al final
  parts.push({ text: prompt });

  const res = await withTimeout(
    model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 2000,
      },
    }),
    TIMEOUT_MS_LLM,
    'Gemini'
  );

  const text = res.response.text();
  if (!text) throw new Error('Gemini devolvió respuesta vacía');
  return text;
}

// ─── PROVIDER 4: Ollama (local/remoto) ──────────────────────────────────────

async function callOllama(prompt: string, base64Images: string[]): Promise<string> {
  if (!OLLAMA_URL) throw new Error('OLLAMA_URL no configurada');

  // Ollama espera el base64 PURO (sin prefijo data:image/...;base64,)
  const imageBlocks = base64Images.map(b64 => stripDataUrl(b64));

  const payload: any = {
    model: OLLAMA_MODEL,
    prompt: prompt,
    stream: false,
    images: imageBlocks,
    options: {
      temperature: 0.0,
      num_predict: 2000,
    },
  };

  const res = await withTimeout(
    fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(OLLAMA_API_KEY && { 'Authorization': `Bearer ${OLLAMA_API_KEY}` }),
      },
      body: JSON.stringify(payload),
    }),
    TIMEOUT_MS_LLM * 3, // Ollama local puede tardar más en primera ejecución
    'Ollama'
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  return data?.response || '';
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
    const r = await withTimeout(runner(stripped), TIMEOUT_MS_TESSERACT, 'Tesseract');
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
    adaptive: ['claude', 'gemini', 'openai', 'ollama', 'tesseract'],
    quality: ['claude', 'openai', 'gemini', 'ollama', 'tesseract'],
    fast: ['gemini', 'openai', 'claude', 'ollama', 'tesseract'],
    local: ['ollama', 'tesseract', 'claude', 'gemini', 'openai'],
  },
  comprobante: {
    adaptive: ['gemini', 'claude', 'openai', 'ollama', 'tesseract'],
    quality: ['claude', 'gemini', 'openai', 'ollama', 'tesseract'],
    fast: ['gemini', 'openai', 'claude', 'ollama', 'tesseract'],
    local: ['ollama', 'tesseract', 'gemini', 'claude', 'openai'],
  },
  siac: {
    adaptive: ['gemini', 'openai', 'claude', 'ollama', 'tesseract'],
    quality: ['claude', 'openai', 'gemini', 'ollama', 'tesseract'],
    fast: ['gemini', 'openai', 'claude', 'ollama', 'tesseract'],
    local: ['ollama', 'tesseract', 'gemini', 'openai', 'claude'],
  },
};

function currentStrategy(): OcrStrategy {
  return (['adaptive', 'quality', 'fast', 'local'].includes(OCR_STRATEGY) ? OCR_STRATEGY : 'adaptive') as OcrStrategy;
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

function completeOrder(preferred: OcrProvider[]): OcrProvider[] {
  return [...preferred, ...VALID_PROVIDERS.filter(provider => !preferred.includes(provider))];
}

function providerOrderFor(docType: OcrDocType): OcrProvider[] {
  const envOrder = parseProviderList(process.env[`OCR_ORDER_${docType.toUpperCase()}`]);
  const forcedPrimary = parseProviderList(OCR_PRIMARY);
  const strategy = currentStrategy();
  const baseOrder = envOrder.length ? envOrder : DOC_ORDERS[docType][strategy];
  return completeOrder([...forcedPrimary, ...baseOrder]);
}

async function tryProvider(provider: OcrProvider, docType: OcrDocType, images: string[]): Promise<OcrResult> {
  const t0 = Date.now();
  const prompt = PROMPTS[docType];

  if (provider === 'claude') {
    const raw = await callClaude(prompt, images);
    if (!raw) throw new Error('Claude devolvió respuesta vacía');
    const fields = parseJsonResponse(raw);
    const text = fields.rawText || raw;
    delete fields.rawText;
    return { text, fields, provider, model: CLAUDE_MODEL, durationMs: Date.now() - t0 };
  }

  if (provider === 'gemini') {
    const raw = await callGemini(prompt, images);
    if (!raw) throw new Error('Gemini devolvió respuesta vacía');
    const fields = parseJsonResponse(raw);
    const text = fields.rawText || raw;
    delete fields.rawText;
    return { text, fields, provider, model: GEMINI_MODEL, durationMs: Date.now() - t0 };
  }

  if (provider === 'openai') {
    const raw = await callOpenAi(prompt, images);
    if (!raw) throw new Error('OpenAI devolvió respuesta vacía');
    const fields = parseJsonResponse(raw);
    const text = fields.rawText || raw;
    delete fields.rawText;
    return { text, fields, provider, model: OPENAI_MODEL, durationMs: Date.now() - t0 };
  }

  if (provider === 'ollama') {
    const raw = await callOllama(prompt, images);
    if (!raw) throw new Error('Ollama devolvió respuesta vacía');
    const fields = parseJsonResponse(raw);
    const text = fields.rawText || raw;
    delete fields.rawText;
    return { text, fields, provider, model: OLLAMA_MODEL, durationMs: Date.now() - t0 };
  }

  // tesseract
  const { text, fields } = await callTesseract(docType, images);
  return { text, fields, provider, model: 'tesseract-spa', durationMs: Date.now() - t0 };
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

  const errors: string[] = [];
  let bestPartial: OcrResult | null = null;

  const providerOrder = providerOrderFor(docType);
  const strategy = currentStrategy();

  for (const provider of providerOrder) {
    if (provider === 'claude' && !ANTHROPIC_API_KEY) { errors.push('claude: sin API key'); continue; }
    if (provider === 'gemini' && !GEMINI_API_KEY) { errors.push('gemini: sin API key'); continue; }
    if (provider === 'openai' && !OPENAI_API_KEY) { errors.push('openai: sin API key'); continue; }
    if (provider === 'ollama' && !OLLAMA_URL) { errors.push('ollama: sin URL configurada'); continue; }

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

export async function checkOcrStatus() {
  const orders = {
    ine: providerOrderFor('ine'),
    comprobante: providerOrderFor('comprobante'),
    siac: providerOrderFor('siac'),
  };
  return {
    primary: orders.ine[0],
    strategy: currentStrategy(),
    order: orders.ine,
    orders,
    cache: {
      entries: ocrCache.size,
      ttlMs: CACHE_TTL_MS,
      maxEntries: CACHE_MAX_ENTRIES,
    },
    providers: {
      claude:    { configured: !!ANTHROPIC_API_KEY, model: CLAUDE_MODEL },
      gemini:    { configured: !!GEMINI_API_KEY,   model: GEMINI_MODEL },
      openai:    { configured: !!OPENAI_API_KEY,    model: OPENAI_MODEL },
      ollama:    { configured: !!OLLAMA_URL,        model: OLLAMA_MODEL, url: OLLAMA_URL },
      tesseract: { configured: true,                model: 'tesseract-spa (local)' },
    },
  };
}
