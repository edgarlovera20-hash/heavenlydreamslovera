// Shared types and constants for the agent orchestrator

export type Intent = 'venta' | 'consulta_folio' | 'soporte' | 'morosidad' | 'busqueda_web' | 'otro';
export type ProposedAction = 'create_sale' | 'update_lead' | 'schedule_followup' | 'escalate_human';

export interface AgentDecision {
  intent: Intent;
  confidence: number;
  extractedFields: Record<string, any>;
  proposedReply?: string;
  proposedActions: ProposedAction[];
  requiresApproval: true;
}

export type SendChannelMessage = (channel: string, target: string, message: string, payload?: any) => Promise<any>;

export const INTENTS: Intent[] = ['venta', 'consulta_folio', 'soporte', 'morosidad', 'busqueda_web', 'otro'];
export const PROPOSED_ACTIONS: ProposedAction[] = ['create_sale', 'update_lead', 'schedule_followup', 'escalate_human'];
export const LEGACY_ARIUX_MESSAGE = 'Hola, soy ARIUX 🤖 asistente virtual de Heavenly Dreams ✨. Estoy aquí para ayudarte y servirte en consulta de folios 🔎, guardar expedientes 📁 e iniciar flujos de captura 📝. ¿Qué necesitas hoy?';
export const DEFAULT_ARIUX_MESSAGE = 'Hola, dime qué necesitas y lo revisamos. Puedo ayudarte con folios, expedientes o una captura nueva.';
export const FIRST_CONTACT_INTRO = 'Hola, buen día. Te ayudo con folios, expedientes o capturas. ¿Con qué nombre te registro para ubicarte mejor?';
export const AI_DECISION_TIMEOUT_MS = Math.max(3000, Number(process.env.AGENT_AI_TIMEOUT_MS || 45000));
