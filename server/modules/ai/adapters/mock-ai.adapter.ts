import { randomUUID } from "node:crypto";
import type {
  AiEngine, AiChatInput, AiChatResult, AiAgentInput, AiAgentResult,
  AiDocumentInput, AiDocumentResult, AiMemoryInput, AiMemoryResult,
  AiMemorySearchInput, AiMemorySearchResult, AiHealthResult
} from "../ai-engine.interface.ts";

// Mock adapter for development/testing when Odysseus is not running.
export class MockAiAdapter implements AiEngine {
  async health(): Promise<AiHealthResult> {
    return { status: "healthy", engine: "mock", latencyMs: 1, models: ["mock-model"] };
  }

  async chat(input: AiChatInput): Promise<AiChatResult> {
    const last = input.messages.at(-1)?.content ?? "";
    return { content: `[MOCK] Respuesta a: ${last.slice(0, 80)}`, model: "mock" };
  }

  async runAgent(input: AiAgentInput): Promise<AiAgentResult> {
    return {
      taskId: randomUUID(),
      status: "completed",
      output: {
        mock: true,
        agentId: input.agentId,
        summary: `[MOCK] Tarea completada para agente ${input.agentId}`,
        score: 75,
        priority: "media",
      },
      durationMs: 50,
    };
  }

  async analyzeDocument(input: AiDocumentInput): Promise<AiDocumentResult> {
    return {
      jobId: randomUUID(),
      status: "completed",
      summary: `[MOCK] Documento analizado: ${input.fileName}`,
      extracted: { mock: true, fileName: input.fileName },
    };
  }

  async saveMemory(input: AiMemoryInput): Promise<AiMemoryResult> {
    return { id: randomUUID(), namespace: input.namespace, createdAt: new Date().toISOString() };
  }

  async searchMemory(_input: AiMemorySearchInput): Promise<AiMemorySearchResult> {
    return { results: [] };
  }
}
