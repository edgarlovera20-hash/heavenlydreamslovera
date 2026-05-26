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

type SendChannelMessage = (channel: string, target: string, message: string) => Promise<any>;
const INTENTS: Intent[] = ['venta', 'consulta_folio', 'soporte', 'morosidad', 'busqueda_web', 'otro'];
const PROPOSED_ACTIONS: ProposedAction[] = ['create_sale', 'update_lead', 'schedule_followup', 'escalate_human'];
const DEFAULT_ARIUX_MESSAGE = 'Hola, soy ARIUX 🤖 asistente virtual de Heavenly Dreams ✨. Estoy aquí para ayudarte y servirte en consulta de folios 🔎, guardar expedientes 📁 e iniciar flujos de captura 📝. ¿Qué necesitas hoy?';
const AI_DECISION_TIMEOUT_MS = Math.max(3000, Number(process.env.AGENT_AI_TIMEOUT_MS || 8000));

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
  const source = cleanPersonName(promoter.firstName)
    || cleanPersonName(promoter.fullName)
    || cleanPersonName(conversation?.display_name);
  return source?.split(/\s+/)[0] || null;
}

function personalizeReply(reply: any, conversation: any) {
  const text = String(reply || '').trim();
  const firstName = promoterFirstName(conversation);
  if (!text || !firstName) return text;
  const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^(hola[, ]+)?${escaped}\\b`, 'i').test(text)) return text;
  if (/^hola,\s*/i.test(text)) return text.replace(/^hola,\s*/i, `Hola, ${firstName}, `);
  if (/^hola\s+/i.test(text)) return text.replace(/^hola\s+/i, `Hola ${firstName}, `);
  return `${firstName}, ${text}`;
}

function personalizeDecision(conversation: any, decision: AgentDecision): AgentDecision {
  return {
    ...decision,
    proposedReply: decision.proposedReply ? personalizeReply(decision.proposedReply, conversation) : decision.proposedReply,
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

function buildAutonomousReply(text: string, profile: any) {
  const lower = String(text || '').toLowerCase();
  const email = extractEmail(text);
  const baseOptions = 'Puedo ayudarte con 🔎 consulta de folios, 📁 guardar expediente o 📝 iniciar una captura. ¿Qué hacemos primero?';
  if (email) {
    return `Recibí el correo ${email} 📩. Lo puedo usar para el expediente o seguimiento del cliente. ${baseOptions}`;
  }
  if (lower.includes('sticker recibido')) {
    return `Sticker recibido 😄. Me quedo en modo trabajo: ${baseOptions}`;
  }
  if (lower.includes('imagen recibida')) {
    return `Imagen recibida 📸. Si es INE, comprobante o documento del expediente, la dejo identificada para el flujo. Dime nombre del cliente o folio para relacionarla.`;
  }
  if (lower.includes('documento recibido')) {
    return `Documento recibido 📄. Lo puedo guardar en expediente o asociarlo a una captura. ¿Me pasas nombre del cliente, teléfono o folio?`;
  }
  if (lower.includes('audio recibido')) {
    return `Audio recibido 🎧. Para avanzar rapido, escríbeme el dato clave: folio, nombre del cliente o qué trámite quieres iniciar.`;
  }
  if (lower.includes('video recibido')) {
    return `Video recibido 🎥. Si corresponde a evidencia o firma, lo podemos guardar en expediente. ¿A qué cliente o folio lo relaciono?`;
  }
  if (/\bine\b|credencial|frente|reverso/i.test(text)) {
    return `Perfecto, si es INE necesito frente y reverso 🪪. También dime nombre del cliente o folio para guardar bien el expediente.`;
  }
  return defaultProfileReply(profile);
}

function classifyIntent(text: string): { intent: Intent; confidence: number } {
  const body = text.toLowerCase();
  if (shouldUseWebSearch(text)) return { intent: 'busqueda_web', confidence: 0.9 };
  if (/\b(folio|consulta|estatus|siac|mi folio)\b/.test(body)) return { intent: 'consulta_folio', confidence: 0.88 };
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
    ['telefono', 'telefono WhatsApp a 10 digitos'],
    ['direccion', 'direccion o domicilio'],
    ['paquete', 'paquete o plan de interes'],
  ];
  return required.filter(([key]) => !fields[key]).map(([, label]) => label);
}

function buildSalesReply(fields: Record<string, any>, missing: string[]) {
  const profile = AgentProfiles.getById('promoter_receptionist') as any;
  const agentName = profile?.name || 'ARIUX';
  if (missing.length > 0) {
    return `Hola, soy ${agentName}. Te ayudo a ordenar esta contratacion. Para avanzar necesito: ${missing.join(', ')}.`;
  }
  return `Soy ${agentName}. Ya tengo los datos principales de ${fields.nombre}. Voy a pasar la solicitud para revision y seguimiento del equipo.`;
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

function postedRecordReply(record: any) {
  const fechaPosteo = record.fecha_os_alta || record.fecha_cambio_estatus || 'N/D';
  return [
    `Folio ${record.folio_siac} ✅ POSTEADO`,
    `Fecha de captura: ${record.fecha_captura || 'N/D'}`,
    `Folio: ${record.folio_siac || 'N/D'}`,
    `Orden de servicio: ${record.os_alta || 'N/D'}`,
    `Fecha de posteo: ${fechaPosteo}`,
  ].join('\n');
}

function buildFolioReply(text: string) {
  const folio = extractFolioCandidate(text);
  if (!folio) return { reply: 'Enviame el numero de folio para consultar. Ejemplo: folio 123456', fields: {} };
  const record = SiacRecords.getByFolio(folio) as any;
  if (!record) return { reply: `Busqué el folio ${folio} 🔎 y no lo encontré en la base disponible. ¿Quieres que lo escale a un asesor o me compartes otro folio?`, fields: { folio } };
  if (isPostedRecord(record)) {
    return {
      reply: postedRecordReply(record),
      fields: { folio, found: true, status: 'POSTEADO' },
    };
  }
  return {
    reply: `Folio ${record.folio_siac} ✅\nEstatus: ${record.estatus_siac || 'N/D'}\nPromotora: ${record.promotor || 'N/D'}\nFecha captura: ${record.fecha_captura || 'N/D'}\nPaquete: ${record.paquete || 'N/D'}`,
    fields: { folio, found: true },
  };
}

function decideWithRules(conversation: any, message: any): AgentDecision {
  const text = String(message.body || '');
  const { intent, confidence } = classifyIntent(text);
  const fields = extractFields(text, conversation);

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
      proposedReply: 'Recibimos tu mensaje. Un asesor revisara tu caso y te dara seguimiento.',
      proposedActions: ['escalate_human'],
      requiresApproval: true,
    });
  }

  return personalizeDecision(conversation, {
    intent,
    confidence,
    extractedFields: fields,
    proposedReply: (() => {
      const profile = AgentProfiles.getById('promoter_receptionist') as any;
      return buildAutonomousReply(text, profile);
    })(),
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
  return String(profile?.metadata?.defaultMessage || DEFAULT_ARIUX_MESSAGE).trim();
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
  const profile = AgentProfiles.getById('promoter_receptionist') as any;
  const memory = conversation?.memory || {};
  const promoter = memory.promoter || {};
  return `/no_think
Analiza el mensaje entrante para Heavenly Dreams CRM.

Reglas:
- Responde SOLO JSON valido, sin markdown y sin explicaciones.
- ARIUX debe responder ante cualquier mensaje entrante, aunque sea corto, raro o incompleto.
- Tono: social, profesional, rapido, con humor ligero cuando ayude. Usa 1 a 3 emojis utiles, sin saturar.
- Si hay nombre del promotor registrado, hablale por su nombre de forma natural y personalizada.
- Siempre termina con una pregunta o siguiente paso concreto cuando falte contexto.
- No inventes folios, telefonos, nombres, paquetes ni direcciones.
- Todas las acciones requieren aprobacion humana aunque el JSON diga lo contrario.
- Si pide buscar informacion externa, internet, noticias, datos actuales o verificar una pagina, usa intent "busqueda_web".
- Si el mensaje es solo un numero, codigo o folio, usa intent "consulta_folio".
- Si el cliente pide estatus/folio/SIAC, usa intent "consulta_folio".
- Si quiere contratar, instalar, cotizar o pasar datos de venta, usa intent "venta".
- Si habla de falla o queja, usa intent "soporte".
- Si habla de adeudo/pago/promesa de pago, usa intent "morosidad".
- Si recibe un email, pregunta si debe guardarlo en expediente, usarlo para seguimiento o asociarlo a cliente.
- Si recibe INE, imagen, PDF o documento, confirma recepcion y pide nombre/folio/telefono para relacionar expediente.
- Si recibe sticker, audio o video, responde de forma amable y con humor ligero; pide el dato operativo que falta.
- Si no entiendes el mensaje, ofrece opciones: consultar folio, guardar expediente o iniciar captura.
- proposedActions solo puede usar: create_sale, update_lead, schedule_followup, escalate_human.

Perfil del agente:
${JSON.stringify({
    name: profile?.name || 'ARIUX',
    selfKnowledge: profile?.selfKnowledge || '',
    knowledgeBase: profile?.knowledgeBase || '',
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
  "proposedReply": "respuesta breve en espanol para proponer al humano",
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
  const transientFields = new Set(['missing', '_ai', '_web', 'sources']);
  const knownFields = {
    ...(previous.knownFields || {}),
    ...Object.fromEntries(Object.entries(decision.extractedFields).filter(([key]) => !transientFields.has(key))),
  };
  return {
    ...previous,
    knownFields,
    summary: decision.intent === 'venta'
      ? `Cliente interesado en venta. Datos conocidos: ${Object.keys(knownFields).join(', ') || 'sin datos completos'}.`
      : `Ultima intencion detectada: ${decision.intent}.`,
    stage: nextStatus(decision),
    lastAgent: decision.intent === 'venta' ? 'capturista' : decision.intent === 'consulta_folio' ? 'consultor' : 'recepcionista',
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

  if (decision.proposedActions.includes('create_sale')) {
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
    agent: decision.intent === 'venta' ? 'capturista' : decision.intent === 'consulta_folio' ? 'consultor' : 'recepcionista',
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
  return {
    id: randomUUID(),
    folio: null,
    asesor_id: actor?.sub || actor?.uid || 'agente_whatsapp',
    asesor_nombre: actor?.nombre || actor?.name || 'Copiloto WhatsApp',
    status: 'pendiente',
    nombres: payload.nombre || null,
    apellidos: null,
    telefono: payload.telefono || null,
    direccion: payload.direccion || null,
    colonia: payload.colonia || null,
    municipio: null,
    tipo_cliente: null,
    tipo_servicio: null,
    plan: payload.paquete || null,
    renta_mensual: null,
    zona: payload.zona || null,
    notas: `Borrador aprobado desde ${item.channel}: ${item.target}`,
    fecha_solicitud: new Date().toISOString(),
    metadata: json({
      source: item.channel,
      conversationId: item.conversation_id,
      outboxId: item.id,
      sourceMessageId: payload.sourceMessageId || null,
      proposedBy: 'agent_orchestrator',
    }),
  };
}

export async function approveAgentOutbox(id: string, actor: any, sendMessage: SendChannelMessage) {
  const item = AgentOutbox.getById(id);
  if (!item) throw new Error('Elemento de outbox no encontrado');
  if (item.status !== 'pending_approval') throw new Error('Este elemento ya fue procesado');

  try {
    let result: any = null;
    if (item.type === 'reply') {
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
