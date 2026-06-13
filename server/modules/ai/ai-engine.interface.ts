export type AiEngineId = "odysseus" | "ollama" | "gemini" | "openai" | "mock";
export type AiTaskStatus = "pending" | "running" | "needs_approval" | "completed" | "failed" | "cancelled";
export type AiRiskLevel = "low" | "medium" | "high" | "critical";
export type AiAgentModule =
  | "recruitment" | "whatsapp" | "operations" | "finance"
  | "email" | "documents" | "central" | "siac" | "morosidad";

export interface AiChatInput {
  sessionId?: string;
  userId: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  context?: Record<string, unknown>;
}

export interface AiChatResult {
  content: string;
  sessionId?: string;
  tokensUsed?: number;
  model?: string;
}

export interface AiAgentInput {
  agentId: string;
  userId: string;
  module: AiAgentModule;
  instruction: string;
  context?: Record<string, unknown>;
  correlationId: string;
  folio?: string;
  leadId?: string;
  fileId?: string;
  source?: string;
}

export interface AiAgentResult {
  taskId: string;
  status: AiTaskStatus;
  output?: Record<string, unknown>;
  needsApproval?: boolean;
  approvalReason?: string;
  error?: string;
  durationMs?: number;
}

export interface AiDocumentInput {
  fileId?: string;
  fileUrl?: string;
  fileName: string;
  fileType: string;
  module: AiAgentModule;
  instruction?: string;
  userId: string;
  correlationId: string;
}

export interface AiDocumentResult {
  jobId: string;
  status: AiTaskStatus;
  extracted?: Record<string, unknown>;
  summary?: string;
  error?: string;
}

export interface AiMemoryInput {
  namespace: string;
  module: AiAgentModule;
  entityType?: string;
  entityId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  userId?: string;
}

export interface AiMemoryResult {
  id: string;
  namespace: string;
  createdAt: string;
}

export interface AiMemorySearchInput {
  namespace: string;
  query: string;
  limit?: number;
  module?: AiAgentModule;
  entityId?: string;
}

export interface AiMemorySearchResult {
  results: Array<{
    id: string;
    content: string;
    score?: number;
    metadata?: Record<string, unknown>;
  }>;
}

export interface AiHealthResult {
  status: "healthy" | "degraded" | "unavailable";
  engine: AiEngineId;
  latencyMs?: number;
  models?: string[];
  message?: string;
}

export interface AiEngine {
  chat(input: AiChatInput): Promise<AiChatResult>;
  runAgent(input: AiAgentInput): Promise<AiAgentResult>;
  analyzeDocument(input: AiDocumentInput): Promise<AiDocumentResult>;
  saveMemory(input: AiMemoryInput): Promise<AiMemoryResult>;
  searchMemory(input: AiMemorySearchInput): Promise<AiMemorySearchResult>;
  health(): Promise<AiHealthResult>;
}
