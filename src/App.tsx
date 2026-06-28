import { useEffect, useState } from "react";
import { Editor } from "./components/Editor";
import { Header } from "./components/Header";
import { LTSetupBanner } from "./components/LTSetupBanner";
import { Output } from "./components/Output";
import { Sidebar } from "./components/Sidebar";
import { Toast } from "./components/Toast";
import { useCorrector } from "./hooks/useCorrector";
import { useLanguageTool } from "./hooks/useLanguageTool";
import { initModel } from "./utils/models";

function App() {
  const {
    textContent,
    setTextContent,
    outputText,
    corrections,
    settings,
    setSettings,
    isLoading,
    isLoadingCorrections,
    error,
    stats,
    handleCorrect,
    handleReset,
  } = useCorrector();

  const { isAvailable: ltAvailable } = useLanguageTool();

  useEffect(() => {
    initModel();
  }, []);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const handleCopySuccess = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({
      id: `copy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      message: "Texte copié dans le presse-papier",
      type: "success",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/40 via-transparent to-transparent dark:from-blue-950/20 pointer-events-none" />

      {settings.engine === "lt" && !ltAvailable && <LTSetupBanner />}
      <Header theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar settings={settings} setSettings={setSettings} />

        <Editor
          text={textContent}
          onChange={setTextContent}
          onCorrect={handleCorrect}
          isLoading={isLoading}
        />

        <Output
          outputText={outputText}
          corrections={corrections}
          stats={stats}
          onCopy={handleCopySuccess}
          onReset={handleReset}
          isLoading={isLoading}
          isLoadingCorrections={isLoadingCorrections}
        />
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {error && (
        <div className="bg-red-50/80 dark:bg-red-950/30 border-t border-red-200/60 dark:border-red-800/40 backdrop-blur-sm">
          <div className="flex items-center justify-between max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <svg
                  aria-hidden="true"
                  className="w-3.5 h-3.5 text-red-500"
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
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button
              type="button"
              onClick={handleCorrect}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all duration-200 active:scale-[0.98]"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
