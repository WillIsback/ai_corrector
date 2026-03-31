import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const PORT = 25000;
const DIST_DIR = join(import.meta.dir, "dist");
const VALID_WORDS_PATH = join(import.meta.dir, "public", "data", "valid-words.json");

const LT_TARGET = "http://127.0.0.1:3002";
const LLM_TARGET = "http://127.0.0.1:30000";

function getCorsHeaders(req: Request): Headers {
  const origin = req.headers.get("Origin") ?? "";
  const allowed =
    origin.includes(".ts.net") || origin.includes("localhost") || origin.includes("127.0.0.1");
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (allowed) {
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

const _server = Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    let path = url.pathname;

    // Normalize path: Caddy's handle_path strips /corrector prefix,
    // so re-add it for API routes that arrive without the prefix.
    if ((path.startsWith("/api/") || path.startsWith("/v1/")) && !path.startsWith("/corrector/")) {
      path = `/corrector${path}`;
    }

    // === API: Valid Words ===
    if (path === "/corrector/api/valid-words") {
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
    if (path.startsWith("/corrector/api/lt/")) {
      const ltPath = path.replace("/corrector/api/lt", "");
      const ltUrl = `${LT_TARGET}${ltPath}${url.search}`;

      try {
        const ltResponse = await fetch(ltUrl, {
          method: req.method,
          headers: req.headers,
          body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
          redirect: "follow",
        });

        const responseHeaders = new Headers(ltResponse.headers);
        const origin = req.headers.get("Origin") ?? "";
        const allowed =
          origin.includes(".ts.net") ||
          origin.includes("localhost") ||
          origin.includes("127.0.0.1");
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

    // === API: LLM Proxy ===
    if (path.startsWith("/corrector/v1/")) {
      const llmPath = path.replace("/corrector", "");
      const llmUrl = `${LLM_TARGET}${llmPath}${url.search}`;

      try {
        const llmResponse = await fetch(llmUrl, {
          method: req.method,
          headers: req.headers,
          body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
          redirect: "follow",
        });

        const responseHeaders = new Headers(llmResponse.headers);
        const origin = req.headers.get("Origin") ?? "";
        const allowed =
          origin.includes(".ts.net") ||
          origin.includes("localhost") ||
          origin.includes("127.0.0.1");
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

console.log(`🚀 AI Corrector server running on http://localhost:${PORT}`);
