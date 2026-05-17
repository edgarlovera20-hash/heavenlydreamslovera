/**
 * OCR multi-proveedor con fallback en cascada:
 *   1. GPT-4o-mini (OpenAI)  — rápido, ~3-5s, requiere OPENAI_API_KEY
 *   2. Claude Haiku 4.5      — fallback, ~2-4s, requiere ANTHROPIC_API_KEY
 *   3. Tesseract.js          — fallback offline, ~5-10s, sin red ni API key
 *
 * Si los tres fallan, lanza error.
 *
 * Variables de entorno:
 *   OPENAI_API_KEY     — clave para GPT-4o-mini
 *   ANTHROPIC_API_KEY  — clave para Claude Haiku 4.5
 *   OCR_PRIMARY        — opcional, fuerza proveedor primario: 'openai' | 'anthropic' | 'tesseract'
 */

import { runTesseractIne, runTesseractComprobante, runTesseractSiac } from './ocr-tesseract';

const OPENAI_API_KEY    = process.env.OPENAI_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OCR_PRIMARY       = (process.env.OCR_PRIMARY || 'openai').toLowerCase();

const OPENAI_MODEL    = 'gpt-4o-mini';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

const TIMEOUT_MS_LLM       = 45_000;  // 45s para GPT/Claude
const TIMEOUT_MS_TESSERACT = 60_000;  // 60s para tesseract local

export type OcrProvider = 'openai' | 'anthropic' | 'tesseract';
export type OcrDocType  = 'ine' | 'comprobante' | 'siac';

export interface OcrResult {
  text: string;
  fields: Record<string, string>;
  provider: OcrProvider;
  model: string;
  durationMs: number;
  fallbackReason?: string; // por qué se cayó al siguiente proveedor
}

// ─── PROMPTS (compartidos entre GPT y Claude) ────────────────────────────────

const INE_PROMPT = `You are an OCR system for Mexican identity documents (INE/IFE, CURP, voter ID).

IMPORTANT: Read ALL text visible in the image carefully.

On an INE (Mexican voter ID), the data is arranged like this:
- APELLIDO PATERNO (first surname, usually uppercase, printed BEFORE the given name)
- APELLIDO MATERNO (second surname, usually uppercase)
- NOMBRE(S) (given name(s), usually uppercase)
- DOMICILIO section: street address, neighborhood, municipality
- CURP: 18-character alphanumeric code
- CLAVE DE ELECTOR: 18-character alphanumeric code (different from CURP)
- Código postal: 5-digit number near the address

Extract all text and respond ONLY with a valid JSON object using these exact field names (leave "" if not found):

{
  "nombres": "given name(s) without surnames",
  "apellidoPaterno": "first surname (apellido paterno)",
  "apellidoMaterno": "second surname (apellido materno)",
  "curp": "18-character CURP code",
  "folioIne": "CLAVE DE ELECTOR (18-char voter key, NOT the CURP)",
  "calle": "street name with number, e.g. C ELOY CAVAZOS MZA 3 LT 9",
  "numeroExterior": "exterior number if separate",
  "numeroInterior": "interior number if exists",
  "colonia": "neighborhood/colonia name, e.g. COL SAN MIGUEL TEOTONGO",
  "codigoPostal": "5-digit postal code",
  "delegacion": "municipality/alcaldía/delegación",
  "ciudad": "city or state, e.g. CDMX or Ciudad de México",
  "rawText": "ALL visible text from the document exactly as it appears"
}

Do NOT include explanations, markdown, or any text outside the JSON.`;

const COMPROBANTE_PROMPT = `You are an OCR system for Mexican utility bills / proof of address documents (CFE electricity, Izzi cable, Totalplay, Telmex, water, gas).

These bills have the customer's name and full installation address printed near the top.

Respond ONLY with a valid JSON object (use "" if not found):

{
  "nombres": "given name(s)",
  "apellidoPaterno": "first surname",
  "apellidoMaterno": "second surname",
  "calle": "street with number (e.g. CALZADA SAN LORENZO 151)",
  "numeroExterior": "exterior number if separate",
  "numeroInterior": "interior/department number if exists",
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
  return base64.replace(/^data:image\/[a-z+]+;base64,/, '');
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

// ─── PROVIDER 1: GPT-4o-mini ─────────────────────────────────────────────────

async function callOpenAi(prompt: string, base64Original: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada');

  const mediaType = detectMediaType(base64Original);
  const base64    = stripDataUrl(base64Original);
  const dataUrl   = `data:${mediaType};base64,${base64}`;

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
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        }],
        response_format: { type: 'json_object' },
        temperature: 0.05,
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

// ─── PROVIDER 2: Claude Haiku 4.5 ────────────────────────────────────────────

async function callAnthropic(prompt: string, base64Original: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY no configurada');

  const mediaType = detectMediaType(base64Original);
  const base64    = stripDataUrl(base64Original);

  const res = await withTimeout(
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        temperature: 0.05,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    }),
    TIMEOUT_MS_LLM,
    'Anthropic'
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  const block = (data?.content || []).find((b: any) => b.type === 'text');
  return block?.text || '';
}

// ─── PROVIDER 3: Tesseract.js (delegado a ocr-tesseract.ts) ──────────────────

async function callTesseract(docType: OcrDocType, base64Original: string): Promise<{ text: string; fields: Record<string, string> }> {
  const base64 = stripDataUrl(base64Original);
  const runner = docType === 'ine'
    ? runTesseractIne
    : docType === 'comprobante'
      ? runTesseractComprobante
      : runTesseractSiac;
  return withTimeout(runner(base64), TIMEOUT_MS_TESSERACT, 'Tesseract');
}

// ─── ORQUESTADOR CON FALLBACK ────────────────────────────────────────────────

const PROVIDER_ORDER: OcrProvider[] = (() => {
  // Permite forzar el orden vía OCR_PRIMARY
  const all: OcrProvider[] = ['openai', 'anthropic', 'tesseract'];
  if (OCR_PRIMARY === 'anthropic') return ['anthropic', 'openai', 'tesseract'];
  if (OCR_PRIMARY === 'tesseract') return ['tesseract', 'openai', 'anthropic'];
  return all; // default: openai → anthropic → tesseract
})();

async function tryProvider(provider: OcrProvider, docType: OcrDocType, base64: string): Promise<OcrResult> {
  const t0 = Date.now();
  const prompt = PROMPTS[docType];

  if (provider === 'openai') {
    const raw = await callOpenAi(prompt, base64);
    if (!raw) throw new Error('OpenAI devolvió respuesta vacía');
    const fields = parseJsonResponse(raw);
    const text = fields.rawText || raw;
    delete fields.rawText;
    return { text, fields, provider, model: OPENAI_MODEL, durationMs: Date.now() - t0 };
  }

  if (provider === 'anthropic') {
    const raw = await callAnthropic(prompt, base64);
    if (!raw) throw new Error('Anthropic devolvió respuesta vacía');
    const fields = parseJsonResponse(raw);
    const text = fields.rawText || raw;
    delete fields.rawText;
    return { text, fields, provider, model: ANTHROPIC_MODEL, durationMs: Date.now() - t0 };
  }

  // tesseract
  const { text, fields } = await callTesseract(docType, base64);
  return { text, fields, provider, model: 'tesseract-spa', durationMs: Date.now() - t0 };
}

export async function runOcrWithFallback(docType: OcrDocType, base64Image: string): Promise<OcrResult> {
  const errors: string[] = [];

  for (const provider of PROVIDER_ORDER) {
    // Salta proveedores LLM sin API key configurada
    if (provider === 'openai' && !OPENAI_API_KEY) { errors.push('openai: sin API key'); continue; }
    if (provider === 'anthropic' && !ANTHROPIC_API_KEY) { errors.push('anthropic: sin API key'); continue; }

    try {
      const result = await tryProvider(provider, docType, base64Image);
      if (errors.length) result.fallbackReason = errors.join(' | ');
      console.log(`[OCR-${docType}] ${provider} OK in ${result.durationMs}ms (${Object.keys(result.fields).length} fields)`);
      return result;
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.warn(`[OCR-${docType}] ${provider} falló: ${msg}`);
      errors.push(`${provider}: ${msg}`);
    }
  }

  throw new Error(`Todos los proveedores OCR fallaron — ${errors.join(' | ')}`);
}

// ─── API PÚBLICA (compatible con el código existente en server.ts) ──────────

export async function runIneOcr(base64: string): Promise<OcrResult> {
  return runOcrWithFallback('ine', base64);
}

export async function runComprobanteOcr(base64: string): Promise<OcrResult> {
  return runOcrWithFallback('comprobante', base64);
}

export async function runSiacOcr(base64: string): Promise<OcrResult> {
  return runOcrWithFallback('siac', base64);
}

export async function checkOcrStatus() {
  return {
    primary: PROVIDER_ORDER[0],
    order: PROVIDER_ORDER,
    providers: {
      openai:    { configured: !!OPENAI_API_KEY,    model: OPENAI_MODEL },
      anthropic: { configured: !!ANTHROPIC_API_KEY, model: ANTHROPIC_MODEL },
      tesseract: { configured: true,                model: 'tesseract-spa (local)' },
    },
  };
}
