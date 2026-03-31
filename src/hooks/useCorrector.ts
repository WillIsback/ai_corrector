import { useCallback, useEffect, useState } from "react";
import { checkLanguageTool } from "../services/languagetool";
import type { CorrectionSettings, CorrectionStats } from "../types";
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

  useEffect(() => {
    const savedSettings = localStorage.getItem("ai-corrector:settings");

    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch {
        // Use defaults
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ai-corrector:settings", JSON.stringify(settings));
  }, [settings]);

  const handleCorrect = useCallback(async () => {
    if (!textContent.trim()) {
      setError("Veuillez entrer du texte");
      return;
    }

    setIsLoading(true);
    setError(null);
    setOutputText("");
    setLtWarning(null);
    setStats({
      processingTime: 0,
      modificationCount: 0,
      ltPreCorrections: 0,
      ltPostCorrections: 0,
    });

    const startTime = performance.now();
    let currentText = textContent;

    try {
      // Pre-fire LT
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

      const originalLength = textContent.length;
      const correctedLength = finalText.length;
      const modificationCount =
        originalLength !== correctedLength ? Math.abs(correctedLength - originalLength) : 0;

      setOutputText(finalText);
      setStats((prev) => ({
        ...prev,
        processingTime: Math.round(performance.now() - startTime),
        modificationCount,
      }));
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Une erreur inconnue est survenue");
      }
    } finally {
      setIsLoading(false);
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
  }, []);

  return {
    textContent,
    setTextContent,
    outputText,
    settings,
    setSettings,
    isLoading,
    error,
    stats,
    ltWarning,
    handleCorrect,
    handleReset,
  };
}
