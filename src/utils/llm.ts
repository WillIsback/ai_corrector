import type { CorrectionEntry, CorrectionSettings, StreamCallbacks } from "../types";
import { getCurrentModel } from "./models";
import { buildSystemPrompt } from "./prompt";
import { sanitizeInput } from "./sanitize";

let currentAbortController: AbortController | null = null;

export function abortOngoingRequest(): void {
  currentAbortController?.abort();
  currentAbortController = null;
}

function parseCorrections(raw: unknown[]): CorrectionEntry[] {
  return raw.map((c) => {
    if (typeof c === "object" && c !== null) {
      const e = c as Record<string, unknown>;
      return {
        avant: String(e.avant ?? ""),
        apres: String(e.apres ?? ""),
        regle: String(e.regle ?? ""),
      };
    }
    const str = String(c);
    const idx = str.indexOf(" -> ");
    return {
      avant: idx >= 0 ? str.slice(0, idx) : str,
      apres: idx >= 0 ? str.slice(idx + 4) : "",
      regle: "",
    };
  });
}

export async function correctText(
  text: string,
  settings: CorrectionSettings,
  callbacks?: StreamCallbacks,
): Promise<CorrectionEntry[]> {
  const systemPrompt = buildSystemPrompt(settings);
  const userPrompt = sanitizeInput(text);

  const request = {
    model: getCurrentModel(),
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ],
    temperature: 0.3,
    correction_mode: settings.mode,
  };

  currentAbortController?.abort();
  const controller = new AbortController();
  currentAbortController = controller;

  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer no-key-needed" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    currentAbortController = null;

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        const payload = JSON.parse(line.slice(6));

        if (payload.error) throw new Error(payload.error);

        if (payload.text_done) {
          callbacks?.onTextDone?.(payload.text ?? "", payload.duration ?? 0);
        }

        if (payload.done) {
          return parseCorrections(Array.isArray(payload.corrections) ? payload.corrections : []);
        }
      }
    }

    throw new Error("Stream ended without done event");
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") throw new Error("Delai d'attente depasse");
      if (error.message.includes("Failed to fetch"))
        throw new Error(
          "Impossible de contacter le serveur de correction. Verifiez que le serveur LLM est lance.",
        );
    }
    throw error;
  }
}
