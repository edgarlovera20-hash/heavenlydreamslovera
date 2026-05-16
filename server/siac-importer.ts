import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { SiacRecords } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, 'siac-data.csv');

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
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
  if (!val || val === 'null' || val === '--' || val === '0000000000') return null;
  return val.trim() || null;
}

export function importSiacCSV(): { imported: number; skipped: number } {
  if (!existsSync(CSV_PATH)) {
    console.warn('[SIAC] No se encontró siac-data.csv');
    return { imported: 0, skipped: 0 };
  }

  const content = readFileSync(CSV_PATH, 'latin1');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { imported: 0, skipped: 0 };

  // Parse headers
  const headers = parseCSVLine(lines[0]);
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));

  const iF   = idx('Folio SIAC');
  const iFC  = idx('Fecha Captura');
  const iE   = idx('Estrategia');
  const iP   = idx('Promotor');
  const iES  = idx('Estatus SIAC');
  const iTL  = idx('Tipo Linea');
  const iLC  = idx('Linea Contratada');
  const iA   = idx('Area');
  const iDiv = idx('Division');
  const iTie = idx('Tienda');
  const iPaq = idx('Paquete');
  const iObs = idx('Observaciones');
  const iRT  = idx('Respuesta Telmex');
  const iMR  = idx('Motivo Rechazo');
  const iTA  = idx('Telefono Asignado');
  const iTP  = idx('Telefono Portado');
  const iOS  = idx('OS Alta Linea');
  const iFOS = idx('Fecha OS Alta');
  const iEPI = idx('Estatus PISA Multiorden');
  const iFCS = idx('Fecha cambio estatus');
  const iTC  = idx('Tipo de Cliente');
  const iTS  = idx('Tipo de Servicio');
  const iCo  = idx('Correo');
  const iEEt = idx('Estatus Etapa');
  const iCam = idx('Campana');

  let imported = 0, skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const folio = clean(cols[iF]);
    if (!folio) { skipped++; continue; }

    try {
      SiacRecords.upsert({
        id:                  randomUUID(),
        folio_siac:          folio,
        fecha_captura:       clean(cols[iFC]),
        estrategia:          clean(cols[iE]),
        promotor:            clean(cols[iP]),
        estatus_siac:        clean(cols[iES]),
        tipo_linea:          clean(cols[iTL]),
        linea_contratada:    clean(cols[iLC]),
        area:                clean(cols[iA]),
        division:            clean(cols[iDiv]),
        tienda:              clean(cols[iTie]),
        paquete:             clean(cols[iPaq]),
        observaciones:       clean(cols[iObs]),
        respuesta_telmex:    clean(cols[iRT]),
        motivo_rechazo:      clean(cols[iMR]),
        telefono_asignado:   clean(cols[iTA]),
        telefono_portado:    clean(cols[iTP]),
        os_alta:             clean(cols[iOS]),
        fecha_os_alta:       clean(cols[iFOS]),
        estatus_pisa:        clean(cols[iEPI]),
        fecha_cambio_estatus:clean(cols[iFCS]),
        tipo_cliente:        clean(cols[iTC]),
        tipo_servicio:       clean(cols[iTS]),
        correo:              clean(cols[iCo]),
        estatus_etapa:       clean(cols[iEEt]),
        campana:             clean(cols[iCam]),
      });
      imported++;
    } catch { skipped++; }
  }

  console.log(`[SIAC] Importados: ${imported}, omitidos: ${skipped}`);
  return { imported, skipped };
}
