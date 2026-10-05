interface Props {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export function Header({ theme, onToggleTheme, onOpenSettings }: Props) {
  const isDark = theme === "dark";

  return (
    <header className="border-b border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="flex justify-between items-center gap-3 px-4 sm:px-6 h-16">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-sm shadow-brand-500/25 shrink-0">
            <svg
              aria-hidden="true"
              className="w-[18px] h-[18px] text-white"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 21h8" />
              <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-gray-900 dark:text-white tracking-tight leading-tight truncate">
              AI Corrector
            </h1>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium tracking-wide truncate">
              Correcteur intelligent
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSettings}
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center
              text-gray-500 dark:text-gray-400
              hover:bg-gray-100 dark:hover:bg-gray-800
              hover:text-gray-700 dark:hover:text-gray-200
              transition-all duration-200"
            aria-label="Ouvrir les réglages"
          >
            <svg
              aria-hidden="true"
              className="w-[18px] h-[18px]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center
              text-gray-500 dark:text-gray-400
              hover:bg-gray-100 dark:hover:bg-gray-800
              hover:text-gray-700 dark:hover:text-gray-200
              transition-all duration-200"
            aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
          >
            {isDark ? (
              <svg
                aria-hidden="true"
                className="w-[18px] h-[18px]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Thème clair</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                className="w-[18px] h-[18px]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Thème sombre</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
