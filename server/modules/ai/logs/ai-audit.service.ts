const SENSITIVE_KEYS = ["password", "token", "secret", "key", "apikey", "api_key", "authorization", "cookie", "credential"];

export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s)) ? "[REDACTED]" : v,
    ])
  );
}

export interface AiAuditParams {
  taskId?: string;
  agentId?: string;
  userId?: string;
  action: string;
  module?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export function buildAuditEntry(params: AiAuditParams) {
  return {
    ...params,
    input: params.input ? sanitizeForLog(params.input) : undefined,
    output: params.output ? sanitizeForLog(params.output) : undefined,
    timestamp: new Date().toISOString(),
  };
}
