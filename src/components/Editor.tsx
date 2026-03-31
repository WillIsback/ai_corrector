interface Props {
  text: string;
  onChange: (text: string) => void;
  onCorrect: () => void;
  isLoading: boolean;
}

export function Editor({ text, onChange, onCorrect, isLoading }: Props) {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            📋 Texte à corriger
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Saisissez votre texte ci-dessous. Les corrections s'appliqueront en cliquant sur
            "Corriger".
          </p>
        </div>

        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Colez votre texte ici pour le corriger..."
          className="w-full h-96 p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
                    rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                    text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                    resize-y font-medium"
          spellCheck={false}
        />

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCorrect}
            disabled={isLoading || !text.trim()}
            className={`px-6 py-2 rounded-lg font-semibold transition-all
              ${
                isLoading
                  ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
          >
            {isLoading ? "Correction en cours..." : "Corriger"}
          </button>
        </div>
      </div>
    </div>
  );
}
