// Telemetry MUST be imported first — instruments OpenAI SDK before it loads
import "./telemetry.ts";

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import OpenAI from "openai";
import { config } from "./config.ts";

const tracer = trace.getTracer("ai-corrector");

const PORT = config.port;
const DIST_DIR = join(import.meta.dir, "dist");
const VALID_WORDS_PATH = join(import.meta.dir, "public", "data", "valid-words.json");

const llmClient = new OpenAI({
  baseURL: `${config.llmTarget}/v1`,
  apiKey: config.llmApiKey || "unused",
});

function getCorsHeaders(req: Request): Headers {
  const origin = req.headers.get("Origin") ?? "";
  const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
  const isAllowed = isLocalhost || config.corsOrigins.some((o) => origin === o);
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (isAllowed) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function readValidWords(): string[] {
  try {
    const data = JSON.parse(readFileSync(VALID_WORDS_PATH, "utf-8"));
    return data.words || [];
  } catch {
    return [];
  }
}

function writeValidWords(words: string[]): void {
  const tmpPath = `${VALID_WORDS_PATH}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify({ words }, null, 2)}\n`);
  renameSync(tmpPath, VALID_WORDS_PATH);
}

Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // === API: Valid Words ===
    if (path === "/api/valid-words") {
      const headers = getCorsHeaders(req);

      if (req.method === "OPTIONS") {
        const corsHeaders = getCorsHeaders(req);
        corsHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        corsHeaders.set("Access-Control-Allow-Headers", "Content-Type");
        return new Response(null, { headers: corsHeaders });
      }

      if (req.method === "GET") {
        return new Response(JSON.stringify({ words: readValidWords() }), { headers });
      }

      if (req.method === "POST") {
        try {
          const body = await req.json();
          const word = typeof body.word === "string" ? body.word.trim() : "";
          if (!word || word.length > 100 || !/^[\p{L}''\-\s]+$/u.test(word)) {
            return new Response(JSON.stringify({ error: "Invalid word" }), {
              status: 400,
              headers,
            });
          }

          const words = readValidWords();
          if (!words.includes(word)) {
            words.push(word);
            try {
              writeValidWords(words);
            } catch {
              return new Response(JSON.stringify({ error: "Failed to save word" }), {
                status: 500,
                headers,
              });
            }
          }

          return new Response(JSON.stringify({ words }), { headers });
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers,
          });
        }
      }
    }

    // === API: LanguageTool Proxy ===
    if (path.startsWith("/api/lt/")) {
      const ltPath = path.replace("/api/lt", "");
      const ltUrl = `${config.ltTarget}${ltPath}${url.search}`;

      try {
        const ltResponse = await fetch(ltUrl, {
          method: req.method,
          headers: req.headers,
          body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
          redirect: "follow",
        });

        const responseHeaders = new Headers(ltResponse.headers);
        const origin = req.headers.get("Origin") ?? "";
        const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
        const allowed = isLocalhost || config.corsOrigins.some((o) => origin === o);
        responseHeaders.set("Access-Control-Allow-Origin", allowed ? origin : "");

        return new Response(ltResponse.body, {
          status: ltResponse.status,
          headers: responseHeaders,
        });
      } catch {
        return new Response(JSON.stringify({ error: "LanguageTool unavailable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // === API: LLM — Chat Completions (OpenAI SDK → OTEL instrumented) ===
    if (path === "/v1/chat/completions" && req.method === "POST") {
      console.log("[LLM] Chat completion via SDK");
      const startTime = Date.now();

      const span = tracer.startSpan("llm.chat", {
        kind: SpanKind.CLIENT,
      });

      try {
        // biome-ignore lint/suspicious/noExplicitAny: req.json() returns unknown JSON structure
        const body = (await req.json()) as any;

        // Extraire les métadonnées de correction (non transmises à vLLM)
        const correctionMode: string = body.correction_mode ?? "unknown";
        const { correction_mode: _mode, ...llmBody } = body;

        // Extraire le texte d'entrée depuis le dernier message user
        const messages: Array<{ role: string; content: string }> = llmBody.messages ?? [];
        const userMessage = [...messages].reverse().find((m) => m.role === "user");
        const inputText: string = userMessage?.content ?? "";

        const resolvedModel = config.llmModelName || llmBody.model || "unknown";
        span.setAttributes({
          "openinference.span.kind": "LLM",
          "llm.model_name": resolvedModel,
          "input.value": JSON.stringify(messages),
          "input.mime_type": "application/json",
          "input.text": inputText.slice(0, 2000),
          "correction.mode": correctionMode,
        });

        const extraParams = config.llmDisableThinking
          ? { chat_template_kwargs: { enable_thinking: false } }
          : {};

        const createParams = { ...llmBody, model: resolvedModel, stream: true, ...extraParams };
        // biome-ignore lint/suspicious/noExplicitAny: OpenAI SDK requires escape hatch for spread params
        const stream = (await llmClient.chat.completions.create(
          createParams as any,
        )) as unknown as AsyncIterable<{
          choices?: Array<{ delta?: { content?: string } }>;
        }>;

        const encoder = new TextEncoder();
        // Regex to detect when texte_corrige is complete (closing quote present)
        const reFull = /"texte_corrige"\s*:\s*"((?:[^"\\]|\\.)*)"/;

        const readable = new ReadableStream({
          async start(controller) {
            let fullContent = "";
            let textDoneSent = false;

            try {
              for await (const chunk of stream) {
                const delta: string = chunk.choices?.[0]?.delta?.content ?? "";
                if (!delta) continue;
                fullContent += delta;

                if (!textDoneSent) {
                  const fullMatch = reFull.exec(fullContent);
                  if (fullMatch) {
                    const extracted = fullMatch[1]
                      .replace(/\\n/g, "\n")
                      .replace(/\\"/g, '"')
                      .replace(/\\\\/g, "\\");
                    const textDuration = Date.now() - startTime;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ text_done: true, text: extracted, duration: textDuration })}\n\n`,
                      ),
                    );
                    textDoneSent = true;
                  }
                }
                // After text_done: silently accumulate remaining JSON for corrections
              }

              // Parse complete JSON for corrections
              const totalDuration = Date.now() - startTime;
              let outputText = "";
              let corrections: unknown[] = [];
              try {
                const parsed = JSON.parse(fullContent);
                outputText = parsed.texte_corrige ?? parsed.corrected_text ?? fullContent;
                corrections = Array.isArray(parsed.corrections) ? parsed.corrections : [];
              } catch {
                outputText = fullContent;
              }

              console.log(`[LLM] Stream terminé en ${totalDuration}ms`);
              span.setAttributes({
                "output.text": outputText.slice(0, 2000),
                "output.value": fullContent.slice(0, 2000),
                "output.mime_type": "application/json",
              });
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ done: true, corrections })}\n\n`),
              );
            } catch (err) {
              span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
              span.end();
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`),
              );
            } finally {
              controller.close();
            }
          },
        });

        const headers = getCorsHeaders(req);
        headers.set("Content-Type", "text/event-stream");
        headers.set("Cache-Control", "no-cache");
        headers.set("X-Accel-Buffering", "no");
        return new Response(readable, { headers });
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(
          `[LLM] Erreur après ${duration}ms:`,
          error instanceof Error ? error.message : error,
        );
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        span.end();
        return new Response(
          JSON.stringify({
            error: "LLM unavailable",
            details: error instanceof Error ? error.message : "Unknown error",
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // === API: LLM Proxy (fallback for other LLM routes) ===
    if (path.startsWith("/v1/")) {
      const llmPath = path;
      const llmUrl = `${config.llmTarget}${llmPath}${url.search}`;

      try {
        // Override Authorization with the real LLM API key (frontend sends a placeholder)
        const proxyHeaders = new Headers(req.headers);
        if (config.llmApiKey) proxyHeaders.set("Authorization", `Bearer ${config.llmApiKey}`);

        const llmResponse = await fetch(llmUrl, {
          method: req.method,
          headers: proxyHeaders,
          body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
          redirect: "follow",
        });

        const responseHeaders = new Headers(llmResponse.headers);
        const origin = req.headers.get("Origin") ?? "";
        const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
        const allowed = isLocalhost || config.corsOrigins.some((o) => origin === o);
        responseHeaders.set("Access-Control-Allow-Origin", allowed ? origin : "");

        return new Response(llmResponse.body, {
          status: llmResponse.status,
          headers: responseHeaders,
        });
      } catch {
        return new Response(JSON.stringify({ error: "LLM unavailable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // === Static Files ===
    let filePath = join(DIST_DIR, path === "/" ? "index.html" : path);

    // Path traversal protection
    const resolved = resolve(filePath);
    if (!resolved.startsWith(DIST_DIR)) {
      return new Response("Forbidden", { status: 403 });
    }

    if (!existsSync(filePath)) {
      filePath = join(DIST_DIR, "index.html");
    }

    return new Response(Bun.file(filePath));
  },
});

console.log(`🚀 AI Corrector server running on http://localhost:${config.port}`);
