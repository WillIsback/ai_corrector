/**
 * OpenTelemetry setup for ai-corrector (Bun/ESM compatible).
 *
 * ESM incompatibility with import-in-the-middle prevents automatic OpenAI
 * instrumentation via NodeSDK. We set up only the provider here; spans are
 * created manually in server.ts with OpenInference semantic conventions.
 *
 * Uses OTel JS SDK v2 API: spanProcessors in constructor + setGlobalTracerProvider.
 */

export {};

import { trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SimpleSpanProcessor, BasicTracerProvider } from "@opentelemetry/sdk-trace-base";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (endpoint) {
  const resource = resourceFromAttributes({
    "service.name": "ai-corrector",
    "openinference.project.name": "ai-corrector",
  });

  const exporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
  const provider = new BasicTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);

  console.log("[otel] Telemetry enabled →", endpoint);
} else {
  console.log("[otel] OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled");
}
