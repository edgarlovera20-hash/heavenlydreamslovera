import type { AiAgentModule, AiRiskLevel } from "../ai-engine.interface.ts";

export interface HdAgentDefinition {
  id: string;
  name: string;
  module: AiAgentModule;
  description: string;
  riskLevel: AiRiskLevel;
  allowedRoles: string[];
  tools: string[];
  requiresApproval: boolean;
  canWriteData: boolean;
  canSendMessages: boolean;
  canAccessFiles: boolean;
  canAccessEmail: boolean;
  enabled: boolean;
  systemPromptFile: string;
}

export const HEAVENLY_AGENTS: HdAgentDefinition[] = [
  {
    id: "recruitment_evaluator",
    name: "Agente Evaluador de Candidatos",
    module: "recruitment",
    description: "Analiza candidatos: score, resumen, riesgos y preguntas de entrevista.",
    riskLevel: "medium",
    allowedRoles: ["admin", "rh", "supervisor"],
    tools: ["crm.read", "crm.write", "memory.read", "memory.write"],
    requiresApproval: false,
    canWriteData: true,
    canSendMessages: false,
    canAccessFiles: false,
    canAccessEmail: false,
    enabled: true,
    systemPromptFile: "recruitment-evaluator.prompt.md",
  },
  {
    id: "whatsapp_recruitment",
    name: "Agente WhatsApp Reclutamiento",
    module: "whatsapp",
    description: "Sugiere mensajes WhatsApp para candidatos. Aprobación humana obligatoria.",
    riskLevel: "medium",
    allowedRoles: ["admin", "rh"],
    tools: ["whatsapp.send", "crm.read"],
    requiresApproval: true,
    canWriteData: false,
    canSendMessages: true,
    canAccessFiles: false,
    canAccessEmail: false,
    enabled: true,
    systemPromptFile: "whatsapp-recruitment.prompt.md",
  },
  {
    id: "siac_excel",
    name: "Agente SIAC / Excel",
    module: "siac",
    description: "Detecta columnas equivalentes, valida folios, sugiere normalización.",
    riskLevel: "high",
    allowedRoles: ["admin", "operations"],
    tools: ["files.read", "excel.process", "memory.write"],
    requiresApproval: true,
    canWriteData: false,
    canSendMessages: false,
    canAccessFiles: true,
    canAccessEmail: false,
    enabled: true,
    systemPromptFile: "siac-excel.prompt.md",
  },
  {
    id: "morosidad",
    name: "Agente Morosidad",
    module: "morosidad",
    description: "Analiza reporte de morosidad, cruza folios y genera resumen de deuda.",
    riskLevel: "high",
    allowedRoles: ["admin", "finance"],
    tools: ["excel.process", "crm.read"],
    requiresApproval: true,
    canWriteData: false,
    canSendMessages: false,
    canAccessFiles: true,
    canAccessEmail: false,
    enabled: true,
    systemPromptFile: "morosidad.prompt.md",
  },
  {
    id: "email_triage",
    name: "Agente Clasificador de Correos",
    module: "email",
    description: "Clasifica, resume y sugiere respuestas. Aprobación obligatoria para envíos.",
    riskLevel: "high",
    allowedRoles: ["admin"],
    tools: ["email.read", "email.draft", "drive.read", "memory.write"],
    requiresApproval: true,
    canWriteData: false,
    canSendMessages: true,
    canAccessFiles: true,
    canAccessEmail: true,
    enabled: true,
    systemPromptFile: "email-triage.prompt.md",
  },
  {
    id: "drive_manager",
    name: "Agente Gestor de Drive",
    module: "documents",
    description: "Indexa, busca y organiza documentos. Escritura requiere aprobación.",
    riskLevel: "high",
    allowedRoles: ["admin"],
    tools: ["drive.read", "drive.write", "files.index"],
    requiresApproval: true,
    canWriteData: true,
    canSendMessages: false,
    canAccessFiles: true,
    canAccessEmail: false,
    enabled: true,
    systemPromptFile: "drive-manager.prompt.md",
  },
  {
    id: "supervisor",
    name: "Agente Supervisor General",
    module: "central",
    description: "Supervisa el estado del ecosistema. Solo lectura de auditoría y tareas.",
    riskLevel: "critical",
    allowedRoles: ["admin"],
    tools: ["audit.read", "tasks.read"],
    requiresApproval: true,
    canWriteData: false,
    canSendMessages: false,
    canAccessFiles: false,
    canAccessEmail: false,
    enabled: true,
    systemPromptFile: "supervisor.prompt.md",
  },
];

export function getAgent(id: string): HdAgentDefinition | undefined {
  return HEAVENLY_AGENTS.find((a) => a.id === id && a.enabled);
}

export function getAgentsForRole(role: string): HdAgentDefinition[] {
  return HEAVENLY_AGENTS.filter((a) => a.enabled && a.allowedRoles.includes(role));
}
