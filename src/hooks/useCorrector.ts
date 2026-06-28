import { useCallback, useEffect, useRef, useState } from "react";
import { applyLTCorrections, runLanguageTool } from "../services/languagetool";
import type { CorrectionEntry, CorrectionSettings, CorrectionStats } from "../types";
import { correctText } from "../utils/llm";

export function useCorrector() {
  const [textContent, setTextContent] = useState("");
  const [outputText, setOutputText] = useState("");
  const [corrections, setCorrections] = useState<CorrectionEntry[]>([]);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isLoadingCorrections, setIsLoadingCorrections] = useState(false);
  const [settings, setSettings] = useState<CorrectionSettings>({
    engine: "llm",
    mode: "formel",
    fixGrammar: true,
    fixSpelling: true,
    fixSyntax: true,
    fixStyle: true,
    showCorrections: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CorrectionStats>({
    processingTime: 0,
    modificationCount: 0,
  });

  const isRunningRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Charger les settings sauvegardés
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("ai-corrector:settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* use defaults */
    }
  }, []);

  // Cleanup à l'unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (localStorageTimeoutRef.current) clearTimeout(localStorageTimeoutRef.current);
    };
  }, []);

  const localStorageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce de la sauvegarde des settings (500ms)
  useEffect(() => {
    if (localStorageTimeoutRef.current) clearTimeout(localStorageTimeoutRef.current);
    localStorageTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem("ai-corrector:settings", JSON.stringify(settings));
      } catch {
        /* ignore */
      }
    }, 500);
    return () => {
      if (localStorageTimeoutRef.current) clearTimeout(localStorageTimeoutRef.current);
    };
  }, [settings]);

  const handleCorrect = useCallback(async () => {
    if (isRunningRef.current) return;
    if (!textContent.trim()) {
      setError("Veuillez entrer du texte");
      return;
    }

    isRunningRef.current = true;
    setIsLoadingText(true);
    setIsLoadingCorrections(false);
    setError(null);
    setOutputText("");
    setCorrections([]);
    setStats({ processingTime: 0, modificationCount: 0 });

    abortControllerRef.current = new AbortController();

    try {
      if (settings.engine === "lt") {
        // Moteur LanguageTool
        const startTime = Date.now();
        const matches = await runLanguageTool(textContent, abortControllerRef.current.signal);
        const { correctedText, corrections: ltCorrections } = applyLTCorrections(
          textContent,
          matches,
        );
        setOutputText(correctedText);
        setCorrections(ltCorrections);
        setStats({
          processingTime: Date.now() - startTime,
          modificationCount: ltCorrections.length,
        });
        setIsLoadingText(false);
      } else {
        // Moteur LLM
        let finalText = "";

        const llmCorrections = await correctText(textContent, settings, {
          onTextDone: (text, duration) => {
            finalText = text;
            setOutputText(text);
            setIsLoadingText(false);
            if (settings.showCorrections) setIsLoadingCorrections(true);
            setStats((prev) => ({ ...prev, processingTime: duration }));
          },
        });

        if (!finalText || finalText.trim().length === 0) {
          throw new Error("LLM returned empty response");
        }

        setCorrections(llmCorrections);
        setIsLoadingCorrections(false);
        setStats((prev) => ({ ...prev, modificationCount: llmCorrections.length }));
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Une erreur inconnue est survenue");
    } finally {
      isRunningRef.current = false;
      setIsLoadingText(false);
      setIsLoadingCorrections(false);
      abortControllerRef.current = null;
    }
  }, [textContent, settings]);

  const handleReset = useCallback(() => {
    setTextContent("");
    setOutputText("");
    setCorrections([]);
    setStats({ processingTime: 0, modificationCount: 0 });
    setError(null);
  }, []);

  return {
    textContent,
    setTextContent,
    outputText,
    corrections,
    settings,
    setSettings,
    isLoading: isLoadingText,
    isLoadingCorrections,
    error,
    stats,
    handleCorrect,
    handleReset,
  };
}
