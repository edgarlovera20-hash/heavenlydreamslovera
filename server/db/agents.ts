import { randomUUID } from 'crypto';
import { db, updateById, parseJson } from './connection';

export const AiJobs = {
  getAll: () => db.prepare('SELECT * FROM ai_jobs ORDER BY created_at DESC LIMIT 200').all(),
  create: (data: any) => db.prepare(`
    INSERT INTO ai_jobs (id,type,payload,status,priority,attempts,result,error)
    VALUES (@id,@type,@payload,@status,@priority,@attempts,@result,@error)
  `).run(data),
  next: () => db.prepare(`
    SELECT * FROM ai_jobs WHERE status='queued' ORDER BY priority ASC, created_at ASC LIMIT 1
  `).get(),
  update: (id: string, data: any) => {
    const fields = Object.keys(data).map(k => `${k}=@${k}`).join(',');
    return db.prepare(`UPDATE ai_jobs SET ${fields},updated_at=datetime('now') WHERE id=@id`).run({ ...data, id });
  },
};

function normalizeDecision(row: any) {
  return row ? {
    ...row,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    extractedFields: parseJson(row.extracted_fields, {}),
    proposedActions: parseJson(row.proposed_actions, []),
    requiresApproval: Boolean(row.requires_approval),
  } : null;
}

export const AgentDecisions = {
  getRecent: (limit = 100) => (db.prepare('SELECT * FROM agent_decisions ORDER BY created_at DESC LIMIT ?').all(limit) as any[]).map(normalizeDecision),
  getByMessage: (messageId: string) => normalizeDecision(db.prepare('SELECT * FROM agent_decisions WHERE message_id=? ORDER BY created_at DESC LIMIT 1').get(messageId)),
  getByConversation: (conversationId: string, limit = 100) => (db.prepare(
    'SELECT * FROM agent_decisions WHERE conversation_id=? ORDER BY created_at DESC LIMIT ?'
  ).all(conversationId, limit) as any[]).map(normalizeDecision),
  create: (data: any) => {
    db.prepare(`
      INSERT INTO agent_decisions
        (id,conversation_id,message_id,agent,intent,confidence,extracted_fields,proposed_reply,proposed_actions,requires_approval,status)
      VALUES
        (@id,@conversation_id,@message_id,@agent,@intent,@confidence,@extracted_fields,@proposed_reply,@proposed_actions,@requires_approval,@status)
    `).run({
      ...data,
      id: data.id || randomUUID(),
      confidence: Number(data.confidence || 0),
      extracted_fields: typeof data.extracted_fields === 'string' ? data.extracted_fields : JSON.stringify(data.extracted_fields || {}),
      proposed_actions: typeof data.proposed_actions === 'string' ? data.proposed_actions : JSON.stringify(data.proposed_actions || []),
      requires_approval: data.requires_approval === false ? 0 : 1,
      status: data.status || 'pending_approval',
    });
  },
};

export const AgentTasks = {
  getAll: (limit = 100) => db.prepare('SELECT * FROM agent_tasks ORDER BY created_at DESC LIMIT ?').all(limit),
  create: (data: any) => db.prepare(`
    INSERT INTO agent_tasks (id,conversation_id,type,title,status,due_at,assigned_to,metadata)
    VALUES (@id,@conversation_id,@type,@title,@status,@due_at,@assigned_to,@metadata)
  `).run({
    ...data,
    id: data.id || randomUUID(),
    status: data.status || 'open',
    metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
  }),
  update: (id: string, data: any) => updateById('agent_tasks', 'id', id, data, ['type', 'title', 'status', 'due_at', 'assigned_to', 'metadata']),
};

function normalizeAgentProfile(row: any) {
  return row ? {
    ...row,
    selfKnowledge: row.self_knowledge,
    knowledgeBase: row.knowledge_base,
    learnedNotes: parseJson(row.learned_notes, []),
    metadata: parseJson(row.metadata, {}),
  } : null;
}

const LEGACY_ARIUX_MESSAGE = 'Hola, soy ARIUX 🤖 asistente virtual de Heavenly Dreams ✨. Estoy aquí para ayudarte y servirte en consulta de folios 🔎, guardar expedientes 📁 e iniciar flujos de captura 📝. ¿Qué necesitas hoy?';
const DEFAULT_ARIUX_MESSAGE = 'Hola, dime qué necesitas y lo revisamos. Puedo ayudarte con folios, expedientes o una captura nueva.';
const FIRST_CONTACT_ARIUX_MESSAGE = 'Hola, buen día. Te ayudo con folios, expedientes o capturas. ¿Con qué nombre te registro para ubicarte mejor?';
const LEGACY_RECEPTIONIST_SELF_KNOWLEDGE = 'Soy ARIUX, el agente de WhatsApp y Telegram para promotores de Heavenly Dreams. Ayudo a consultar datos, iniciar conversaciones y ordenar informacion antes de pasarla al flujo operativo.';
const LEGACY_RECEPTIONIST_KNOWLEDGE_BASE = 'Para nuevo cliente debo pedir nombre, telefono, direccion, colonia, paquete de interes y documentos. Para folios debo pedir el folio SIAC y devolver el estatus disponible. Si falta informacion, hago preguntas cortas y concretas.';
const DEFAULT_AGENT_FUNCTIONS = [
  {
    id: 'consulta_folios',
    emoji: '🔎',
    title: 'Consulta de folios',
    description: 'Pedir folio SIAC, buscar estatus disponible y responder con el siguiente paso.',
    enabled: true,
  },
  {
    id: 'guardar_expedientes',
    emoji: '📁',
    title: 'Guardar expedientes',
    description: 'Ordenar documentos, imagenes, PDF y datos recibidos antes de pasarlos al flujo operativo.',
    enabled: true,
  },
  {
    id: 'iniciar_captura',
    emoji: '📝',
    title: 'Iniciar flujos de captura',
    description: 'Recolectar nombre, telefono, direccion, colonia, paquete y documentos para nueva venta.',
    enabled: true,
  },
  {
    id: 'seguimiento_chat',
    emoji: '💬',
    title: 'Atencion por chat',
    description: 'Responder dudas por WhatsApp o Telegram con tono claro, cordial y accionable.',
    enabled: true,
  },
  {
    id: 'info_telmex',
    emoji: '🌐',
    title: 'Info Telmex',
    description: 'Consultar Telmex Hogar/Negocio, paquetes, beneficios, promociones, fibra y mapas de cobertura desde fuentes oficiales.',
    enabled: true,
  },
  {
    id: 'rutas_google_maps',
    emoji: '🗺️',
    title: 'Rutas Google Maps',
    description: 'Generar rutas para llegar a colonias o zonas por auto, transporte publico, caminando o bicicleta.',
    enabled: true,
  },
];

const DEFAULT_RECEPTIONIST_PROFILE = {
  id: 'promoter_receptionist',
  name: 'ARIUX',
  role: 'Agente de promotores',
  personality: 'Cordial, claro, rapido y humano. Escribe como alguien del equipo de campo por WhatsApp: natural, atento y sin sonar a bot.',
  self_knowledge: FIRST_CONTACT_ARIUX_MESSAGE,
  knowledge_base: 'Funciones activas: 🔎 consultar folios SIAC, 📁 guardar expedientes, 📝 iniciar captura de venta, 💬 orientar por WhatsApp o Telegram, 🌐 consultar informacion oficial de Telmex Hogar/Negocio/cobertura y 🗺️ crear rutas con Google Maps. Para nuevo cliente debo pedir nombre, telefono, direccion, colonia, paquete de interes y documentos. Para folios debo pedir el folio SIAC y devolver el estatus disponible. Para Telmex puedo responder paquetes, beneficios, precios, promociones, fibra optica y mapas de cobertura desde fuentes oficiales. Para rutas debo pedir origen y destino si falta informacion. Si falta informacion, hago preguntas cortas y concretas.',
  learned_notes: JSON.stringify([]),
  metadata: JSON.stringify({
    audience: 'promotores',
    channel: 'whatsapp_telegram',
    whatsappAccount: 'promotores',
    phonePurpose: 'numero exclusivo para promotores',
    defaultMessage: DEFAULT_ARIUX_MESSAGE,
    firstContactMessage: FIRST_CONTACT_ARIUX_MESSAGE,
    functions: DEFAULT_AGENT_FUNCTIONS,
    humor: 'Ligero y respetuoso; solo usa humor cuando ayuda a bajar tension.',
    naturalHumanStyle: true,
    responseStyle: 'Responde como persona: breve, cercano, con frases naturales como "va", "claro", "lo reviso" o "me pasas". No digas que eres bot ni asistente virtual.',
  }),
};

const DEFAULT_CUSTOMER_SUPPORT_PROFILE = {
  id: 'customer_support_agent',
  name: 'ARIA',
  role: 'Agente de atencion al cliente',
  personality: 'Cordial, empatica, clara y resolutiva. Escribe como una persona real de atencion al cliente, cercana y sin sonar automatizada.',
  self_knowledge: 'Soy parte del equipo de atencion al cliente de Heavenly Dreams. Ayudo con dudas de servicio, soporte, seguimiento, pagos y orientacion general.',
  knowledge_base: 'Atiendo clientes finales. No debo iniciar flujos internos de promotores ni pedir datos de captura salvo que sean necesarios para soporte. Si el cliente reporta falla, pago, instalacion, seguimiento o duda de servicio, doy pasos claros y escalo cuando corresponda. Si existe un video de apoyo por tema, puedo recomendarlo para explicar mejor.',
  learned_notes: JSON.stringify([]),
  metadata: JSON.stringify({
    audience: 'clientes',
    channel: 'whatsapp_clientes',
    whatsappAccount: 'clientes',
    phonePurpose: 'numero exclusivo para atencion al cliente',
    defaultMessage: 'Hola, claro. Cuéntame qué necesitas revisar de tu servicio y te ayudo.',
    functions: [
      {
        id: 'soporte_clientes',
        emoji: '🛠️',
        title: 'Soporte a clientes',
        description: 'Atender dudas, fallas y seguimiento de clientes finales.',
        enabled: true,
      },
      {
        id: 'videos_ayuda',
        emoji: '🎥',
        title: 'Videos de ayuda',
        description: 'Responder dudas y enviar videos asociados por tema.',
        enabled: true,
      },
      {
        id: 'morosidad_clientes',
        emoji: '💳',
        title: 'Pagos y morosidad',
        description: 'Orientar sobre pagos, saldos y promesas de pago sin mezclar promotores.',
        enabled: true,
      },
    ],
    naturalHumanStyle: true,
    responseStyle: 'Responde como persona de atencion: amable, simple y directa. No digas que eres bot ni uses frases corporativas.',
  }),
};

export const AgentProfiles = {
  getAll: () => {
    AgentProfiles.getById(DEFAULT_RECEPTIONIST_PROFILE.id);
    AgentProfiles.getById(DEFAULT_CUSTOMER_SUPPORT_PROFILE.id);
    return (db.prepare('SELECT * FROM agent_profiles ORDER BY updated_at DESC, created_at DESC').all() as any[]).map(normalizeAgentProfile);
  },
  getById: (id: string) => {
    let row = db.prepare('SELECT * FROM agent_profiles WHERE id=?').get(id) as any;
    if (row && id === DEFAULT_RECEPTIONIST_PROFILE.id && String(row.name || '').trim().toLowerCase() === 'agente heavenly') {
      const existing = normalizeAgentProfile(row) as any;
      AgentProfiles.upsert({
        id,
        name: DEFAULT_RECEPTIONIST_PROFILE.name,
        role: DEFAULT_RECEPTIONIST_PROFILE.role,
        personality: existing?.personality || DEFAULT_RECEPTIONIST_PROFILE.personality,
        selfKnowledge: existing?.selfKnowledge || DEFAULT_RECEPTIONIST_PROFILE.self_knowledge,
        knowledgeBase: existing?.knowledgeBase || DEFAULT_RECEPTIONIST_PROFILE.knowledge_base,
        learnedNotes: existing?.learnedNotes || [],
        metadata: {
          ...parseJson(DEFAULT_RECEPTIONIST_PROFILE.metadata, {}),
          ...(existing?.metadata || {}),
          migratedFrom: 'Agente Heavenly',
        },
      });
      row = db.prepare('SELECT * FROM agent_profiles WHERE id=?').get(id) as any;
    }
    if (row && id === DEFAULT_RECEPTIONIST_PROFILE.id) {
      const existing = normalizeAgentProfile(row) as any;
      const metadata = existing?.metadata || {};
      const currentFunctions = Array.isArray(metadata.functions) ? metadata.functions : [];
      const missingDefaultFunctions = DEFAULT_AGENT_FUNCTIONS.filter(defaultItem => (
        !currentFunctions.some((item: any) => item?.id === defaultItem.id)
      ));
      const needsDefaultMessage = !metadata.defaultMessage || metadata.defaultMessage === LEGACY_ARIUX_MESSAGE || /hola,\s*soy\s*ariux/i.test(String(metadata.defaultMessage || ''));
      const needsDefaultFunctions = !Array.isArray(metadata.functions) || missingDefaultFunctions.length > 0;
      const needsHumanStyle = metadata.naturalHumanStyle !== true || /asistente virtual|agente inteligente|soy ariux/i.test(String(metadata.defaultMessage || ''));
      const needsLegacySelfKnowledge = String(existing?.selfKnowledge || '').trim() === LEGACY_RECEPTIONIST_SELF_KNOWLEDGE;
      const needsLegacyKnowledgeBase = String(existing?.knowledgeBase || '').trim() === LEGACY_RECEPTIONIST_KNOWLEDGE_BASE;
      const needsTelmexKnowledge = !/telmex/i.test(String(existing?.knowledgeBase || '')) || !/google maps|rutas/i.test(String(existing?.knowledgeBase || ''));
      if (needsDefaultMessage || needsDefaultFunctions || needsHumanStyle || needsLegacySelfKnowledge || needsLegacyKnowledgeBase || needsTelmexKnowledge) {
        AgentProfiles.upsert({
          id,
          name: existing?.name || DEFAULT_RECEPTIONIST_PROFILE.name,
          role: existing?.role || DEFAULT_RECEPTIONIST_PROFILE.role,
          personality: existing?.personality || DEFAULT_RECEPTIONIST_PROFILE.personality,
          selfKnowledge: needsLegacySelfKnowledge ? DEFAULT_RECEPTIONIST_PROFILE.self_knowledge : existing?.selfKnowledge,
          knowledgeBase: needsLegacyKnowledgeBase
            ? DEFAULT_RECEPTIONIST_PROFILE.knowledge_base
            : needsTelmexKnowledge
              ? `${existing?.knowledgeBase || DEFAULT_RECEPTIONIST_PROFILE.knowledge_base} Tambien puedo consultar informacion oficial de Telmex Hogar/Negocio, fibra, mapas de cobertura y crear rutas con Google Maps.`
              : existing?.knowledgeBase,
          learnedNotes: existing?.learnedNotes || [],
          metadata: {
            ...parseJson(DEFAULT_RECEPTIONIST_PROFILE.metadata, {}),
            ...metadata,
            naturalHumanStyle: true,
            defaultMessage: needsDefaultMessage || needsHumanStyle ? DEFAULT_ARIUX_MESSAGE : metadata.defaultMessage,
            firstContactMessage: metadata.firstContactMessage || FIRST_CONTACT_ARIUX_MESSAGE,
            responseStyle: needsHumanStyle ? parseJson(DEFAULT_RECEPTIONIST_PROFILE.metadata, {}).responseStyle : metadata.responseStyle,
            functions: Array.isArray(metadata.functions) ? [...metadata.functions, ...missingDefaultFunctions] : DEFAULT_AGENT_FUNCTIONS,
          },
        });
        row = db.prepare('SELECT * FROM agent_profiles WHERE id=?').get(id) as any;
      }
    }
    if (row && id === DEFAULT_CUSTOMER_SUPPORT_PROFILE.id) {
      const existing = normalizeAgentProfile(row) as any;
      const metadata = existing?.metadata || {};
      const defaultCustomerMetadata = parseJson(DEFAULT_CUSTOMER_SUPPORT_PROFILE.metadata, {});
      const needsHumanStyle = metadata.naturalHumanStyle !== true || /bot|asistente virtual|soy aria/i.test(String(metadata.defaultMessage || ''));
      if (needsHumanStyle) {
        AgentProfiles.upsert({
          id,
          name: existing?.name || DEFAULT_CUSTOMER_SUPPORT_PROFILE.name,
          role: existing?.role || DEFAULT_CUSTOMER_SUPPORT_PROFILE.role,
          personality: existing?.personality || DEFAULT_CUSTOMER_SUPPORT_PROFILE.personality,
          selfKnowledge: /bot|agente de atencion/i.test(String(existing?.selfKnowledge || ''))
            ? DEFAULT_CUSTOMER_SUPPORT_PROFILE.self_knowledge
            : existing?.selfKnowledge,
          knowledgeBase: existing?.knowledgeBase || DEFAULT_CUSTOMER_SUPPORT_PROFILE.knowledge_base,
          learnedNotes: existing?.learnedNotes || [],
          metadata: {
            ...defaultCustomerMetadata,
            ...metadata,
            naturalHumanStyle: true,
            defaultMessage: defaultCustomerMetadata.defaultMessage,
            responseStyle: defaultCustomerMetadata.responseStyle,
          },
        });
        row = db.prepare('SELECT * FROM agent_profiles WHERE id=?').get(id) as any;
      }
    }
    if (row) return normalizeAgentProfile(row);
    if (id === DEFAULT_RECEPTIONIST_PROFILE.id) {
      AgentProfiles.upsert(DEFAULT_RECEPTIONIST_PROFILE);
      return normalizeAgentProfile(db.prepare('SELECT * FROM agent_profiles WHERE id=?').get(id));
    }
    if (id === DEFAULT_CUSTOMER_SUPPORT_PROFILE.id) {
      AgentProfiles.upsert(DEFAULT_CUSTOMER_SUPPORT_PROFILE);
      return normalizeAgentProfile(db.prepare('SELECT * FROM agent_profiles WHERE id=?').get(id));
    }
    return null;
  },
  upsert: (data: any) => {
    const clean = {
      id: data.id,
      name: data.name || DEFAULT_RECEPTIONIST_PROFILE.name,
      role: data.role || DEFAULT_RECEPTIONIST_PROFILE.role,
      personality: data.personality || '',
      self_knowledge: data.self_knowledge ?? data.selfKnowledge ?? '',
      knowledge_base: data.knowledge_base ?? data.knowledgeBase ?? '',
      learned_notes: typeof data.learned_notes === 'string'
        ? data.learned_notes
        : JSON.stringify(data.learnedNotes || data.learned_notes || []),
      metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
    };
    return db.prepare(`
      INSERT INTO agent_profiles
        (id,name,role,personality,self_knowledge,knowledge_base,learned_notes,metadata)
      VALUES
        (@id,@name,@role,@personality,@self_knowledge,@knowledge_base,@learned_notes,@metadata)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        role=excluded.role,
        personality=excluded.personality,
        self_knowledge=excluded.self_knowledge,
        knowledge_base=excluded.knowledge_base,
        learned_notes=excluded.learned_notes,
        metadata=excluded.metadata,
        updated_at=datetime('now')
    `).run(clean);
  },
  update: (id: string, data: any) => {
    const existing = AgentProfiles.getById(id) as any;
    if (!existing) return null;
    AgentProfiles.upsert({
      id,
      name: data.name ?? existing.name,
      role: data.role ?? existing.role,
      personality: data.personality ?? existing.personality,
      selfKnowledge: data.selfKnowledge ?? data.self_knowledge ?? existing.selfKnowledge,
      knowledgeBase: data.knowledgeBase ?? data.knowledge_base ?? existing.knowledgeBase,
      learnedNotes: data.learnedNotes ?? data.learned_notes ?? existing.learnedNotes ?? [],
      metadata: data.metadata ?? existing.metadata ?? {},
    });
    return AgentProfiles.getById(id);
  },
  delete: (id: string) => db.prepare('DELETE FROM agent_profiles WHERE id=?').run(id),
};

function normalizeOutbox(row: any) {
  return row ? {
    ...row,
    conversationId: row.conversation_id,
    decisionId: row.decision_id,
    payload: parseJson(row.payload, {}),
    result: parseJson(row.result, null),
  } : null;
}

export const AgentOutbox = {
  getAll: (limit = 200) => (db.prepare(`
    SELECT o.*, c.display_name, c.intent
    FROM agent_outbox o
    LEFT JOIN channel_conversations c ON c.id=o.conversation_id
    ORDER BY CASE o.status WHEN 'pending_approval' THEN 0 ELSE 1 END, o.created_at DESC
    LIMIT ?
  `).all(limit) as any[]).map(normalizeOutbox),
  getByConversation: (conversationId: string, limit = 100) => (db.prepare(
    'SELECT * FROM agent_outbox WHERE conversation_id=? ORDER BY created_at DESC LIMIT ?'
  ).all(conversationId, limit) as any[]).map(normalizeOutbox),
  getById: (id: string) => normalizeOutbox(db.prepare('SELECT * FROM agent_outbox WHERE id=?').get(id)),
  create: (data: any) => {
    const id = data.id || randomUUID();
    db.prepare(`
      INSERT INTO agent_outbox
        (id,conversation_id,decision_id,type,status,channel,target,message,action,payload,result,error)
      VALUES
        (@id,@conversation_id,@decision_id,@type,@status,@channel,@target,@message,@action,@payload,@result,@error)
    `).run({
      ...data,
      id,
      status: data.status || 'pending_approval',
      payload: typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload || {}),
      result: data.result == null ? null : typeof data.result === 'string' ? data.result : JSON.stringify(data.result),
      error: data.error || null,
    });
    return AgentOutbox.getById(id);
  },
  update: (id: string, data: any) => {
    const update = { ...data };
    if (Object.prototype.hasOwnProperty.call(update, 'payload') && typeof update.payload !== 'string') update.payload = JSON.stringify(update.payload || {});
    if (Object.prototype.hasOwnProperty.call(update, 'result') && typeof update.result !== 'string') update.result = JSON.stringify(update.result || null);
    return updateById('agent_outbox', 'id', id, update, ['status', 'message', 'action', 'payload', 'result', 'error', 'approved_by', 'approved_at', 'rejected_by', 'rejected_at']);
  },
};

export const AutomationRules = {
  getAll: () => db.prepare('SELECT * FROM automation_rules ORDER BY created_at DESC').all(),
  getEnabledByEvent: (event: string) => db.prepare(
    'SELECT * FROM automation_rules WHERE enabled=1 AND event=? ORDER BY created_at DESC'
  ).all(event),
  create: (data: any) => db.prepare(`
    INSERT INTO automation_rules (id,name,event,conditions,actions,enabled)
    VALUES (@id,@name,@event,@conditions,@actions,@enabled)
  `).run(data),
  update: (id: string, data: any) => updateById('automation_rules', 'id', id, data, ['name', 'event', 'conditions', 'actions', 'enabled']),
  delete: (id: string) => db.prepare('DELETE FROM automation_rules WHERE id=?').run(id),
};
