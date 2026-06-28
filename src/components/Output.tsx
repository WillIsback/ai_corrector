import { useState } from "react";
import type { CorrectionEntry } from "../types";

interface Props {
  outputText: string;
  corrections: CorrectionEntry[];
  stats: {
    processingTime: number;
    modificationCount: number;
    ltPreCorrections: number;
    ltPostCorrections: number;
  };
  onCopy: (text: string) => void;
  onReset: () => void;
  isLoading: boolean;
  isLoadingCorrections?: boolean;
  ltWarning?: string | null;
}

export function Output({
  outputText,
  corrections,
  stats,
  onCopy,
  onReset,
  isLoading,
  isLoadingCorrections,
  ltWarning,
}: Props) {
  const [correctionsOpen, setCorrectionsOpen] = useState(false);
  return (
    <div className="flex-1 flex flex-col min-w-0 border-l border-gray-200/50 dark:border-gray-700/50">
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto h-full flex flex-col">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Résultat corrigé
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Texte corrigé selon vos paramètres
            </p>
          </div>

          <div
            className="flex-1 min-h-[320px] bg-surface-50 dark:bg-gray-800/50 p-5 rounded-2xl
              border border-gray-200/60 dark:border-gray-700/60 shadow-subtle"
          >
            {outputText ? (
              <p className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {outputText}
              </p>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <svg
                    aria-hidden="true"
                    className="w-6 h-6 text-gray-300 dark:text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-[200px]">
                  Le texte corrigé apparaîtra ici
                </p>
              </div>
            )}
          </div>

          {isLoadingCorrections && !outputText && (
            <div className="mt-5 flex items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
              <svg
                aria-hidden="true"
                className="w-4 h-4 animate-spin text-brand-500"
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
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Correction en cours…
            </div>
          )}

          {outputText && (
            <div className="animate-slide-up">
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div
                  className="bg-white dark:bg-gray-800/80 p-3.5 rounded-xl border border-gray-200/60
                    dark:border-gray-700/60 shadow-subtle"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      aria-hidden="true"
                      className="w-3.5 h-3.5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Temps
                    </span>
                  </div>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white tabular-nums">
                    {stats.processingTime}
                    <span className="text-sm font-normal text-gray-400 ml-0.5">ms</span>
                  </p>
                </div>

                <div
                  className="bg-white dark:bg-gray-800/80 p-3.5 rounded-xl border border-gray-200/60
                    dark:border-gray-700/60 shadow-subtle"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      aria-hidden="true"
                      className="w-3.5 h-3.5 text-brand-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                    <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Corrections
                    </span>
                  </div>
                  {isLoadingCorrections ? (
                    <svg
                      aria-hidden="true"
                      className="w-5 h-5 mt-0.5 animate-spin text-brand-500"
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
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <p className="text-xl font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
                      {stats.modificationCount}
                    </p>
                  )}
                </div>

                {stats.ltPreCorrections > 0 && (
                  <div
                    className="bg-white dark:bg-gray-800/80 p-3.5 rounded-xl border border-amber-200/60
                      dark:border-amber-800/40 shadow-subtle"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-medium text-amber-500 uppercase tracking-wider">
                        LT Pré
                      </span>
                    </div>
                    <p className="text-xl font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {stats.ltPreCorrections}
                    </p>
                  </div>
                )}

                {stats.ltPostCorrections > 0 && (
                  <div
                    className="bg-white dark:bg-gray-800/80 p-3.5 rounded-xl border border-amber-200/60
                      dark:border-amber-800/40 shadow-subtle"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-medium text-amber-500 uppercase tracking-wider">
                        LT Post
                      </span>
                    </div>
                    <p className="text-xl font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {stats.ltPostCorrections}
                    </p>
                  </div>
                )}
              </div>

              {ltWarning && (
                <div className="mt-3 p-3 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl">
                  <p className="text-xs text-amber-600 dark:text-amber-400">{ltWarning}</p>
                </div>
              )}

              {isLoadingCorrections && (
                <div className="mt-5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <svg
                    aria-hidden="true"
                    className="w-3.5 h-3.5 animate-spin text-brand-500"
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
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="uppercase tracking-wider font-semibold">
                    Analyse des corrections…
                  </span>
                </div>
              )}

              {corrections.length > 0 && (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setCorrectionsOpen((o) => !o)}
                    className="flex items-center gap-2 w-full text-left group"
                  >
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Corrections ({corrections.length})
                    </span>
                    <svg
                      aria-hidden="true"
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${correctionsOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {correctionsOpen && (
                    <div
                      className="mt-2 bg-surface-50 dark:bg-gray-800/50 rounded-2xl border
                        border-gray-200/60 dark:border-gray-700/60 shadow-subtle divide-y
                        divide-gray-100 dark:divide-gray-700/60 overflow-hidden"
                    >
                      {corrections.map((c, i) => (
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: corrections list is static per render
                          key={i}
                          className="grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-2 px-4 py-2.5 text-[13px] min-w-0"
                        >
                          <span
                            className="text-red-500 dark:text-red-400 line-through font-mono truncate"
                            title={c.avant}
                          >
                            {c.avant}
                          </span>
                          <span className="text-gray-400 shrink-0">→</span>
                          <span
                            className="text-emerald-700 dark:text-emerald-400 font-mono truncate"
                            title={c.apres}
                          >
                            {c.apres}
                          </span>
                          <span
                            className="text-[11px] text-gray-400 dark:text-gray-500 italic truncate text-right"
                            title={c.regle}
                          >
                            {c.regle}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => onCopy(outputText)}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5
                    bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100
                    text-white dark:text-gray-900 rounded-xl text-sm font-semibold
                    transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
                >
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
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Copier
                </button>
                {!isLoading && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium
                      text-gray-500 dark:text-gray-400
                      hover:bg-gray-100 dark:hover:bg-gray-800
                      hover:text-gray-700 dark:hover:text-gray-200
                      transition-all duration-200"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
