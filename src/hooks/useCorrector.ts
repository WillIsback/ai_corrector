import { useState, useCallback, useEffect } from 'react';
import { correctText } from '../utils/api';
import { computeDiff } from '../utils/diff';
import { checkLanguageTool } from '../services/languagetool';
import { CorrectionSettings, DiffChunk, CorrectionStats } from '../types';

export function useCorrector() {
  const [textContent, setTextContent] = useState('')
  const [outputText, setOutputText] = useState('')
  const [diffChunks, setDiffChunks] = useState<DiffChunk[]>([])
  const [settings, setSettings] = useState<CorrectionSettings>({
    mode: 'formel',
    fixGrammar: true,
    fixSpelling: true,
    fixSyntax: true,
    fixStyle: true,
    ltEnabled: true,
    ltPreFire: true,
    ltPostFire: true,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<CorrectionStats>({
    processingTime: 0,
    modificationCount: 0,
    ltPreCorrections: 0,
    ltPostCorrections: 0,
  })
  const [ltWarning, setLtWarning] = useState<string | null>(null)

  useEffect(() => {
    const savedSettings = localStorage.getItem('ai-corrector:settings')
    
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch {
        // Use defaults
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('ai-corrector:settings', JSON.stringify(settings))
  }, [settings])

  const handleCorrect = useCallback(async () => {
    if (!textContent.trim()) {
      setError('Veuillez entrer du texte')
      return
    }

    setIsLoading(true)
    setError(null)
    setOutputText('')
    setDiffChunks([])
    setLtWarning(null)
    setStats({ processingTime: 0, modificationCount: 0, ltPreCorrections: 0, ltPostCorrections: 0 })

    const startTime = performance.now()
    let currentText = textContent

    try {
      // Pre-fire LT
      if (settings.ltEnabled && settings.ltPreFire) {
        try {
          const preResult = await checkLanguageTool(currentText);
          if (preResult.matchCount > 0 && preResult.correctedText !== currentText) {
            const preDiff = computeDiff(currentText, preResult.correctedText, 'lt_pre');
            setDiffChunks(prev => [...prev, ...preDiff]);
            currentText = preResult.correctedText;
            setStats(prev => ({ ...prev, ltPreCorrections: preResult.matchCount }));
          }
        } catch (e) {
          console.warn('Pre-fire LT failed:', e);
          setLtWarning('Pre-fire correction skipped (LanguageTool unavailable)');
        }
      }

      // LLM inference
      const llmCorrected = await correctText(currentText, settings);
      
      if (!llmCorrected || llmCorrected.trim().length === 0) {
        throw new Error('LLM returned empty response')
      }

      const llmDiff = computeDiff(currentText, llmCorrected, 'llm');
      setDiffChunks(prev => [...prev, ...llmDiff]);
      currentText = llmCorrected;

      // Post-fire LT
      let finalText = currentText;
      if (settings.ltEnabled && settings.ltPostFire) {
        try {
          const postResult = await checkLanguageTool(currentText);
          if (postResult.matchCount > 0 && postResult.correctedText !== currentText) {
            const postDiff = computeDiff(currentText, postResult.correctedText, 'lt_post');
            setDiffChunks(prev => [...prev, ...postDiff]);
            finalText = postResult.correctedText;
            setStats(prev => ({ ...prev, ltPostCorrections: postResult.matchCount }));
          }
        } catch (e) {
          console.warn('Post-fire LT failed:', e);
          setLtWarning('Post-fire correction skipped (LanguageTool unavailable)');
        }
      }

      const modifications = diffChunks.filter(chunk => chunk.type !== 'unchanged').length;

      setOutputText(finalText)
      setStats(prev => ({
        ...prev,
        processingTime: Math.round(performance.now() - startTime),
        modificationCount: modifications,
      }))
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Une erreur inconnue est survenue')
      }
    } finally {
      setIsLoading(false)
    }
  }, [settings])

  const handleReset = useCallback(() => {
    setTextContent('')
    setOutputText('')
    setDiffChunks([])
    setStats({ processingTime: 0, modificationCount: 0, ltPreCorrections: 0, ltPostCorrections: 0 })
    setError(null)
    setLtWarning(null)
  }, [])

  return {
    textContent,
    setTextContent,
    outputText,
    diffChunks,
    settings,
    setSettings,
    isLoading,
    error,
    stats,
    ltWarning,
    handleCorrect,
    handleReset,
  }
}
