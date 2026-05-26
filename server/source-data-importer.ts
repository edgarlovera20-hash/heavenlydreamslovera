import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import db, { ClientesCrm, Morosidad, SiacRecords } from './db';

const REPO_SIAC_SOURCE = path.join(process.cwd(), 'server', 'source-data', 'siac-current.xlsx');
export const DEFAULT_SIAC_SOURCE = process.env.SIAC_PRIMARY_SOURCE
  || (existsSync(REPO_SIAC_SOURCE) ? REPO_SIAC_SOURCE : 'C:\\Users\\Edgar Lovera\\OneDrive\\Desktop\\SIAC PPIES.csv');
export const DEFAULT_MOROSOS_SOURCE = process.env.MOROSOS_PRIMARY_SOURCE || 'C:\\Users\\Edgar Lovera\\OneDrive\\Desktop\\MOROSOS APP.csv';
export const SIAC_IMPORTER_VERSION = 'siac-ppies-v2';

type SourceInput = { sourcePath?: string; buffer?: Buffer; fileName?: string; replace?: boolean };

function fingerprintBuffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function getSourceFingerprint(sourcePath: string) {
  if (!existsSync(sourcePath)) return null;
  return fingerprintBuffer(readFileSync(sourcePath));
}

function decodeText(buffer: Buffer) {
  const utf8 = buffer.toString('utf8');
  const replacementChars = (utf8.match(/\uFFFD/g) || []).length;
  return replacementChars > 5 ? buffer.toString('latin1') : utf8;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && quoted && next === '"') { cur += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsvRows(text: string) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];
  const headers = uniqueHeaders(parseCsvLine(lines[0]));
  return lines.slice(1).map(line => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = cols[index] ?? ''; });
    return row;
  });
}

function xmlDecode(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function normalizeHeader(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toUpperCase();
}

function baseHeaderKey(key: string) {
  return key.replace(/__\d+$/, '');
}

function uniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = String(header || `Columna ${index + 1}`).trim() || `Columna ${index + 1}`;
    const normalized = normalizeHeader(base) || `COLUMNA ${index + 1}`;
    const count = (seen.get(normalized) || 0) + 1;
    seen.set(normalized, count);
    return count === 1 ? base : `${base}__${count}`;
  });
}

function clean(value: any) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || /^null$/i.test(trimmed) || trimmed === '--' || trimmed === '0000000000' || trimmed === '0') return null;
  return trimmed;
}

function digits10(value: any) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : clean(value);
}

function excelSerialDate(raw: string) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 25000 || n > 80000) return raw;
  const date = new Date(Math.round((n - 25569) * 86400 * 1000));
  return date.toISOString().slice(0, 10);
}

function colIndex(ref: string) {
  const letters = (ref.match(/[A-Z]+/) || ['A'])[0];
  return letters.split('').reduce((sum, ch) => sum * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

async function parseXlsxRows(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string').catch(() => '') || '';
  const shared = [...sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map(match => {
    const text = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => xmlDecode(t[1])).join('');
    return text.trim();
  });
  const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
  if (!sheetXml) return [];
  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = (attrs.match(/\br="([^"]+)"/) || [])[1] || '';
      const type = (attrs.match(/\bt="([^"]+)"/) || [])[1] || '';
      const idx = colIndex(ref);
      const raw = (body.match(/<v[^>]*>([\s\S]*?)<\/v>/) || body.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || '';
      const value = type === 's' ? (shared[Number(raw)] || '') : xmlDecode(raw);
      row[idx] = value;
    }
    if (row.some(Boolean)) rows.push(row.map(value => value || ''));
  }
  if (!rows.length) return [];
  const headers = uniqueHeaders(rows[0].map(String));
  return rows.slice(1).map(cols => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = cols[index] ?? ''; });
    return row;
  });
}

function headerMatches(row: Record<string, any>, aliases: string[]) {
  const entries = Object.entries(row);
  const normalizedAliases = aliases.map(normalizeHeader);
  const exact = entries.filter(([key]) => normalizedAliases.includes(normalizeHeader(baseHeaderKey(key))));
  if (exact.length) return exact;
  return entries.filter(([key]) => normalizedAliases.some(alias => normalizeHeader(baseHeaderKey(key)).includes(alias)));
}

function headerValueAt(row: Record<string, any>, aliases: string[], index = 0) {
  const match = headerMatches(row, aliases)[index];
  return match ? clean(match[1]) : null;
}

function headerValue(row: Record<string, any>, aliases: string[]) {
  return headerValueAt(row, aliases, 0);
}

function headerValueLast(row: Record<string, any>, aliases: string[]) {
  const matches = headerMatches(row, aliases);
  const match = matches[matches.length - 1];
  return match ? clean(match[1]) : null;
}

function dateValue(row: Record<string, any>, aliases: string[]) {
  const value = headerValue(row, aliases);
  return value ? excelSerialDate(value) : null;
}

async function rowsFromSource(input: SourceInput) {
  const sourcePath = input.sourcePath;
  const buffer = input.buffer || (sourcePath ? readFileSync(sourcePath) : null);
  if (!buffer) throw new Error('No se proporciono archivo');
  const fileName = input.fileName || sourcePath || '';
  const lower = fileName.toLowerCase();
  const rows = lower.endsWith('.xlsx') || lower.endsWith('.xlsm')
    ? await parseXlsxRows(buffer)
    : parseCsvRows(decodeText(buffer));
  return { rows, fingerprint: fingerprintBuffer(buffer), source: sourcePath || fileName || 'upload' };
}

export async function importSiacSource(input: SourceInput = {}) {
  const { rows, fingerprint, source } = await rowsFromSource({ sourcePath: DEFAULT_SIAC_SOURCE, ...input });
  if (input.replace) SiacRecords.deleteAll();
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    const folio = headerValue(row, ['Folio SIAC']);
    const osAlta = headerValue(row, ['Orden de Servicio', 'Orrden de Servicio', 'OS de Pago']);
    const telefono = digits10(headerValue(row, ['Telefono']));
    const telefonoAsignado = digits10(headerValue(row, ['Telefono Asignado', 'Telfono Asignado', 'Tel Pago'])) || null;
    const telefonoPortado = digits10(headerValue(row, ['Telefono de Portabilidad', 'Telefono Portado', 'Numero a Portar']));
    const zona = headerValue(row, ['Zona']);
    if (!folio && !osAlta && !telefono && !zona) { skipped++; continue; }
    try {
      const sourceId = headerValue(row, ['ID']) || String(imported + skipped + 1);
      const estatusSecundario = headerValueAt(row, ['Estatus'], 1);
      const tipoLinea = headerValue(row, ['Tipo de Linea', 'Linea Contratada']);
      const tipoCliente = headerValue(row, ['Tipo de Cliente', 'Tipo Cliente', 'Segmento']);
      const segmentoLinea = headerValue(row, ['Segmento']) || tipoCliente || headerValueLast(row, ['Tipo de Linea']) || tipoLinea;
      const tipoServicio = headerValue(row, ['Tipo de Servicio']) || headerValueAt(row, ['Tipo de Cliente', 'Tipo Cliente'], 1);
      const usuario = headerValue(row, ['Usuario', 'Promotor']);
      const promotor = headerValue(row, ['Nombre Promotor']) || usuario;
      const etapaPisa = estatusSecundario || headerValue(row, ['Etapa PISA', 'Estatus Elaborada', 'Estatus Etapa']);
      SiacRecords.upsert({
        id: randomUUID(),
        source_id: sourceId,
        folio_siac: folio,
        fecha_captura: dateValue(row, ['Fecha de Captura', 'Fecha Captura']),
        estrategia: headerValue(row, ['Estrategia']),
        promotor,
        usuario,
        morosidad: headerValue(row, ['Morosidad']),
        estatus_siac: headerValue(row, ['Estatus SIAC', 'Estatus']),
        tipo_linea: tipoLinea,
        linea_contratada: segmentoLinea,
        area: headerValue(row, ['Area']) || zona,
        division: headerValue(row, ['Division']) || headerValue(row, ['Distrito']),
        tienda: headerValue(row, ['Tienda']),
        paquete: headerValue(row, ['Paquete']),
        observaciones: null,
        respuesta_telmex: null,
        motivo_rechazo: null,
        telefono_asignado: telefonoAsignado,
        telefono_portado: telefonoPortado,
        os_alta: osAlta,
        fecha_os_alta: dateValue(row, ['Fecha Posteo', 'Fecha OS Alta']),
        estatus_pisa: etapaPisa,
        fecha_cambio_estatus: dateValue(row, ['Fecha cambio estatus', 'Fecha Posteo']),
        tipo_cliente: tipoCliente,
        tipo_servicio: tipoServicio,
        correo: headerValue(row, ['Correo Electronico', 'Correo']),
        estatus_etapa: etapaPisa,
        campana: null,
        telefono_referencia: digits10(headerValue(row, ['Num Celular', 'Celular', 'Telefono'])),
        zona,
        distrito: headerValue(row, ['Distrito']),
        colonia: headerValue(row, ['Colonia']),
      });
      imported++;
    } catch {
      skipped++;
    }
  }
  return { imported, skipped, source, fingerprint };
}

function morosityLevel(amount: number) {
  if (amount >= 3000) return 'CRITICA';
  if (amount >= 2000) return 'ALTA';
  if (amount >= 1000) return 'MEDIA';
  return 'PREVENTIVA';
}

export async function importMorososSource(input: SourceInput = {}) {
  const { rows, fingerprint, source } = await rowsFromSource({ sourcePath: DEFAULT_MOROSOS_SOURCE, ...input });
  if (input.replace) {
    (db as any).prepare('DELETE FROM morosidad').run();
  }
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    const folio = headerValue(row, ['Folio SIAC', 'Folio']);
    if (!folio) { skipped++; continue; }
    const telefono = digits10(headerValue(row, ['Telefono']));
    const celular = digits10(headerValue(row, ['Celular', 'Celular 1']));
    const correo = headerValue(row, ['Correo']);
    const saldo = Number(String(headerValue(row, ['Saldo Total']) || '0').replace(/[^0-9.-]/g, '')) || 0;
    const existingClient = (db as any).prepare('SELECT id FROM clientes_crm WHERE folio=?').get(folio) as any;
    const clienteId = existingClient?.id || `MOR-CLI-${folio}`;
    const metadata = {
      paquete: headerValue(row, ['Paq Ofic C', 'Paquete']),
      promotor: headerValue(row, ['Promotor']),
      usuario: headerValue(row, ['Folioprom']),
      area: headerValue(row, ['Area']),
      mercado: headerValue(row, ['Mercado C']),
      celular,
      correo2: headerValue(row, ['Correo 2']),
      saldos: {
        telecom: headerValue(row, ['Saldo Telecom']),
        tercero: headerValue(row, ['Saldo Tercero']),
        venfin: headerValue(row, ['Saldo Venfin']),
      },
    };
    try {
      ClientesCrm.upsert({
        id: clienteId,
        captura_id: null,
        folio,
        nombre: headerValue(row, ['Nombre Fact']) || 'Cliente sin nombre',
        telefono,
        whatsapp: celular || telefono,
        correo,
        direccion: [headerValue(row, ['Direccion 1']), headerValue(row, ['Direccion 2']), headerValue(row, ['Direccion 3'])].filter(Boolean).join(' '),
        fecha_alta: null,
        status_cliente: 'MOROSO',
        ultimo_contacto: null,
        proximo_seguimiento: null,
        nivel_satisfaccion: null,
        riesgo_cancelacion: saldo >= 3000 ? 'ALTO' : 'MEDIO',
        vendedor_asignado: null,
        metadata: JSON.stringify(metadata),
      });
      Morosidad.upsert({
        id: `MOR-${folio}`,
        folio,
        cliente_id: clienteId,
        monto_adeudo: saldo,
        dias_atraso: Math.max(1, Math.ceil(saldo / 100)),
        fecha_vencimiento: null,
        ultimo_pago: null,
        status_cobranza: morosityLevel(saldo),
        gestor_asignado: null,
        convenio: 0,
        observaciones: `Importado de MOROSOS APP. Promotor: ${metadata.promotor || 'N/D'}`,
        metadata: JSON.stringify(metadata),
      });
      imported++;
    } catch {
      skipped++;
    }
  }
  return { imported, skipped, source, fingerprint };
}
