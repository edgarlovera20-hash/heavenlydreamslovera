#!/usr/bin/env node
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'heavenlydreams.db');
const INPUT = process.argv[2] || process.env.MOROSOS_XLSX;

if (!INPUT) {
  console.error('Uso: node scripts/import-morosos-xlsx.mjs /ruta/MOROSOS.xlsx');
  process.exit(1);
}

if (!existsSync(INPUT)) {
  console.error(`No existe el archivo: ${INPUT}`);
  process.exit(1);
}

function decodeXml(value = '') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripTags(value = '') {
  return decodeXml(String(value).replace(/<[^>]+>/g, '')).trim();
}

function attrs(tag = '') {
  const out = {};
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) out[m[1]] = decodeXml(m[2]);
  return out;
}

function colIndex(ref = '') {
  const letters = String(ref).replace(/\d+/g, '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return Math.max(0, n - 1);
}

async function parseXlsx(filePath) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string').catch(() => '') || '';
  const sharedStrings = [...sharedXml.matchAll(/<si\b[\s\S]*?<\/si>/g)].map(([si]) => {
    const textRuns = [...si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join('');
    return textRuns ? decodeXml(textRuns).trim() : stripTags(si);
  });

  const workbookXml = await zip.file('xl/workbook.xml')?.async('string').catch(() => '') || '';
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string').catch(() => '') || '';
  const firstSheetTag = workbookXml.match(/<sheet\b[^>]*>/)?.[0] || '';
  const relId = attrs(firstSheetTag)['r:id'];
  let sheetPath = 'xl/worksheets/sheet1.xml';
  if (relId) {
    const relTag = [...relsXml.matchAll(/<Relationship\b[^>]*\/>/g)]
      .map(m => m[0])
      .find(tag => attrs(tag).Id === relId);
    const target = relTag ? attrs(relTag).Target : '';
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : path.posix.join('xl', target);
  }

  const sheetXml = await zip.file(sheetPath)?.async('string');
  if (!sheetXml) throw new Error(`No se pudo leer la hoja XLSX: ${sheetPath}`);

  const matrix = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[\s\S]*?<\/row>/g)) {
    const rowXml = rowMatch[0];
    const row = [];
    for (const cellMatch of rowXml.matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g)) {
      const cellXml = cellMatch[0];
      const open = cellXml.match(/<c\b[^>]*>/)?.[0] || '';
      const a = attrs(open);
      const idx = colIndex(a.r);
      let value = '';
      if (a.t === 'inlineStr') {
        value = [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => decodeXml(m[1])).join('').trim();
      } else {
        const raw = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] || '';
        value = a.t === 's' ? (sharedStrings[Number(raw)] || '') : decodeXml(raw).trim();
      }
      row[idx] = value;
    }
    if (row.some(v => String(v || '').trim())) matrix.push(row);
  }

  const headerRowIndex = matrix.findIndex(row => row.filter(v => String(v || '').trim()).length >= 3);
  if (headerRowIndex < 0) throw new Error('No se encontraron encabezados en el XLSX');
  const headers = matrix[headerRowIndex].map(h => String(h || '').trim());
  return matrix.slice(headerRowIndex + 1)
    .map(row => Object.fromEntries(headers.map((h, i) => [h, String(row[i] ?? '').trim()])))
    .filter(row => Object.values(row).some(v => String(v || '').trim()));
}

function stableId(prefix, key) {
  const hash = createHash('sha1').update(String(key || randomUUID())).digest('hex').slice(0, 24);
  return `${prefix}_${hash}`;
}

function firstNonEmpty(row, keys) {
  for (const key of keys) {
    const value = String(row[key] ?? '').trim();
    if (value && value.toLowerCase() !== 'nan') return value;
  }
  return '';
}

function phone10(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function parseMoney(...values) {
  for (const value of values) {
    const n = Number(String(value || '').replace(/[$,\s]/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function levelFromAmount(amount) {
  if (amount >= 3000) return 'CRITICA';
  if (amount >= 2000) return 'ALTA';
  if (amount >= 1000) return 'MEDIA';
  if (amount > 0) return 'BAJA';
  return 'PREVENTIVA';
}

function cleanName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function buildImportRow(row, sourceFile) {
  const folio = firstNonEmpty(row, ['FOLIO_SIAC', 'FOLIOPROM', 'folio', 'Folio']);
  if (!folio) return null;
  const telefono = phone10(firstNonEmpty(row, ['CELULAR', 'TELEFONO', 'CELULAR_1', 'CELULAR_2', 'CELULAR_3']));
  const whatsapp = phone10(firstNonEmpty(row, ['CELULAR_1', 'CELULAR', 'TELEFONO']));
  const nombre = cleanName(firstNonEmpty(row, ['NOMBRE_FACT', 'CLIENTE', 'NOMBRE']));
  const correo = firstNonEmpty(row, ['CORREO', 'CORREO_2']).toLowerCase();
  const direccion = [row.DIRECCION_1, row.DIRECCION_2, row.DIRECCION_3].map(v => String(v || '').trim()).filter(Boolean).join(' ');
  const paquete = firstNonEmpty(row, ['PAQ_OFIC_C', 'PAQUETE']);
  const promotor = firstNonEmpty(row, ['PROMOTOR']);
  const mercado = firstNonEmpty(row, ['MERCADO_C']);
  const area = firstNonEmpty(row, ['AREA']);
  const monto = parseMoney(row.SALDO_TOTAL, row.SALDO_TELECOM, row.SALDO_TERCERO, row.SALDO_VENFIN);
  const metadata = {
    source: path.basename(sourceFile),
    importedAt: new Date().toISOString(),
    paquete,
    promotor,
    mercado,
    area,
    telefonoLinea: phone10(row.TELEFONO),
    entreCalle1: row.ENTRE_CALLE1 || '',
    entreCalle2: row.ENTRE_CALLE2 || '',
    saldos: {
      total: parseMoney(row.SALDO_TOTAL),
      telecom: parseMoney(row.SALDO_TELECOM),
      tercero: parseMoney(row.SALDO_TERCERO),
      venfin: parseMoney(row.SALDO_VENFIN),
    },
    raw: row,
  };

  const clienteId = stableId('crm_moroso', folio);
  const morosidadId = stableId('morosidad', folio);
  return {
    cliente: {
      id: clienteId,
      captura_id: null,
      folio,
      nombre: nombre || `CLIENTE ${folio}`,
      telefono,
      whatsapp,
      correo,
      direccion,
      fecha_alta: new Date().toISOString().slice(0, 10),
      status_cliente: 'RIESGO',
      ultimo_contacto: null,
      proximo_seguimiento: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      nivel_satisfaccion: null,
      riesgo_cancelacion: monto >= 2000 ? 'ALTO' : 'MEDIO',
      vendedor_asignado: null,
      metadata: JSON.stringify(metadata),
    },
    morosidad: {
      id: morosidadId,
      folio,
      cliente_id: clienteId,
      monto_adeudo: monto,
      dias_atraso: 0,
      fecha_vencimiento: null,
      ultimo_pago: null,
      status_cobranza: 'Sin contactar',
      gestor_asignado: null,
      convenio: 0,
      observaciones: `Importado desde ${path.basename(sourceFile)}. Nivel por saldo: ${levelFromAmount(monto)}${promotor ? `. Promotor: ${promotor}` : ''}`,
      metadata: JSON.stringify(metadata),
    },
  };
}

const rows = await parseXlsx(INPUT);
const prepared = rows.map(row => buildImportRow(row, INPUT)).filter(Boolean);
const skipped = rows.length - prepared.length;

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const upsertCliente = db.prepare(`
  INSERT INTO clientes_crm
    (id,captura_id,folio,nombre,telefono,whatsapp,correo,direccion,fecha_alta,status_cliente,ultimo_contacto,proximo_seguimiento,nivel_satisfaccion,riesgo_cancelacion,vendedor_asignado,metadata)
  VALUES
    (@id,@captura_id,@folio,@nombre,@telefono,@whatsapp,@correo,@direccion,@fecha_alta,@status_cliente,@ultimo_contacto,@proximo_seguimiento,@nivel_satisfaccion,@riesgo_cancelacion,@vendedor_asignado,@metadata)
  ON CONFLICT(folio) DO UPDATE SET
    nombre=excluded.nombre,
    telefono=excluded.telefono,
    whatsapp=excluded.whatsapp,
    correo=excluded.correo,
    direccion=excluded.direccion,
    status_cliente=excluded.status_cliente,
    proximo_seguimiento=excluded.proximo_seguimiento,
    riesgo_cancelacion=excluded.riesgo_cancelacion,
    metadata=excluded.metadata,
    updated_at=datetime('now')
`);

const upsertMorosidad = db.prepare(`
  INSERT INTO morosidad
    (id,folio,cliente_id,monto_adeudo,dias_atraso,fecha_vencimiento,ultimo_pago,status_cobranza,gestor_asignado,convenio,observaciones,metadata)
  VALUES
    (@id,@folio,@cliente_id,@monto_adeudo,@dias_atraso,@fecha_vencimiento,@ultimo_pago,@status_cobranza,@gestor_asignado,@convenio,@observaciones,@metadata)
  ON CONFLICT(id) DO UPDATE SET
    cliente_id=excluded.cliente_id,
    monto_adeudo=excluded.monto_adeudo,
    dias_atraso=excluded.dias_atraso,
    fecha_vencimiento=excluded.fecha_vencimiento,
    ultimo_pago=excluded.ultimo_pago,
    status_cobranza=excluded.status_cobranza,
    convenio=excluded.convenio,
    observaciones=excluded.observaciones,
    metadata=excluded.metadata,
    updated_at=datetime('now')
`);

const insertAudit = db.prepare(`
  INSERT INTO audit_log (accion,entidad,entidad_id,user_id,user_nombre,detalle)
  VALUES (@accion,@entidad,@entidad_id,@user_id,@user_nombre,@detalle)
`);

const tx = db.transaction(items => {
  for (const item of items) {
    upsertCliente.run(item.cliente);
    upsertMorosidad.run(item.morosidad);
  }
  insertAudit.run({
    accion: 'IMPORT_MOROSOS_XLSX',
    entidad: 'morosidad',
    entidad_id: null,
    user_id: null,
    user_nombre: 'system',
    detalle: `archivo:${path.basename(INPUT)};registros:${items.length};omitidos:${skipped}`,
  });
});

tx(prepared);

const totalMorosidad = db.prepare('SELECT COUNT(*) AS c FROM morosidad').get().c;
const totalClientes = db.prepare('SELECT COUNT(*) AS c FROM clientes_crm').get().c;

console.log(JSON.stringify({
  ok: true,
  source: INPUT,
  parsedRows: rows.length,
  imported: prepared.length,
  skipped,
  totalMorosidad,
  totalClientes,
}, null, 2));
