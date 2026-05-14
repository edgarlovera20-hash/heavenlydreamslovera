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
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
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
// IMAGE PRE-PROCESSING
// Escala, convierte a escala de grises y aumenta
// contraste antes de pasarla a Tesseract.
// Esto mejora significativamente la precisión.
// ─────────────────────────────────────────────
async function preprocessImage(base64Image: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX_DIM = 2400;
      const scale = Math.min(MAX_DIM / Math.max(img.width, img.height), 3);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // Fondo blanco (evita transparencia negra)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // Procesado pixel a pixel
      const id = ctx.getImageData(0, 0, w, h);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        // Escala de grises
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // Contraste alto (factor 1.8)
        const c = Math.min(255, Math.max(0, 1.8 * (gray - 128) + 128));
        // Umbral adaptativo suave (binarización parcial)
        const out = c > 145 ? 255 : c < 60 ? 0 : c;
        d[i] = d[i + 1] = d[i + 2] = out;
        d[i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(base64Image); // fallback sin procesar
    img.src = base64Image;
  });
}

// ─────────────────────────────────────────────
// TESSERACT — doble pasada (PSM 3 + PSM 6)
// PSM 3 = detección automática de layout
// PSM 6 = bloque uniforme de texto
// Combinar ambos maximiza cobertura de campos
// ─────────────────────────────────────────────
async function runTesseract(
  base64Image: string,
  onProgress?: (p: number) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js');

  // Preprocesar imagen
  const processed = await preprocessImage(base64Image);

  const runPass = async (psm: number, weight: number): Promise<string> => {
    const worker = await createWorker('spa', 1, {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * weight * 100));
        }
      },
    });
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: psm as any,
        preserve_interword_spaces: '1',
        tessedit_char_whitelist:
          'ABCDEFGHIJKLMNÑOPQRSTUVWXYZabcdefghijklmnñopqrstuvwxyzÁÉÍÓÚáéíóú0123456789.,;:/-# ',
      });
      const { data } = await worker.recognize(processed);
      return data.text || '';
    } finally {
      await worker.terminate();
    }
  };

  // Pasada 1: PSM 3 (auto-layout), peso 0→50%
  const text1 = await runPass(3, 0.5);
  if (onProgress) onProgress(50);
  // Pasada 2: PSM 6 (bloque uniforme), peso 50→100%
  const text2 = await runPass(6, 0.5);
  if (onProgress) onProgress(100);

  // Combinar: el texto más largo suele ser más completo
  return text1.length >= text2.length
    ? text1 + '\n' + text2
    : text2 + '\n' + text1;
}

// ─────────────────────────────────────────────
// REGEX EXTRACTORS
// ─────────────────────────────────────────────

// CURP — 18 caracteres exactos
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
    .replace(/[|\\[\]{}()*+?^$]/g, ' ')  // limpiar caracteres especiales OCR
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
  // 1. Clave de elector
  const ce = text.match(CLAVE_ELECTOR_RE);
  if (ce) return ce[1];
  // 2. IDMEX / FOLIO
  const f = text.match(FOLIO_CREDENCIAL_RE);
  if (f) return f[1];
  // 3. Línea que contenga solo alfanum 13-18 chars (reverso INE)
  for (const line of text.split('\n')) {
    const t = line.trim().replace(/\s/g, '');
    if (/^[A-Z0-9]{13,18}$/.test(t)) return t;
  }
  return '';
}

function extractCP(text: string): string {
  const ctx = text.match(CP_RE);
  if (ctx) return ctx[1];
  // Buscar en contexto de domicilio
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

  // Estrategia 2: CURP → derivar apellidos (determinístico)
  if (!apellidoPaterno || !apellidoMaterno) {
    const curp = extractCURP(text.toUpperCase());
    if (curp.length === 18) {
      // CURP: [APC1][APC2][AC][AM] — primera letra paterno, primera vocal interna paterno,
      // primera consonante materno, primera consonante nombre(s)
      // Posiciones: 0-3=letras, 4-9=fecha, 10=sexo, 11-12=estado, 13-15=consonantes, 16=homoclave, 17=dígito
      // No podemos reconstruir el nombre completo, pero sí buscarlo en el texto
    }
  }

  // Estrategia 3: bloque de 3 líneas ALL-CAPS consecutivas (INE legacy)
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

  // Estrategia 4: buscar patrón "APELLIDO PATERNO: XXX"
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

  // Localizar sección de domicilio
  const domIdx = Math.max(
    upper.search(/DOMICILIO/),
    upper.search(/DIRECCI[OÓ]N/),
    upper.search(/CALLE\b/),
  );
  const section = domIdx !== -1
    ? upper.slice(domIdx, domIdx + 500)
    : upper;

  // Colonia
  const colMatch = section.match(
    /COL\.?\s*([A-ZÁÉÍÓÚÑ0-9 .]{2,40?})(?=\s*(?:\d{5}|C\.?P\.?|DEL|MUN|$))/,
  );
  if (colMatch) result.colonia = colMatch[1].trim();

  // Calle + número exterior
  const calleMatch = section.match(
    /(?:CALLE|DOMICILIO)[:\s]*([A-ZÁÉÍÓÚÑ0-9 .]{3,50?}?)\s+(?:N[UÚ]M\.?|#|EXT\.?)?\s*(\d+[A-Z]?)/,
  );
  if (calleMatch) {
    result.calle = calleMatch[1].trim();
    result.numeroExterior = calleMatch[2];
  } else {
    // Fallback: primera línea después de DOMICILIO con número al final
    const fallback = section.match(/([A-ZÁÉÍÓÚÑ ]{3,50})\s+(\d{1,5}[A-Z]?)\b/);
    if (fallback) {
      result.calle = fallback[1].trim();
      result.numeroExterior = fallback[2];
    }
  }

  // Número interior
  const intMatch = section.match(/INT\.?\s*(\d+[A-Z]?)/);
  if (intMatch) result.numeroInterior = intMatch[1];

  // Delegación / Municipio
  const delMatch = section.match(
    /(?:DEL\.?|MUN\.?|ALCALD[IÍ]A)\s+([A-ZÁÉÍÓÚÑ ]{3,40?})(?=\s*(?:\d|\n|CIUDAD|$))/,
  );
  if (delMatch) result.delegacion = delMatch[1].trim();

  // Ciudad (buscar "CIUDAD DE MEXICO" o "CDMX" u otras)
  const cidMatch = section.match(/(?:CIUDAD[^,\n]{0,30}|CDMX|GDL|MTY)/);
  if (cidMatch) result.ciudad = cidMatch[0].trim();

  return result;
}

// ─────────────────────────────────────────────
// MERGE RESULTS — combina dos pasadas OCR
// prefiriendo el valor más largo y limpio
// ─────────────────────────────────────────────
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
    base64Image: string,
    _mimeType: string,
    onProgress?: (p: number) => void,
  ): Promise<Partial<OcrResult> | null> {
    try {
      // Doble pasada de OCR con progreso dividido
      const rawText = await runTesseract(base64Image, onProgress);
      if (!rawText || rawText.trim().length < 10) return null;

      const cleaned = cleanText(rawText);

      // Extraer desde texto limpio (para CURP/folio) y desde texto original (para nombres)
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
      if (nombres) result.nombres = nombres;
      if (apellidoPaterno) result.apellidoPaterno = apellidoPaterno;
      if (apellidoMaterno) result.apellidoMaterno = apellidoMaterno;
      if (curp) result.curp = curp;
      if (folioIne) result.folioIne = folioIne;
      if (codigoPostal) result.codigoPostal = codigoPostal;
      if (dom.calle) result.calle = dom.calle;
      if (dom.numeroExterior) result.numeroExterior = dom.numeroExterior;
      if (dom.numeroInterior) result.numeroInterior = dom.numeroInterior;
      if (dom.colonia) result.colonia = dom.colonia;
      if (dom.delegacion) result.delegacion = dom.delegacion;
      if (dom.ciudad) result.ciudad = dom.ciudad;

      if (Object.keys(result).length === 0) return null;
      return result;
    } catch (err) {
      console.error('[OCR] Error:', err);
      return null;
    }
  }
}

export const aiAgent = new CRM_AI_Agent();
