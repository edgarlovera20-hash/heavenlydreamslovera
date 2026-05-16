/**
 * OCR local usando Ollama + LLaVA.
 * Devuelve texto crudo + campos estructurados para autorellenar el formulario.
 *
 * Requisitos:
 *   1. Ollama corriendo: https://ollama.com
 *   2. Modelo descargado: `ollama pull llava`
 *
 * Variables de entorno opcionales:
 *   OLLAMA_URL   — default: http://localhost:11434
 *   OLLAMA_MODEL — default: llava
 */

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llava';

const OCR_PROMPT = `You are an OCR system for Mexican identity documents (INE/IFE, CURP, voter ID).

IMPORTANT: Read ALL text visible in the image carefully.

On an INE (Mexican voter ID), the data is arranged like this:
- APELLIDO PATERNO (first surname, usually uppercase, printed BEFORE the given name)
- APELLIDO MATERNO (second surname, usually uppercase)
- NOMBRE(S) (given name(s), usually uppercase)
- DOMICILIO section: street address, neighborhood, municipality
- CURP: 18-character alphanumeric code
- CLAVE DE ELECTOR: 18-character alphanumeric code (different from CURP)
- Código postal: 5-digit number near the address

Extract all text from the image and respond ONLY with a valid JSON object using these exact field names (leave "" if not found):

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


export interface OllamaOCRResult {
  text: string;
  fields: Record<string, string>;
  model: string;
  durationMs: number;
}

async function callOllama(prompt: string, base64?: string): Promise<string> {
  const body: any = {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    options: { temperature: 0.05, num_predict: 1500 },
  };
  if (base64) body.images = [base64];

  let response: Response;
  try {
    response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    throw new Error(
      `No se pudo conectar con Ollama en ${OLLAMA_URL}. ` +
      `Verifica que esté corriendo y que '${OLLAMA_MODEL}' esté instalado ('ollama pull ${OLLAMA_MODEL}'). ` +
      `Error: ${err.message}`
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Ollama error (${response.status}): ${body}`);
  }

  const data = await response.json() as any;
  return (data.response || '').trim();
}

function parseJsonResponse(raw: string): Record<string, string> {
  // Intenta extraer JSON aunque el modelo añada texto extra
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const obj = JSON.parse(match[0]);
    // Normalizar: solo strings, sin nulls
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.trim()) result[k] = v.trim();
    }
    return result;
  } catch {
    return {};
  }
}

// Prompt específico para comprobantes de domicilio (CFE, Izzi, Totalplay, Telmex, agua, etc.)
const COMPROBANTE_PROMPT = `You are an OCR system for Mexican utility bills / proof of address documents (CFE electricity, Izzi cable, Totalplay, Telmex, water, gas).

These bills have the customer's name and full installation address printed near the top, usually in a block format like:
"NOMBRE COMPLETO
CALLE NÚMERO INT
COLONIA / FRACCIONAMIENTO
DELEGACIÓN / MUNICIPIO, ESTADO
C.P. 12345"

Sometimes the address is on multiple lines without commas. Extract the data carefully.

Respond ONLY with a valid JSON object (use "" if not found):

{
  "nombres": "given name(s)",
  "apellidoPaterno": "first surname",
  "apellidoMaterno": "second surname",
  "calle": "street with number (e.g. CALZADA SAN LORENZO 151)",
  "numeroExterior": "exterior number if separate",
  "numeroInterior": "interior/department number if exists (e.g. INT 402)",
  "colonia": "colonia/fraccionamiento/section",
  "codigoPostal": "5-digit postal code",
  "delegacion": "delegación/alcaldía/municipio",
  "ciudad": "city or state (e.g. Ciudad de México, MEX)",
  "proveedor": "company name issuing the bill: CFE, Izzi, Totalplay, Telmex, etc.",
  "rawText": "all visible text exactly as it appears"
}

Do NOT include explanations, markdown, or text outside the JSON.`;

// Prompt para captura de confirmación SIAC (Telmex)
const SIAC_PROMPT = `You are an OCR system reading a SIAC (Telmex internal system) confirmation screenshot.

This screen confirms that a sale was registered. Typical fields shown:
- "Folio SIAC:" followed by 8-10 digit number
- "Servicio solicitado:" followed by a 3-4 digit code
- "Datos de contacto" with the customer's full name
- "Celular de contacto" with 10-digit phone
- "Correo electrónico" with an email address
- "Gastos de instalación" describing initial payment and monthly fees

Extract ONLY these fields. Respond with valid JSON (use "" if not found):

{
  "folioSiac": "Folio SIAC number, e.g. 151500304",
  "servicio": "service code, e.g. 389",
  "nombreCompleto": "customer full name as shown",
  "celular": "10-digit phone number",
  "correo": "email address",
  "gastosInstalacion": "installation fees text, e.g. 'Pago inicial de $400 y 12 meses de $100'",
  "rawText": "all visible text"
}

Do NOT include explanations, markdown, or text outside the JSON.`;

export async function runSiacOCR(base64Image: string): Promise<OllamaOCRResult> {
  const base64 = base64Image.replace(/^data:image\/[a-z+]+;base64,/, '');
  const t0 = Date.now();
  const raw = await callOllama(SIAC_PROMPT, base64);
  if (!raw) throw new Error('Ollama devolvió respuesta vacía.');
  const fields = parseJsonResponse(raw);
  const text = fields.rawText || raw;
  delete fields.rawText;
  return { text, fields, model: OLLAMA_MODEL, durationMs: Date.now() - t0 };
}

export async function runComprobanteOCR(base64Image: string): Promise<OllamaOCRResult> {
  const base64 = base64Image.replace(/^data:image\/[a-z+]+;base64,/, '');
  const t0 = Date.now();
  const raw = await callOllama(COMPROBANTE_PROMPT, base64);
  if (!raw) throw new Error('Ollama devolvió respuesta vacía.');
  const fields = parseJsonResponse(raw);
  const text = fields.rawText || raw;
  delete fields.rawText;
  return { text, fields, model: OLLAMA_MODEL, durationMs: Date.now() - t0 };
}

export async function runOllamaOCR(base64Image: string): Promise<string> {
  const result = await runOllamaOCRVerbose(base64Image);
  return result.text;
}

export async function runOllamaOCRVerbose(base64Image: string): Promise<OllamaOCRResult> {
  const base64 = base64Image.replace(/^data:image\/[a-z+]+;base64,/, '');
  const t0 = Date.now();

  const raw = await callOllama(OCR_PROMPT, base64);
  if (!raw) throw new Error('Ollama devolvió respuesta vacía. El modelo puede no soportar imágenes.');

  const fields = parseJsonResponse(raw);
  const text = fields.rawText || raw;
  delete fields.rawText;

  return { text, fields, model: OLLAMA_MODEL, durationMs: Date.now() - t0 };
}

export async function checkOllamaStatus(): Promise<{ ok: boolean; models: string[]; error?: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
    const data = await res.json() as any;
    const models: string[] = (data.models || []).map((m: any) => m.name as string);
    const hasModel = models.some(m => m.startsWith(OLLAMA_MODEL));
    return {
      ok: hasModel,
      models,
      error: hasModel ? undefined : `Modelo '${OLLAMA_MODEL}' no encontrado. Ejecuta: ollama pull ${OLLAMA_MODEL}`,
    };
  } catch (err: any) {
    return { ok: false, models: [], error: `Ollama no disponible en ${OLLAMA_URL}: ${err.message}` };
  }
}
