import { randomUUID } from "node:crypto";
import type {
  AiEngine, AiChatInput, AiChatResult, AiAgentInput, AiAgentResult,
  AiDocumentInput, AiDocumentResult, AiMemoryInput, AiMemoryResult,
  AiMemorySearchInput, AiMemorySearchResult, AiHealthResult
} from "../ai-engine.interface.ts";

export class OdysseusAdapter implements AiEngine {
  constructor(
    private readonly baseUrl: string,
    private readonly apiToken: string,
  ) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiToken}`,
    };
  }

  async health(): Promise<AiHealthResult> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { status: "degraded", engine: "odysseus", message: `HTTP ${res.status}` };
      return { status: "healthy", engine: "odysseus", latencyMs: Date.now() - t0 };
    } catch (e) {
      return { status: "unavailable", engine: "odysseus", message: String(e) };
    }
  }

  async chat(input: AiChatInput): Promise<AiChatResult> {
    const res = await fetch(`${this.baseUrl}/api/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: "gemma4:e4b",
        messages: input.messages,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Odysseus chat error: ${res.status}`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { total_tokens?: number } };
    return {
      content: data.choices?.[0]?.message?.content ?? "",
      tokensUsed: data.usage?.total_tokens,
      model: "odysseus",
    };
  }

  async runAgent(input: AiAgentInput): Promise<AiAgentResult> {
    const taskId = randomUUID();
    const t0 = Date.now();
    try {
      const result = await this.chat({
        userId: input.userId,
        messages: [
          { role: "user", content: input.instruction },
        ],
        context: input.context,
      });
      return {
        taskId,
        status: "completed",
        output: { content: result.content, correlationId: input.correlationId },
        durationMs: Date.now() - t0,
      };
    } catch (e) {
      return { taskId, status: "failed", error: String(e), durationMs: Date.now() - t0 };
    }
  }

  async analyzeDocument(input: AiDocumentInput): Promise<AiDocumentResult> {
    const jobId = randomUUID();
    try {
      const instruction = input.instruction ?? `Analiza el documento ${input.fileName} y extrae información estructurada en JSON.`;
      const result = await this.chat({
        userId: input.userId,
        messages: [{ role: "user", content: instruction }],
      });
      return {
        jobId,
        status: "completed",
        summary: result.content,
      };
    } catch (e) {
      return { jobId, status: "failed", error: String(e) };
    }
  }

  async saveMemory(input: AiMemoryInput): Promise<AiMemoryResult> {
    const id = randomUUID();
    try {
      await fetch(`${this.baseUrl}/api/memory/add`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          namespace: input.namespace,
          content: input.content,
          metadata: { module: input.module, entityType: input.entityType, entityId: input.entityId, ...input.metadata },
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      // Memory save is best-effort — log only, never throw
    }
    return { id, namespace: input.namespace, createdAt: new Date().toISOString() };
  }

  async searchMemory(input: AiMemorySearchInput): Promise<AiMemorySearchResult> {
    try {
      const res = await fetch(`${this.baseUrl}/api/memory/search`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          namespace: input.namespace,
          query: input.query,
          limit: input.limit ?? 10,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { results: [] };
      const data = await res.json() as { results?: Array<{ id: string; content: string; score?: number; metadata?: Record<string, unknown> }> };
      return { results: data.results ?? [] };
    } catch {
      return { results: [] };
    }
  }
}
