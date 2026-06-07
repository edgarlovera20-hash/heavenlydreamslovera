// Main orchestration loop — imports from all handler modules

import { randomUUID } from 'node:crypto';
import {
  AgentDecisions,
  AgentOutbox,
  AgentProfiles,
  ChannelConversations,
  ChannelMessages,
  Metrics,
} from '../db';
import { runAiWithFallback } from '../enterprise';
import { answerWebQuestion, shouldUseWebSearch } from '../web-search';
import { findAgentVideoForQuestion } from '../agent-video-library';
import {
  type Intent,
  type AgentDecision,
  INTENTS,
  PROPOSED_ACTIONS,
  DEFAULT_ARIUX_MESSAGE,
  FIRST_CONTACT_INTRO,
  AI_DECISION_TIMEOUT_MS,
} from './types';
import {
  conversationAudience,
  profileIdForConversation,
  agentLabelForDecision,
  promoterFirstName,
  cleanPersonName,
  defaultProfileReply,
  getDesignerConfig,
  removeAccents,
  normalizedBody,
  isSimpleGreeting,
  isMediaSignal,
  messageMedia,
  audioTranscript,
  messageTextForUnderstanding,
  mergeMemory,
} from './memory';
import {
  buildFolioReply,
  extractFolioCandidate,
} from './siac-handler';
import {
  extractFields,
  extractCaptureFields,
  requiredMissing,
  buildSalesReply,
  buildCaptureDecision,
  extractEmail,
} from './validation-handler';

// ─── Metrics helper ───────────────────────────────────────────────────────────

function recordMetric(name: string, tags: any = {}) {
  try {
    Metrics.insert({ id: randomUUID(), name, value: 1, tags: JSON.stringify(tags || {}) });
  } catch {}
}

// ─── Personalization helpers ──────────────────────────────────────────────────

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

// ─── AI output parsing ────────────────────────────────────────────────────────

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

function normalizeActions(value: any) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item, index, list) => PROPOSED_ACTIONS.includes(item as any) && list.indexOf(item) === index) as AgentDecision['proposedActions'];
}

function cleanReply(value: any) {
  return stripVisibleThinking(String(value || '')).replace(/\s+\n/g, '\n').trim().slice(0, 900);
}

// ─── Profile macros ───────────────────────────────────────────────────────────

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

// ─── Promoter name extraction ─────────────────────────────────────────────────

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

// ─── Autonomous reply builder ─────────────────────────────────────────────────

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
    return `Ya recibí tu audio. Si no alcanzo a transcribirlo completo, mándame solo el dato clave: folio, cliente o trámite, y lo avanzo contigo.`;
  }
  if (lower.includes('video recibido')) {
    return `Ya tengo el video. ¿A qué cliente o folio lo relaciono?`;
  }
  if (/\bine\b|credencial|frente|reverso/i.test(text)) {
    return `Perfecto. Si es INE, mándame frente y reverso, y dime el nombre del cliente o folio para guardarlo bien.`;
  }
  return defaultProfileReply(profile);
}

// ─── Intent classification ────────────────────────────────────────────────────

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

// ─── Rule-based decision engine ───────────────────────────────────────────────

function decideWithRules(conversation: any, message: any): AgentDecision {
  const text = messageTextForUnderstanding(message);
  const rawText = String(message.body || '');
  const media = messageMedia(message);
  const transcript = audioTranscript(media);
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
    ...extractCaptureFields(text, conversation, media),
    ...(promoterName ? {
      promoterName: promoterName.fullName,
      promoterFirstName: promoterName.firstName,
      promoterNameConfirmed: true,
      promoterNameSource: promoterName.source,
    } : {}),
    ...(transcript ? {
      audioTranscript: transcript,
      audioTranscriptionStatus: media?.transcription?.status || 'completed',
      originalMessageBody: rawText,
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

// ─── AI decision prompt & parsing ────────────────────────────────────────────

function buildAiDecisionPrompt(conversation: any, message: any, rules: AgentDecision) {
  const audience = conversationAudience(conversation);
  const profile = AgentProfiles.getById(profileIdForConversation(conversation)) as any;
  const memory = conversation?.memory || {};
  const promoter = memory.promoter || {};
  const media = messageMedia(message);
  const transcript = audioTranscript(media);
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
- Si recibe audio con transcripcion, responde al contenido del audio como si lo hubieras escuchado. No pidas que lo escriba otra vez salvo que la transcripcion sea incompleta.
- Si recibe audio sin transcripcion, confirma que lo recibiste y pide solo el dato operativo necesario.
- Si recibe sticker o video, responde natural y pide el dato operativo que falta.
- Si el mensaje coincide con un macro activo del diseñador, respeta ese macro como respuesta base y conserva su intencion.
- Si no entiendes el mensaje, ofrece opciones: consultar folio, guardar expediente o iniciar captura.
- proposedActions solo puede usar: create_sale, update_lead, schedule_followup, escalate_human.

Perfil del agente:
${JSON.stringify({
    name: profile?.name || 'ARIUX',
    // Truncate free-text knowledge fields to avoid LLM context overflow
    selfKnowledge: String(profile?.selfKnowledge || '').slice(0, 1200),
    knowledgeBase: String(profile?.knowledgeBase || '').slice(0, 1200),
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
${JSON.stringify({
    // Only send operationally relevant memory slices to keep prompt size bounded
    promoter: memory.promoter,
    captureDraft: memory.captureDraft,
    knownFields: memory.knownFields,
    stage: memory.stage,
    summary: memory.summary,
    audience: memory.audience,
  })}

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

Audio transcrito:
${transcript ? transcript.slice(0, 2500) : 'N/D'}

Metadata del mensaje:
${JSON.stringify({
    ...(message.metadata || {}),
    audioTranscription: transcript ? {
      status: media?.transcription?.status,
      provider: media?.transcription?.provider,
      model: media?.transcription?.model,
      text: transcript,
    } : undefined,
  })}

Devuelve SOLO este JSON (sin markdown, sin texto fuera del objeto):
{
  "intent": "<uno de: venta | consulta_folio | soporte | morosidad | busqueda_web | otro>",
  "confidence": <numero entre 0.0 y 1.0>,
  "extractedFields": {
    "nombre": "<nombre completo del titular si esta en el mensaje, si no omitir o dejar vacio>",
    "telefono": "<telefono de 10 digitos si esta en el mensaje>",
    "direccion": "<direccion de instalacion si esta en el mensaje>",
    "colonia": "<colonia si esta en el mensaje>",
    "paquete": "<paquete o plan si esta en el mensaje>",
    "zona": "<zona si esta en el mensaje>",
    "folio": "<numero de folio si esta en el mensaje>"
  },
  "proposedReply": "<tu respuesta real en espanol mexicano, tono humano, max 2 oraciones>",
  "proposedActions": ["<solo de: create_sale | update_lead | schedule_followup | escalate_human>"]
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
    const sourceText = messageTextForUnderstanding(message);
    const folio = extractedFields.folio || sourceText.match(/\b([A-Z0-9]{5,}|\d{5,})\b/i)?.[1] || '';
    // Pass the raw folio value directly so extractFolioCandidate can parse it
    // without creating a "folio folio 12345" double-prefix when the value
    // already starts with the word "folio".
    const { reply, fields } = buildFolioReply(folio || sourceText);
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

// ─── Timeout helper ───────────────────────────────────────────────────────────

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

// ─── Main decision function ───────────────────────────────────────────────────

async function decide(conversation: any, message: any): Promise<AgentDecision> {
  const rules = decideWithRules(conversation, message);
  const text = messageTextForUnderstanding(message);
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

// ─── Next status helper ───────────────────────────────────────────────────────

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

// ─── Outbox builder ───────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runAgentForMessage(conversation: any, message: any) {
  if (!conversation || !message) return null;
  // Use the canonical DB record as source of truth for direction.
  // The in-memory `message` object may lack `direction` entirely (e.g. passed
  // from an in-flight webhook payload), which would make the stale guard below
  // silently pass even for outgoing messages.
  const dbMessage = ChannelMessages.getById(message.id);
  if (!dbMessage || dbMessage.direction !== 'incoming') return null;
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
    memory: mergeMemory(conversation, decision, nextStatus, agentLabelForDecision),
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
