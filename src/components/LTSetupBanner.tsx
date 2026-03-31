interface Props {
  onDismiss?: () => void;
}

export function LTSetupBanner({ onDismiss }: Props) {
  return (
    <div className="bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-200/60 dark:border-amber-800/40 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center shrink-0">
            <svg
              aria-hidden="true"
              className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              LanguageTool n&rsquo;est pas disponible
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Lancez le conteneur Docker avec{" "}
              <code className="bg-amber-100/80 dark:bg-amber-800/40 px-1.5 py-0.5 rounded-md font-mono text-[11px]">
                docker compose up -d
              </code>
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="w-7 h-7 rounded-lg flex items-center justify-center
              text-amber-500 dark:text-amber-400
              hover:bg-amber-100 dark:hover:bg-amber-800/40
              transition-colors"
          >
            <svg
              aria-hidden="true"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
