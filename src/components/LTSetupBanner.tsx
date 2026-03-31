interface Props {
  onDismiss?: () => void;
}

export function LTSetupBanner({ onDismiss }: Props) {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-amber-600 dark:text-amber-400 text-xl">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              LanguageTool n'est pas disponible
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Lancez le conteneur Docker avec docker compose pour activer la correction:
            </p>
            <code className="block mt-1 text-xs bg-amber-100 dark:bg-amber-800 px-2 py-1 rounded font-mono">
              docker compose up -d
            </code>
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
