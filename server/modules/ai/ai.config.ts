export const aiConfig = {
  engine: (process.env.AI_ENGINE ?? "mock") as "odysseus" | "ollama" | "gemini" | "openai" | "mock",
  odysseus: {
    baseUrl: process.env.ODYSSEUS_BASE_URL ?? "http://127.0.0.1:7000",
    apiToken: process.env.ODYSSEUS_API_TOKEN ?? "",
  },
  gateway: {
    secret: process.env.AI_GATEWAY_SECRET ?? "",
    rateLimitPerMinute: parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE ?? "30", 10),
    requireApprovalForHighRisk: process.env.AI_REQUIRE_APPROVAL_FOR_HIGH_RISK !== "false",
  },
};
