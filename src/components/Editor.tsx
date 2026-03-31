interface Props {
  text: string;
  onChange: (text: string) => void;
  onCorrect: () => void;
  isLoading: boolean;
}

export function Editor({ text, onChange, onCorrect, isLoading }: Props) {
  const charCount = text.length;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Texte à corriger
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Saisissez ou collez votre texte ci-dessous
              </p>
            </div>
            {charCount > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                {charCount.toLocaleString()} car.
              </span>
            )}
          </div>

          <div className="flex-1 relative group">
            <textarea
              value={text}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Collez votre texte ici pour le corriger..."
              className="w-full h-full min-h-[320px] p-5 bg-white dark:bg-gray-800/80
                border border-gray-200/80 dark:border-gray-700/80
                rounded-2xl shadow-subtle
                focus:ring-2 focus:ring-brand-500/20 focus:border-brand-300 dark:focus:border-brand-600
                text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600
                resize-none text-[15px] leading-relaxed font-normal
                transition-all duration-200"
              spellCheck={false}
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onCorrect}
              disabled={isLoading || !text.trim()}
              className={`group relative px-6 py-2.5 rounded-xl text-sm font-semibold
                transition-all duration-200
                ${
                  isLoading
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : !text.trim()
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                      : "bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white shadow-sm hover:shadow-md active:scale-[0.98]"
                }`}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Correction en cours...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                  Corriger
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
