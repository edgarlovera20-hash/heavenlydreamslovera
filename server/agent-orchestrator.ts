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

type Intent = 'venta' | 'consulta_folio' | 'soporte' | 'morosidad' | 'otro';
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
const INTENTS: Intent[] = ['venta', 'consulta_folio', 'soporte', 'morosidad', 'otro'];
const PROPOSED_ACTIONS: ProposedAction[] = ['create_sale', 'update_lead', 'schedule_followup', 'escalate_human'];

function json(value: any) {
  return JSON.stringify(value ?? {});
}

function recordMetric(name: string, tags: any = {}) {
  try {
    Metrics.insert({ id: randomUUID(), name, value: 1, tags: JSON.stringify(tags || {}) });
  } catch {}
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

function classifyIntent(text: string): { intent: Intent; confidence: number } {
  const body = text.toLowerCase();
  if (/\b(folio|consulta|estatus|siac|mi folio)\b/.test(body)) return { intent: 'consulta_folio', confidence: 0.88 };
  if (/\b(contratar|quiero internet|paquete|cobertura|fibra|instalar|servicio|alta)\b/.test(body)) return { intent: 'venta', confidence: 0.86 };
  if (/\b(pagar|adeudo|debo|atraso|promesa|liquido|cobranza)\b/.test(body)) return { intent: 'morosidad', confidence: 0.8 };
  if (/\b(falla|soporte|ayuda|problema|no funciona|queja)\b/.test(body)) return { intent: 'soporte', confidence: 0.78 };
  if (body.includes('nombre:') && (body.includes('tel:') || body.includes('telefono:') || body.includes('teléfono:'))) return { intent: 'venta', confidence: 0.92 };
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

function buildFolioReply(text: string) {
  const folio = text.match(/\b([A-Z0-9]{5,}|\d{5,})\b/i)?.[1];
  if (!folio) return { reply: 'Enviame el numero de folio para consultar. Ejemplo: folio 123456', fields: {} };
  const record = SiacRecords.getByFolio(folio) as any;
  if (!record) return { reply: `No encontre el folio ${folio}. Puedo escalarlo a un asesor para revision.`, fields: { folio } };
  return {
    reply: `Folio ${record.folio_siac}\nEstatus: ${record.estatus_siac || 'N/D'}\nPromotora: ${record.promotor || 'N/D'}\nFecha captura: ${record.fecha_captura || 'N/D'}\nPaquete: ${record.paquete || 'N/D'}`,
    fields: { folio, found: true },
  };
}

function decideWithRules(conversation: any, message: any): AgentDecision {
  const text = String(message.body || '');
  const { intent, confidence } = classifyIntent(text);
  const fields = extractFields(text, conversation);

  if (intent === 'venta') {
    const missing = requiredMissing(fields);
    return {
      intent,
      confidence,
      extractedFields: { ...fields, missing },
      proposedReply: buildSalesReply(fields, missing),
      proposedActions: missing.length ? ['update_lead'] : ['create_sale', 'schedule_followup'],
      requiresApproval: true,
    };
  }

  if (intent === 'consulta_folio') {
    const { reply, fields: folioFields } = buildFolioReply(text);
    return {
      intent,
      confidence,
      extractedFields: { ...fields, ...folioFields },
      proposedReply: reply,
      proposedActions: folioFields.found ? [] : ['escalate_human'],
      requiresApproval: true,
    };
  }

  if (intent === 'soporte' || intent === 'morosidad') {
    return {
      intent,
      confidence,
      extractedFields: fields,
      proposedReply: 'Recibimos tu mensaje. Un asesor revisara tu caso y te dara seguimiento.',
      proposedActions: ['escalate_human'],
      requiresApproval: true,
    };
  }

  return {
    intent,
    confidence,
    extractedFields: fields,
    proposedReply: (() => {
      const profile = AgentProfiles.getById('promoter_receptionist') as any;
      const learned = (profile?.learnedNotes || []).slice(0, 2).join(' ');
      return `Hola, soy ${profile?.name || 'ARIUX'}. ${profile?.selfKnowledge || 'Recibo a los promotores de Heavenly Dreams.'} ${profile?.knowledgeBase || 'Puedo ayudarte con contrataciones, folios y soporte.'} ${learned}`.trim();
    })(),
    proposedActions: [],
    requiresApproval: true,
  };
}

function stripVisibleThinking(value: string) {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*\/?no_think\s*/i, '')
    .trim();
}

function parseModelJson(output: string) {
  const clean = stripVisibleThinking(output);
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
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

function buildQwenDecisionPrompt(conversation: any, message: any, rules: AgentDecision) {
  const profile = AgentProfiles.getById('promoter_receptionist') as any;
  const memory = conversation?.memory || {};
  return `/no_think
Analiza el mensaje entrante para Heavenly Dreams CRM.

Reglas:
- Responde SOLO JSON valido, sin markdown y sin explicaciones.
- No inventes folios, telefonos, nombres, paquetes ni direcciones.
- Todas las acciones requieren aprobacion humana aunque el JSON diga lo contrario.
- Si el cliente pide estatus/folio/SIAC, usa intent "consulta_folio".
- Si quiere contratar, instalar, cotizar o pasar datos de venta, usa intent "venta".
- Si habla de falla o queja, usa intent "soporte".
- Si habla de adeudo/pago/promesa de pago, usa intent "morosidad".
- proposedActions solo puede usar: create_sale, update_lead, schedule_followup, escalate_human.

Perfil del agente:
${JSON.stringify({
    name: profile?.name || 'ARIUX',
    selfKnowledge: profile?.selfKnowledge || '',
    knowledgeBase: profile?.knowledgeBase || '',
    learnedNotes: (profile?.learnedNotes || []).slice(0, 6),
  })}

Memoria de conversacion:
${JSON.stringify(memory)}

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

Devuelve exactamente:
{
  "intent": "venta|consulta_folio|soporte|morosidad|otro",
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

function decisionFromModel(rules: AgentDecision, modelPayload: any, ai: { provider?: string; model?: string; errors?: string[] }, message: any): AgentDecision {
  const intent = normalizeIntent(modelPayload?.intent, rules.intent);
  const modelFields = typeof modelPayload?.extractedFields === 'object' && modelPayload.extractedFields
    ? modelPayload.extractedFields
    : typeof modelPayload?.fields === 'object' && modelPayload.fields
      ? modelPayload.fields
      : {};
  const extractedFields: Record<string, any> = {
    ...rules.extractedFields,
    ...Object.fromEntries(Object.entries(modelFields).filter(([, value]) => value != null && String(value).trim() !== '')),
    _ai: { provider: ai.provider || 'ollama', model: ai.model || 'qwen3', mode: 'qwen3' },
  };

  if (intent === 'consulta_folio') {
    const folio = extractedFields.folio || String(message.body || '').match(/\b([A-Z0-9]{5,}|\d{5,})\b/i)?.[1] || '';
    const { reply, fields } = buildFolioReply(folio ? `folio ${folio}` : String(message.body || ''));
    return {
      intent,
      confidence: clampConfidence(modelPayload?.confidence, Math.max(rules.confidence, 0.88)),
      extractedFields: { ...extractedFields, ...fields },
      proposedReply: reply,
      proposedActions: fields.found ? [] : ['escalate_human'],
      requiresApproval: true,
    };
  }

  if (intent === 'venta') {
    const missing = requiredMissing(extractedFields);
    extractedFields.missing = missing;
    const actions = normalizeActions(modelPayload?.proposedActions);
    return {
      intent,
      confidence: clampConfidence(modelPayload?.confidence, rules.confidence),
      extractedFields,
      proposedReply: cleanReply(modelPayload?.proposedReply) || buildSalesReply(extractedFields, missing),
      proposedActions: actions.length ? actions : (missing.length ? ['update_lead'] : ['create_sale', 'schedule_followup']),
      requiresApproval: true,
    };
  }

  const actions = normalizeActions(modelPayload?.proposedActions);
  return {
    intent,
    confidence: clampConfidence(modelPayload?.confidence, rules.confidence),
    extractedFields,
    proposedReply: cleanReply(modelPayload?.proposedReply) || rules.proposedReply,
    proposedActions: actions.length ? actions : (intent === 'soporte' || intent === 'morosidad' ? ['escalate_human'] : []),
    requiresApproval: true,
  };
}

async function decide(conversation: any, message: any): Promise<AgentDecision> {
  const rules = decideWithRules(conversation, message);
  try {
    const ai = await runAiWithFallback(buildQwenDecisionPrompt(conversation, message, rules));
    const parsed = parseModelJson(ai.output);
    if (!parsed) throw new Error('Qwen no devolvio JSON valido');
    return decisionFromModel(rules, parsed, ai, message);
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
  if (decision.intent === 'venta') {
    const missing = decision.extractedFields.missing || [];
    return missing.length ? 'datos_incompletos' : 'captura_pendiente_aprobacion';
  }
  if (decision.intent === 'consulta_folio') return 'seguimiento';
  return 'calificando';
}

function mergeMemory(conversation: any, decision: AgentDecision) {
  const previous = conversation?.memory || {};
  const knownFields = {
    ...(previous.knownFields || {}),
    ...Object.fromEntries(Object.entries(decision.extractedFields).filter(([key]) => key !== 'missing')),
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
