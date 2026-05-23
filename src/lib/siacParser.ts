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
    const next = line[i + 1];
    if (ch === '"' && inQuote && next === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
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

function clean(value: string | undefined): string {
  const trimmed = String(value || '').trim();
  if (!trimmed || /^null$/i.test(trimmed) || trimmed === '--') return '';
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

function at(fields: string[], index: number) {
  return index >= 0 ? clean(fields[index]) : '';
}

function parseByHeader(lines: string[]): SIACRecord[] {
  const headers = parseLine(lines[0]);
  const h = headerTools(headers);

  const iFolio = h.first(['Folio SIAC']);
  if (iFolio < 0) return [];

  const iStatus = h.first(['Estatus SIAC', 'Estatus']);
  const iFecha = h.first(['Fecha Captura', 'Fecha de Captura']);
  const iElaboracion = h.first(['Estatus Elaborada', 'Elaboracion', 'Elaborada']);
  const iPaquete = h.first(['Paquete']);
  const iTipoPrincipal = h.first(['Tipo de Linea', 'Tipo Linea', 'Linea Contratada']);
  const iTipoFinal = h.last(['Tipo de Linea', 'Tipo Linea']);
  const iArea = h.first(['Area']);
  const iEstrategia = h.first(['Estrategia']);
  const iPromotor = h.first(['Promotor', 'Usuario']);
  const iOS = h.first(['Orden de Servicio', 'Orrden de Servicio', 'Orden Servicio', 'OS Alta Linea']);
  const iTelefono = h.first(['Telefono']);
  const iTelPago = h.first(['Tel Pago', 'Telefono Pago', 'Telefono Asignado']);
  const iFechaPosteo = h.first(['Fecha Posteo', 'Fecha OS Alta']);
  const iTienda = h.first(['Tienda']);
  const iEtapa = h.first(['Etapa PISA', 'Estatus Etapa']);
  const iOsPago = h.first(['OS de Pago']);
  const iZona = h.first(['Zona']);
  const iDistrito = h.first(['Distrito']);
  const iColonia = h.first(['Colonia']);
  const iCorreo = h.first(['Correo', 'Correo Electronico']);

  return lines.slice(1).reduce<SIACRecord[]>((records, line, rowIndex) => {
    if (!line.trim()) return records;
    const f = parseLine(line);
    const rawFolio = at(f, iFolio);
    const folioSiac = rawFolio || `SIN-FOLIO-${String(rowIndex + 1).padStart(5, '0')}`;
    const paquete = at(f, iPaquete);
    const zona = at(f, iZona);
    const distrito = at(f, iDistrito);
    const colonia = at(f, iColonia);
    const telefono = at(f, iTelefono);
    const hasUsefulData = rawFolio || at(f, iOS) || at(f, iOsPago) || telefono || at(f, iTelPago) || zona || distrito;
    if (!hasUsefulData) return records;
    records.push({
      id: `siac-${folioSiac || rowIndex}`,
      estatus: at(f, iStatus),
      fechaCaptura: at(f, iFecha),
      folioSiac,
      elaboracion: at(f, iElaboracion),
      paquete,
      precio: extractPrice(paquete),
      tipoCliente: at(f, iTipoPrincipal),
      area: at(f, iArea) || zona,
      estrategia: at(f, iEstrategia),
      nombrePromotor: at(f, iPromotor),
      usuarioPromotor: at(f, iPromotor),
      ordenServicio: at(f, iOS),
      numPortar: telefono,
      telefonoAsignado: at(f, iTelPago),
      fechaPosteo: at(f, iFechaPosteo),
      tienda: at(f, iTienda),
      etapa: at(f, iEtapa),
      error: [distrito, colonia].filter(Boolean).join(' · '),
      osPago: at(f, iOsPago),
      telTelmex: at(f, iTelPago) || telefono,
      tipoLinea: at(f, iTipoFinal),
      zona,
      email: at(f, iCorreo),
      numCelular: telefono,
    });
    return records;
  }, []);
}

export function parseSIACCsv(csvText: string): SIACRecord[] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const headerRecords = parseByHeader(lines);
  if (headerRecords.length) return headerRecords;

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
