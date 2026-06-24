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

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

let _currentModel: string = import.meta.env.VITE_LLM_MODEL_NAME || "auto";
const _modelListeners: Set<(model: string) => void> = new Set();

export function getCurrentModel(): string {
  return _currentModel;
}

export function setCurrentModel(model: string): void {
  _currentModel = model;
  for (const listener of _modelListeners) {
    listener(model);
  }
}

export function subscribeToModelChange(listener: (model: string) => void): () => void {
  _modelListeners.add(listener);
  return () => _modelListeners.delete(listener);
}

export async function fetchModels(): Promise<ModelInfo[]> {
  const response = await fetch("/corrector/v1/models", {
    headers: { Authorization: "Bearer no-key-needed" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }
  const data = await response.json();
  return (data.data ?? []) as ModelInfo[];
}

export async function initModel(): Promise<void> {
  try {
    const models = await fetchModels();
    if (models.length > 0 && _currentModel === "auto") {
      setCurrentModel(models[0].id);
    }
  } catch {
    // vLLM may not be available yet — keep default
  }
}

export interface LLMRequest {
  model: string;
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
  temperature: number;
  correction_mode?: string;
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

export interface CorrectionEntry {
  avant: string;
  apres: string;
  regle: string;
}

export interface CorrectionResult {
  text: string;
  corrections: CorrectionEntry[];
}

function parseCorrections(raw: unknown[]): CorrectionEntry[] {
  return raw.map((c) => {
    if (typeof c === "object" && c !== null) {
      const e = c as Record<string, unknown>;
      return { avant: String(e.avant ?? ""), apres: String(e.apres ?? ""), regle: String(e.regle ?? "") };
    }
    const str = String(c);
    const idx = str.indexOf(" -> ");
    return { avant: idx >= 0 ? str.slice(0, idx) : str, apres: idx >= 0 ? str.slice(idx + 4) : "", regle: "" };
  });
}

export interface StreamCallbacks {
  onTextDone?: (text: string, duration: number) => void;
}

export async function correctText(
  text: string,
  settings: CorrectionSettings,
  callbacks?: StreamCallbacks,
): Promise<CorrectionEntry[]> {
  const systemPrompt = buildSystemPrompt(settings);
  const userPrompt = sanitizeInput(text);

  const request: LLMRequest = {
    model: _currentModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    correction_mode: settings.mode,
  };

  currentAbortController?.abort();
  const controller = new AbortController();
  currentAbortController = controller;

  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("/corrector/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer no-key-needed" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    currentAbortController = null;

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    if (!response.body) throw new Error("No response body");

    // Consume SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // Process complete SSE events (delimited by double newline)
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
        throw new Error("Impossible de contacter le serveur de correction. Verifiez que le serveur LLM est lance.");
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

  const correctionLabels: Partial<Record<keyof CorrectionSettings, string>> = {
    fixGrammar: "grammaire",
    fixSpelling: "orthographe",
    fixSyntax: "syntaxe",
    fixStyle: "style",
  };

  const activeCorrections = (Object.entries(correctionLabels) as [keyof CorrectionSettings, string][])
    .filter(([key]) => settings[key] === true)
    .map(([, label]) => label)
    .join(", ");

  const base =
    "Tu es un correcteur editorial expert en francais. " +
    "Mode: " + modeDescriptions[settings.mode] + ". " +
    "Corrections actives: " + (activeCorrections || "toutes") + ". " +
    "Corrige UNIQUEMENT ce qui necessite une correction selon ces criteres. Ne change pas le sens ni le style au-dela du mode demande. " +
    "Reponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ou apres:\n";

  if (settings.showCorrections) {
    return (
      base +
      '{"texte_corrige": "le texte corrige complet", "corrections": [{"avant": "expression originale", "apres": "expression corrigee", "regle": "nom court de la regle ex: accord sujet-verbe"}, ...]}\n' +
      "Si aucune correction n'est necessaire, retourne corrections vide []."
    );
  }

  return base + '{"texte_corrige": "le texte corrige complet"}';
}
