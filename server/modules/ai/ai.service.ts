import { aiConfig } from "./ai.config.ts";
import { OdysseusAdapter } from "./adapters/odysseus.adapter.ts";
import { MockAiAdapter } from "./adapters/mock-ai.adapter.ts";
import type { AiEngine } from "./ai-engine.interface.ts";
import { getAgent } from "./agents/agent-registry.ts";
import { runRecruitmentAgent } from "./agents/recruitment.agent.ts";
import { runSiacAgent } from "./agents/siac.agent.ts";
import { runMorosidadAgent } from "./agents/morosidad.agent.ts";
import { runEmailAgent } from "./agents/email.agent.ts";
import { runSupervisorAgent } from "./agents/supervisor.agent.ts";
import type { AiAgentInput, AiAgentResult } from "./ai-engine.interface.ts";

let _engine: AiEngine | null = null;

export function getAiEngine(): AiEngine {
  if (_engine) return _engine;
  if (aiConfig.engine === "odysseus") {
    _engine = new OdysseusAdapter(aiConfig.odysseus.baseUrl, aiConfig.odysseus.apiToken);
  } else {
    _engine = new MockAiAdapter();
  }
  return _engine;
}

const agentRunners: Record<string, (engine: AiEngine, input: AiAgentInput) => Promise<AiAgentResult>> = {
  recruitment_evaluator: runRecruitmentAgent,
  whatsapp_recruitment: runRecruitmentAgent,
  siac_excel: runSiacAgent,
  morosidad: runMorosidadAgent,
  email_triage: runEmailAgent,
  drive_manager: runEmailAgent,
  supervisor: runSupervisorAgent,
};

export async function runAgentById(
  agentId: string,
  input: Omit<AiAgentInput, "agentId">,
): Promise<AiAgentResult> {
  const agent = getAgent(agentId);
  if (!agent) return { taskId: "", status: "failed", error: `Agente '${agentId}' no existe` };

  const engine = getAiEngine();
  const runner = agentRunners[agentId];
  if (!runner) return { taskId: "", status: "failed", error: `Sin runner para agente '${agentId}'` };

  return runner(engine, { ...input, agentId });
}
