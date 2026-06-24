import { useCallback, useEffect, useRef, useState } from "react";
import { checkLanguageTool } from "../services/languagetool";
import type { CorrectionSettings, CorrectionStats } from "../types";
import { type CorrectionEntry, correctText, type StreamCallbacks } from "../utils/api";

export function useCorrector() {
  const [textContent, setTextContent] = useState("");
  const [outputText, setOutputText] = useState("");
  const [corrections, setCorrections] = useState<CorrectionEntry[]>([]);
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

  const isRunningRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamBufRef = useRef("");
  const rafRef = useRef<number | null>(null);

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
    setCorrections([]);
    setLtWarning(null);
    setStats({
      processingTime: 0,
      modificationCount: 0,
      ltPreCorrections: 0,
      ltPostCorrections: 0,
    });

    let currentText = textContent;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Pre-fire LT on original text
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

      // LLM inference — streaming avec séparation texte / corrections
      streamBufRef.current = "";
      const flushStream = () => {
        if (streamBufRef.current) {
          const chunk = streamBufRef.current;
          streamBufRef.current = "";
          setOutputText((prev) => prev + chunk);
        }
        rafRef.current = null;
      };

      let finalText = "";

      const callbacks: StreamCallbacks = {
        onDelta: (delta) => {
          streamBufRef.current += delta;
          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(flushStream);
          }
        },
        onTextDone: (text, duration) => {
          // Flush remaining buffer immediately
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          if (streamBufRef.current) { streamBufRef.current = ""; }
          finalText = text;
          // Update text + stats immediately — corrections come later via done event
          setOutputText(text);
          setStats((prev) => ({ ...prev, processingTime: duration }));
        },
      };

      const corrections = await correctText(currentText, settings, callbacks);

      // Cancel any leftover RAF
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

      if (!finalText || finalText.trim().length === 0) {
        throw new Error("LLM returned empty response");
      }

      // Post-fire LT (optional) — updates text if needed
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
      setStats((prev) => ({
        ...prev,
        modificationCount: corrections.length,
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
    isLoading,
    isRunning,
    error,
    stats,
    ltWarning,
    handleCorrect,
    handleReset,
  };
}
