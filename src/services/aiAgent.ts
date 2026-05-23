export interface CustomerData {
  nombre: string;
  deuda: number;
  diasAtraso: number;
  esNuevo: boolean;
  telefono: string;
  prioridad?: string;
}

export interface OcrResult {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  folioIne: string;
  prefijoCalle?: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  edificio?: string;
  departamento?: string;
  piso?: string;
  torre?: string;
  manzana?: string;
  lote?: string;
  privada?: string;
  sector?: string;
  etapa?: string;
  unidadHabitacional?: string;
  referencias?: string;
  colonia: string;
  codigoPostal: string;
  ciudad: string;
  delegacion: string;
}

export type EventType = 'BIENVENIDA' | 'COBRANZA_MOROSO' | 'FALLA_TECNICA' | 'RECUPERACION_CHURN' | 'ATENCION_GENERAL' | 'SCRIPT_VENTA' | 'SCRIPT_SEGUIMIENTO' | 'SCRIPT_REFERIDO';

const MOCK_RESPONSES: Record<EventType, (c: CustomerData) => string> = {
  BIENVENIDA: (c) =>
    `¡Hola ${c.nombre}! 👋 Bienvenido a Heavenly Dreams. Tu servicio ya está activo. Cualquier duda estamos aquí para apoyarte. 🚀`,
  COBRANZA_MOROSO: (c) =>
    `Hola ${c.nombre} 👋, te contactamos porque detectamos un saldo pendiente de $${c.deuda} con ${c.diasAtraso} días de atraso. ¿Podemos ayudarte a regularizarte hoy? 💳 Tenemos opciones de pago flexibles.`,
  FALLA_TECNICA: (c) =>
    `Hola ${c.nombre} 🔧, lamentamos el inconveniente técnico. Nuestro equipo ya está trabajando en ello. Te damos seguimiento en las próximas horas. Gracias por tu paciencia. ⏳`,
  RECUPERACION_CHURN: (c) =>
    `Hola ${c.nombre} 😊, nos preocupa que estés pensando en cancelar. Cuéntanos qué pasó y con gusto te ofrecemos una solución o un descuento especial. ¡Queremos que te quedes con nosotros! 🙏`,
  ATENCION_GENERAL: (c) =>
    `Hola ${c.nombre} 👋, gracias por comunicarte con Heavenly Dreams. ¿En qué podemos ayudarte hoy? Estamos aquí para lo que necesites. 😊`,
  SCRIPT_VENTA: (c) =>
    `Hola ${c.nombre || 'estimado cliente'} 😊, soy promotor de *Heavenly Dreams*.\n\nTe presento una oferta especial de internet de alta velocidad pensada para ti${c.prioridad ? ` (perfil: ${c.prioridad})` : ''}.\n\n📡 *¿Qué te ofrecemos?*\n• Internet de alta velocidad sin cortes\n• Sin pagos de instalación\n• Soporte técnico 24/7\n• Plataformas de streaming incluidas\n\n¿Te interesa recibir más información o agendar una visita de instalación? 📲`,
  SCRIPT_SEGUIMIENTO: (c) =>
    `Hola ${c.nombre || 'estimado cliente'} 👋, te escribo de *Heavenly Dreams* para dar seguimiento a tu solicitud de servicio.\n\nQuería asegurarme de que todo quedara a tu entera satisfacción. ¿Tienes alguna duda o comentario que quieras compartir? Estamos para apoyarte. 💬\n\n¡Que tengas un excelente día! 🌟`,
  SCRIPT_REFERIDO: (c) =>
    `Hola ${c.nombre || 'estimado cliente'} 🙌, ¡gracias por confiar en *Heavenly Dreams*!\n\nTenemos un programa especial para ti: si nos recomiendas con un familiar o amigo y se contrata el servicio, *ambos reciben un beneficio exclusivo* 🎁.\n\n¿Conoces a alguien que le pueda interesar internet de alta velocidad a un precio inmejorable? ¡Te doy más detalles!`,
};

// ─────────────────────────────────────────────
// GOOGLE CLOUD VISION — DOCUMENT_TEXT_DETECTION
// Llama al endpoint del servidor /api/vision/ocr
// que autentica con la cuenta de servicio.
// ─────────────────────────────────────────────
export interface VisionOCRResponse {
  text: string;
  fields?: Record<string, string>;
  manualRequired?: boolean;
  warning?: string;
}

function friendlyOcrError(status: number, msg: string) {
  const lower = msg.toLowerCase();
  if (lower.includes('sin api key') || lower.includes('sin url configurada') || lower.includes('proveedores ocr fallaron')) {
    return 'OCR sin proveedores IA configurados o sin lectura local confiable. Configura Claude/Gemini/OpenAI/Ollama en Ajustes > Integraciones o completa los campos manualmente.';
  }
  if (lower.includes('payload') || lower.includes('too large') || status === 413) {
    return 'La imagen es demasiado pesada para OCR. Toma otra foto más cercana o sube una imagen más ligera.';
  }
  return `OCR error (${status}): ${msg}`;
}

export async function runGoogleVision(
  base64Image: string,
  onProgress?: (p: number) => void,
): Promise<string> {
  const data = await callVisionOCR(base64Image, onProgress);
  return data.text;
}

export async function callVisionOCR(
  imageOrImages: string | string[],
  onProgress?: (p: number) => void,
): Promise<VisionOCRResponse> {
  if (onProgress) onProgress(10);

  const body = Array.isArray(imageOrImages)
    ? { images: imageOrImages }
    : { image: imageOrImages };

  const response = await fetch('/api/vision/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (onProgress) onProgress(80);

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    const msg = err?.error || response.statusText;
    throw new Error(friendlyOcrError(response.status, msg));
  }

  const data = await response.json() as VisionOCRResponse;
  if (onProgress) onProgress(100);
  return { text: data.text || '', fields: data.fields, manualRequired: data.manualRequired, warning: data.warning };
}

// ─────────────────────────────────────────────
// REGEX EXTRACTORS
// ─────────────────────────────────────────────

// CURP — 18 caracteres exactos con validación de estado mexicano
const CURP_RE =
  /\b([A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d)\b/;

// Clave de elector INE (18 alfanum)
const CLAVE_ELECTOR_RE = /\b([A-Z]{6}\d{8}[HM]\d{3})\b/;

// Folio de credencial (reverso) — empieza con IDMEX o es largo alfanum
const FOLIO_CREDENCIAL_RE = /(?:IDMEX|FOLIO)\s*[:\s]*([A-Z0-9]{9,18})/;

// CP — 5 dígitos con contexto
const CP_RE = /(?:C\.?P\.?|CODIGO\s*POSTAL)\D{0,8}(\d{5})/;
const CP_PLAIN_RE = /\b(\d{5})\b/;

function cleanText(s: string): string {
  return s
    .replace(/[|\\[\]{}()*+?^$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function extractCURP(text: string): string {
  const m = text.match(CURP_RE);
  if (m) return m[1];
  // Fallback flexible (sin validación de estado)
  const m2 = text.match(/\b([A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d)\b/);
  return m2 ? m2[1] : '';
}

function extractFolioINE(text: string): string {
  const ce = text.match(CLAVE_ELECTOR_RE);
  if (ce) return ce[1];
  const f = text.match(FOLIO_CREDENCIAL_RE);
  if (f) return f[1];
  for (const line of text.split('\n')) {
    const t = line.trim().replace(/\s/g, '');
    if (/^[A-Z0-9]{13,18}$/.test(t)) return t;
  }
  return '';
}

function extractCP(text: string): string {
  const ctx = text.match(CP_RE);
  if (ctx) return ctx[1];
  const domIdx = text.search(/DOMICILIO/);
  if (domIdx !== -1) {
    const m = text.slice(domIdx, domIdx + 300).match(CP_PLAIN_RE);
    if (m) return m[1];
  }
  const m = text.match(CP_PLAIN_RE);
  return m ? m[1] : '';
}

function extractNombre(
  text: string,
): { nombres: string; apellidoPaterno: string; apellidoMaterno: string } {
  const lines = text
    .split('\n')
    .map(l => l.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  let nombres = '', apellidoPaterno = '', apellidoMaterno = '';

  const isName = (s: string) =>
    /^[A-ZÁÉÍÓÚÑ ]{2,40}$/.test(s.toUpperCase()) &&
    !/\d/.test(s) &&
    s.split(' ').length <= 5;

  // Estrategia 1: etiquetas INE explícitas (frente)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toUpperCase().replace(/\s+/g, ' ');
    const next = (lines[i + 1] || '').trim();
    const next2 = (lines[i + 2] || '').trim();

    if (/^NOMBRE(S)?\b/.test(l)) {
      if (isName(next)) nombres = next.toUpperCase();
      else if (isName(next2)) nombres = next2.toUpperCase();
    }
    if (/^APELLIDO\s*PATERNO\b/.test(l)) {
      if (isName(next)) apellidoPaterno = next.toUpperCase();
      else if (isName(next2)) apellidoPaterno = next2.toUpperCase();
    }
    if (/^APELLIDO\s*MATERNO\b/.test(l)) {
      if (isName(next)) apellidoMaterno = next.toUpperCase();
      else if (isName(next2)) apellidoMaterno = next2.toUpperCase();
    }
  }

  // Estrategia 2: bloque de 3 líneas ALL-CAPS consecutivas (INE legacy)
  if (!apellidoPaterno && !apellidoMaterno && !nombres) {
    const blocks: string[] = [];
    for (const line of lines) {
      if (isName(line) && line === line.toUpperCase()) {
        blocks.push(line);
      }
      if (blocks.length === 3) break;
    }
    if (blocks.length >= 3) {
      [apellidoPaterno, apellidoMaterno, nombres] = blocks;
    } else if (blocks.length === 2) {
      [apellidoPaterno, apellidoMaterno] = blocks;
    }
  }

  // Estrategia 3: buscar patrón "APELLIDO PATERNO: XXX"
  if (!apellidoPaterno) {
    const m = text.match(/PATERNO[:\s]+([A-ZÁÉÍÓÚÑ ]{2,40})/i);
    if (m) apellidoPaterno = m[1].trim().toUpperCase();
  }
  if (!apellidoMaterno) {
    const m = text.match(/MATERNO[:\s]+([A-ZÁÉÍÓÚÑ ]{2,40})/i);
    if (m) apellidoMaterno = m[1].trim().toUpperCase();
  }
  if (!nombres) {
    const m = text.match(/NOMBRE[S]?[:\s]+([A-ZÁÉÍÓÚÑ ]{2,40})/i);
    if (m) nombres = m[1].trim().toUpperCase();
  }

  return { nombres, apellidoPaterno, apellidoMaterno };
}

function extractDomicilio(text: string): {
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  ciudad: string;
  delegacion: string;
} {
  const result = {
    calle: '', numeroExterior: '', numeroInterior: '',
    colonia: '', ciudad: '', delegacion: '',
  };
  const upper = text.toUpperCase();

  const domIdx = Math.max(
    upper.search(/DOMICILIO/),
    upper.search(/DIRECCI[OÓ]N/),
    upper.search(/CALLE\b/),
  );
  const section = domIdx !== -1
    ? upper.slice(domIdx, domIdx + 500)
    : upper;

  const colMatch = section.match(
    /COL\.?\s*([A-ZÁÉÍÓÚÑ0-9 .]{2,40?})(?=\s*(?:\d{5}|C\.?P\.?|DEL|MUN|$))/,
  );
  if (colMatch) result.colonia = colMatch[1].trim();

  const calleMatch = section.match(
    /(?:CALLE|DOMICILIO)[:\s]*([A-ZÁÉÍÓÚÑ0-9 .]{3,50?}?)\s+(?:N[UÚ]M\.?|#|EXT\.?)?\s*(\d+[A-Z]?)/,
  );
  if (calleMatch) {
    result.calle = calleMatch[1].trim();
    result.numeroExterior = calleMatch[2];
  } else {
    const fallback = section.match(/([A-ZÁÉÍÓÚÑ ]{3,50})\s+(\d{1,5}[A-Z]?)\b/);
    if (fallback) {
      result.calle = fallback[1].trim();
      result.numeroExterior = fallback[2];
    }
  }

  const intMatch = section.match(/INT\.?\s*(\d+[A-Z]?)/);
  if (intMatch) result.numeroInterior = intMatch[1];

  const delMatch = section.match(
    /(?:DEL\.?|MUN\.?|ALCALD[IÍ]A)\s+([A-ZÁÉÍÓÚÑ ]{3,40?})(?=\s*(?:\d|\n|CIUDAD|$))/,
  );
  if (delMatch) result.delegacion = delMatch[1].trim();

  const cidMatch = section.match(/(?:CIUDAD[^,\n]{0,30}|CDMX|GDL|MTY)/);
  if (cidMatch) result.ciudad = cidMatch[0].trim();

  return result;
}

function mergeOcr<T extends Record<string, string>>(a: T, b: T): T {
  const out = { ...a };
  for (const key of Object.keys(b) as (keyof T)[]) {
    const va = (a[key] || '').toString().trim();
    const vb = (b[key] || '').toString().trim();
    if (!va && vb) (out as any)[key] = vb;
    else if (vb.length > va.length) (out as any)[key] = vb;
  }
  return out;
}

// ─────────────────────────────────────────────
// AGENT
// ─────────────────────────────────────────────
export class CRM_AI_Agent {
  public async generateResponse(
    cliente: CustomerData,
    evento: EventType,
    mensajeUsuario: string = '',
  ): Promise<string> {
    await new Promise(r => setTimeout(r, 400));
    if (mensajeUsuario) {
      return `Entendido. Procesando tu mensaje sobre "${mensajeUsuario.substring(0, 40)}...". Un asesor revisará tu caso pronto. 👍`;
    }
    return MOCK_RESPONSES[evento]?.(cliente) ?? MOCK_RESPONSES.ATENCION_GENERAL(cliente);
  }

  public async analyzeDocument(
    imageOrImages: string | string[],
    _mimeType: string,
    onProgress?: (p: number) => void,
  ): Promise<Partial<OcrResult> | null> {
    try {
      const { text: rawText, fields } = await callVisionOCR(imageOrImages, onProgress);

      // Si Ollama devolvió campos estructurados, úsalos directamente
      if (fields && Object.keys(fields).length > 0) {
        const result: Partial<OcrResult> = {};
        const f = fields;
        // Map all known field names (also handle alternate casing from model)
        const nombres = f.nombres || f.nombre || f.name || '';
        const apPat = f.apellidoPaterno || f.apellido_paterno || f.primerApellido || '';
        const apMat = f.apellidoMaterno || f.apellido_materno || f.segundoApellido || '';
        if (nombres)   result.nombres         = nombres;
        if (apPat)     result.apellidoPaterno = apPat;
        if (apMat)     result.apellidoMaterno = apMat;
        if (f.curp)            result.curp            = f.curp;
        if (f.folioIne || f.claveElector) result.folioIne = f.folioIne || f.claveElector;
        if (f.prefijoCalle || f.tipoVialidad || f.tipo_vialidad || f.vialidadTipo) result.prefijoCalle = f.prefijoCalle || f.tipoVialidad || f.tipo_vialidad || f.vialidadTipo;
        if (f.calle)           result.calle           = f.calle;
        if (f.numeroExterior || f.numExterior)  result.numeroExterior  = f.numeroExterior || f.numExterior;
        if (f.numeroInterior || f.numInterior)  result.numeroInterior  = f.numeroInterior || f.numInterior;
        if (f.edificio || f.edif || f.torre || f.bloque) result.edificio = f.edificio || f.edif || f.torre || f.bloque;
        if (f.departamento || f.depto || f.dept) result.departamento = f.departamento || f.depto || f.dept;
        if (f.piso || f.nivel) result.piso = f.piso || f.nivel;
        if (f.torre) result.torre = f.torre;
        if (f.manzana || f.mz) result.manzana = f.manzana || f.mz;
        if (f.lote || f.lt) result.lote = f.lote || f.lt;
        if (f.privada || f.priv) result.privada = f.privada || f.priv;
        if (f.sector) result.sector = f.sector;
        if (f.etapa) result.etapa = f.etapa;
        if (f.unidadHabitacional || f.unidad_habitacional || f.unidad) result.unidadHabitacional = f.unidadHabitacional || f.unidad_habitacional || f.unidad;
        if (f.referencias || f.referencia) result.referencias = f.referencias || f.referencia;
        if (f.colonia)         result.colonia         = f.colonia;
        if (f.codigoPostal || f.cp || f.postal) result.codigoPostal = f.codigoPostal || f.cp || f.postal;
        if (f.delegacion || f.municipio || f.alcaldia) result.delegacion = f.delegacion || f.municipio || f.alcaldia;
        if (f.ciudad || f.estado)  result.ciudad = f.ciudad || f.estado;
        if (Object.keys(result).length > 0) return result;
      }

      // Fallback: extraer con regex del texto crudo
      if (!rawText || rawText.trim().length < 10) return null;
      const cleaned = cleanText(rawText);
      const curp = extractCURP(cleaned);
      const folioIne = extractFolioINE(cleaned);
      const codigoPostal = extractCP(cleaned);
      const nombres1 = extractNombre(rawText);
      const nombres2 = extractNombre(cleaned);
      const { nombres, apellidoPaterno, apellidoMaterno } = mergeOcr(nombres1, nombres2);
      const dom1 = extractDomicilio(rawText);
      const dom2 = extractDomicilio(cleaned);
      const dom = mergeOcr(dom1, dom2);

      const result: Partial<OcrResult> = {};
      if (nombres)           result.nombres         = nombres;
      if (apellidoPaterno)   result.apellidoPaterno = apellidoPaterno;
      if (apellidoMaterno)   result.apellidoMaterno = apellidoMaterno;
      if (curp)              result.curp            = curp;
      if (folioIne)          result.folioIne        = folioIne;
      if (codigoPostal)      result.codigoPostal    = codigoPostal;
      if (dom.calle)         result.calle           = dom.calle;
      if (dom.numeroExterior) result.numeroExterior = dom.numeroExterior;
      if (dom.numeroInterior) result.numeroInterior = dom.numeroInterior;
      if (dom.colonia)       result.colonia         = dom.colonia;
      if (dom.delegacion)    result.delegacion      = dom.delegacion;
      if (dom.ciudad)        result.ciudad          = dom.ciudad;

      if (Object.keys(result).length === 0) return null;
      return result;
    } catch (err) {
      console.error('[OCR] Error:', err);
      throw err;
    }
  }
}

export const aiAgent = new CRM_AI_Agent();
