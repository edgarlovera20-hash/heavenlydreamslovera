// SIAC folio lookup and formatting logic

import { SiacRecords } from '../db';

function normalizeStatus(value: any) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

export function isPostedRecord(record: any) {
  return [
    record?.estatus_siac,
    record?.estatus_pisa,
    record?.estatus_etapa,
    record?.respuesta_telmex,
  ].some(value => normalizeStatus(value).includes('POSTEAD'));
}

export function siacValue(value: any) {
  const text = String(value ?? '').trim();
  return text || 'N/D';
}

export function siacStatus(record: any) {
  return siacValue(record?.estatus_siac || record?.estatus_pisa || record?.estatus_etapa || record?.respuesta_telmex);
}

export function formatSiacFolioReply(record: any) {
  const fechaPosteo = record?.fecha_os_alta || record?.fecha_cambio_estatus;
  return [
    `Folio ${siacValue(record?.folio_siac)} ✅`,
    `STATUS: ${siacStatus(record)}`,
    `FECHA DE CAPTURA: ${siacValue(record?.fecha_captura)}`,
    `FOLIO: ${siacValue(record?.folio_siac)}`,
    `TIPO DE LÍNEA: ${siacValue(record?.tipo_linea)}`,
    `SEGMENTO: ${siacValue(record?.linea_contratada || record?.tipo_cliente)}`,
    `PAQUETE: ${siacValue(record?.paquete)}`,
    `ÁREA: ${siacValue(record?.area)}`,
    `ESTRATEGIA: ${siacValue(record?.estrategia)}`,
    `USUARIO: ${siacValue(record?.usuario || record?.promotor)}`,
    `ORDEN DE SERVICIO: ${siacValue(record?.os_alta)}`,
    `FECHA DE POSTEO: ${siacValue(fechaPosteo)}`,
    `TIENDA: ${siacValue(record?.tienda)}`,
    `ETAPA PISA (SIAC): ${siacValue(record?.estatus_pisa || record?.estatus_etapa)}`,
    `TIPO DE SERVICIO: ${siacValue(record?.tipo_servicio)}`,
    `ZONA: ${siacValue(record?.zona)}`,
  ].join('\n');
}

export function extractFolioCandidate(text: string) {
  const raw = String(text || '').trim();
  const prefixed = raw.match(/\b(?:folio|siac|estatus|consulta)\s*[:#-]?\s*([A-Z0-9-]{5,})\b/i)?.[1];
  if (prefixed) return prefixed;
  if (/^\s*(?:folio\s*)?[A-Z0-9-]{5,}\s*$/i.test(raw) && /\d/.test(raw)) {
    return raw.replace(/^folio\s*/i, '').trim();
  }
  return raw.match(/\b([A-Z0-9]{5,}|\d{5,})\b/i)?.[1] || null;
}

export function buildFolioReply(text: string) {
  const folio = extractFolioCandidate(text);
  if (!folio) return { reply: 'Enviame el numero de folio para consultar. Ejemplo: folio 123456', fields: {} };
  const record = SiacRecords.getByFolio(folio) as any;
  if (!record) return { reply: `Busqué el folio ${folio} 🔎 y no lo encontré en la base disponible. ¿Quieres que lo escale a un asesor o me compartes otro folio?`, fields: { folio } };
  return {
    reply: formatSiacFolioReply(record),
    fields: { folio, found: true, status: isPostedRecord(record) ? 'POSTEADO' : siacStatus(record) },
  };
}
