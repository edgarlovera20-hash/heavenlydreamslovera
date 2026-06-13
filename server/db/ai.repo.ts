import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export interface AiTask {
  id: string;
  agentId: string;
  module: string;
  status: string;
  priority: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdById?: string;
  source?: string;
  folio?: string;
  leadId?: string;
  fileId?: string;
  needsApproval: boolean;
  approvalReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const SENSITIVE = ["password", "token", "secret", "key", "apikey", "authorization", "cookie"];
function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      SENSITIVE.some((s) => k.toLowerCase().includes(s)) ? [k, "[REDACTED]"] : [k, v]
    )
  );
}

function rowToTask(row: Record<string, unknown>): AiTask {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    module: row.module as string,
    status: row.status as string,
    priority: row.priority as number,
    input: JSON.parse((row.input as string) || "{}"),
    output: row.output ? JSON.parse(row.output as string) : undefined,
    error: row.error as string | undefined,
    createdById: row.created_by_id as string | undefined,
    source: row.source as string | undefined,
    folio: row.folio as string | undefined,
    leadId: row.lead_id as string | undefined,
    fileId: row.file_id as string | undefined,
    needsApproval: Boolean(row.needs_approval),
    approvalReason: row.approval_reason as string | undefined,
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createAiRepo(db: Database.Database) {
  const createTask = (data: Omit<AiTask, "id" | "createdAt" | "updatedAt">): AiTask => {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO ai_task (id, agent_id, module, status, priority, input, output, error,
        created_by_id, source, folio, lead_id, file_id, needs_approval, approval_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.agentId, data.module, data.status, data.priority,
      JSON.stringify(data.input), data.output ? JSON.stringify(data.output) : null,
      data.error ?? null, data.createdById ?? null, data.source ?? null,
      data.folio ?? null, data.leadId ?? null, data.fileId ?? null,
      data.needsApproval ? 1 : 0, data.approvalReason ?? null, now, now
    );
    return { ...data, id, createdAt: now, updatedAt: now };
  };

  const getTask = (id: string): AiTask | null => {
    const row = db.prepare("SELECT * FROM ai_task WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? rowToTask(row) : null;
  };

  const listTasks = (opts: { status?: string; module?: string; limit?: number } = {}): AiTask[] => {
    let q = "SELECT * FROM ai_task WHERE 1=1";
    const params: unknown[] = [];
    if (opts.status) { q += " AND status = ?"; params.push(opts.status); }
    if (opts.module) { q += " AND module = ?"; params.push(opts.module); }
    q += " ORDER BY created_at DESC LIMIT ?";
    params.push(opts.limit ?? 50);
    return (db.prepare(q).all(...params) as Record<string, unknown>[]).map(rowToTask);
  };

  const updateTask = (id: string, status: string, output?: Record<string, unknown>, error?: string) => {
    db.prepare("UPDATE ai_task SET status = ?, output = ?, error = ?, updated_at = ? WHERE id = ?")
      .run(status, output ? JSON.stringify(output) : null, error ?? null, new Date().toISOString(), id);
  };

  const approveTask = (id: string, by: string) => {
    db.prepare("UPDATE ai_task SET status = 'completed', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?")
      .run(by, new Date().toISOString(), new Date().toISOString(), id);
  };

  const rejectTask = (id: string, by: string) => {
    db.prepare("UPDATE ai_task SET status = 'cancelled', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?")
      .run(by, new Date().toISOString(), new Date().toISOString(), id);
  };

  const createAuditEntry = (data: {
    taskId?: string; agentId?: string; userId?: string; action: string;
    module?: string; input?: Record<string, unknown>; output?: Record<string, unknown>;
    metadata?: Record<string, unknown>; ip?: string;
  }) => {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO ai_audit_log (id, task_id, agent_id, user_id, action, module, input, output, metadata, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.taskId ?? null, data.agentId ?? null, data.userId ?? null,
      data.action, data.module ?? null,
      data.input ? JSON.stringify(sanitize(data.input)) : null,
      data.output ? JSON.stringify(sanitize(data.output)) : null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.ip ?? null, new Date().toISOString()
    );
  };

  const listAuditLog = (limit = 100) =>
    db.prepare("SELECT * FROM ai_audit_log ORDER BY created_at DESC LIMIT ?").all(limit);

  return { createTask, getTask, listTasks, updateTask, approveTask, rejectTask, createAuditEntry, listAuditLog };
}
