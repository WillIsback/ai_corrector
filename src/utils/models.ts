import type { ModelInfo } from "../types";

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
  const response = await fetch("/v1/models", {
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
    // vLLM peut ne pas être disponible — conserver la valeur par défaut
  }
}
