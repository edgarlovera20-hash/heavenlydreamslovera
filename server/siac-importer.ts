import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomUUID } from 'crypto';
import { SiacRecords } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, 'siac-data.csv');

interface ImportSiacOptions {
  sourcePath?: string;
  replace?: boolean;
}

function decodeCSV(sourcePath: string): string {
  const buffer = readFileSync(sourcePath);
  const utf8 = buffer.toString('utf8');
  const replacementChars = (utf8.match(/\uFFFD/g) || []).length;
  return replacementChars > 5 ? buffer.toString('latin1') : utf8;
}

export function getSiacCSVFingerprint(sourcePath = CSV_PATH): string | null {
  if (!existsSync(sourcePath)) return null;
  return createHash('sha256').update(readFileSync(sourcePath)).digest('hex');
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function clean(val: string | undefined): string | null {
  if (val == null) return null;
  const trimmed = String(val).trim();
  if (!trimmed || /^null$/i.test(trimmed) || trimmed === '--' || trimmed === '0000000000') return null;
  return trimmed;
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toUpperCase();
}

function headerTools(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const indexes = (aliases: string[]) => {
    const normalizedAliases = aliases.map(normalizeHeader);
    const exact = normalized
      .map((header, index) => normalizedAliases.includes(header) ? index : -1)
      .filter(index => index >= 0);
    if (exact.length) return exact;
    return normalized
      .map((header, index) => normalizedAliases.some(alias => header.includes(alias)) ? index : -1)
      .filter(index => index >= 0);
  };
  return {
    first: (aliases: string[]) => indexes(aliases)[0] ?? -1,
    last: (aliases: string[]) => {
      const found = indexes(aliases);
      return found.length ? found[found.length - 1] : -1;
    },
  };
}

function value(cols: string[], index: number) {
  return index >= 0 ? clean(cols[index]) : null;
}

export function importSiacCSV(options: ImportSiacOptions = {}): { imported: number; skipped: number; source: string } {
  const sourcePath = options.sourcePath || CSV_PATH;
  if (!existsSync(sourcePath)) {
    console.warn(`[SIAC] No se encontró CSV: ${sourcePath}`);
    return { imported: 0, skipped: 0, source: sourcePath };
  }

  const content = decodeCSV(sourcePath);
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { imported: 0, skipped: 0, source: sourcePath };

  if (options.replace) {
    SiacRecords.deleteAll();
  }

  const headers = parseCSVLine(lines[0]);
  const header = headerTools(headers);

  const iF = header.first(['Folio SIAC']);
  const iFC = header.first(['Fecha Captura', 'Fecha de Captura']);
  const iEstrategia = header.first(['Estrategia']);
  const iPromotor = header.first(['Promotor', 'Usuario']);
  const iEstatus = header.first(['Estatus SIAC', 'Estatus']);
  const iElaborada = header.first(['Estatus Elaborada', 'Elaboracion', 'Elaborada']);
  const iTipoLineaPrincipal = header.first(['Tipo de Linea', 'Tipo Linea', 'Linea Contratada']);
  const iTipoLineaFinal = header.last(['Tipo de Linea', 'Tipo Linea']);
  const iArea = header.first(['Area']);
  const iDivision = header.first(['Division']);
  const iTienda = header.first(['Tienda']);
  const iPaquete = header.first(['Paquete']);
  const iObs = header.first(['Observaciones']);
  const iRT = header.first(['Respuesta Telmex']);
  const iMR = header.first(['Motivo Rechazo']);
  const iTelefono = header.first(['Telefono']);
  const iTelPago = header.first(['Tel Pago', 'Telefono Pago', 'Telefono Asignado']);
  const iTelefonoAsignado = header.first(['Telefono Asignado']);
  const iTelefonoPortado = header.first(['Telefono Portado']);
  const iOS = header.first(['Orden de Servicio', 'Orrden de Servicio', 'Orden Servicio', 'OS Alta Linea']);
  const iOsPago = header.first(['OS de Pago']);
  const iFechaPosteo = header.first(['Fecha Posteo', 'Fecha OS Alta']);
  const iEPI = header.first(['Estatus PISA Multiorden', 'Etapa PISA']);
  const iFCS = header.first(['Fecha cambio estatus']);
  const iTC = header.first(['Tipo de Cliente']);
  const iTS = header.first(['Tipo de Servicio']);
  const iCo = header.first(['Correo', 'Correo Electronico']);
  const iEEt = header.first(['Estatus Etapa']);
  const iCam = header.first(['Campana']);
  const iZona = header.first(['Zona']);
  const iDistrito = header.first(['Distrito']);
  const iColonia = header.first(['Colonia']);

  let imported = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const tipoLineaPrincipal = value(cols, iTipoLineaPrincipal);
    const tipoLineaFinal = value(cols, iTipoLineaFinal);
    const telefonoGeneral = value(cols, iTelefono);
    const telPago = value(cols, iTelPago);
    const telefonoAsignado = value(cols, iTelefonoAsignado) || telPago;
    const telefonoPortado = value(cols, iTelefonoPortado) || telefonoGeneral;
    const osAlta = value(cols, iOS);
    const osPago = value(cols, iOsPago);
    const zona = value(cols, iZona);
    const distrito = value(cols, iDistrito);
    const rawFolio = value(cols, iF);
    const folio = rawFolio || `SIN-FOLIO-${String(i).padStart(5, '0')}`;
    const hasUsefulData = rawFolio || osAlta || osPago || telefonoGeneral || telPago || zona || distrito;
    if (!hasUsefulData) {
      skipped++;
      continue;
    }

    try {
      SiacRecords.upsert({
        id: randomUUID(),
        folio_siac: folio,
        fecha_captura: value(cols, iFC),
        estrategia: value(cols, iEstrategia),
        promotor: value(cols, iPromotor),
        estatus_siac: value(cols, iEstatus),
        tipo_linea: tipoLineaPrincipal,
        linea_contratada: tipoLineaPrincipal,
        area: value(cols, iArea) || zona,
        division: value(cols, iDivision) || distrito,
        tienda: value(cols, iTienda),
        paquete: value(cols, iPaquete),
        observaciones: value(cols, iObs)
          || [!rawFolio ? 'FOLIO SIAC SIN CAPTURAR' : null, osPago ? `OS DE PAGO: ${osPago}` : null].filter(Boolean).join(' | ')
          || null,
        respuesta_telmex: value(cols, iRT),
        motivo_rechazo: value(cols, iMR),
        telefono_asignado: telefonoAsignado,
        telefono_portado: telefonoPortado,
        os_alta: osAlta || osPago,
        fecha_os_alta: value(cols, iFechaPosteo),
        estatus_pisa: value(cols, iEPI) || value(cols, iElaborada),
        fecha_cambio_estatus: value(cols, iFCS) || value(cols, iFechaPosteo),
        tipo_cliente: value(cols, iTC) || tipoLineaFinal,
        tipo_servicio: value(cols, iTS),
        correo: value(cols, iCo),
        estatus_etapa: value(cols, iEEt) || value(cols, iEPI),
        campana: value(cols, iCam),
        telefono_referencia: telefonoGeneral,
        zona,
        distrito,
        colonia: value(cols, iColonia),
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  console.log(`[SIAC] Importados: ${imported}, omitidos: ${skipped}, fuente: ${sourcePath}`);
  return { imported, skipped, source: sourcePath };
}
