export interface SIACRecord {
  id: string;
  estatus: 'ABIERTA' | 'POSTEADA' | string;
  fechaCaptura: string;       // DD/MM/YYYY
  folioSiac: string;
  elaboracion: string;
  paquete: string;
  precio: number;             // extraído del nombre del paquete
  tipoCliente: string;        // LINEA NUEVA | LINEA PORTADA
  area: string;
  estrategia: string;
  nombrePromotor: string;
  usuarioPromotor: string;
  ordenServicio: string;
  numPortar: string;
  telefonoAsignado: string;
  fechaPosteo: string;
  tienda: string;
  etapa: string;
  error: string;
  osPago: string;
  telTelmex: string;
  tipoLinea: 'RESIDENCIAL' | 'COMERCIAL' | string;
  zona: string;
  email: string;
  numCelular: string;
}

/** Extrae el precio del nombre del paquete, ej: "PFR39-INFINITUM 349" → 349 */
function extractPrice(paquete: string): number {
  const m = paquete.trim().match(/(\d{3,4})$/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Parsea una línea CSV respetando comas dentro de comillas */
function parseLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export function parseSIACCsv(csvText: string): SIACRecord[] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const records: SIACRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const f = parseLine(line);
    if (f.length < 17) continue;

    const paquete = f[4] || '';
    records.push({
      id: `siac-${f[2] || i}`,
      estatus: f[0] || '',
      fechaCaptura: f[1] || '',
      folioSiac: f[2] || '',
      elaboracion: f[3] || '',
      paquete,
      precio: extractPrice(paquete),
      tipoCliente: f[5] || '',
      area: f[6] || '',
      estrategia: f[7] || '',
      nombrePromotor: f[8] || '',
      usuarioPromotor: f[9] || '',
      ordenServicio: f[10] || '',
      numPortar: f[11] || '',
      telefonoAsignado: f[12] || '',
      fechaPosteo: f[13] || '',
      tienda: f[14] || '',
      etapa: f[15] || '',
      error: f[16] || '',
      osPago: f[17] || '',
      telTelmex: f[18] || '',
      tipoLinea: f[19] || '',
      zona: f[20] || '',
      email: f[21] || '',
      numCelular: f[22] || '',
    });
  }
  return records;
}

const KEY = 'adhdreams_siac';

export function saveSIAC(records: SIACRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(records));
}

export function loadSIAC(): SIACRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
