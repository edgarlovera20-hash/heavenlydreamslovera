import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AiEngine, AiAgentInput, AiAgentResult } from "../ai-engine.interface.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPrompt(): string {
  try {
    return readFileSync(join(__dirname, "../prompts/recruitment-evaluator.prompt.md"), "utf-8");
  } catch {
    return "Eres el Agente Evaluador de Candidatos de Heavenly Dreams. Responde en JSON válido.";
  }
}

export async function runRecruitmentAgent(
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

    let output: Record<string, unknown>;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      output = jsonMatch ? JSON.parse(jsonMatch[0]) : { content: result.content };
    } catch {
      output = { content: result.content };
    }

    return {
      taskId: input.correlationId,
      status: "completed",
      output,
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      taskId: input.correlationId,
      status: "failed",
      error: String(e),
      durationMs: Date.now() - t0,
    };
  }
}
