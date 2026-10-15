import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression test for issue #17 (Bug 1):
// Bun.serve's default 10s idleTimeout aborted any /v1/chat/completions request
// whose time-to-first-token exceeded 10s (large inputs), and the unguarded SSE
// keepalive enqueue then threw "Controller is already closed", crashing the
// whole Bun process. server.ts runs under Bun and cannot be imported in the
// vitest environment, so we guard the source level.

const serverSource = readFileSync(join(import.meta.dirname, "../../server.ts"), "utf-8");

function chatSection(): string {
  const start = serverSource.indexOf('path === "/v1/chat/completions"');
  expect(start, "handler for /v1/chat/completions must exist").toBeGreaterThan(-1);
  const end = serverSource.indexOf("// === API: LLM Proxy", start);
  expect(end, "end of handler section must be found").toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

describe("Bun.serve idle timeout for streaming corrections (issue #17)", () => {
  it("accesses the Bun server so the SSE route can disable its idle timeout", () => {
    expect(serverSource).toMatch(/fetch\s*\(\s*req\s*:\s*Request\s*,\s*server\s*:/);
  });

  it("disables the per-request idle timeout on the streaming route", () => {
    expect(chatSection()).toMatch(/server\.timeout\(\s*req\s*,\s*0\s*\)/);
  });

  it("routes every controller.enqueue through a guarded helper", () => {
    const section = chatSection();
    expect(section).toMatch(/function\s+safeEnqueue/);
    // The helper wraps enqueue in try/catch so a closed controller is handled.
    expect(section).toMatch(/try\s*\{[\s\S]*?controller\.enqueue[\s\S]*?\}\s*catch/);
    // Only one raw enqueue call remains (inside the helper) — the keepalive,
    // text_done, done and error paths must all go through it.
    const rawEnqueues = section.match(/controller\.enqueue/g) ?? [];
    expect(rawEnqueues.length).toBe(1);
  });

  it("keeps the SSE stream alive via the guarded keepalive", () => {
    const section = chatSection();
    expect(section).toMatch(/setInterval\([\s\S]*?safeEnqueue/);
  });

  it("keeps the keepalive interval below Bun's 10s default idle timeout", () => {
    const match = chatSection().match(/keepaliveIntervalMs\s*=\s*([\d_]+)/);
    expect(match, "keepaliveIntervalMs must be defined").not.toBeNull();
    const ms = Number((match as RegExpMatchArray)[1].replace(/_/g, ""));
    expect(ms).toBeLessThan(10_000);
  });
});
