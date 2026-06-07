// Field extraction, capture flow, and validation logic

import { type Intent, type ProposedAction, type AgentDecision, FIRST_CONTACT_INTRO } from './types';
import {
  normalizedBody,
  isAffirmative,
  isNegative,
  isMediaSignal,
  messageMedia,
} from './memory';

export function normalizePhone(text: any) {
  const digits = String(text || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits || null;
}

export function extractField(text: string, key: string) {
  const re = new RegExp(`${key}\\s*[:\\-]?\\s*([^\\n,;]+)`, 'i');
  return text.match(re)?.[1]?.trim() || null;
}

export function extractEmail(text: string) {
  return String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
}

export function uniquePhones(text: string) {
  const matches = String(text || '').match(/(?:\+?52)?\s*\d[\d\s().-]{8,}\d/g) || [];
  return Array.from(new Set(matches.map(normalizePhone).filter(phone => phone && phone.length === 10))) as string[];
}

export function firstTruthy(...values: any[]) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return null;
}

const QUICK_CAPTURE_LABELS = [
  't\\.t',
  'tt',
  'telefono\\s*(?:de\\s*)?titular',
  'tel[eé]fono\\s*(?:de\\s*)?titular',
  'telefono\\s*(?:del\\s*)?cliente',
  't\\s*titular',
  'celular',
  'cel',
  'tref',
  't\\.ref',
  'referencia',
  'telefono\\s*(?:de\\s*)?referencia',
  'tel[eé]fono\\s*(?:de\\s*)?referencia',
  'email',
  'correo(?:\\s*electronico|\\s*electr[oó]nico)?',
  'nombre',
  'nombre\\s*(?:del\\s*)?cliente',
  'sn',
  'servicio\\s*nuevo',
  'paquete',
  'plan',
  'gastos?\\s*(?:de\\s*)?instalaci[oó]n',
  'porta',
  'portabilidad',
  'num(?:ero)?\\s*a\\s*portar',
  'n[uú]mero\\s*a\\s*portar',
  'nip',
  'compa(?:ñ|n)ia',
  'compa(?:ñ|n)[ií]a',
  'operador',
  'datos\\s*adicionales',
  'observaciones',
  'terminal',
  'direccion',
  'direcci[oó]n',
  'domicilio',
  'entre\\s*calle\\s*1',
  'entre\\s*calle\\s*2',
  'entre\\s*calles?',
  'coordenadas?',
  'coords?',
  'cp',
  'c\\.p',
  'c[oó]digo\\s*postal',
];

const QUICK_CAPTURE_LABEL_RE = QUICK_CAPTURE_LABELS.join('|');

export function extractQuickValue(text: string, labelPattern: string) {
  const re = new RegExp(
    `(?:^|[\\n;|/,-])\\s*(?:${labelPattern})\\s*[:\\-]?\\s*([\\s\\S]*?)(?=\\s*(?:[\\n;|/,-]\\s*)?(?:${QUICK_CAPTURE_LABEL_RE})\\s*[:\\-]?|$)`,
    'i',
  );
  const value = text.match(re)?.[1]?.trim();
  return value ? value.replace(/\s+/g, ' ').trim() : null;
}

export function extractMoneyNumber(value: any) {
  const match = String(value || '').match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

export function extractPostalCode(text: string) {
  return extractQuickValue(text, 'cp|c\\.p|c[oó]digo\\s*postal')?.replace(/\D/g, '').slice(0, 5)
    || text.match(/\b(?:c\.?p\.?|cp|codigo postal|c[oó]digo postal)\D*(\d{5})\b/i)?.[1]
    || text.match(/\b(\d{5})\b/)?.[1]
    || null;
}

export function extractCoordinates(text: string) {
  const source = extractQuickValue(text, 'coordenadas?|coords?') || text;
  const match = source.match(/([+-]?\d{1,3}(?:\.\d+)?)\s*[, ]+\s*([+-]?\d{1,3}(?:\.\d+)?)/);
  if (!match) return {};
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return {};
  return { gpsLatitud: String(lat), gpsLongitud: String(lng), coordenadas: { lat, lng } };
}

export function extractMapUrl(text: string) {
  return String(text || '').match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps)[^\s]+/i)?.[0] || null;
}

export function cleanAddressBlock(value: any) {
  const cleaned = String(value || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bTERMINAL\s*[:.-]?.*$/gim, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

export function extractAuthorizationAddress(text: string) {
  const direct = extractQuickValue(text, 'direccion|direcci[oó]n|domicilio');
  if (direct) return cleanAddressBlock(direct);
  const match = String(text || '').match(/(?:este\s+domicilio|domicilio)\s*[:.-]?\s*([\s\S]*?)(?=\n\s*(?:terminal|https?:\/\/|$))/i);
  if (match?.[1]) return cleanAddressBlock(match[1]);
  const mapPreface = String(text || '').match(/(?:^|\n)\s*([^\n]{8,120})\s*\n\s*https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps)/i);
  if (mapPreface?.[1]) return cleanAddressBlock(mapPreface[1]);
  return null;
}

export function inferProductType(text: string, serviceMode: any, packageName: any) {
  const body = normalizedBody(`${text} ${packageName || ''}`);
  if (/infinitum\s*puro|solo\s*internet/.test(body)) return 'infinitum_puro';
  if (/doble\s*play|internet\s*(?:\+|y)\s*tel[eé]fono|telefono\s*(?:\+|y)\s*internet/.test(body)) return 'doble_play';
  if (serviceMode === 'portabilidad') return 'doble_play';
  return packageName ? 'doble_play' : null;
}

export function parseQuickCaptureTemplate(text: string) {
  const titularRaw = extractQuickValue(text, 't\\.t|tt|celular|cel|telefono\\s*(?:de\\s*)?titular|tel[eé]fono\\s*(?:de\\s*)?titular|telefono\\s*(?:del\\s*)?cliente|t\\s*titular');
  const refRaw = extractQuickValue(text, 'tref|t\\.ref|referencia|telefono\\s*(?:de\\s*)?referencia|tel[eé]fono\\s*(?:de\\s*)?referencia');
  const emailRaw = extractQuickValue(text, 'email|correo(?:\\s*electronico|\\s*electr[oó]nico)?');
  const nameRaw = extractQuickValue(text, 'nombre\\s*(?:del\\s*)?cliente|nombre');
  const packageName = extractQuickValue(text, 'paquete|plan');
  const addressRaw = extractAuthorizationAddress(text);
  const portNumber = extractQuickValue(text, 'num(?:ero)?\\s*a\\s*portar|n[uú]mero\\s*a\\s*portar|porta|portabilidad');
  const body = normalizedBody(text);
  const serviceMode = /\b(sn|servicio nuevo|linea nueva|línea nueva|alta nueva)\b/.test(body)
    ? 'nuevo'
    : /\b(porta|portabilidad|numero a portar|n[uú]mero a portar)\b/.test(body)
      ? 'portabilidad'
      : null;

  const fields = {
    nombre: nameRaw,
    titularPhone: normalizePhone(titularRaw),
    telefono: normalizePhone(titularRaw),
    referencePhone: normalizePhone(refRaw),
    email: extractEmail(emailRaw || '') || extractEmail(text),
    serviceMode,
    segment: /negocio|empresa|comercial|pyme/.test(body) ? 'negocio' : 'residencial',
    paquete: packageName,
    gastosInstalacion: extractMoneyNumber(extractQuickValue(text, 'gastos?\\s*(?:de\\s*)?instalaci[oó]n')),
    portabilityNumber: normalizePhone(portNumber),
    portabilityNip: extractQuickValue(text, 'nip')?.match(/\d{4}/)?.[0] || null,
    portabilityCompany: extractQuickValue(text, 'compa(?:ñ|n)ia|compa(?:ñ|n)[ií]a|operador'),
    addressRaw,
    direccion: addressRaw,
    codigoPostal: extractPostalCode(text),
    entreCalle1: extractQuickValue(text, 'entre\\s*calle\\s*1|entre\\s*calles?'),
    entreCalle2: extractQuickValue(text, 'entre\\s*calle\\s*2'),
    datosAdicionales: extractQuickValue(text, 'datos\\s*adicionales|observaciones'),
    terminal: extractQuickValue(text, 'terminal'),
    mapsUrl: extractMapUrl(text),
    ...extractCoordinates(text),
  };

  return Object.fromEntries(Object.entries({
    ...fields,
    productType: inferProductType(text, serviceMode, packageName),
  }).filter(([, value]) => value != null && String(value).trim() !== ''));
}

export function extractFields(text: string, conversation: any) {
  const memory = conversation?.memory || {};
  const known = memory.knownFields || {};
  const phoneMatch = text.match(/(?:\+?52)?\s*(\d[\d\s().-]{8,}\d)/);
  const fields: Record<string, any> = {
    ...known,
    nombre: extractField(text, 'nombre|cliente') || known.nombre || null,
    telefono: normalizePhone(extractField(text, 'tel(?:efo(?:no)?)?|whatsapp') || phoneMatch?.[1] || known.telefono),
    direccion: extractField(text, 'direcci[oó]n|domicilio|calle') || known.direccion || null,
    colonia: extractField(text, 'colonia') || known.colonia || null,
    paquete: extractField(text, 'paquete|plan|internet') || known.paquete || null,
    zona: extractField(text, 'zona') || known.zona || null,
  };

  if (!fields.paquete) {
    const packageMatch = text.match(/\b(?:internet|fibra|paquete|plan)\s+([a-z0-9 áéíóúñ.+-]{2,40})/i);
    if (packageMatch) fields.paquete = packageMatch[0].trim();
  }

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value != null && String(value).trim() !== ''));
}

export function extractOcrFields(media: any) {
  const ocr = media?.ocr || {};
  const fields = ocr.fields && typeof ocr.fields === 'object' ? ocr.fields : {};
  const fullName = firstTruthy(
    fields.nombreCompleto,
    fields.nombre_completo,
    [fields.nombre, fields.apellidoPaterno, fields.apellidoMaterno].filter(Boolean).join(' '),
    [fields.nombres, fields.apellido_paterno, fields.apellido_materno].filter(Boolean).join(' '),
  );
  return Object.fromEntries(Object.entries({
    nombre: fullName,
    curp: firstTruthy(fields.curp),
    folioIne: firstTruthy(fields.folioIne, fields.claveElector, fields.cic),
    addressRaw: firstTruthy(fields.domicilio, fields.direccion, fields.address),
    direccion: firstTruthy(fields.domicilio, fields.direccion, fields.address),
    colonia: firstTruthy(fields.colonia),
    codigoPostal: firstTruthy(fields.codigoPostal, fields.cp),
  }).filter(([, value]) => value != null && String(value).trim() !== ''));
}

export function extractCaptureFields(text: string, conversation: any, media?: any) {
  const memory = conversation?.memory || {};
  const known = memory.knownFields || {};
  const draftFields = memory.captureDraft?.fields || {};
  const body = normalizedBody(text);
  const phones = uniquePhones(text);
  const ocrFields = extractOcrFields(media);
  const quickFields = parseQuickCaptureTemplate(text);
  const titularFromLabel = normalizePhone(
    extractField(text, 'tel(?:efo(?:no)?)?\\s*(?:titular|cliente|principal)?|whatsapp')
  );
  const referenceFromLabel = normalizePhone(
    extractField(text, 'tel(?:efo(?:no)?)?\\s*(?:referencia|ref)|referencia')
  );
  const serviceMode = /portab|n[uú]mero a portar/.test(body)
    ? 'portabilidad'
    : /(servicio|linea|línea)\s+nuev|nuevo servicio|alta nueva/.test(body)
      ? 'nuevo'
      : null;
  const segment = /negocio|pyme|empresa|comercial/.test(body)
    ? 'negocio'
    : /residencial|hogar|casa/.test(body)
      ? 'residencial'
      : null;
  const productType = /doble\s*play|telefono\s*\+\s*internet|internet\s*\+\s*telefono/.test(body)
    ? 'doble_play'
    : /infinitum\s*puro|solo\s*internet/.test(body)
      ? 'infinitum_puro'
      : null;
  const allFields = {
    ...known,
    ...draftFields,
    ...ocrFields,
    ...quickFields,
    nombre: extractField(text, 'nombre|cliente|titular') || quickFields.nombre || draftFields.nombre || known.nombre || ocrFields.nombre,
    titularPhone: quickFields.titularPhone || titularFromLabel || phones[0] || draftFields.titularPhone || known.titularPhone || known.telefono,
    telefono: quickFields.telefono || titularFromLabel || phones[0] || draftFields.telefono || known.telefono,
    referencePhone: quickFields.referencePhone || referenceFromLabel || phones.find(phone => phone !== (titularFromLabel || phones[0])) || draftFields.referencePhone || known.referencePhone,
    email: quickFields.email || extractEmail(text) || draftFields.email || known.email,
    addressRaw: quickFields.addressRaw || extractField(text, 'direcci[oó]n|domicilio|calle') || draftFields.addressRaw || known.addressRaw || known.direccion,
    direccion: quickFields.direccion || extractField(text, 'direcci[oó]n|domicilio|calle') || draftFields.direccion || known.direccion,
    colonia: quickFields.colonia || extractField(text, 'colonia') || draftFields.colonia || known.colonia,
    codigoPostal: quickFields.codigoPostal || draftFields.codigoPostal || known.codigoPostal || ocrFields.codigoPostal || extractPostalCode(text),
    paquete: quickFields.paquete || extractField(text, 'paquete|plan|internet') || draftFields.paquete || known.paquete,
    serviceMode: quickFields.serviceMode || serviceMode || draftFields.serviceMode || known.serviceMode,
    segment: quickFields.segment || segment || draftFields.segment || known.segment,
    productType: quickFields.productType || productType || inferProductType(text, quickFields.serviceMode || serviceMode, quickFields.paquete || draftFields.paquete || known.paquete) || draftFields.productType || known.productType,
    gastosInstalacion: quickFields.gastosInstalacion || draftFields.gastosInstalacion || known.gastosInstalacion,
    portabilityNumber: quickFields.portabilityNumber || normalizePhone(extractField(text, 'n[uú]mero\\s*a\\s*portar|numero\\s*a\\s*portar|portar')) || draftFields.portabilityNumber || known.portabilityNumber,
    portabilityCompany: quickFields.portabilityCompany || extractField(text, 'compa(?:ñ|n)ia|operador|empresa actual') || draftFields.portabilityCompany || known.portabilityCompany,
    portabilityNip: quickFields.portabilityNip || text.match(/\bnip\D*(\d{4})\b/i)?.[1] || draftFields.portabilityNip || known.portabilityNip,
    entreCalle1: quickFields.entreCalle1 || draftFields.entreCalle1 || known.entreCalle1,
    entreCalle2: quickFields.entreCalle2 || draftFields.entreCalle2 || known.entreCalle2,
    datosAdicionales: quickFields.datosAdicionales || draftFields.datosAdicionales || known.datosAdicionales,
    terminal: quickFields.terminal || draftFields.terminal || known.terminal,
    mapsUrl: quickFields.mapsUrl || draftFields.mapsUrl || known.mapsUrl,
    gpsLatitud: quickFields.gpsLatitud || draftFields.gpsLatitud || known.gpsLatitud,
    gpsLongitud: quickFields.gpsLongitud || draftFields.gpsLongitud || known.gpsLongitud,
    coordenadas: quickFields.coordenadas || draftFields.coordenadas || known.coordenadas,
  };

  if (!allFields.addressRaw && /(calle|avenida|av\.|constituci[oó]n|colonia|cp|codigo postal|c[oó]digo postal|mz|lt|lote|manzana|cerrada|privada)/i.test(text) && text.length > 8) {
    allFields.addressRaw = text.trim();
    allFields.direccion = text.trim();
  }

  return Object.fromEntries(Object.entries(allFields).filter(([, value]) => value != null && String(value).trim() !== ''));
}

export function captureMissing(fields: Record<string, any>) {
  const missing: string[] = [];
  if (!fields.nombre) missing.push('nombre');
  if (!fields.titularPhone && !fields.telefono) missing.push('titularPhone');
  if (!fields.referencePhone) missing.push('referencePhone');
  if (!fields.email) missing.push('email');
  if (!fields.addressRaw && !fields.direccion) missing.push('addressRaw');
  if (!fields.serviceMode) missing.push('serviceMode');
  if (!fields.segment) missing.push('segment');
  if (!fields.productType) missing.push('productType');
  if (!fields.paquete) missing.push('paquete');
  if (fields.serviceMode === 'portabilidad') {
    if (!fields.portabilityNumber) missing.push('portabilityNumber');
    if (!fields.portabilityCompany) missing.push('portabilityCompany');
    if (!fields.portabilityNip) missing.push('portabilityNip');
  }
  return missing;
}

export function stageForMissing(missing: string[]) {
  if (missing.some(key => ['titularPhone', 'referencePhone', 'email'].includes(key))) return 'collecting_contact';
  if (missing.includes('addressRaw')) return 'collecting_address';
  if (missing.some(key => ['serviceMode', 'segment', 'productType', 'paquete'].includes(key))) return 'collecting_service';
  if (missing.some(key => key.startsWith('portability'))) return 'collecting_portability';
  return 'ready_for_review';
}

export function promptForMissing(missing: string[]) {
  const labels: Record<string, string> = {
    nombre: 'nombre completo del titular',
    titularPhone: 'teléfono del titular a 10 dígitos',
    referencePhone: 'teléfono de referencia a 10 dígitos',
    email: 'correo electrónico',
    addressRaw: 'dirección completa de instalación',
    serviceMode: 'si es servicio nuevo o portabilidad',
    segment: 'si es residencial o negocio',
    productType: 'si será doble play o infinitum puro',
    paquete: 'paquete o plan de interés',
    portabilityNumber: 'número a portar',
    portabilityCompany: 'compañía actual',
    portabilityNip: 'NIP de portabilidad de 4 dígitos',
  };
  return missing.slice(0, 3).map(key => labels[key] || key).join(', ');
}

export function captureIntentRequested(text: string, media?: any) {
  const body = normalizedBody(text);
  return /\b(captura|capturar|venta|contratar|contratacion|contratación|alta|instalacion|instalación|cliente nuevo|quiero internet|servicio)\b/.test(body)
    || Boolean(media && mediaLooksLikeCaptureDocument(media, text));
}

export function mediaLooksLikeCaptureDocument(media: any, text: string) {
  const haystack = normalizedBody(`${text} ${media?.fileName || ''} ${media?.kind || ''} ${media?.docType || ''}`);
  if (/(ine|curp|comprobante|domicilio|recibo|cfe|telmex|expediente|pdf|documento)/i.test(haystack)) return true;
  return ['image', 'document'].includes(String(media?.kind || '').toLowerCase());
}

export function buildDocumentSummary(media: any) {
  if (!media) return null;
  const label = media.docType || media.kind || 'documento';
  const ocr = media.ocr?.status === 'completed' ? ' OCR listo.' : media.ocr?.status === 'failed' ? ' OCR pendiente/manual.' : '';
  return `${label}${media.fileName ? ` (${media.fileName})` : ''}.${ocr}`;
}

export function buildCaptureDecision(conversation: any, message: any, baseFields: Record<string, any>) {
  const text = String(message.body || '');
  const media = messageMedia(message);
  const previousDraft = conversation?.memory?.captureDraft || {};
  const activeStage = String(previousDraft.stage || 'idle');
  const hasActiveDraft = activeStage !== 'idle';
  const wantsStart = hasActiveDraft && activeStage === 'offer_capture_after_document' && isAffirmative(text);
  const declinedStart = hasActiveDraft && activeStage === 'offer_capture_after_document' && isNegative(text);
  const mediaDocument = media && mediaLooksLikeCaptureDocument(media, text);

  if (mediaDocument && !hasActiveDraft) {
    return {
      fields: {
        ...baseFields,
        _captureDraft: {
          stage: 'offer_capture_after_document',
          fields: { ...baseFields, ...extractCaptureFields(text, conversation, media) },
          documents: [media],
          ocr: media.ocr || null,
          missing: [],
          lastPromptedField: 'start_capture',
          updatedAt: new Date().toISOString(),
        },
      },
      reply: `Recibí el documento 📎${buildDocumentSummary(media) ? ` ${buildDocumentSummary(media)}` : ''}\n¿Quieres iniciar una captura de venta con este expediente?`,
      actions: [] as ProposedAction[],
    };
  }

  if (declinedStart) {
    return {
      fields: {
        ...baseFields,
        _captureDraft: {
          ...previousDraft,
          stage: 'idle',
          lastPromptedField: null,
          updatedAt: new Date().toISOString(),
        },
      },
      reply: 'Perfecto, dejo el documento guardado en expediente. Cuando quieras iniciar captura, dime "iniciar captura".',
      actions: [] as ProposedAction[],
    };
  }

  if (hasActiveDraft && activeStage === 'offer_capture_after_document' && !wantsStart) return null;
  if (!hasActiveDraft && !captureIntentRequested(text, media)) return null;

  const mergedFields = {
    ...(previousDraft.fields || {}),
    ...baseFields,
    ...extractCaptureFields(text, conversation, media),
  };
  const documents = [
    ...(Array.isArray(previousDraft.documents) ? previousDraft.documents : []),
    ...(media ? [media] : []),
  ].filter((doc, index, list) => doc && list.findIndex(item => item.documentId === doc.documentId && item.fileName === doc.fileName) === index);
  const missing = captureMissing(mergedFields);
  const stage = stageForMissing(missing);
  const draft = {
    ...previousDraft,
    stage,
    fields: mergedFields,
    documents,
    ocr: media?.ocr || previousDraft.ocr || null,
    missing,
    lastPromptedField: missing[0] || null,
    updatedAt: new Date().toISOString(),
  };

  if (missing.length === 0) {
    return {
      fields: { ...mergedFields, _captureDraft: draft },
      reply: 'Listo. Ya armé el borrador con los datos recibidos. Lo mando a revisión para confirmarlo antes de capturarlo oficialmente.',
      actions: ['create_sale', 'schedule_followup'] as ProposedAction[],
    };
  }

  return {
    fields: { ...mergedFields, missing, _captureDraft: draft },
    reply: `Perfecto, voy armando la captura. Para avanzar necesito: ${promptForMissing(missing)}.`,
    actions: ['update_lead'] as ProposedAction[],
  };
}

export function requiredMissing(fields: Record<string, any>) {
  const required = [
    ['nombre', 'nombre completo'],
    [fields.titularPhone ? 'titularPhone' : 'telefono', 'telefono del titular a 10 digitos'],
    ['referencePhone', 'telefono de referencia a 10 digitos'],
    ['email', 'correo electronico'],
    [fields.addressRaw ? 'addressRaw' : 'direccion', 'direccion o domicilio'],
    ['serviceMode', 'servicio nuevo o portabilidad'],
    ['segment', 'residencial o negocio'],
    ['productType', 'doble play o infinitum puro'],
    ['paquete', 'paquete o plan de interes'],
  ];
  const missing = required.filter(([key]) => !fields[key]).map(([, label]) => label);
  if (fields.serviceMode === 'portabilidad') {
    if (!fields.portabilityNumber) missing.push('numero a portar');
    if (!fields.portabilityCompany) missing.push('compania actual');
    if (!fields.portabilityNip) missing.push('NIP de portabilidad de 4 digitos');
  }
  return missing;
}

export function buildSalesReply(fields: Record<string, any>, missing: string[]) {
  if (missing.length > 0) {
    return `Va, ya estoy ordenando la contratación. Solo me falta: ${missing.join(', ')}.`;
  }
  return `Listo, ya tengo los datos principales de ${fields.nombre}. La dejo preparada para revisión del equipo.`;
}
