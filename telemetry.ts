import { trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { config } from "./config.ts";

if (config.otelEndpoint) {
  const resource = resourceFromAttributes({
    "service.name": "ai-corrector",
    "openinference.project.name": "ai-corrector",
  });

  const exporter = new OTLPTraceExporter({ url: `${config.otelEndpoint}/v1/traces` });
  const provider = new BasicTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);

  console.log("[otel] Telemetry enabled →", config.otelEndpoint);
} else {
  console.log("[otel] OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled");
}
