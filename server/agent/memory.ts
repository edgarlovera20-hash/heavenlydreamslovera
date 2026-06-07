// Memory and conversation context management

import { type AgentDecision, DEFAULT_ARIUX_MESSAGE, LEGACY_ARIUX_MESSAGE } from './types';
import { type AgentVideoAudience } from '../agent-video-library';

export function json(value: any) {
  return JSON.stringify(value ?? {});
}

export function recordMetric(name: string, tags: any = {}) {
  // Metrics import is deferred to avoid circular deps — caller passes the Metrics db handle
  // This is a re-export shim; actual insertion happens via the imported Metrics in core.ts
  void name; void tags;
  throw new Error('Use recordMetricWith(Metrics, name, tags) instead');
}

export function cleanPersonName(value: any) {
  const name = String(value || '')
    .replace(/@s\.whatsapp\.net|@g\.us/gi, '')
    .replace(/^(promotores|clientes):/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name && /[a-záéíóúñ]/i.test(name) ? name : null;
}

export function promoterFirstName(conversation: any) {
  const memory = conversation?.memory || {};
  const promoter = memory.promoter || {};
  const source = promoter.nameConfirmed
    ? cleanPersonName(promoter.preferredName) || cleanPersonName(promoter.firstName) || cleanPersonName(promoter.fullName)
    : null;
  return source?.split(/\s+/)[0] || null;
}

export function conversationAudience(conversation: any): AgentVideoAudience {
  const memory = conversation?.memory || {};
  const raw = `${conversation?.external_chat_id || ''} ${memory.account || ''} ${memory.promoter?.account || ''}`.toLowerCase();
  if (raw.includes('clientes:') || /\bclientes?\b/.test(raw)) return 'clientes';
  return 'promotores';
}

export function profileIdForConversation(conversation: any) {
  return conversationAudience(conversation) === 'clientes' ? 'customer_support_agent' : 'promoter_receptionist';
}

export function agentLabelForDecision(conversation: any, decision: AgentDecision) {
  if (conversationAudience(conversation) === 'clientes') return 'atencion_cliente';
  return decision.intent === 'venta' ? 'capturista' : decision.intent === 'consulta_folio' ? 'consultor' : 'recepcionista_promotores';
}

export function defaultProfileReply(profile: any) {
  const configured = String(profile?.metadata?.defaultMessage || '').trim();
  if (!configured || configured === LEGACY_ARIUX_MESSAGE || /hola,\s*soy\s*ariux/i.test(configured)) return DEFAULT_ARIUX_MESSAGE;
  return configured;
}

export function getDesignerConfig(profile: any) {
  const metadata = profile?.metadata || {};
  return metadata.agentDesigner && typeof metadata.agentDesigner === 'object'
    ? metadata.agentDesigner
    : {};
}

export function removeAccents(value: string) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizedBody(text: string) {
  return removeAccents(String(text || '')).toLowerCase();
}

export function isSimpleGreeting(text: string) {
  const normalized = String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  return /^(hola|holi|buenos dias|buen dia|buenas tardes|buenas noches|buenas|hi|hello|hey|\/start|\/star|\/inicio|\/inicios)$/.test(normalized);
}

export function isAffirmative(text: string) {
  return /^(si|sí|ok|okay|vale|va|correcto|claro|adelante|inicia|iniciar|empezar|dale|hazlo)\b/i.test(normalizedBody(text).trim());
}

export function isNegative(text: string) {
  return /^(no|negativo|despues|luego|aun no|todavia no)\b/i.test(normalizedBody(text).trim());
}

export function isMediaSignal(text: string) {
  return /^\[(sticker|imagen|documento|audio|video|contacto|ubicacion|mensaje recibido sin texto)/i.test(String(text || '').trim());
}

export function messageMedia(message: any) {
  const media = message?.metadata?.media;
  return media && typeof media === 'object' ? media : null;
}

export function audioTranscript(media: any) {
  const text = media?.transcription?.text;
  return typeof text === 'string' && text.trim() ? text.trim() : '';
}

export function messageTextForUnderstanding(message: any) {
  const raw = String(message?.body || '');
  const transcript = audioTranscript(messageMedia(message));
  return transcript ? `${transcript}\n[transcripcion de audio]` : raw;
}

export function mergeMemory(conversation: any, decision: AgentDecision, nextStatusFn: (d: AgentDecision) => string, agentLabelFn: (c: any, d: AgentDecision) => string) {
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
    stage: nextStatusFn(decision),
    lastAgent: agentLabelFn(conversation, decision),
    nextAction: decision.proposedActions.length ? decision.proposedActions.join(',') : 'responder',
    updatedAt: new Date().toISOString(),
  };
}
