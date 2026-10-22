/**
 * Tolerant parser for the JSON object returned by the correction LLM.
 *
 * Models do not reliably emit well-formed JSON from a prompt instruction
 * alone: Nemotron 3.5 Super returned an extra or a missing closing brace in
 * 6/6 runs (2026-10-23), which made JSON.parse fail and silently dropped every
 * correction. server.ts also sends `response_format: json_object`, but keep
 * this as a safety net for backends or models that ignore it.
 *
 * Strategy: take the first top-level `{...}` object (string-aware brace
 * matching, so braces inside values are ignored), discarding anything after
 * it; if the output ends before the object closes, append the missing `]`/`}`.
 */

export interface LlmCorrectionJson {
  texte_corrige?: string;
  corrected_text?: string;
  corrections?: Array<Record<string, unknown>>;
}

export interface ParsedLlmJson {
  value: LlmCorrectionJson;
  /** True when the raw output was not valid JSON and had to be repaired. */
  repaired: boolean;
}

function tryParse(text: string): LlmCorrectionJson | null {
  try {
    const value = JSON.parse(text);
    return typeof value === "object" && value !== null ? value : null;
  } catch {
    return null;
  }
}

function extractObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;

  const closers: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") closers.push("}");
    else if (ch === "[") closers.push("]");
    else if (ch === "}" || ch === "]") {
      closers.pop();
      if (closers.length === 0) return raw.slice(start, i + 1);
    }
  }

  // Truncated output: close whatever is still open (never inside a string).
  if (inString) return null;
  return raw.slice(start).trimEnd() + closers.reverse().join("");
}

export function parseLlmJson(raw: string): ParsedLlmJson | null {
  const direct = tryParse(raw);
  if (direct) return { value: direct, repaired: false };

  const candidate = extractObject(raw);
  const repaired = candidate ? tryParse(candidate) : null;
  return repaired ? { value: repaired, repaired: true } : null;
}
