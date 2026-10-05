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

type Pane = "editor" | "output";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePane, setActivePane] = useState<Pane>("editor");

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const handleCopySuccess = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({
      id: `copy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      message: "Texte copié dans le presse-papier",
      type: "success",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fc] dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <div className="fixed inset-0 -z-10 pointer-events-none bg-[radial-gradient(70%_45%_at_50%_0%,rgba(59,130,246,0.07),transparent_70%)] dark:bg-[radial-gradient(70%_45%_at_50%_0%,rgba(37,99,235,0.14),transparent_70%)]" />

      {settings.engine === "lt" && !ltAvailable && <LTSetupBanner />}
      <Header
        theme={theme}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
        onOpenSettings={() => setSidebarOpen(true)}
      />

      <div className="md:hidden px-4 pt-3">
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 dark:bg-gray-800/60 border border-gray-200/70 dark:border-gray-700/60 max-w-md mx-auto">
          {(
            [
              { id: "editor" as const, label: "Texte" },
              { id: "output" as const, label: "Résultat" },
            ] satisfies { id: Pane; label: string }[]
          ).map((tab) => {
            const isActive = activePane === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePane(tab.id)}
                aria-pressed={isActive}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${
                    isActive
                      ? "bg-white dark:bg-gray-700 text-brand-700 dark:text-brand-300 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          settings={settings}
          setSettings={setSettings}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex flex-1 min-w-0 overflow-hidden">
          <div className={`${activePane === "editor" ? "flex" : "hidden"} md:flex flex-1 min-w-0`}>
            <Editor
              text={textContent}
              onChange={setTextContent}
              onCorrect={handleCorrect}
              isLoading={isLoading}
            />
          </div>
          <div className={`${activePane === "output" ? "flex" : "hidden"} md:flex flex-1 min-w-0`}>
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
        </main>
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {error && (
        <div className="bg-red-50/90 dark:bg-red-950/40 border-t border-red-200/70 dark:border-red-800/40 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4 max-w-5xl mx-auto px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
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
              <p className="text-sm text-red-700 dark:text-red-300 truncate">{error}</p>
            </div>
            <button
              type="button"
              onClick={handleCorrect}
              className="shrink-0 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all duration-200 active:scale-[0.98]"
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
