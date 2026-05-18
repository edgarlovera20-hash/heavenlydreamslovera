/**
 * OCR multi-proveedor con fallback en cascada:
 *   1. Gemini 1.5 Pro (Google) — potente, ~3-5s, requiere GEMINI_API_KEY
 *   2. GPT-4o-mini (OpenAI)    — rápido, ~3-5s, requiere OPENAI_API_KEY
 *   3. Tesseract.js            — fallback offline, ~5-10s, sin red ni API key
 *
 * Si los tres fallan, lanza error.
 *
 * Variables de entorno:
 *   GEMINI_API_KEY     — clave para Gemini 1.5 Pro
 *   OPENAI_API_KEY     — clave para GPT-4o-mini
 *   OCR_PRIMARY        — opcional, fuerza proveedor primario: 'gemini' | 'openai' | 'tesseract'
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { runTesseractIne, runTesseractComprobante, runTesseractSiac } from './ocr-tesseract';

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY || '';
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY || '';
const OCR_PRIMARY       = (process.env.OCR_PRIMARY || 'gemini').toLowerCase();

const GEMINI_MODEL    = 'gemini-1.5-pro-latest';
const OPENAI_MODEL    = 'gpt-4o-mini';

const TIMEOUT_MS_LLM       = 45_000;  // 45s para GPT/Claude
const TIMEOUT_MS_TESSERACT = 60_000;  // 60s para tesseract local

export type OcrProvider = 'gemini' | 'openai' | 'tesseract';
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

// ─── PROVIDER 1: GPT-4o-mini ─────────────────────────────────────────────────

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

// ─── PROVIDER 2: Gemini 1.5 Pro ──────────────────────────────────────────────

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

// ─── PROVIDER 3: Tesseract.js (delegado a ocr-tesseract.ts) ──────────────────

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

const PROVIDER_ORDER: OcrProvider[] = (() => {
  // Permite forzar el orden vía OCR_PRIMARY
  const all: OcrProvider[] = ['gemini', 'openai', 'tesseract'];
  if (OCR_PRIMARY === 'openai') return ['openai', 'gemini', 'tesseract'];
  if (OCR_PRIMARY === 'tesseract') return ['tesseract', 'gemini', 'openai'];
  return all; // default: gemini → openai → tesseract
})();

async function tryProvider(provider: OcrProvider, docType: OcrDocType, images: string[]): Promise<OcrResult> {
  const t0 = Date.now();
  const prompt = PROMPTS[docType];

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

  // tesseract
  const { text, fields } = await callTesseract(docType, images);
  return { text, fields, provider, model: 'tesseract-spa', durationMs: Date.now() - t0 };
}

export async function runOcrWithFallback(docType: OcrDocType, images: string | string[]): Promise<OcrResult> {
  const imgs = Array.isArray(images) ? images : [images];
  if (imgs.length === 0) throw new Error('No se proporcionaron imágenes');

  const errors: string[] = [];

  for (const provider of PROVIDER_ORDER) {
    if (provider === 'gemini' && !GEMINI_API_KEY) { errors.push('gemini: sin API key'); continue; }
    if (provider === 'openai' && !OPENAI_API_KEY) { errors.push('openai: sin API key'); continue; }

    try {
      const result = await tryProvider(provider, docType, imgs);

      // Validación de output — si parece basura, intentamos el siguiente proveedor
      const valid = validateFields(docType, result.fields);
      if (!valid.ok) {
        console.warn(`[OCR-${docType}] ${provider} output rechazado: ${valid.reason}`);
        errors.push(`${provider} output inválido (${valid.reason})`);
        continue;
      }

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

// ─── API PÚBLICA ─────────────────────────────────────────────────────────────

export async function runIneOcr(images: string | string[]): Promise<OcrResult> {
  return runOcrWithFallback('ine', images);
}

export async function runComprobanteOcr(images: string | string[]): Promise<OcrResult> {
  return runOcrWithFallback('comprobante', images);
}

export async function runSiacOcr(images: string | string[]): Promise<OcrResult> {
  return runOcrWithFallback('siac', images);
}

export async function checkOcrStatus() {
  return {
    primary: PROVIDER_ORDER[0],
    order: PROVIDER_ORDER,
    providers: {
      gemini:    { configured: !!GEMINI_API_KEY,   model: GEMINI_MODEL },
      openai:    { configured: !!OPENAI_API_KEY,    model: OPENAI_MODEL },
      tesseract: { configured: true,                model: 'tesseract-spa (local)' },
    },
  };
}
