import { CorrectionMode, CorrectionSettings } from '../types'

// Module-level ref to store the current AbortController for cleanup
let currentAbortController: AbortController | null = null

export interface LLMRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user'
    content: string
  }>
  temperature: number
}

export interface LLMResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
}

export async function correctText(
  text: string,
  settings: CorrectionSettings
): Promise<string> {
  const systemPrompt = buildSystemPrompt(settings)
  const userPrompt = text

  const request: LLMRequest = {
    model: 'auto',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  }

  // Cancel any ongoing request before starting a new one
  currentAbortController?.abort()
  const controller = new AbortController()
  currentAbortController = controller

  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const baseUrl = import.meta.env.VITE_LLM_API_BASE_URL || 'http://localhost:30000'
    const apiPath = import.meta.env.VITE_LLM_API_PATH || '/v1/chat/completions'
    const response = await fetch(baseUrl + apiPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer no-key-needed',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Clean up the ref after completion
    currentAbortController = null

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data: LLMResponse = await response.json()

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim()
    }

    throw new Error('Invalid response format')
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Délai d\'attente dépassé')
    }
    throw error
  }
}

function buildSystemPrompt(
  settings: CorrectionSettings
): string {
  const modeDescriptions: Record<CorrectionMode, string> = {
    formel: 'Formel et professionnel',
    'semi-formel': 'Neutre, adapté au courrier',
    informel: 'Décontracté, style conversationnel',
    technical: 'Texte technique, clarté et précision',
  }

  const activeCorrections = Object.entries(settings)
    .filter(([_, value]) => value === true)
    .map(([key]) => key)
    .join(', ')

  return `Tu es un correcteur rédactionnel expert en français. 
Ton rôle est de corriger la grammaire, l'orthographe, la syntaxe et le style du texte fourni.
Conserve scrupuleusement le ton de l'auteur et le sens du message.
Applique le mode de correction suivant: ${modeDescriptions[settings.mode]} (${activeCorrections || 'toutes'}).
Renvoie uniquement le texte corrigé, sans commentaires ni introductions.`
}
