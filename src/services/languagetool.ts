import type { CorrectionEntry, LTMatch, LTResponse } from "../types";

const LT_API_BASE = "/api/lt";

export async function runLanguageTool(text: string, signal?: AbortSignal): Promise<LTMatch[]> {
  if (!text.trim()) {
    throw new Error("Le texte ne peut pas être vide");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(`${LT_API_BASE}/v2/check`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, language: "fr" }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`LanguageTool API error: ${response.status}`);
    }

    const data: LTResponse = await response.json();
    return data.matches;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function applyLTCorrections(
  text: string,
  matches: LTMatch[],
): { correctedText: string; corrections: CorrectionEntry[] } {
  const validMatches = matches
    .filter((m) => m.replacements && m.replacements.length > 0)
    .sort((a, b) => b.offset - a.offset);

  const corrections: CorrectionEntry[] = [];
  let result = text;

  for (const match of validMatches) {
    const firstReplacement = match.replacements[0];
    const replacementText =
      typeof firstReplacement === "string"
        ? firstReplacement
        : (firstReplacement as { value: string }).value;

    const avant = result.slice(match.offset, match.offset + match.length);
    corrections.push({ avant, apres: replacementText, regle: match.rule.id });

    result =
      result.slice(0, match.offset) + replacementText + result.slice(match.offset + match.length);
  }

  return { correctedText: result, corrections: corrections.reverse() };
}

export async function checkLTAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${LT_API_BASE}/v2/languages`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
