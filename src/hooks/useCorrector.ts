import { useState, useCallback, useEffect } from 'react'
import { correctText, abortOngoingRequest } from '../utils/api'
import { computeDiff } from '../utils/diff'
import { CorrectionMode, CorrectionSettings, DiffChunk, CorrectionStats } from '../types'

export function useCorrector() {
  const [textContent, setTextContent] = useState('')
  const [outputText, setOutputText] = useState('')
  const [diffChunks, setDiffChunks] = useState<DiffChunk[]>([])
  const [mode, setMode] = useState<CorrectionMode>('formel')
  const [settings, setSettings] = useState<CorrectionSettings>({
    mode: 'formel',
    fixGrammar: true,
    fixSpelling: true,
    fixSyntax: true,
    fixStyle: true,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<CorrectionStats>({
    processingTime: 0,
    modificationCount: 0,
  })

  useEffect(() => {
    const savedSettings = localStorage.getItem('ai-corrector:settings')
    
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        // Preserve mode from localStorage if not in settings
        const savedMode = localStorage.getItem('ai-corrector:mode')
        if (savedMode && !parsed.mode) {
          parsed.mode = savedMode as CorrectionMode
        }
        setSettings(parsed)
      } catch {
        // Use defaults
      }
    }
    
    // Load saved mode from localStorage
    const savedMode = localStorage.getItem('ai-corrector:mode')
    if (savedMode) {
      setMode(savedMode as CorrectionMode)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('ai-corrector:settings', JSON.stringify(settings))
    localStorage.setItem('ai-corrector:mode', mode)
  }, [settings.mode, mode])

  const handleCorrect = useCallback(async () => {
    if (!textContent.trim()) {
      setError('Veuillez entrer du texte')
      return
    }

    setIsLoading(true)
    setError(null)
    setOutputText('')
    setDiffChunks([])
    setStats({ processingTime: 0, modificationCount: 0 })

    const startTime = performance.now()

    try {
      const corrected = await correctText(textContent, settings)
      
      // Validate API response
      if (!corrected || corrected.trim().length === 0) {
        throw new Error('LLM returned empty response')
      }
      
      const diff = computeDiff(textContent, corrected)

      const modifications = diff.filter(chunk => chunk.type !== 'unchanged').length

      setOutputText(corrected)
      setDiffChunks(diff)
      setStats({
        processingTime: Math.round(performance.now() - startTime),
        modificationCount: modifications,
      })
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Une erreur inconnue est survenue')
      }
    } finally {
      setIsLoading(false)
      setError(null)
      abortOngoingRequest()
    }
  }, [textContent, settings])

  const handleReset = useCallback(() => {
    setTextContent('')
    setOutputText('')
    setDiffChunks([])
    setStats({ processingTime: 0, modificationCount: 0 })
    setError(null)
  }, [])

  return {
    textContent,
    setTextContent,
    outputText,
    diffChunks,
    
    mode,
    setMode,
    settings,
    setSettings,
    isLoading,
    error,
    stats,
    handleCorrect,
    handleReset,
  }
}
