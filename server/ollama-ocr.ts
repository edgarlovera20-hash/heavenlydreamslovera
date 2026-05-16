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

const OCR_PROMPT = `Eres un sistema OCR especializado en documentos de identidad mexicanos (INE/IFE, CURP, comprobantes de domicilio).

Analiza la imagen y responde ÚNICAMENTE con un objeto JSON válido con estos campos (deja vacío "" si no encuentras el dato):

{
  "nombres": "nombre(s) de pila sin apellidos",
  "apellidoPaterno": "primer apellido",
  "apellidoMaterno": "segundo apellido",
  "curp": "CURP de 18 caracteres",
  "folioIne": "clave de elector o folio de INE",
  "calle": "nombre de la calle",
  "numeroExterior": "número exterior",
  "numeroInterior": "número interior si existe",
  "colonia": "colonia o fraccionamiento",
  "codigoPostal": "código postal de 5 dígitos",
  "delegacion": "alcaldía, delegación o municipio",
  "ciudad": "ciudad o estado",
  "rawText": "todo el texto visible en el documento tal como aparece"
}

No incluyas explicaciones, markdown ni texto fuera del JSON.`;

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
