import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression test for issue #1 (incident inc-1790288620):
// a reversible e2e test fault ("E2E-DEV-TEST forced handler failure") was
// left at the top of the /v1/chat/completions handler in server.ts, making
// every request fail with HTTP 500 before the upstream vLLM call was made.
// server.ts runs under Bun (Bun.serve) and cannot be imported in the vitest
// jsdom environment, so we guard at the source level that no forced fault is
// injected in the handler and that the handler flows straight into span
// creation / the upstream call.

const serverSource = readFileSync(join(import.meta.dirname, "../../server.ts"), "utf-8");

function handlerBody(): string {
  const start = serverSource.indexOf('path === "/v1/chat/completions"');
  expect(start, "handler for /v1/chat/completions must exist in server.ts").toBeGreaterThan(-1);
  const end = serverSource.indexOf("// === API: LLM Proxy", start);
  expect(end, "end of /v1/chat/completions handler section must be found").toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

describe("POST /v1/chat/completions — no forced test fault (issue #1)", () => {
  it("does not contain the E2E-DEV-TEST forced handler failure", () => {
    const handler = handlerBody();
    expect(handler).not.toMatch(/E2E-DEV-TEST/);
    expect(handler).not.toMatch(/forced handler failure/);
  });

  it("proceeds to span creation right after entering the handler (no early throw)", () => {
    const handler = handlerBody();
    const enter = handler.indexOf('console.log("[LLM] Chat completion via SDK")');
    expect(enter, "handler entry log must exist").toBeGreaterThan(-1);
    const span = handler.indexOf('tracer.startSpan("llm.chat"', enter);
    expect(span, "tracer.startSpan must follow the handler entry").toBeGreaterThan(enter);
    // No unconditional `throw new Error(...)` between handler entry and span creation
    const between = handler.slice(enter, span);
    const stripped = between.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/throw\s+new\s+Error/);
  });

  it("reaches the upstream OpenAI SDK call in the handler", () => {
    const handler = handlerBody();
    expect(handler).toMatch(/llmClient\.chat\.completions\.create/);
  });
});
