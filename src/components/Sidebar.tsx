import type React from "react";
import { useEffect, useState } from "react";
import type { CorrectionMode, CorrectionSettings } from "../types";
import { getCurrentModel, subscribeToModelChange } from "../utils/api";
import { ModelSelector } from "./ModelSelector";

interface Props {
  settings: CorrectionSettings;
  setSettings: (settings: CorrectionSettings) => void;
}

const modeLabels: Record<CorrectionMode, { label: string; icon: string }> = {
  formel: { label: "Formel", icon: "F" },
  "semi-formel": { label: "Semi-formel", icon: "SF" },
  informel: { label: "Informel", icon: "I" },
  technical: { label: "Technique", icon: "T" },
};

export function Sidebar({ settings, setSettings }: Props) {
  const modeKeys = Object.keys(modeLabels) as CorrectionMode[];
  const [currentModel, setCurrentModelState] = useState(getCurrentModel);

  useEffect(() => {
    return subscribeToModelChange(setCurrentModelState);
  }, []);

  const handleModeChange = (newMode: CorrectionMode) => {
    setSettings({ ...settings, mode: newMode });
  };

  const handleSettingChange = (setting: keyof CorrectionSettings, value: boolean) => {
    setSettings({ ...settings, [setting]: value });
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown": {
        e.preventDefault();
        handleModeChange(modeKeys[(index + 1) % modeKeys.length]);
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        e.preventDefault();
        handleModeChange(modeKeys[(index - 1 + modeKeys.length) % modeKeys.length]);
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        handleModeChange(modeKeys[index]);
        break;
      }
    }
  };

  return (
    <aside className="w-[260px] shrink-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border-r border-gray-200/50 dark:border-gray-700/50 p-5 overflow-y-auto">
      <div className="mb-5">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
          Mode de correction
        </h2>

        <div role="radiogroup" aria-label="Mode de correction" className="space-y-1">
          {modeKeys.map((key, index) => {
            const isSelected = settings.mode === key;
            return (
              <div key={key}>
                <input
                  type="radio"
                  id={`mode-${key}`}
                  name="mode"
                  value={key}
                  checked={isSelected}
                  onChange={() => handleModeChange(key)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={`mode-${key}`}
                  role="radio"
                  tabIndex={0}
                  aria-checked={isSelected}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onClick={() => handleModeChange(key)}
                  className={`flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200
                    ${
                      isSelected
                        ? "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 shadow-subtle"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
                    }
                    focus:outline-none focus:ring-2 focus:ring-brand-500/20`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center transition-colors
                    ${
                      isSelected
                        ? "bg-brand-500 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {modeLabels[key].icon}
                  </span>
                  <span>{modeLabels[key].label}</span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
          Corrections
        </h2>

        <div className="space-y-0.5">
          {[
            { key: "fixGrammar" as const, label: "Grammaire" },
            { key: "fixSpelling" as const, label: "Orthographe" },
            { key: "fixSyntax" as const, label: "Syntaxe" },
            { key: "fixStyle" as const, label: "Style" },
          ].map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer
                hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => handleSettingChange(key, e.target.checked)}
                  className="peer sr-only"
                />
                <div
                  className="w-4 h-4 rounded-[5px] border-2 border-gray-300 dark:border-gray-600
                    peer-checked:border-brand-500 peer-checked:bg-brand-500
                    transition-all duration-150 flex items-center justify-center"
                >
                  <svg
                    aria-hidden="true"
                    className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
            </label>
          ))}

          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60">
            <label
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer
                hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.showCorrections}
                  onChange={(e) => handleSettingChange("showCorrections", e.target.checked)}
                  className="peer sr-only"
                />
                <div
                  className="w-4 h-4 rounded-[5px] border-2 border-gray-300 dark:border-gray-600
                    peer-checked:border-brand-500 peer-checked:bg-brand-500
                    transition-all duration-150 flex items-center justify-center"
                >
                  <svg
                    aria-hidden="true"
                    className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Détail des corrections
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {settings.showCorrections ? "Ralentit l'inférence" : "Mode rapide"}
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <ModelSelector currentModel={currentModel} onModelSelect={setCurrentModelState} />

      <div className="pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
          LanguageTool
          <span className="text-[10px] font-normal text-gray-300 dark:text-gray-600 ml-1.5 normal-case">
            toujours actif
          </span>
        </h2>

        <div className="space-y-0.5">
          <label
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer
              hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="relative">
              <input
                type="checkbox"
                checked={settings.ltPreFire}
                onChange={(e) => setSettings({ ...settings, ltPreFire: e.target.checked })}
                className="peer sr-only"
              />
              <div
                className="w-4 h-4 rounded-[5px] border-2 border-gray-300 dark:border-gray-600
                  peer-checked:border-amber-500 peer-checked:bg-amber-500
                  transition-all duration-150 flex items-center justify-center"
              >
                <svg
                  aria-hidden="true"
                  className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">Pré-correction</span>
          </label>

          <label
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer
              hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="relative">
              <input
                type="checkbox"
                checked={settings.ltPostFire}
                onChange={(e) => setSettings({ ...settings, ltPostFire: e.target.checked })}
                className="peer sr-only"
              />
              <div
                className="w-4 h-4 rounded-[5px] border-2 border-gray-300 dark:border-gray-600
                  peer-checked:border-amber-500 peer-checked:bg-amber-500
                  transition-all duration-150 flex items-center justify-center"
              >
                <svg
                  aria-hidden="true"
                  className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">Post-correction</span>
          </label>
        </div>
      </div>
    </aside>
  );
}
