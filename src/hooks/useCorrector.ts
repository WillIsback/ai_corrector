import { useCallback, useEffect, useRef, useState } from "react";
import { detectEntities, markEntitiesInOutput } from "../services/entityDetector";
import { checkLanguageTool } from "../services/languagetool";
import { addValidWord, loadValidWords } from "../services/validWords";
import type { CorrectionSettings, CorrectionStats, SuspectWord } from "../types";
import { correctText } from "../utils/api";

export function useCorrector() {
  const [textContent, setTextContent] = useState("");
  const [outputText, setOutputText] = useState("");
  const [settings, setSettings] = useState<CorrectionSettings>({
    mode: "formel",
    fixGrammar: true,
    fixSpelling: true,
    fixSyntax: true,
    fixStyle: true,
    ltEnabled: true,
    ltPreFire: true,
    ltPostFire: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CorrectionStats>({
    processingTime: 0,
    modificationCount: 0,
    ltPreCorrections: 0,
    ltPostCorrections: 0,
  });
  const [ltWarning, setLtWarning] = useState<string | null>(null);
  const [suspects, setSuspects] = useState<SuspectWord[]>([]);

  const isRunningRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("ai-corrector:settings");
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch {
      // Use defaults
    }
  }, []);

  const localStorageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (localStorageTimeoutRef.current) {
        clearTimeout(localStorageTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (localStorageTimeoutRef.current) {
      clearTimeout(localStorageTimeoutRef.current);
    }

    localStorageTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem("ai-corrector:settings", JSON.stringify(settings));
      } catch {
        // Ignore storage errors
      }
    }, 500);

    return () => {
      if (localStorageTimeoutRef.current) {
        clearTimeout(localStorageTimeoutRef.current);
      }
    };
  }, [settings]);

  const handleCorrect = useCallback(async () => {
    if (isRunningRef.current) {
      return;
    }

    if (!textContent.trim()) {
      setError("Veuillez entrer du texte");
      return;
    }

    isRunningRef.current = true;
    setIsRunning(true);
    setIsLoading(true);
    setError(null);
    setOutputText("");
    setLtWarning(null);
    setSuspects([]);
    setStats({
      processingTime: 0,
      modificationCount: 0,
      ltPreCorrections: 0,
      ltPostCorrections: 0,
    });

    const startTime = performance.now();
    let currentText = textContent;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Detect entities in the input text (for marking later)
      const validWords = await loadValidWords();
      const detectedEntities = detectEntities(textContent, validWords);

      // Pre-fire LT on original text (no placeholder protection)
      if (settings.ltEnabled && settings.ltPreFire) {
        try {
          const preResult = await checkLanguageTool(currentText);
          if (preResult.matchCount > 0 && preResult.correctedText !== currentText) {
            currentText = preResult.correctedText;
            setStats((prev) => ({ ...prev, ltPreCorrections: preResult.matchCount }));
          }
        } catch (e) {
          console.warn("Pre-fire LT failed:", e);
          setLtWarning("Pre-correction LanguageTool non disponible");
        }
      }

      // LLM inference
      const llmCorrected = await correctText(currentText, settings);

      if (!llmCorrected || llmCorrected.trim().length === 0) {
        throw new Error("LLM returned empty response");
      }

      // Post-fire LT (optional)
      let finalText = llmCorrected;
      if (settings.ltEnabled && settings.ltPostFire) {
        try {
          const postResult = await checkLanguageTool(llmCorrected);
          if (postResult.matchCount > 0 && postResult.correctedText !== llmCorrected) {
            finalText = postResult.correctedText;
            setStats((prev) => ({ ...prev, ltPostCorrections: postResult.matchCount }));
          }
        } catch (e) {
          console.warn("Post-fire LT failed:", e);
        }
      }

      // Mark detected entities in the final output text
      const outputSuspects = markEntitiesInOutput(finalText, detectedEntities);

      const originalLength = textContent.length;
      const correctedLength = finalText.length;
      const modificationCount =
        originalLength !== correctedLength ? Math.abs(correctedLength - originalLength) : 0;

      setSuspects(outputSuspects);
      setOutputText(finalText);
      setStats((prev) => ({
        ...prev,
        processingTime: Math.round(performance.now() - startTime),
        modificationCount,
      }));
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Une erreur inconnue est survenue");
      }
    } finally {
      isRunningRef.current = false;
      setIsRunning(false);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [textContent, settings]);

  const handleReset = useCallback(() => {
    setTextContent("");
    setOutputText("");
    setStats({
      processingTime: 0,
      modificationCount: 0,
      ltPreCorrections: 0,
      ltPostCorrections: 0,
    });
    setError(null);
    setLtWarning(null);
    setSuspects([]);
  }, []);

  const handleKeepWord = useCallback(async (word: string) => {
    await addValidWord(word);
    setSuspects((prev) => prev.filter((s) => s.originalText !== word));
  }, []);

  const handleRejectWord = useCallback((word: string) => {
    setSuspects((prev) => prev.filter((s) => s.originalText !== word));
  }, []);

  return {
    textContent,
    setTextContent,
    outputText,
    settings,
    setSettings,
    isLoading,
    isRunning,
    error,
    stats,
    ltWarning,
    suspects,
    handleCorrect,
    handleReset,
    handleKeepWord,
    handleRejectWord,
  };
}
