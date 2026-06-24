import type React from "react";
import type { DiffChunk, SuspectWord } from "../types";
import { SuspectWord as SuspectBadge } from "./SuspectBadge";

interface Props {
  outputText: string;
  diffChunks: DiffChunk[];
  suspects: SuspectWord[];
  onKeepWord: (word: string) => void;
  onRejectWord: (word: string) => void;
  stats: {
    processingTime: number;
    modificationCount: number;
    ltPreCorrections: number;
    ltPostCorrections: number;
  };
  onCopy: (text: string) => void;
  onReset: () => void;
  isLoading: boolean;
  ltWarning?: string | null;
}

function renderTextWithSuspects(
  text: string,
  suspects: SuspectWord[],
  onKeep: (word: string) => void,
  onReject: (word: string) => void,
): React.ReactNode[] {
  if (suspects.length === 0) {
    return [<span key="text">{text}</span>];
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  const sorted = [...suspects].sort((a, b) => a.offset - b.offset);

  for (const suspect of sorted) {
    if (suspect.offset > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, suspect.offset)}</span>);
    }

    parts.push(
      <SuspectBadge
        key={`suspect-${suspect.offset}`}
        word={suspect.originalText}
        onKeep={() => onKeep(suspect.originalText)}
        onReject={() => onReject(suspect.originalText)}
      />,
    );

    lastIndex = suspect.offset + suspect.length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return parts;
}

export function Output({
  outputText,
  diffChunks,
  suspects,
  onKeepWord,
  onRejectWord,
  stats,
  onCopy,
  onReset,
  isLoading,
  ltWarning,
}: Props) {
  const hasChanges = diffChunks.some((c) => c.type !== "unchanged");
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
                {renderTextWithSuspects(outputText, suspects, onKeepWord, onRejectWord)}
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
                      Différence
                    </span>
                  </div>
                  <p className="text-xl font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
                    {stats.modificationCount}
                    <span className="text-sm font-normal text-gray-400 ml-0.5">car.</span>
                  </p>
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

              {hasChanges && (
                <div className="mt-5 animate-slide-up">
                  <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                    Modifications
                  </h3>
                  <div
                    className="bg-surface-50 dark:bg-gray-800/50 p-4 rounded-2xl border
                      border-gray-200/60 dark:border-gray-700/60 shadow-subtle
                      text-[14px] leading-relaxed font-mono"
                  >
                    {diffChunks.map((chunk, i) => {
                      if (chunk.type === "removed") {
                        return (
                          <del
                            key={i}
                            className="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-0.5 rounded no-underline line-through"
                          >
                            {chunk.text}
                          </del>
                        );
                      }
                      if (chunk.type === "added") {
                        return (
                          <span
                            key={i}
                            className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-0.5 rounded"
                          >
                            {chunk.text}
                          </span>
                        );
                      }
                      return <span key={i} className="text-gray-500 dark:text-gray-400">{chunk.text}</span>;
                    })}
                  </div>
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
