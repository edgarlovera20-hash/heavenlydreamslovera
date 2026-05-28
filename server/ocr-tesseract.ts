/**
 * Fallback OCR 100% local con Tesseract.js + parsers regex.
 * Se usa si Ollama no está disponible o devuelve una lectura poco confiable.
 *
 * Tesseract extrae texto crudo — los parsers heurísticos intentan mapear ese texto
 * a los mismos campos que devuelve el motor local Ollama (nombres, CURP, dirección…).
 *
 * Nota: tesseract.js descarga el language pack 'spa' (~10MB) la primera vez que se
 * invoca y lo cachea localmente.
 */

import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('spa', 1, {
      // Silenciar logs ruidosos en producción
      logger: () => {},
    });
  }
  return workerPromise;
}

async function recognize(base64: string): Promise<string> {
  const worker = await getWorker();
  const buffer = Buffer.from(base64, 'base64');
  const result = await worker.recognize(buffer);
  return result.data.text || '';
}

// ─── HELPERS DE PARSEO ───────────────────────────────────────────────────────

/** Elimina líneas vacías y normaliza espacios. */
function cleanLines(text: string): string[] {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}

/** Quita acentos para comparar. */
function deburr(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Busca la primera línea que matchee una regex (case-insensitive). */
function findLine(lines: string[], re: RegExp): string | null {
  for (const l of lines) if (re.test(l)) return l;
  return null;
}

/** Busca la primera línea cuyo deburr matchee la regex. */
function findLineDeburred(lines: string[], re: RegExp): string | null {
  for (const l of lines) if (re.test(deburr(l))) return l;
  return null;
}

// ─── PARSER: INE ─────────────────────────────────────────────────────────────

export function parseIneText(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = cleanLines(text);
  const upper = text.toUpperCase();

  // CURP: 4 letras + 6 dígitos + H/M + 5 letras + alfanumérico + dígito
  const curp = upper.match(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/);
  if (curp) fields.curp = curp[0];

  // CLAVE DE ELECTOR: 18 alfanuméricos (letras + dígitos, sin patrón CURP)
  const clave = upper.match(/CLAVE\s*DE\s*ELECTOR[^\w]*([A-Z0-9]{18})/);
  if (clave) fields.folioIne = clave[1];

  // Código postal: 5 dígitos (preferimos uno cerca de "C.P." o "CP")
  const cpNear = upper.match(/C\.?\s*P\.?\s*(\d{5})/);
  if (cpNear) {
    fields.codigoPostal = cpNear[1];
  } else {
    const cpAny = upper.match(/\b(\d{5})\b/);
    if (cpAny) fields.codigoPostal = cpAny[1];
  }

  // Nombre / Apellidos: en INE aparecen en bloque después de "NOMBRE"
  // Heurística: buscamos línea "NOMBRE" y tomamos las 3 líneas siguientes en uppercase
  const nombreIdx = lines.findIndex(l => /NOMBRE/i.test(deburr(l)));
  if (nombreIdx >= 0) {
    const block = lines.slice(nombreIdx + 1, nombreIdx + 4)
      .filter(l => /^[A-ZÁÉÍÓÚÑ\s]{3,}$/.test(l.toUpperCase()));
    if (block[0]) fields.apellidoPaterno = block[0].toUpperCase();
    if (block[1]) fields.apellidoMaterno = block[1].toUpperCase();
    if (block[2]) fields.nombres        = block[2].toUpperCase();
  }

  // Domicilio: línea(s) entre "DOMICILIO" y "CLAVE DE ELECTOR" / "CURP" / "FOLIO"
  const domIdx = lines.findIndex(l => /DOMICILIO/i.test(deburr(l)));
  if (domIdx >= 0) {
    const stop = lines.findIndex((l, i) => i > domIdx && /(CLAVE|FOLIO|CURP|SECCION|VIGENCIA)/i.test(deburr(l)));
    const end = stop > 0 ? stop : domIdx + 5;
    const domLines = lines.slice(domIdx + 1, end);
    if (domLines[0]) fields.calle    = domLines[0];
    if (domLines[1]) fields.colonia  = domLines[1];
    if (domLines[2]) fields.ciudad   = domLines[2];
  }

  return fields;
}

// ─── PARSER: COMPROBANTE DE DOMICILIO ────────────────────────────────────────

export function parseComprobanteText(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = cleanLines(text);
  const upper = text.toUpperCase();

  // Proveedor
  if (/\bCFE\b|COMISION\s*FEDERAL/i.test(deburr(upper))) fields.proveedor = 'CFE';
  else if (/\bIZZI\b/i.test(upper)) fields.proveedor = 'Izzi';
  else if (/TOTALPLAY/i.test(upper)) fields.proveedor = 'Totalplay';
  else if (/TELMEX|TELEFONOS\s*DE\s*MEXICO/i.test(deburr(upper))) fields.proveedor = 'Telmex';
  else if (/MEGACABLE/i.test(upper)) fields.proveedor = 'Megacable';

  // CP
  const cp = upper.match(/C\.?\s*P\.?\s*(\d{5})/) || upper.match(/\b(\d{5})\b/);
  if (cp) fields.codigoPostal = cp[1];

  // Primer bloque de líneas mayúsculas suele ser nombre + dirección
  const upperLines = lines.filter(l => /^[A-ZÁÉÍÓÚÑ0-9\s\.,\-#°/]{6,}$/.test(l) && l.length < 80);
  if (upperLines[0]) {
    const parts = upperLines[0].split(/\s+/);
    if (parts.length >= 2) {
      fields.apellidoPaterno = parts[0];
      fields.apellidoMaterno = parts[1] || '';
      fields.nombres         = parts.slice(2).join(' ');
    }
  }
  if (upperLines[1]) fields.calle   = upperLines[1];
  if (upperLines[2]) fields.colonia = upperLines[2];
  if (upperLines[3]) fields.ciudad  = upperLines[3];

  return fields;
}

// ─── PARSER: SIAC (TELMEX) ───────────────────────────────────────────────────

export function parseSiacText(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = cleanLines(text);

  // Folio SIAC: 8-10 dígitos cerca de "Folio"
  const folio = text.match(/Folio\s*SIAC[^\d]*(\d{6,12})/i)
            || text.match(/Folio[^\d]*(\d{8,10})/i);
  if (folio) fields.folioSiac = folio[1];

  // Servicio: 3-4 dígitos cerca de "Servicio"
  const servicio = text.match(/Servicio[^\d]*(\d{3,4})\b/i);
  if (servicio) fields.servicio = servicio[1];

  // Celular: primer número de 10 dígitos cerca de "Celular" o suelto
  const cel = text.match(/Celular[^\d]*(\d{10})/i) || text.match(/\b(\d{10})\b/);
  if (cel) fields.celular = cel[1];

  // Correo electrónico
  const correo = text.match(/[\w.+\-]+@[\w\-]+\.[\w.\-]+/);
  if (correo) fields.correo = correo[0];

  // Nombre completo: línea con "Nombre" o primera línea con 3+ palabras alfabéticas mayúsculas
  const nombreLine = findLineDeburred(lines, /^(NOMBRE|DATOS\s*DE\s*CONTACTO)/i);
  if (nombreLine) {
    const after = nombreLine.replace(/^(NOMBRE|DATOS\s*DE\s*CONTACTO)[:\s\-]*/i, '').trim();
    if (after) fields.nombreCompleto = after;
  }
  if (!fields.nombreCompleto) {
    const cand = lines.find(l => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){2,}/.test(l));
    if (cand) fields.nombreCompleto = cand;
  }

  // Gastos de instalación
  const gastos = lines.find(l => /(pago\s*inicial|gastos\s*de\s*instal)/i.test(deburr(l)));
  if (gastos) fields.gastosInstalacion = gastos;

  return fields;
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

export async function runTesseractIne(base64: string): Promise<{ text: string; fields: Record<string, string> }> {
  const text = await recognize(base64);
  return { text, fields: parseIneText(text) };
}

export async function runTesseractComprobante(base64: string): Promise<{ text: string; fields: Record<string, string> }> {
  const text = await recognize(base64);
  return { text, fields: parseComprobanteText(text) };
}

export async function runTesseractSiac(base64: string): Promise<{ text: string; fields: Record<string, string> }> {
  const text = await recognize(base64);
  return { text, fields: parseSiacText(text) };
}

export function parseOcrText(docType: 'ine' | 'comprobante' | 'siac', text: string): Record<string, string> {
  if (docType === 'ine') return parseIneText(text);
  if (docType === 'comprobante') return parseComprobanteText(text);
  return parseSiacText(text);
}

/** Permite limpiar el worker (útil en tests o reinicios). */
export async function shutdownTesseract(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
