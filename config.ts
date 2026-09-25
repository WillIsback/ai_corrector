export const config = {
  port: Number(process.env.PORT ?? 25000),
  ltTarget: process.env.LT_TARGET ?? "http://127.0.0.1:3002",
  llmTarget: process.env.LLM_TARGET ?? "http://127.0.0.1:30000",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModelName: process.env.LLM_MODEL_NAME ?? "",
  llmDisableThinking: process.env.LLM_DISABLE_THINKING !== "false",
  corsOrigins: (process.env.CORS_ORIGIN ?? "").split(",").filter(Boolean),
  otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "",
};
