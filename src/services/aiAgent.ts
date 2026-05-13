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

// ---------- OCR helpers ----------

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toUpperCase();
}

// CURP: 4 letras + 6 dígitos (fecha) + H/M + 5 letras (entidad+consonantes) + alfanum + dígito
const CURP_RE = /\b([A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d)\b/;
// Folio INE / Clave de elector: 13 a 18 alfanum sin espacios
const CLAVE_ELECTOR_RE = /\b([A-Z]{6}\d{8}[HM]\d{3})\b/;
const CP_RE = /\b(?:C\.?P\.?\s*|CP\s*)?(\d{5})\b/;

function extractCURP(text: string): string {
  const m = text.match(CURP_RE);
  return m ? m[1] : '';
}

function extractFolioINE(text: string): string {
  const claveMatch = text.match(CLAVE_ELECTOR_RE);
  if (claveMatch) return claveMatch[1];
  // Fallback: look for "IDMEX" + numbers, or long alphanumeric strings of 13+ on a line
  const idmex = text.match(/IDMEX\s*([A-Z0-9]{10,})/);
  if (idmex) return idmex[1];
  return '';
}

function extractCP(text: string): string {
  // Prefer CP after the word DOMICILIO/COLONIA/CP
  const ctxMatch = text.match(/(?:C\.?P\.?|CODIGO\s*POSTAL)\D{0,5}(\d{5})/);
  if (ctxMatch) return ctxMatch[1];
  const m = text.match(CP_RE);
  return m ? m[1] : '';
}

function extractNombre(text: string): { nombres: string; apellidoPaterno: string; apellidoMaterno: string } {
  // INE shows three labelled lines: NOMBRE / NOMBRES, then APELLIDO PATERNO, APELLIDO MATERNO
  // (legacy formats put apellidos before nombres). We try both.
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let nombres = '', apellidoPaterno = '', apellidoMaterno = '';

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toUpperCase();
    const next = (lines[i + 1] || '').trim();
    if (/^NOMBRE(S)?\b/.test(l) && next && /^[A-ZÁÉÍÓÚÑ ]{2,}$/.test(next.toUpperCase())) {
      nombres = next.toUpperCase();
    }
    if (/^APELLIDO\s+PATERNO\b/.test(l) && next && /^[A-ZÁÉÍÓÚÑ ]{2,}$/.test(next.toUpperCase())) {
      apellidoPaterno = next.toUpperCase();
    }
    if (/^APELLIDO\s+MATERNO\b/.test(l) && next && /^[A-ZÁÉÍÓÚÑ ]{2,}$/.test(next.toUpperCase())) {
      apellidoMaterno = next.toUpperCase();
    }
  }

  // Fallback: derive from CURP (positions are deterministic) — only if nothing else worked
  if (!apellidoPaterno && !apellidoMaterno && !nombres) {
    // Look for 3 consecutive ALL-CAPS lines (typical INE block)
    const blocks: string[] = [];
    for (const line of lines) {
      if (/^[A-ZÁÉÍÓÚÑ ]{3,}$/.test(line) && !/[0-9]/.test(line) && line.split(' ').length <= 4) {
        blocks.push(line);
      }
      if (blocks.length === 3) break;
    }
    if (blocks.length >= 3) {
      // Heuristic: most INE put APELLIDO PATERNO, MATERNO, NOMBRE(S) in that order
      apellidoPaterno = blocks[0];
      apellidoMaterno = blocks[1];
      nombres = blocks[2];
    }
  }

  return { nombres, apellidoPaterno, apellidoMaterno };
}

function extractDomicilio(text: string): { calle: string; numeroExterior: string; numeroInterior: string; colonia: string; ciudad: string; delegacion: string } {
  const result = { calle: '', numeroExterior: '', numeroInterior: '', colonia: '', ciudad: '', delegacion: '' };
  const upper = text.toUpperCase();
  const domIdx = upper.search(/DOMICILIO/);
  if (domIdx === -1) return result;
  const tail = upper.slice(domIdx).split('\n').slice(0, 6).join(' ');

  const colMatch = tail.match(/COL\.?\s+([A-Z0-9 ÁÉÍÓÚÑ.]+?)(?:\s+\d{5}|\s+C\.?P\.?|\s+DEL|$)/);
  if (colMatch) result.colonia = colMatch[1].trim();

  const calleMatch = tail.match(/DOMICILIO[:\s]*([A-Z0-9 ÁÉÍÓÚÑ.]+?)\s+(\d+[A-Z]?)\s+/);
  if (calleMatch) {
    result.calle = calleMatch[1].trim();
    result.numeroExterior = calleMatch[2];
  }

  const intMatch = tail.match(/INT\.?\s*(\d+[A-Z]?)/);
  if (intMatch) result.numeroInterior = intMatch[1];

  const delMatch = tail.match(/DEL\.?\s+([A-Z ÁÉÍÓÚÑ]+?)(?:\s+\d|\s+CIUDAD|$)/);
  if (delMatch) result.delegacion = delMatch[1].trim();

  return result;
}

async function runTesseract(base64Image: string, onProgress?: (p: number) => void): Promise<string> {
  // Dynamic import keeps tesseract out of the main bundle (~3MB)
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', undefined, {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  try {
    const { data } = await worker.recognize(base64Image);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

export class CRM_AI_Agent {
  public async generateResponse(cliente: CustomerData, evento: EventType, mensajeUsuario: string = ''): Promise<string> {
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
      const text = await runTesseract(base64Image, onProgress);
      if (!text || text.trim().length < 5) return null;

      const cleaned = cleanText(text);
      const curp = extractCURP(cleaned);
      const folioIne = extractFolioINE(cleaned);
      const codigoPostal = extractCP(cleaned);
      const { nombres, apellidoPaterno, apellidoMaterno } = extractNombre(text);
      const dom = extractDomicilio(text);

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

      if (Object.keys(result).length === 0) return null;
      return result;
    } catch (err) {
      console.error('[OCR] Tesseract error:', err);
      return null;
    }
  }
}

export const aiAgent = new CRM_AI_Agent();
