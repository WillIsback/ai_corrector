import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLlmJson } from "../../src/utils/llmJson";

// Regression test for the Nemotron incident (2026-10-23): with JSON requested
// only through the system prompt, nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B
// returned malformed JSON in 6/6 runs (extra or missing closing brace). The
// server's JSON.parse failed silently and set corrections = [], so the UI
// showed the corrected text with an empty corrections panel.

const BODY =
  '{"texte_corrige": "Nous sommes d\\u00e9sol\\u00e9s.\\nCordialement", "corrections": [{"avant": "somme", "apres": "sommes", "regle": "conjugaison"}, {"avant": "d\\u00e9sol\\u00e9", "apres": "d\\u00e9sol\\u00e9s", "regle": "accord adjectif {pluriel}"}]';

describe("parseLlmJson — tolerant parsing of LLM JSON output", () => {
  it("parses valid JSON without flagging a repair", () => {
    const result = parseLlmJson(`${BODY}}`);
    expect(result?.repaired).toBe(false);
    expect(result?.value.corrections).toHaveLength(2);
  });

  it("drops an extra trailing brace after a newline (observed: ']}\\n}')", () => {
    const result = parseLlmJson(`${BODY}}\n}`);
    expect(result?.repaired).toBe(true);
    expect(result?.value.corrections).toHaveLength(2);
  });

  it("drops an extra trailing brace (observed: ']}}')", () => {
    const result = parseLlmJson(`${BODY}}}`);
    expect(result?.repaired).toBe(true);
    expect(result?.value.texte_corrige).toBe("Nous sommes désolés.\nCordialement");
  });

  it("closes a missing final brace (observed: ending on ']')", () => {
    const result = parseLlmJson(BODY);
    expect(result?.repaired).toBe(true);
    expect(result?.value.corrections).toHaveLength(2);
  });

  it("ignores braces inside strings and markdown fences around the object", () => {
    const result = parseLlmJson(`\`\`\`json\n${BODY}}\n\`\`\``);
    expect(result?.value.corrections?.[1]?.regle).toBe("accord adjectif {pluriel}");
  });

  it("returns null when there is no JSON object at all", () => {
    expect(parseLlmJson("Désolé, je ne peux pas corriger ce texte.")).toBeNull();
  });
});

describe("server.ts JSON contract", () => {
  const serverSource = readFileSync(join(import.meta.dirname, "../../server.ts"), "utf-8");
  const start = serverSource.indexOf("const createParams = {");
  const block = serverSource.slice(start, serverSource.indexOf("};", start));

  it("asks vLLM to constrain the output to a JSON object", () => {
    expect(block).toMatch(/response_format:\s*\{\s*type:\s*"json_object"\s*\}/);
  });

  it("parses the final content with parseLlmJson and logs failures", () => {
    expect(serverSource).toMatch(/parseLlmJson\(fullContent\)/);
    expect(serverSource).toMatch(/console\.warn\(\s*`\[LLM\] JSON invalide/);
  });
});
