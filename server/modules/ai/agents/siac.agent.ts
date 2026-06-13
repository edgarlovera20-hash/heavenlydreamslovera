import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AiEngine, AiAgentInput, AiAgentResult } from "../ai-engine.interface.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPrompt(): string {
  try {
    return readFileSync(join(__dirname, "../prompts/siac-excel.prompt.md"), "utf-8");
  } catch {
    return "Eres el Agente SIAC/Excel de Heavenly Dreams. Ayuda a detectar columnas y validar folios. No modifiques archivos directamente.";
  }
}

export async function runSiacAgent(
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
      output: { content: result.content, suggestion: true },
      needsApproval: true,
      approvalReason: "Operación de alto riesgo sobre archivos SIAC requiere revisión humana",
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    return { taskId: input.correlationId, status: "failed", error: String(e), durationMs: Date.now() - t0 };
  }
}
