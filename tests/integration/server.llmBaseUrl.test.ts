import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression test for issue #4 (llm.chat 404 'no body' after image 1.5.1):
// commit 3425666 changed the OpenAI SDK client baseURL in server.ts from
// `${config.llmTarget}/v1` to `${config.llmTarget}/v1/v1`, so every chat
// completion hit <LLM_TARGET>/v1/v1/chat/completions and the vLLM router
// answered with a bare 404 (no body) in ~10ms.
//
// server.ts runs under Bun (Bun.serve) and cannot be imported in the vitest
// jsdom environment, so we assert at the source level — same convention as
// server.chatCompletions.test.ts — that the OpenAI client baseURL appends
// exactly one /v1, and that the endpoint the SDK will hit for
// chat.completions.create() is <LLM_TARGET>/v1/chat/completions.

const serverSource = readFileSync(join(import.meta.dirname, "../../server.ts"), "utf-8");

/** Placeholder text inside the baseURL template, split so biome's
 * noTemplateCurlyInString doesn't flag it as an accidental template string. */
const TARGET_PLACEHOLDER = "$" + "{config.llmTarget}";

/** Extracts the baseURL template literal from the OpenAI client construction. */
function llmClientBaseUrlTemplate(): string {
  const clientStart = serverSource.indexOf("new OpenAI({");
  expect(clientStart, "OpenAI client construction must exist in server.ts").toBeGreaterThan(-1);
  const baseMatch = serverSource
    .slice(clientStart, clientStart + 500)
    .match(/baseURL:\s*`([^`]+)`/);
  expect(baseMatch, "OpenAI client must set baseURL via a template literal").not.toBeNull();
  return baseMatch[1];
}

describe("OpenAI SDK client baseURL (issue #4)", () => {
  it("does not double the /v1 path", () => {
    const template = llmClientBaseUrlTemplate();
    expect(template).not.toMatch(/\/v1\/v1/);
  });

  it("appends exactly one /v1 to config.llmTarget", () => {
    const template = llmClientBaseUrlTemplate();
    expect(template).toBe(`${TARGET_PLACEHOLDER}/v1`);
  });

  it("resolves to <LLM_TARGET>/v1/chat/completions for the deployed env", () => {
    // Simulate the SDK: baseURL + "/chat/completions" with the real deployed
    // LLM_TARGET (host root, no trailing slash, per stacks/ai/docker-compose.yml).
    const llmTarget = "http://192.168.1.87:30000";
    const baseURL = llmClientBaseUrlTemplate().split(TARGET_PLACEHOLDER).join(llmTarget);
    const endpoint = `${baseURL}/chat/completions`;
    expect(endpoint).toBe("http://192.168.1.87:30000/v1/chat/completions");
  });
});
