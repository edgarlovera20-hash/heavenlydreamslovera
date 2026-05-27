import { randomUUID } from 'node:crypto';
import {
  AgentDecisions,
  AgentOutbox,
  AgentProfiles,
  AgentTasks,
  AuditLog,
  ChannelConversations,
  ChannelMessages,
  Metrics,
  SiacRecords,
  Ventas,
} from './db';
import { runAiWithFallback } from './enterprise';
import { answerWebQuestion, shouldUseWebSearch } from './web-search';
import { findAgentVideoForQuestion, type AgentVideoAudience } from './agent-video-library';

type Intent = 'venta' | 'consulta_folio' | 'soporte' | 'morosidad' | 'busqueda_web' | 'otro';
type ProposedAction = 'create_sale' | 'update_lead' | 'schedule_followup' | 'escalate_human';

interface AgentDecision {
  intent: Intent;
  confidence: number;
  extractedFields: Record<string, any>;
  proposedReply?: string;
  proposedActions: ProposedAction[];
  requiresApproval: true;
}

type SendChannelMessage = (channel: string, target: string, message: string, payload?: any) => Promise<any>;
const INTENTS: Intent[] = ['venta', 'consulta_folio', 'soporte', 'morosidad', 'busqueda_web', 'otro'];
const PROPOSED_ACTIONS: ProposedAction[] = ['create_sale', 'update_lead', 'schedule_followup', 'escalate_human'];
const LEGACY_ARIUX_MESSAGE = 'Hola, soy ARIUX 🤖 asistente virtual de Heavenly Dreams ✨. Estoy aquí para ayudarte y servirte en consulta de folios 🔎, guardar expedientes 📁 e iniciar flujos de captura 📝. ¿Qué necesitas hoy?';
const DEFAULT_ARIUX_MESSAGE = 'Hola, dime qué necesitas y lo revisamos. Puedo ayudarte con folios, expedientes o una captura nueva.';
const FIRST_CONTACT_INTRO = 'Hola, buen día. Te ayudo con folios, expedientes o capturas. ¿Con qué nombre te registro para ubicarte mejor?';
const AI_DECISION_TIMEOUT_MS = Math.max(3000, Number(process.env.AGENT_AI_TIMEOUT_MS || 45000));

function json(value: any) {
  return JSON.stringify(value ?? {});
}

function recordMetric(name: string, tags: any = {}) {
  try {
    Metrics.insert({ id: randomUUID(), name, value: 1, tags: JSON.stringify(tags || {}) });
  } catch {}
}

function cleanPersonName(value: any) {
  const name = String(value || '')
    .replace(/@s\.whatsapp\.net|@g\.us/gi, '')
    .replace(/^(promotores|clientes):/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name && /[a-záéíóúñ]/i.test(name) ? name : null;
}

function promoterFirstName(conversation: any) {
  const memory = conversation?.memory || {};
  const promoter = memory.promoter || {};
  const source = promoter.nameConfirmed
    ? cleanPersonName(promoter.preferredName) || cleanPersonName(promoter.firstName) || cleanPersonName(promoter.fullName)
    : null;
  return source?.split(/\s+/)[0] || null;
}

function conversationAudience(conversation: any): AgentVideoAudience {
  const memory = conversation?.memory || {};
  const raw = `${conversation?.external_chat_id || ''} ${memory.account || ''} ${memory.promoter?.account || ''}`.toLowerCase();
  if (raw.includes('clientes:') || /\bclientes?\b/.test(raw)) return 'clientes';
  return 'promotores';
}

function profileIdForConversation(conversation: any) {
  return conversationAudience(conversation) === 'clientes' ? 'customer_support_agent' : 'promoter_receptionist';
}

function agentLabelForDecision(conversation: any, decision: AgentDecision) {
  if (conversationAudience(conversation) === 'clientes') return 'atencion_cliente';
  return decision.intent === 'venta' ? 'capturista' : decision.intent === 'consulta_folio' ? 'consultor' : 'recepcionista_promotores';
}

function firstNameForDecision(conversation: any, decision: AgentDecision) {
  return cleanPersonName(decision.extractedFields?.promoterFirstName)
    || cleanPersonName(decision.extractedFields?.promoterName)?.split(/\s+/)[0]
    || promoterFirstName(conversation);
}

function shouldAskPromoterName(conversation: any, decision: AgentDecision) {
  if (conversationAudience(conversation) === 'clientes') return false;
  const memory = conversation?.memory || {};
  const promoter = memory.promoter || {};
  if (promoter.nameConfirmed || decision.extractedFields?.promoterNameConfirmed) return false;
  if (promoter.nameRequestedAt || promoter.introSentAt || decision.extractedFields?._nameRequestSent) return false;
  if (promoter.isGroup || conversation?.is_group) return false;
  return true;
}

function appendPromoterNameQuestion(reply: string, intent?: Intent) {
  if (/c[oó]mo te llamas|tu nombre|me dices tu nombre/i.test(reply)) return reply;
  if (!reply || intent === 'otro') return FIRST_CONTACT_INTRO;
  return `${reply}\n\nPara atenderte más personal, ¿con qué nombre te registro?`.trim();
}

function personalizeReply(reply: any, firstName?: string | null) {
  const text = String(reply || '').trim();
  if (!text || !firstName) return text;
  const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^(hola[, ]+)?${escaped}\\b`, 'i').test(text)) return text;
  if (new RegExp(`\\b${escaped}\\b`, 'i').test(text.slice(0, 140))) return text;
  if (/^hola,\s*/i.test(text)) return text.replace(/^hola,\s*/i, `Hola, ${firstName}, `);
  if (/^hola\s+/i.test(text)) return text.replace(/^hola\s+/i, `Hola ${firstName}, `);
  return `${firstName}, ${text}`;
}

function personalizeDecision(conversation: any, decision: AgentDecision): AgentDecision {
  const firstName = firstNameForDecision(conversation, decision);
  const askName = shouldAskPromoterName(conversation, decision);
  const reply = decision.proposedReply ? personalizeReply(decision.proposedReply, firstName) : decision.proposedReply;
  return {
    ...decision,
    extractedFields: askName
      ? { ...decision.extractedFields, _nameRequestSent: true, _introSent: true }
      : decision.extractedFields,
    proposedReply: askName ? appendPromoterNameQuestion(reply || FIRST_CONTACT_INTRO, decision.intent) : reply,
  };
}

function normalizePhone(text: any) {
  const digits = String(text || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits || null;
}

function extractField(text: string, key: string) {
  const re = new RegExp(`${key}\\s*[:\\-]?\\s*([^\\n,;]+)`, 'i');
  return text.match(re)?.[1]?.trim() || null;
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

function extractQuickValue(text: string, labelPattern: string) {
  const re = new RegExp(
    `(?:^|[\\n;|/,-])\\s*(?:${labelPattern})\\s*[:\\-]?\\s*([\\s\\S]*?)(?=\\s*(?:[\\n;|/,-]\\s*)?(?:${QUICK_CAPTURE_LABEL_RE})\\s*[:\\-]?|$)`,
    'i',
  );
  const value = text.match(re)?.[1]?.trim();
  return value ? value.replace(/\s+/g, ' ').trim() : null;
}

function extractMoneyNumber(value: any) {
  const match = String(value || '').match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

function extractPostalCode(text: string) {
  return extractQuickValue(text, 'cp|c\\.p|c[oó]digo\\s*postal')?.replace(/\D/g, '').slice(0, 5)
    || text.match(/\b(?:c\.?p\.?|cp|codigo postal|c[oó]digo postal)\D*(\d{5})\b/i)?.[1]
    || text.match(/\b(\d{5})\b/)?.[1]
    || null;
}

function extractCoordinates(text: string) {
  const source = extractQuickValue(text, 'coordenadas?|coords?') || text;
  const match = source.match(/([+-]?\d{1,3}(?:\.\d+)?)\s*[, ]+\s*([+-]?\d{1,3}(?:\.\d+)?)/);
  if (!match) return {};
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return {};
  return { gpsLatitud: String(lat), gpsLongitud: String(lng), coordenadas: { lat, lng } };
}

function extractMapUrl(text: string) {
  return String(text || '').match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps)[^\s]+/i)?.[0] || null;
}

function cleanAddressBlock(value: any) {
  const cleaned = String(value || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bTERMINAL\s*[:.-]?.*$/gim, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

function extractAuthorizationAddress(text: string) {
  const direct = extractQuickValue(text, 'direccion|direcci[oó]n|domicilio');
  if (direct) return cleanAddressBlock(direct);
  const match = String(text || '').match(/(?:este\s+domicilio|domicilio)\s*[:.-]?\s*([\s\S]*?)(?=\n\s*(?:terminal|https?:\/\/|$))/i);
  if (match?.[1]) return cleanAddressBlock(match[1]);
  const mapPreface = String(text || '').match(/(?:^|\n)\s*([^\n]{8,120})\s*\n\s*https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps)/i);
  if (mapPreface?.[1]) return cleanAddressBlock(mapPreface[1]);
  return null;
}

function inferProductType(text: string, serviceMode: any, packageName: any) {
  const body = normalizedBody(`${text} ${packageName || ''}`);
  if (/infinitum\s*puro|solo\s*internet/.test(body)) return 'infinitum_puro';
  if (/doble\s*play|internet\s*(?:\+|y)\s*tel[eé]fono|telefono\s*(?:\+|y)\s*internet/.test(body)) return 'doble_play';
  if (serviceMode === 'portabilidad') return 'doble_play';
  return packageName ? 'doble_play' : null;
}

function parseQuickCaptureTemplate(text: string) {
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

function extractFields(text: string, conversation: any) {
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

function extractEmail(text: string) {
  return String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
}

function uniquePhones(text: string) {
  const matches = String(text || '').match(/(?:\+?52)?\s*\d[\d\s().-]{8,}\d/g) || [];
  return Array.from(new Set(matches.map(normalizePhone).filter(phone => phone && phone.length === 10))) as string[];
}

function normalizedBody(text: string) {
  return removeAccents(String(text || '')).toLowerCase();
}

function firstTruthy(...values: any[]) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return null;
}

function isAffirmative(text: string) {
  return /^(si|sí|ok|okay|vale|va|correcto|claro|adelante|inicia|iniciar|empezar|dale|hazlo)\b/i.test(normalizedBody(text).trim());
}

function isNegative(text: string) {
  return /^(no|negativo|despues|luego|aun no|todavia no)\b/i.test(normalizedBody(text).trim());
}

function messageMedia(message: any) {
  const media = message?.metadata?.media;
  return media && typeof media === 'object' ? media : null;
}

function mediaLooksLikeCaptureDocument(media: any, text: string) {
  const haystack = normalizedBody(`${text} ${media?.fileName || ''} ${media?.kind || ''} ${media?.docType || ''}`);
  if (/(ine|curp|comprobante|domicilio|recibo|cfe|telmex|expediente|pdf|documento)/i.test(haystack)) return true;
  return ['image', 'document'].includes(String(media?.kind || '').toLowerCase());
}

function extractOcrFields(media: any) {
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

function extractCaptureFields(text: string, conversation: any, media?: any) {
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

function captureMissing(fields: Record<string, any>) {
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

function stageForMissing(missing: string[]) {
  if (missing.some(key => ['titularPhone', 'referencePhone', 'email'].includes(key))) return 'collecting_contact';
  if (missing.includes('addressRaw')) return 'collecting_address';
  if (missing.some(key => ['serviceMode', 'segment', 'productType', 'paquete'].includes(key))) return 'collecting_service';
  if (missing.some(key => key.startsWith('portability'))) return 'collecting_portability';
  return 'ready_for_review';
}

function promptForMissing(missing: string[]) {
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

function captureIntentRequested(text: string, media?: any) {
  const body = normalizedBody(text);
  return /\b(captura|capturar|venta|contratar|contratacion|contratación|alta|instalacion|instalación|cliente nuevo|quiero internet|servicio)\b/.test(body)
    || Boolean(media && mediaLooksLikeCaptureDocument(media, text));
}

function buildDocumentSummary(media: any) {
  if (!media) return null;
  const label = media.docType || media.kind || 'documento';
  const ocr = media.ocr?.status === 'completed' ? ' OCR listo.' : media.ocr?.status === 'failed' ? ' OCR pendiente/manual.' : '';
  return `${label}${media.fileName ? ` (${media.fileName})` : ''}.${ocr}`;
}

function buildCaptureDecision(conversation: any, message: any, baseFields: Record<string, any>) {
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
      reply: 'Perfecto, dejo el documento guardado en expediente. Cuando quieras iniciar captura, dime “iniciar captura”.',
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
    stage: wantsStart && missing.length ? stage : stage,
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

function extractFolioCandidate(text: string) {
  const raw = String(text || '').trim();
  const prefixed = raw.match(/\b(?:folio|siac|estatus|consulta)\s*[:#-]?\s*([A-Z0-9-]{5,})\b/i)?.[1];
  if (prefixed) return prefixed;
  if (/^\s*(?:folio\s*)?[A-Z0-9-]{5,}\s*$/i.test(raw) && /\d/.test(raw)) {
    return raw.replace(/^folio\s*/i, '').trim();
  }
  return raw.match(/\b([A-Z0-9]{5,}|\d{5,})\b/i)?.[1] || null;
}

function isMediaSignal(text: string) {
  return /^\[(sticker|imagen|documento|audio|video|contacto|ubicacion|mensaje recibido sin texto)/i.test(String(text || '').trim());
}

function removeAccents(value: string) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function cleanPotentialPromoterName(value: any) {
  const cleaned = String(value || '')
    .replace(/[^\p{L}\s'.-]/gu, ' ')
    .replace(/\b(?:asesor|promotor|supervisor|administrador|admin|gerente|vendedor|soy|me|llamo|nombre|es)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/).filter(Boolean).slice(0, 4);
  if (!tokens.length || tokens.length > 4) return null;
  const normalized = removeAccents(tokens.join(' ')).toLowerCase();
  if (/\b(folio|consulta|estatus|siac|cliente|telefono|whatsapp|paquete|direccion|captura|expediente|internet|hola|buenas|gracias)\b/i.test(normalized)) return null;
  if (tokens.some(token => token.length < 2 && tokens.length === 1)) return null;
  return tokens.map(token => token.charAt(0).toUpperCase() + token.slice(1)).join(' ');
}

function extractPromoterName(text: string, conversation: any) {
  const body = String(text || '').trim();
  if (!body || isMediaSignal(body) || extractEmail(body)) return null;

  const explicitPatterns = [
    /\b(?:me llamo|mi nombre es|soy|aqui\s+(?:es|anda)|aquí\s+(?:es|anda))\s+([\p{L}][\p{L}\s'.-]{1,80})/iu,
    /\bnombre\s*[:\-]\s*([\p{L}][\p{L}\s'.-]{1,80})/iu,
  ];
  for (const pattern of explicitPatterns) {
    const candidate = cleanPotentialPromoterName(body.match(pattern)?.[1]);
    if (candidate) {
      const firstName = candidate.split(/\s+/)[0];
      return { fullName: candidate, firstName, source: 'self_reported' };
    }
  }

  const memory = conversation?.memory || {};
  const promoter = memory.promoter || {};
  const normalized = removeAccents(body).toLowerCase();
  const wasAsked = Boolean(promoter.nameRequestedAt);
  const looksLikePlainName = /^[\p{L}\s'.-]{2,70}$/u.test(body)
    && !isSimpleGreeting(body)
    && !/\b(quiero|necesito|consulta|consultar|folio|estatus|siac|captura|cliente|paquete|direccion|telefono|gracias|ok|vale)\b/i.test(normalized);

  if (wasAsked && looksLikePlainName) {
    const candidate = cleanPotentialPromoterName(body);
    if (candidate) {
      const firstName = candidate.split(/\s+/)[0];
      return { fullName: candidate, firstName, source: 'name_reply' };
    }
  }

  return null;
}

function buildAutonomousReply(text: string, profile: any) {
  const lower = String(text || '').toLowerCase();
  const email = extractEmail(text);
  const baseOptions = 'Puedo revisar un folio, guardar un expediente o ayudarte a iniciar una captura. ¿Qué hacemos?';
  if (email) {
    return `Perfecto, ya tengo el correo ${email}. ¿Lo guardo para expediente o lo usamos para seguimiento?`;
  }
  if (lower.includes('sticker recibido')) {
    return `Va, te leo. ${baseOptions}`;
  }
  if (lower.includes('imagen recibida')) {
    return `Ya recibí la imagen. ¿La relaciono con algún cliente o folio?`;
  }
  if (lower.includes('documento recibido')) {
    return `Ya recibí el documento. Pásame nombre del cliente, teléfono o folio para guardarlo donde corresponde.`;
  }
  if (lower.includes('audio recibido')) {
    return `Recibí tu audio. Para avanzar sin error, escríbeme el dato clave: folio, cliente o trámite.`;
  }
  if (lower.includes('video recibido')) {
    return `Ya tengo el video. ¿A qué cliente o folio lo relaciono?`;
  }
  if (/\bine\b|credencial|frente|reverso/i.test(text)) {
    return `Perfecto. Si es INE, mándame frente y reverso, y dime el nombre del cliente o folio para guardarlo bien.`;
  }
  return defaultProfileReply(profile);
}

function classifyIntent(text: string): { intent: Intent; confidence: number } {
  const body = text.toLowerCase();
  if (shouldUseWebSearch(text)) return { intent: 'busqueda_web', confidence: 0.9 };
  if (/\b(folio|consulta|estatus|siac|mi folio)\b/.test(body)) return { intent: 'consulta_folio', confidence: 0.88 };
  if (/(?:^|[\n;|/,-])\s*(?:t\.t|tt|celular|referencia|tref|email|correo|nombre|sn|servicio nuevo|porta|portabilidad|paquete|terminal)\b/i.test(text)) return { intent: 'venta', confidence: 0.94 };
  if (/\b(contratar|quiero internet|paquete|cobertura|fibra|instalar|servicio|alta)\b/.test(body)) return { intent: 'venta', confidence: 0.86 };
  if (body.includes('nombre:') && (body.includes('tel:') || body.includes('telefono:') || body.includes('teléfono:'))) return { intent: 'venta', confidence: 0.92 };
  if (/\b(pagar|adeudo|debo|atraso|promesa|liquido|cobranza)\b/.test(body)) return { intent: 'morosidad', confidence: 0.8 };
  if (/\b(falla|soporte|ayuda|problema|no funciona|queja)\b/.test(body)) return { intent: 'soporte', confidence: 0.78 };
  if (extractFolioCandidate(text) && !extractEmail(text) && !isMediaSignal(text)) {
    return { intent: 'consulta_folio', confidence: 0.9 };
  }
  return { intent: 'otro', confidence: 0.45 };
}

function requiredMissing(fields: Record<string, any>) {
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

function buildSalesReply(fields: Record<string, any>, missing: string[]) {
  if (missing.length > 0) {
    return `Va, ya estoy ordenando la contratación. Solo me falta: ${missing.join(', ')}.`;
  }
  return `Listo, ya tengo los datos principales de ${fields.nombre}. La dejo preparada para revisión del equipo.`;
}

function normalizeStatus(value: any) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function isPostedRecord(record: any) {
  return [
    record?.estatus_siac,
    record?.estatus_pisa,
    record?.estatus_etapa,
    record?.respuesta_telmex,
  ].some(value => normalizeStatus(value).includes('POSTEAD'));
}

function siacValue(value: any) {
  const text = String(value ?? '').trim();
  return text || 'N/D';
}

function siacStatus(record: any) {
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

function buildFolioReply(text: string) {
  const folio = extractFolioCandidate(text);
  if (!folio) return { reply: 'Enviame el numero de folio para consultar. Ejemplo: folio 123456', fields: {} };
  const record = SiacRecords.getByFolio(folio) as any;
  if (!record) return { reply: `Busqué el folio ${folio} 🔎 y no lo encontré en la base disponible. ¿Quieres que lo escale a un asesor o me compartes otro folio?`, fields: { folio } };
  return {
    reply: formatSiacFolioReply(record),
    fields: { folio, found: true, status: isPostedRecord(record) ? 'POSTEADO' : siacStatus(record) },
  };
}

function decideWithRules(conversation: any, message: any): AgentDecision {
  const text = String(message.body || '');
  const audience = conversationAudience(conversation);
  const profile = AgentProfiles.getById(profileIdForConversation(conversation)) as any;
  const matchedVideo = findAgentVideoForQuestion(text, audience);
  const promoterName = extractPromoterName(text, conversation);
  const classified = classifyIntent(text);
  const intent = audience === 'clientes' && classified.intent === 'venta'
    ? 'soporte'
    : promoterName?.source === 'name_reply' ? 'otro' : classified.intent;
  const confidence = promoterName?.source === 'name_reply' ? 0.96 : classified.confidence;
  const fields = {
    audience,
    ...extractFields(text, conversation),
    ...extractCaptureFields(text, conversation, messageMedia(message)),
    ...(promoterName ? {
      promoterName: promoterName.fullName,
      promoterFirstName: promoterName.firstName,
      promoterNameConfirmed: true,
      promoterNameSource: promoterName.source,
    } : {}),
  };

  if (matchedVideo) {
    return personalizeDecision(conversation, {
      intent: intent === 'otro' ? 'soporte' : intent,
      confidence: Math.max(confidence, 0.92),
      extractedFields: {
        ...fields,
        matchedVideo: {
          id: matchedVideo.id,
          title: matchedVideo.title,
          topic: matchedVideo.topic,
          url: matchedVideo.url,
          mimeType: matchedVideo.mimeType,
          storagePath: matchedVideo.storagePath,
          fileName: matchedVideo.fileName,
        },
      },
      proposedReply: `Tengo un video que te puede ayudar con ${matchedVideo.topic}. Te lo mando para que lo veas rápido.`,
      proposedActions: [],
      requiresApproval: true,
    });
  }

  const captureFlow = buildCaptureDecision(conversation, message, fields);
  if (captureFlow) {
    return personalizeDecision(conversation, {
      intent: 'venta',
      confidence: Math.max(confidence, 0.9),
      extractedFields: captureFlow.fields,
      proposedReply: captureFlow.reply,
      proposedActions: captureFlow.actions,
      requiresApproval: true,
    });
  }

  const macro = matchProfileMacro(text, profile);
  if (macro) {
    return personalizeDecision(conversation, {
      intent: macro.intent || 'otro',
      confidence: 0.98,
      extractedFields: { ...fields, macro: macro.command, macroName: macro.name },
      proposedReply: macro.reply,
      proposedActions: macro.actions,
      requiresApproval: true,
    });
  }

  if (promoterName && intent === 'otro') {
    return personalizeDecision(conversation, {
      intent: 'otro',
      confidence: 0.96,
      extractedFields: fields,
      proposedReply: `Perfecto, ${promoterName.firstName}. Ya te ubico así para esta conversación. ¿Revisamos un folio, expediente o captura?`,
      proposedActions: [],
      requiresApproval: true,
    });
  }

  if (intent === 'venta') {
    const missing = requiredMissing(fields);
    return personalizeDecision(conversation, {
      intent,
      confidence,
      extractedFields: { ...fields, missing },
      proposedReply: buildSalesReply(fields, missing),
      proposedActions: missing.length ? ['update_lead'] : ['create_sale', 'schedule_followup'],
      requiresApproval: true,
    });
  }

  if (intent === 'consulta_folio') {
    const { reply, fields: folioFields } = buildFolioReply(text);
    return personalizeDecision(conversation, {
      intent,
      confidence,
      extractedFields: { ...fields, ...folioFields },
      proposedReply: reply,
      proposedActions: folioFields.found ? [] : ['escalate_human'],
      requiresApproval: true,
    });
  }

  if (intent === 'soporte' || intent === 'morosidad') {
    return personalizeDecision(conversation, {
      intent,
      confidence,
      extractedFields: fields,
      proposedReply: audience === 'clientes'
        ? 'Claro, lo reviso contigo. Cuéntame un poco más qué pasó y vemos el siguiente paso.'
        : 'Va, lo reviso. Pásame el dato clave para ubicarlo: folio, cliente o teléfono.',
      proposedActions: ['escalate_human'],
      requiresApproval: true,
    });
  }

  return personalizeDecision(conversation, {
    intent,
    confidence,
    extractedFields: fields,
    proposedReply: buildAutonomousReply(text, profile),
    proposedActions: [],
    requiresApproval: true,
  });
}

function stripVisibleThinking(value: string) {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '')
    .replace(/^\s*\/?no_think\s*/i, '')
    .trim();
}

function parseModelJson(output: string) {
  const clean = stripVisibleThinking(output);
  for (let start = clean.lastIndexOf('{'); start >= 0; start = clean.lastIndexOf('{', start - 1)) {
    const candidate = clean.slice(start).trim();
    const end = candidate.lastIndexOf('}');
    if (end < 0) continue;
    try {
      return JSON.parse(candidate.slice(0, end + 1));
    } catch {}
  }
  return null;
}

function clampConfidence(value: any, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0.05, Math.min(0.99, numeric > 1 ? numeric / 100 : numeric));
}

function normalizeIntent(value: any, fallback: Intent): Intent {
  const intent = String(value || '').trim().toLowerCase() as Intent;
  return INTENTS.includes(intent) ? intent : fallback;
}

function normalizeActions(value: any): ProposedAction[] {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item) => String(item || '').trim().toLowerCase() as ProposedAction)
    .filter((item, index, list) => PROPOSED_ACTIONS.includes(item) && list.indexOf(item) === index);
}

function cleanReply(value: any) {
  return stripVisibleThinking(String(value || '')).replace(/\s+\n/g, '\n').trim().slice(0, 900);
}

function defaultProfileReply(profile: any) {
  const configured = String(profile?.metadata?.defaultMessage || '').trim();
  if (!configured || configured === LEGACY_ARIUX_MESSAGE || /hola,\s*soy\s*ariux/i.test(configured)) return DEFAULT_ARIUX_MESSAGE;
  return configured;
}

function getDesignerConfig(profile: any) {
  const metadata = profile?.metadata || {};
  return metadata.agentDesigner && typeof metadata.agentDesigner === 'object'
    ? metadata.agentDesigner
    : {};
}

function getProfileMacros(profile: any) {
  const metadata = profile?.metadata || {};
  const designer = getDesignerConfig(profile);
  const raw = Array.isArray(designer.macros)
    ? designer.macros
    : Array.isArray(metadata.macros)
      ? metadata.macros
      : [];
  return raw
    .filter((macro: any) => macro && macro.enabled !== false && macro.command && macro.reply)
    .map((macro: any) => ({
      id: String(macro.id || macro.command || '').trim(),
      name: String(macro.name || macro.command || '').trim(),
      command: String(macro.command || '').trim().toLowerCase(),
      reply: cleanReply(macro.reply),
      intent: normalizeIntent(macro.intent, 'otro'),
      actions: normalizeActions(macro.actions || []),
    }))
    .filter((macro: any) => macro.command && macro.reply);
}

function matchProfileMacro(text: string, profile: any) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return null;
  return getProfileMacros(profile).find((macro: any) => (
    normalized === macro.command
    || normalized === macro.name.toLowerCase()
    || normalized === macro.command.replace(/^\//, '')
  )) || null;
}

function isSimpleGreeting(text: string) {
  const normalized = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return /^(hola|holi|buenos dias|buen dia|buenas tardes|buenas noches|buenas|hi|hello|hey|\/start|\/star|\/inicio|\/inicios)$/.test(normalized);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} excedio ${ms}ms`)), ms);
    }),
  ]);
}

function buildAiDecisionPrompt(conversation: any, message: any, rules: AgentDecision) {
  const audience = conversationAudience(conversation);
  const profile = AgentProfiles.getById(profileIdForConversation(conversation)) as any;
  const memory = conversation?.memory || {};
  const promoter = memory.promoter || {};
  return `/no_think
Analiza el mensaje entrante para Heavenly Dreams CRM.

Reglas:
- Responde SOLO JSON valido, sin markdown y sin explicaciones.
- El agente debe responder ante cualquier mensaje entrante, aunque sea corto, raro o incompleto.
- Hay dos agentes separados: promotores usa ARIUX y clientes usa ARIA. Nunca mezcles instrucciones internas de promotores con clientes finales.
- Audiencia actual: ${audience}.
- Tono humano: escribe como una persona del equipo por WhatsApp, no como bot ni call center.
- Usa frases naturales, cortas y personales: "va", "claro", "lo reviso", "me pasas", "te ayudo".
- Evita decir "soy un bot", "asistente virtual", "agente inteligente", "procesando", "estimado usuario", "hemos recibido su solicitud".
- No repitas el nombre del agente en cada mensaje; solo preséntate si es primer contacto.
- Usa maximo 1 emoji y solo si se siente natural.
- Si hay nombre registrado, úsalo de vez en cuando, no en cada respuesta.
- Si no hay nombre confirmado del promotor, pide su nombre una sola vez de forma casual para ubicarlo mejor.
- Si el promotor dice "me llamo", "soy" o responde solo con su nombre, confirma que lo guardaste y usalo desde ese momento.
- Si hay captureDraft activo, continua el flujo y pide solo los datos faltantes.
- Si recibe INE/CURP/comprobante y el usuario acepta iniciar captura, recolecta telefono titular, telefono referencia, correo, direccion, tipo de servicio, segmento, producto y paquete.
- Si es portabilidad, pide numero a portar, compania actual y NIP de 4 digitos.
- La captura final siempre queda como borrador pendiente de aprobacion humana.
- Siempre termina con una pregunta concreta cuando falte contexto. Si ya tienes lo necesario, confirma el siguiente paso.
- No inventes folios, telefonos, nombres, paquetes ni direcciones.
- Todas las acciones requieren aprobacion humana aunque el JSON diga lo contrario.
- Si pide buscar informacion externa, internet, noticias, datos actuales o verificar una pagina, usa intent "busqueda_web".
- Si pide Telmex Hogar, Telmex Negocio, beneficios, paquetes, cobertura, fibra optica o mapas de cobertura, usa intent "busqueda_web".
- Si pide como llegar, rutas, Google Maps, transporte publico, auto o una colonia/zona para ubicarse, usa intent "busqueda_web".
- Si el mensaje es solo un numero, codigo o folio, usa intent "consulta_folio".
- Si el cliente pide estatus/folio/SIAC, usa intent "consulta_folio".
- Si quiere contratar, instalar, cotizar o pasar datos de venta, usa intent "venta".
- Si la audiencia es clientes, no inicies captura de venta de promotores; trata dudas como soporte/atencion general salvo consulta de folio o pago.
- Si habla de falla o queja, usa intent "soporte".
- Si habla de adeudo/pago/promesa de pago, usa intent "morosidad".
- Si recibe un email, pregunta si debe guardarlo en expediente, usarlo para seguimiento o asociarlo a cliente.
- Si recibe INE, imagen, PDF o documento, confirma recepcion y pide nombre/folio/telefono para relacionar expediente.
- Si recibe sticker, audio o video, responde natural y pide el dato operativo que falta.
- Si el mensaje coincide con un macro activo del diseñador, respeta ese macro como respuesta base y conserva su intencion.
- Si no entiendes el mensaje, ofrece opciones: consultar folio, guardar expediente o iniciar captura.
- proposedActions solo puede usar: create_sale, update_lead, schedule_followup, escalate_human.

Perfil del agente:
${JSON.stringify({
    name: profile?.name || 'ARIUX',
    selfKnowledge: profile?.selfKnowledge || '',
    knowledgeBase: profile?.knowledgeBase || '',
    designer: getDesignerConfig(profile),
    macros: getProfileMacros(profile).map((macro: any) => ({
      name: macro.name,
      command: macro.command,
      intent: macro.intent,
      reply: macro.reply,
      actions: macro.actions,
    })),
    defaultMessage: profile?.metadata?.defaultMessage || DEFAULT_ARIUX_MESSAGE,
    functions: Array.isArray(profile?.metadata?.functions) ? profile.metadata.functions : [],
    learnedNotes: (profile?.learnedNotes || []).slice(0, 6),
  })}

Memoria de conversacion:
${JSON.stringify(memory)}

Promotor registrado:
${JSON.stringify(promoter)}

Decision heuristica inicial:
${JSON.stringify({
    intent: rules.intent,
    confidence: rules.confidence,
    extractedFields: rules.extractedFields,
    proposedReply: rules.proposedReply,
    proposedActions: rules.proposedActions,
  })}

Mensaje:
${String(message.body || '').slice(0, 2500)}

Metadata del mensaje:
${JSON.stringify(message.metadata || {})}

Devuelve exactamente:
{
  "intent": "venta|consulta_folio|soporte|morosidad|busqueda_web|otro",
  "confidence": 0.0,
  "extractedFields": {
    "nombre": "",
    "telefono": "",
    "direccion": "",
    "colonia": "",
    "paquete": "",
    "zona": "",
    "folio": ""
  },
  "proposedReply": "respuesta breve, natural y personal en espanol mexicano",
  "proposedActions": []
}`;
}

function decisionFromModel(conversation: any, rules: AgentDecision, modelPayload: any, ai: { provider?: string; model?: string; errors?: string[] }, message: any): AgentDecision {
  const intent = normalizeIntent(modelPayload?.intent, rules.intent);
  const modelFields = typeof modelPayload?.extractedFields === 'object' && modelPayload.extractedFields
    ? modelPayload.extractedFields
    : typeof modelPayload?.fields === 'object' && modelPayload.fields
      ? modelPayload.fields
      : {};
  const extractedFields: Record<string, any> = {
    ...rules.extractedFields,
    ...Object.fromEntries(Object.entries(modelFields).filter(([, value]) => value != null && String(value).trim() !== '')),
    _ai: { provider: ai.provider || 'ollama', model: ai.model || 'gemma4:e4b', mode: 'ollama-gemma4' },
  };

  if (intent === 'consulta_folio') {
    const folio = extractedFields.folio || String(message.body || '').match(/\b([A-Z0-9]{5,}|\d{5,})\b/i)?.[1] || '';
    const { reply, fields } = buildFolioReply(folio ? `folio ${folio}` : String(message.body || ''));
    return personalizeDecision(conversation, {
      intent,
      confidence: clampConfidence(modelPayload?.confidence, Math.max(rules.confidence, 0.88)),
      extractedFields: { ...extractedFields, ...fields },
      proposedReply: reply,
      proposedActions: fields.found ? [] : ['escalate_human'],
      requiresApproval: true,
    });
  }

  if (intent === 'venta') {
    const missing = requiredMissing(extractedFields);
    extractedFields.missing = missing;
    const actions = normalizeActions(modelPayload?.proposedActions);
    return personalizeDecision(conversation, {
      intent,
      confidence: clampConfidence(modelPayload?.confidence, rules.confidence),
      extractedFields,
      proposedReply: cleanReply(modelPayload?.proposedReply) || buildSalesReply(extractedFields, missing),
      proposedActions: actions.length ? actions : (missing.length ? ['update_lead'] : ['create_sale', 'schedule_followup']),
      requiresApproval: true,
    });
  }

  const actions = normalizeActions(modelPayload?.proposedActions);
  return personalizeDecision(conversation, {
    intent,
    confidence: clampConfidence(modelPayload?.confidence, rules.confidence),
    extractedFields,
    proposedReply: cleanReply(modelPayload?.proposedReply) || rules.proposedReply,
    proposedActions: actions.length ? actions : (intent === 'soporte' || intent === 'morosidad' ? ['escalate_human'] : []),
    requiresApproval: true,
  });
}

async function decide(conversation: any, message: any): Promise<AgentDecision> {
  const rules = decideWithRules(conversation, message);
  const text = String(message?.body || '');
  if (rules.intent === 'busqueda_web') {
    try {
      const web = await withTimeout(answerWebQuestion(text, { promoterName: promoterFirstName(conversation) }), 15_000, 'Web search');
      return personalizeDecision(conversation, {
        intent: 'busqueda_web',
        confidence: Math.max(rules.confidence, 0.9),
        extractedFields: {
          ...rules.extractedFields,
          query: web.query,
          sources: web.sources,
          _web: { provider: 'duckduckgo', count: web.sources.length },
        },
        proposedReply: web.reply,
        proposedActions: [],
        requiresApproval: true,
      });
    } catch (err: any) {
      return personalizeDecision(conversation, {
        intent: 'busqueda_web',
        confidence: rules.confidence,
        extractedFields: {
          ...rules.extractedFields,
          _web: { provider: 'duckduckgo', error: err?.message || String(err) },
        },
        proposedReply: 'No pude consultar la web en este momento. Dame una palabra clave mas concreta o intenta de nuevo en unos minutos.',
        proposedActions: [],
        requiresApproval: true,
      });
    }
  }
  if (rules.intent === 'consulta_folio' || isSimpleGreeting(text)) {
    return rules;
  }
  try {
    const ai = await withTimeout(runAiWithFallback(buildAiDecisionPrompt(conversation, message, rules)), AI_DECISION_TIMEOUT_MS, 'AI decision');
    const parsed = parseModelJson(ai.output);
    if (!parsed) throw new Error('El modelo IA no devolvio JSON valido');
    return decisionFromModel(conversation, rules, parsed, ai, message);
  } catch (err: any) {
    return {
      ...rules,
      extractedFields: {
        ...rules.extractedFields,
        _ai: { provider: 'rules-fallback', error: err?.message || String(err) },
      },
    };
  }
}

function nextStatus(decision: AgentDecision) {
  if (decision.proposedActions.includes('escalate_human')) return 'requiere_humano';
  if (decision.intent === 'busqueda_web') return 'consulta_web';
  if (decision.intent === 'venta') {
    const missing = decision.extractedFields.missing || [];
    return missing.length ? 'datos_incompletos' : 'captura_pendiente_aprobacion';
  }
  if (decision.intent === 'consulta_folio') return 'seguimiento';
  return 'calificando';
}

function mergeMemory(conversation: any, decision: AgentDecision) {
  const previous = conversation?.memory || {};
  const transientFields = new Set([
    'missing',
    '_ai',
    '_web',
    'sources',
    '_nameRequestSent',
    '_introSent',
    '_captureDraft',
    'matchedVideo',
    'promoterName',
    'promoterFirstName',
    'promoterNameConfirmed',
    'promoterNameSource',
  ]);
  const knownFields = {
    ...(previous.knownFields || {}),
    ...Object.fromEntries(Object.entries(decision.extractedFields).filter(([key]) => !transientFields.has(key))),
  };
  const previousPromoter = previous.promoter && typeof previous.promoter === 'object' ? previous.promoter : {};
  const promoterName = cleanPersonName(decision.extractedFields?.promoterName);
  const promoterFirst = cleanPersonName(decision.extractedFields?.promoterFirstName)
    || promoterName?.split(/\s+/)[0]
    || previousPromoter.firstName
    || null;
  const nowIso = new Date().toISOString();
  const incomingDraft = decision.extractedFields?._captureDraft && typeof decision.extractedFields._captureDraft === 'object'
    ? decision.extractedFields._captureDraft
    : null;
  const captureDraft = incomingDraft
    ? {
        ...(previous.captureDraft || {}),
        ...incomingDraft,
        fields: {
          ...((previous.captureDraft || {}).fields || {}),
          ...(incomingDraft.fields || {}),
        },
        documents: Array.isArray(incomingDraft.documents)
          ? incomingDraft.documents
          : Array.isArray((previous.captureDraft || {}).documents)
            ? (previous.captureDraft || {}).documents
            : [],
        updatedAt: incomingDraft.updatedAt || nowIso,
      }
    : previous.captureDraft;
  return {
    ...previous,
    knownFields,
    ...(captureDraft ? { captureDraft } : {}),
    promoter: {
      ...previousPromoter,
      ...(decision.extractedFields?._introSent && !previousPromoter.introSentAt ? { introSentAt: nowIso } : {}),
      ...(decision.extractedFields?._nameRequestSent && !previousPromoter.nameRequestedAt ? { nameRequestedAt: nowIso } : {}),
      ...(promoterName ? {
        fullName: promoterName,
        firstName: promoterFirst,
        preferredName: promoterFirst,
        nameConfirmed: true,
        nameSource: decision.extractedFields?.promoterNameSource || 'self_reported',
        nameConfirmedAt: nowIso,
      } : {}),
    },
    audience: conversationAudience(conversation),
    summary: decision.intent === 'venta'
      ? `Cliente interesado en venta. Datos conocidos: ${Object.keys(knownFields).join(', ') || 'sin datos completos'}.`
      : `Ultima intencion detectada: ${decision.intent}.`,
    stage: nextStatus(decision),
    lastAgent: agentLabelForDecision(conversation, decision),
    nextAction: decision.proposedActions.length ? decision.proposedActions.join(',') : 'responder',
    updatedAt: new Date().toISOString(),
  };
}

function createOutboxItems(conversation: any, message: any, decisionId: string, decision: AgentDecision) {
  const items: any[] = [];
  if (decision.proposedReply) {
    items.push(AgentOutbox.create({
      conversation_id: conversation.id,
      decision_id: decisionId,
      type: 'reply',
      channel: conversation.channel,
      target: conversation.external_chat_id,
      message: decision.proposedReply,
      action: 'send_message',
      payload: { sourceMessageId: message.id, intent: decision.intent },
    }));
  }

  const matchedVideo = decision.extractedFields?.matchedVideo;
  if (matchedVideo?.storagePath) {
    items.push(AgentOutbox.create({
      conversation_id: conversation.id,
      decision_id: decisionId,
      type: 'media',
      channel: conversation.channel,
      target: conversation.external_chat_id,
      message: decision.proposedReply || `Video de apoyo: ${matchedVideo.title || matchedVideo.topic || 'tema solicitado'}`,
      action: 'send_video',
      payload: {
        sourceMessageId: message.id,
        intent: decision.intent,
        video: matchedVideo,
      },
    }));
  }

  if (decision.proposedActions.includes('create_sale')) {
    const alreadyQueued = (AgentOutbox.getByConversation(conversation.id, 30) as any[])
      .some(item => item?.action === 'create_sale' && ['pending_approval', 'approved'].includes(String(item.status || '')));
    if (!alreadyQueued) {
      items.push(AgentOutbox.create({
        conversation_id: conversation.id,
        decision_id: decisionId,
        type: 'action',
        channel: conversation.channel,
        target: conversation.external_chat_id,
        message: null,
        action: 'create_sale',
        payload: {
          ...decision.extractedFields,
          sourceMessageId: message.id,
          conversationId: conversation.id,
          channel: conversation.channel,
        },
      }));
    }
  }

  if (decision.proposedActions.includes('schedule_followup')) {
    items.push(AgentOutbox.create({
      conversation_id: conversation.id,
      decision_id: decisionId,
      type: 'task',
      channel: conversation.channel,
      target: conversation.external_chat_id,
      message: null,
      action: 'schedule_followup',
      payload: {
        title: `Seguimiento WhatsApp: ${conversation.display_name || conversation.external_chat_id}`,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    }));
  }

  if (decision.proposedActions.includes('escalate_human')) {
    items.push(AgentOutbox.create({
      conversation_id: conversation.id,
      decision_id: decisionId,
      type: 'task',
      channel: conversation.channel,
      target: conversation.external_chat_id,
      message: null,
      action: 'escalate_human',
      payload: { title: `Revisar conversacion ${conversation.display_name || conversation.external_chat_id}`, intent: decision.intent },
    }));
  }

  return items.filter(Boolean);
}

export async function runAgentForMessage(conversation: any, message: any) {
  if (!conversation || !message || message.direction === 'outgoing') return null;
  if (ChannelMessages.getById(message.id)?.direction !== 'incoming') return null;
  const existing = AgentDecisions.getByMessage(message.id);
  if (existing) return { decision: existing, duplicate: true };

  const decision = await decide(conversation, message);
  const decisionId = randomUUID();
  AgentDecisions.create({
    id: decisionId,
    conversation_id: conversation.id,
    message_id: message.id,
    agent: agentLabelForDecision(conversation, decision),
    intent: decision.intent,
    confidence: decision.confidence,
    extracted_fields: decision.extractedFields,
    proposed_reply: decision.proposedReply || null,
    proposed_actions: decision.proposedActions,
    requires_approval: true,
    status: 'pending_approval',
  });

  ChannelConversations.update(conversation.id, {
    status: nextStatus(decision),
    intent: decision.intent,
    confidence: decision.confidence,
    memory: mergeMemory(conversation, decision),
  });

  const outbox = createOutboxItems(conversation, message, decisionId, decision);
  recordMetric('agent.decision.created', { intent: decision.intent, channel: conversation.channel });
  return { decision: { id: decisionId, ...decision }, outbox };
}

export async function runAgentForConversation(conversationId: string) {
  const conversation = ChannelConversations.getById(conversationId);
  if (!conversation) throw new Error('Conversacion no encontrada');
  const messages = ChannelMessages.getByConversation(conversationId, 200);
  const lastIncoming = [...messages].reverse().find((msg: any) => msg.direction === 'incoming');
  if (!lastIncoming) return { ok: true, idle: true };
  return runAgentForMessage(conversation, lastIncoming);
}

function salePayloadFromOutbox(item: any, actor: any) {
  const payload = item.payload || {};
  const draftFields = payload._captureDraft?.fields || {};
  const fields = { ...draftFields, ...payload };
  const addressParts = [
    fields.addressRaw || fields.direccion,
    fields.entreCalle1 ? `entre ${fields.entreCalle1}` : null,
    fields.entreCalle2 ? `y ${fields.entreCalle2}` : null,
    fields.codigoPostal ? `CP ${fields.codigoPostal}` : null,
  ].filter(Boolean).join(' ');
  return {
    id: randomUUID(),
    folio: null,
    asesor_id: actor?.sub || actor?.uid || 'agente_whatsapp',
    asesor_nombre: actor?.nombre || actor?.name || 'Copiloto WhatsApp',
    status: 'pendiente',
    nombres: fields.nombre || null,
    apellidos: null,
    telefono: fields.titularPhone || fields.telefono || null,
    direccion: addressParts || fields.addressRaw || fields.direccion || null,
    colonia: fields.colonia || null,
    municipio: null,
    tipo_cliente: fields.segment || null,
    tipo_servicio: fields.serviceMode || fields.productType || null,
    plan: fields.paquete || null,
    renta_mensual: null,
    zona: fields.zona || null,
    notas: `Borrador aprobado desde ${item.channel}: ${item.target}`,
    fecha_solicitud: new Date().toISOString(),
    metadata: json({
      source: item.channel,
      conversationId: item.conversation_id,
      outboxId: item.id,
      sourceMessageId: fields.sourceMessageId || null,
      proposedBy: 'agent_orchestrator',
      referencePhone: fields.referencePhone || null,
      email: fields.email || null,
      codigoPostal: fields.codigoPostal || null,
      gastosInstalacion: fields.gastosInstalacion || null,
      entreCalle1: fields.entreCalle1 || null,
      entreCalle2: fields.entreCalle2 || null,
      datosAdicionales: fields.datosAdicionales || null,
      terminal: fields.terminal || null,
      mapsUrl: fields.mapsUrl || null,
      gpsLatitud: fields.gpsLatitud || fields.coordenadas?.lat || null,
      gpsLongitud: fields.gpsLongitud || fields.coordenadas?.lng || null,
      curp: fields.curp || null,
      folioIne: fields.folioIne || null,
      portabilityNumber: fields.portabilityNumber || null,
      portabilityCompany: fields.portabilityCompany || null,
      portabilityNip: fields.portabilityNip || null,
      documents: payload._captureDraft?.documents || [],
    }),
  };
}

export async function approveAgentOutbox(id: string, actor: any, sendMessage: SendChannelMessage) {
  const item = AgentOutbox.getById(id);
  if (!item) throw new Error('Elemento de outbox no encontrado');
  if (item.status !== 'pending_approval') throw new Error('Este elemento ya fue procesado');

  try {
    let result: any = null;
    if (item.action === 'send_video') {
      result = await sendMessage(item.channel, item.target, item.message || '', item.payload);
    } else if (item.type === 'reply') {
      result = await sendMessage(item.channel, item.target, item.message || '');
    } else if (item.action === 'create_sale') {
      const sale = salePayloadFromOutbox(item, actor);
      Ventas.create(sale);
      ChannelConversations.update(item.conversation_id, { status: 'venta_creada' });
      AuditLog.insert({
        accion: 'AGENT_CREATE_VENTA_APPROVED',
        entidad: 'ventas',
        entidad_id: sale.id,
        user_id: actor?.sub || actor?.uid || null,
        user_nombre: actor?.nombre || actor?.name || null,
        detalle: item.target,
      });
      result = { saleId: sale.id };
    } else if (item.action === 'schedule_followup') {
      AgentTasks.create({
        conversation_id: item.conversation_id,
        type: 'followup',
        title: item.payload?.title || `Seguimiento ${item.target}`,
        status: 'open',
        due_at: item.payload?.dueAt || null,
        assigned_to: actor?.sub || null,
        metadata: { outboxId: item.id },
      });
      result = { task: 'followup' };
    } else if (item.action === 'escalate_human') {
      AgentTasks.create({
        conversation_id: item.conversation_id,
        type: 'escalation',
        title: item.payload?.title || `Escalar conversacion ${item.target}`,
        status: 'open',
        due_at: null,
        assigned_to: actor?.sub || null,
        metadata: { outboxId: item.id, intent: item.payload?.intent || null },
      });
      ChannelConversations.update(item.conversation_id, { status: 'requiere_humano' });
      result = { task: 'escalation' };
    } else {
      throw new Error(`Accion de outbox no soportada: ${item.action || item.type}`);
    }

    AgentOutbox.update(id, {
      status: 'approved',
      approved_by: actor?.sub || actor?.uid || null,
      approved_at: new Date().toISOString(),
      result,
      error: null,
    });
    recordMetric('agent.outbox.approved', { action: item.action || item.type, channel: item.channel });
    return AgentOutbox.getById(id);
  } catch (err: any) {
    AgentOutbox.update(id, { status: 'failed', error: err.message || String(err) });
    throw err;
  }
}

export function rejectAgentOutbox(id: string, actor: any, reason?: string) {
  const item = AgentOutbox.getById(id);
  if (!item) throw new Error('Elemento de outbox no encontrado');
  if (item.status !== 'pending_approval') throw new Error('Este elemento ya fue procesado');
  AgentOutbox.update(id, {
    status: 'rejected',
    rejected_by: actor?.sub || actor?.uid || null,
    rejected_at: new Date().toISOString(),
    error: reason || null,
  });
  recordMetric('agent.outbox.rejected', { action: item.action || item.type, channel: item.channel });
  return AgentOutbox.getById(id);
}
