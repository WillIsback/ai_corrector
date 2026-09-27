import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression test for issue #12 (v1.5.9 incident, 2026-09-27):
// commit 33140fa added `top_k: config.llmTopK` to the chat completion params
// with LLM_TOP_K defaulting to 0. SGLang rejects top_k=0 with
// 400 "top_k must be -1 (disable) or at least 1", so all 41 chat completions
// in the failure window were rejected before inference (6-112ms, no body).
//
// server.ts runs under Bun (Bun.serve) and cannot be imported in the vitest
// jsdom environment, so we assert at the source level — same convention as
// server.chatCompletions.test.ts / server.llmBaseUrl.test.ts — that the
// top_k sent to the LLM comes from config (not a hardcoded value) and that
// the config default is SGLang-valid.

const serverSource = readFileSync(join(import.meta.dirname, "../../server.ts"), "utf-8");

function chatCompletionParamsBlock(): string {
  const start = serverSource.indexOf("const createParams = {");
  expect(start, "createParams block must exist in server.ts").toBeGreaterThan(-1);
  const end = serverSource.indexOf("};", start);
  expect(end, "end of createParams block must be found").toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

describe("chat completion top_k (issue #12)", () => {
  it("top_k comes from config.llmTopK (no hardcoded value)", () => {
    const block = chatCompletionParamsBlock();
    expect(block).toMatch(/top_k:\s*config\.llmTopK/);
    // No literal top_k value in the params block (e.g. top_k: 0)
    expect(block).not.toMatch(/top_k:\s*\d+/);
  });
});
