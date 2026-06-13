import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getAiEngine, runAgentById } from "./ai.service.ts";
import { HEAVENLY_AGENTS, getAgentsForRole } from "./agents/agent-registry.ts";
import { requireAuth, requireAgentAccess, requireAdmin } from "./security/ai-permissions.guard.ts";
import { buildAuditEntry } from "./logs/ai-audit.service.ts";

const router = Router();

interface AuthReq extends InstanceType<typeof Router>["request"] {
  user?: { id: string; role?: string; roles?: string[] };
}

function getUserRoles(req: AuthReq): string[] {
  if (!req.user) return [];
  if ((req.user as { roles?: string[] }).roles) return (req.user as { roles: string[] }).roles;
  if (req.user.role) return [req.user.role];
  return [];
}

router.get("/health", async (_req, res) => {
  try {
    const engine = getAiEngine();
    const health = await engine.health();
    res.json(health);
  } catch (e) {
    res.status(503).json({ status: "unavailable", error: String(e) });
  }
});

router.get("/agents", requireAuth, (req: AuthReq, res) => {
  const roles = getUserRoles(req);
  const visible = roles.includes("admin")
    ? HEAVENLY_AGENTS
    : getAgentsForRole(roles[0] ?? "");
  res.json(visible.map(({ systemPromptFile: _sp, ...a }) => a));
});

router.post("/chat", requireAuth, async (req: AuthReq, res) => {
  const { messages, sessionId, context } = req.body as {
    messages?: Array<{ role: string; content: string }>;
    sessionId?: string;
    context?: Record<string, unknown>;
  };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages requerido" });
    return;
  }
  try {
    const engine = getAiEngine();
    const result = await engine.chat({
      userId: req.user!.id,
      messages: messages as Array<{ role: "user" | "assistant" | "system"; content: string }>,
      sessionId,
      context,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/agents/:agentId/run", requireAuth, requireAgentAccess, async (req: AuthReq, res) => {
  const { agentId } = req.params;
  const { instruction, context, folio, leadId, fileId, source } = req.body as {
    instruction?: string;
    context?: Record<string, unknown>;
    folio?: string;
    leadId?: string;
    fileId?: string;
    source?: string;
  };
  if (!instruction) {
    res.status(400).json({ error: "instruction requerida" });
    return;
  }
  const correlationId = randomUUID();
  try {
    const result = await runAgentById(agentId, {
      userId: req.user!.id,
      module: "recruitment",
      instruction,
      context,
      correlationId,
      folio,
      leadId,
      fileId,
      source,
    });
    const audit = buildAuditEntry({
      taskId: result.taskId,
      agentId,
      userId: req.user!.id,
      action: "agent.run",
      module: agentId,
      input: { instruction: instruction.slice(0, 200) },
      output: { status: result.status },
      ip: req.ip,
    });
    void audit;
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/tasks", requireAuth, requireAdmin, (_req, res) => {
  res.json({ message: "Conectar con ai.repo.ts para listar tareas", tasks: [] });
});

router.post("/approve-action/:taskId", requireAuth, requireAdmin, (req: AuthReq, res) => {
  res.json({ approved: true, taskId: req.params.taskId, by: req.user!.id });
});

router.post("/reject-action/:taskId", requireAuth, requireAdmin, (req: AuthReq, res) => {
  res.json({ rejected: true, taskId: req.params.taskId, by: req.user!.id });
});

router.get("/audit", requireAuth, requireAdmin, (_req, res) => {
  res.json({ message: "Conectar con ai.repo.ts para ver audit log", logs: [] });
});

router.post("/memory", requireAuth, async (req: AuthReq, res) => {
  const { namespace, module, content, entityType, entityId, metadata } = req.body as {
    namespace?: string;
    module?: string;
    content?: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  };
  if (!namespace || !module || !content) {
    res.status(400).json({ error: "namespace, module y content requeridos" });
    return;
  }
  try {
    const engine = getAiEngine();
    const result = await engine.saveMemory({
      namespace,
      module: module as import("./ai-engine.interface.ts").AiAgentModule,
      content,
      entityType,
      entityId,
      metadata,
      userId: req.user!.id,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/memory/search", requireAuth, async (req: AuthReq, res) => {
  const { namespace, query, limit } = req.query as { namespace?: string; query?: string; limit?: string };
  if (!namespace || !query) {
    res.status(400).json({ error: "namespace y query requeridos" });
    return;
  }
  try {
    const engine = getAiEngine();
    const result = await engine.searchMemory({
      namespace,
      query,
      limit: limit ? parseInt(limit, 10) : 10,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export { router as aiRouter };
