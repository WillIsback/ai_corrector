import type { CorrectionMode, CorrectionSettings } from "../types";

// Module-level ref to store the current AbortController for cleanup
let currentAbortController: AbortController | null = null;

/**
 * Abort any ongoing API request
 */
export function abortOngoingRequest() {
  currentAbortController?.abort();
  currentAbortController = null;
}

// Maximum content length to prevent prompt injection and abuse
const MAX_CONTENT_LENGTH = 10000;

/**
 * Sanitizes user input text for LLM processing
 * - Removes control characters (except newlines and tabs)
 * - Truncates to MAX_CONTENT_LENGTH
 * - Validates non-empty
 */
function sanitizeInput(text: string): string {
  // Trim leading/trailing whitespace
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    throw new Error("Le texte ne peut pas être vide");
  }

  // Remove control characters except newlines (\n) and tabs (\t)
  // This prevents prompt injection via control characters
  const sanitized = trimmed.replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");

  // Truncate to max length
  if (sanitized.length > MAX_CONTENT_LENGTH) {
    return sanitized.substring(0, MAX_CONTENT_LENGTH);
  }

  return sanitized;
}

export interface LLMRequest {
  model: string;
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
  temperature: number;
}

export interface LLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

export async function correctText(text: string, settings: CorrectionSettings): Promise<string> {
  const systemPrompt = buildSystemPrompt(settings);
  const userPrompt = sanitizeInput(text);

  const model = import.meta.env.VITE_LLM_MODEL_NAME || "auto";

  const request: LLMRequest = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
  };

  // Cancel any ongoing request before starting a new one
  currentAbortController?.abort();
  const controller = new AbortController();
  currentAbortController = controller;

  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer no-key-needed",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Clean up the ref after completion
    currentAbortController = null;

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: LLMResponse = await response.json();

    if (data.choices?.[0]?.message) {
      return data.choices[0].message.content.trim();
    }

    throw new Error("Invalid response format");
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("Delai d'attente depasse");
      }
      if (error.message.includes("Failed to fetch")) {
        throw new Error(
          "Impossible de contacter le serveur de correction. Verifiez que le serveur LLM est lance sur http://127.0.0.1:30000/v1",
        );
      }
    }
    throw error;
  }
}

function buildSystemPrompt(settings: CorrectionSettings): string {
  const modeDescriptions: Record<CorrectionMode, string> = {
    formel: "Formel et professionnel",
    "semi-formel": "Neutre, adapte au courrier",
    informel: "Decontracte, style conversationnel",
    technical: "Texte technique, clarte et precision",
  };

  const activeCorrections = Object.entries(settings)
    .filter(([, value]) => value === true)
    .map(([key]) => key)
    .join(", ");

  return (
    "Tu es un correcteur editorial expert en francais. Corrige UNIQUEMENT le texte fourni. Sois precis et ne change que ce qui necessite une correction. Mode: " +
    modeDescriptions[settings.mode] +
    " (" +
    (activeCorrections || "toutes") +
    "). Renvoie uniquement le texte corrige en une seule fois, sans historique des modifications, sans version avant/apres, sans commentaires ou annotations, sans markdown, sans repetitions du texte."
  );
}
