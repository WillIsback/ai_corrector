import { useEffect, useState } from "react";
import { Editor } from "./components/Editor";
import { Header } from "./components/Header";
import { LTSetupBanner } from "./components/LTSetupBanner";
import { Output } from "./components/Output";
import { Sidebar } from "./components/Sidebar";
import { Toast } from "./components/Toast";
import { useCorrector } from "./hooks/useCorrector";
import { useLanguageTool } from "./hooks/useLanguageTool";

function App() {
  const {
    textContent,
    setTextContent,
    outputText,
    settings,
    setSettings,
    isLoading,
    error,
    stats,
    ltWarning,
    suspects,
    handleCorrect,
    handleReset,
    handleKeepWord,
    handleRejectWord,
  } = useCorrector();

  const { isAvailable: ltAvailable } = useLanguageTool();

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches) {
      return "dark";
    }
    return "light";
  });

  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const handleCloseToast = () => {
    setToast(null);
  };

  const handleCopySuccess = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({
      id: `copy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      message: "Texte copie dans le presse-papier !",
      type: "success",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {!ltAvailable && <LTSetupBanner />}
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
          suspects={suspects}
          onKeepWord={handleKeepWord}
          onRejectWord={handleRejectWord}
          stats={stats}
          onCopy={handleCopySuccess}
          onReset={handleReset}
          isLoading={isLoading}
          ltWarning={ltWarning}
        />
      </div>

      {toast && <Toast toast={toast} onClose={handleCloseToast} />}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 px-6 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              type="button"
              onClick={handleCorrect}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
