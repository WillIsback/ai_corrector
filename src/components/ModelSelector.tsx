import { useEffect, useState, useCallback } from "react";
import { fetchModels, setCurrentModel, ModelInfo } from "../utils/api";

interface Props {
  currentModel: string;
  onModelSelect: (model: string) => void;
}

export function ModelSelector({ currentModel, onModelSelect }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await fetchModels();
      setModels(list);
    } catch (e) {
      console.warn("[ModelSelector] Failed to load models:", e);
      setError("Impossible de charger la liste des modèles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleSelect = (modelId: string) => {
    setCurrentModel(modelId);
    onModelSelect(modelId);
  };

  return (
    <div className="pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
        Modèle LLM
      </h2>

      {loading && (
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-3 h-3 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Chargement…</span>
        </div>
      )}

      {error && !loading && (
        <div className="px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={loadModels}
            className="mt-1 text-xs text-brand-500 hover:text-brand-600 transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && models.length === 0 && (
        <div className="px-3 py-2">
          <p className="text-xs text-gray-400">Aucun modèle disponible</p>
        </div>
      )}

      {!loading && models.length > 0 && (
        <div className="space-y-0.5">
          {models.map((m) => {
            const isActive = currentModel === m.id;
            return (
              <button
                key={m.id}
                onClick={() => handleSelect(m.id)}
                className={`w-full flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-xl text-left transition-all duration-200
                  ${
                    isActive
                      ? "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 shadow-subtle"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                    ${
                      isActive
                        ? "border-brand-500 bg-brand-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                >
                  {isActive && (
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </span>
                <span className="text-sm font-medium truncate">{m.id}</span>
              </button>
            );
          })}
        </div>
      )}

      {!loading && models.length > 0 && (
        <button
          onClick={loadModels}
          className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-3 py-1"
        >
          Rafraîchir
        </button>
      )}
    </div>
  );
}
