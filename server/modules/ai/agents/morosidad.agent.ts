import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AiEngine, AiAgentInput, AiAgentResult } from "../ai-engine.interface.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPrompt(): string {
  try {
    return readFileSync(join(__dirname, "../prompts/morosidad.prompt.md"), "utf-8");
  } catch {
    return "Eres el Agente de Morosidad de Heavenly Dreams. Analiza reportes y cruza folios. Responde en JSON.";
  }
}

export async function runMorosidadAgent(
  engine: AiEngine,
  input: AiAgentInput,
): Promise<AiAgentResult> {
  const systemPrompt = loadPrompt();
  const t0 = Date.now();
  try {
    const result = await engine.chat({
      userId: input.userId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input.instruction },
      ],
      context: input.context,
    });
    return {
      taskId: input.correlationId,
      status: "needs_approval",
      output: { content: result.content },
      needsApproval: true,
      approvalReason: "Análisis de morosidad requiere revisión antes de usar datos",
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    return { taskId: input.correlationId, status: "failed", error: String(e), durationMs: Date.now() - t0 };
  }
}
