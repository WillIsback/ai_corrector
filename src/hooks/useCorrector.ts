import { useCallback, useEffect, useRef, useState } from "react";
import { checkLanguageTool } from "../services/languagetool";
import type { CorrectionSettings, CorrectionStats } from "../types";
import { type CorrectionEntry, correctText } from "../utils/api";

export function useCorrector() {
  const [textContent, setTextContent] = useState("");
  const [outputText, setOutputText] = useState("");
  const [corrections, setCorrections] = useState<CorrectionEntry[]>([]);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isLoadingCorrections, setIsLoadingCorrections] = useState(false);
  const [settings, setSettings] = useState<CorrectionSettings>({
    mode: "formel",
    fixGrammar: true,
    fixSpelling: true,
    fixSyntax: true,
    fixStyle: true,
    showCorrections: true,
    ltEnabled: true,
    ltPreFire: true,
    ltPostFire: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CorrectionStats>({
    processingTime: 0,
    modificationCount: 0,
    ltPreCorrections: 0,
    ltPostCorrections: 0,
  });
  const [ltWarning, setLtWarning] = useState<string | null>(null);

  const isRunningRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("ai-corrector:settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Merge with defaults to handle missing fields from older versions
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* use defaults */
    }
  }, []);

  const localStorageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (localStorageTimeoutRef.current) clearTimeout(localStorageTimeoutRef.current);
    };
  }, []);

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
    setLtWarning(null);
    setStats({
      processingTime: 0,
      modificationCount: 0,
      ltPreCorrections: 0,
      ltPostCorrections: 0,
    });

    let currentText = textContent;
    abortControllerRef.current = new AbortController();

    try {
      // Pre-fire LT
      if (settings.ltEnabled && settings.ltPreFire) {
        try {
          const preResult = await checkLanguageTool(currentText, []);
          if (preResult.matchCount > 0 && preResult.correctedText !== currentText) {
            currentText = preResult.correctedText;
            setStats((prev) => ({ ...prev, ltPreCorrections: preResult.matchCount }));
          }
        } catch (e) {
          console.warn("Pre-fire LT failed:", e);
          setLtWarning("Pre-correction LanguageTool non disponible");
        }
      }

      let finalText = "";

      const corrections = await correctText(currentText, settings, {
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

      // Post-fire LT
      if (settings.ltEnabled && settings.ltPostFire) {
        try {
          const postResult = await checkLanguageTool(finalText);
          if (postResult.matchCount > 0 && postResult.correctedText !== finalText) {
            finalText = postResult.correctedText;
            setOutputText(finalText);
            setStats((prev) => ({ ...prev, ltPostCorrections: postResult.matchCount }));
          }
        } catch (e) {
          console.warn("Post-fire LT failed:", e);
        }
      }

      setCorrections(corrections);
      setIsLoadingCorrections(false);
      setStats((prev) => ({ ...prev, modificationCount: corrections.length }));
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
    setStats({
      processingTime: 0,
      modificationCount: 0,
      ltPreCorrections: 0,
      ltPostCorrections: 0,
    });
    setError(null);
    setLtWarning(null);
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
    ltWarning,
    handleCorrect,
    handleReset,
  };
}
