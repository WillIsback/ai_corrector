import { describe, it, expect } from 'vitest'
import { checkLanguageTool, checkLTAvailable } from '../../src/services/languagetool'

const testText = `Bonjour Gwladys,

À la réunion de vendredis après-midi, les équipes national ont indicator n'avoir aucune information sur le rétablissement d'u service est que l'enquête n'été pas entre leurs main, met celle des services de la COSSIM (Centre opérationnel de la sécurité des systèmes d'information ministériels). Ils nous on par ailleurs montrait le contenu du mail qui sera envoyé aux agents impactés.

Je reviens vers vous dès que je reçois une réponse satisfaisante.

Cordialement,`

describe('E2E - Real LanguageTool', () => {
  it('corrige les erreurs réelles du texte de test', async () => {
    const available = await checkLTAvailable()
    
    if (!available) {
      console.log('Skip: LT server not available (localhost:3002)')
      return
    }

    const result = await checkLanguageTool(testText)
    
    expect(result.matchCount).toBeGreaterThan(0)
    expect(result.correctedText).not.toBe(testText)
    expect(result.correctedText).toContain('vendredi')
  }, 10000)

  it('timing < 5s', async () => {
    const available = await checkLTAvailable()
    if (!available) {
      console.log('Skip: LT server not available')
      return
    }

    const start = Date.now()
    await checkLanguageTool(testText)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(5000)
  }, 10000)
})