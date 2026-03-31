# Tests exhaustifs du pipeline de correction - Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans pour implémenter tâche par tâche.

**Goal:** Créer des tests exhaustifs (unit, intégration, e2e) pour valider le pipeline de correction avec LanguageTool.

**Architecture:** Vitest comme framework, structure tests/unit/, tests/integration/, tests/e2e/.

**Tech Stack:** Vitest, @testing-library/react (si besoin), MSW (mock HTTP).

---

## Configuration initiale

**Files:**
- Modify: `package.json`
- Create: `vite.config.ts` (update)
- Create: `tests/setup.ts`

- [ ] **Step 1: Installer Vitest et dépendances**

```bash
npm install -D vitest @testing-library/react jsdom
```

- [ ] **Step 2: Ajouter scripts de test dans package.json**

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

- [ ] **Step 3: Créer vite.config.ts pour les tests**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})
```

- [ ] **Step 4: Créer tests/setup.ts**

```typescript
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

global.fetch = vi.fn()
```

- [ ] **Step 5: Commit**

```bash
npm install
git add package.json vite.config.ts tests/setup.ts
git commit -m "test: setup Vitest configuration"
```

---

## Task 1: Tests unitaires - languagetool.service.ts

**Files:**
- Create: `tests/unit/languagetool.service.test.ts`

### Données de test

```typescript
const sampleText = 'Le chat mangent la souris';
const sampleWithErrors = 'Il ont fait une erreure';
```

- [ ] **Step 1: Écrire le test - applyAutoFix sans matches**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkLanguageTool, applyAutoFix, checkLTAvailable } from '../../src/services/languagetool'

describe('applyAutoFix', () => {
  it('retourne texte original si aucun match', () => {
    const result = applyAutoFix(sampleText, [])
    expect(result).toBe(sampleText)
  })
})
```

- [ ] **Step 2: applyAutoFix avec un match**

```typescript
  it('applique première replacement pour un match', () => {
    const matches = [{
      message: 'mangents → mange',
      shortMessage: 'Conjugaison',
      offset: 8,
      length: 8,
      replacements: ['mange', 'mangent'],
      rule: { id: 'MORFOLOGIK_RULE_FR' }
    }]
    const result = applyAutoFix('Le chat mangent la souris', matches)
    expect(result).toBe('Le chat mange la souris')
  })
```

- [ ] **Step 3: applyAutoFix avec multiples matches**

```typescript
  it('applique les matches en ordre décroissant d\'offset', () => {
    const matches = [
      {
        message: 'erreure → erreur',
        shortMessage: 'Orthographe',
        offset: 14,
        length: 7,
        replacements: ['erreur'],
        rule: { id: 'MORFOLOGIK_RULE_FR' }
      },
      {
        message: 'ont → ont',
        shortMessage: 'Conjugaison',
        offset: 3,
        length: 3,
        replacements: ['ont'],
        rule: { id: 'OTHER' }
      }
    ]
    const result = applyAutoFix('Il ont fait une erreure', matches)
    expect(result).toBe('Il ont fait une erreur')
  })
```

- [ ] **Step 4: applyAutoFix ignore matches sans replacement**

```typescript
  it('ignore les matches sans replacement', () => {
    const matches = [{
      message: 'Unknown pattern',
      shortMessage: 'Info',
      offset: 5,
      length: 3,
      replacements: [],
      rule: { id: 'UNKNOWN' }
    }]
    const result = applyAutoFix('Hello world', matches)
    expect(result).toBe('Hello world')
  })
```

- [ ] **Step 5: checkLanguageTool avec texte vide**

```typescript
describe('checkLanguageTool', () => {
  it('jette erreur si texte vide', async () => {
    await expect(checkLanguageTool('')).rejects.toThrow('Le texte ne peut pas être vide')
  })
```

- [ ] **Step 6: checkLanguageTool succès**

```typescript
  it('retourne correctedText et matchCount', async () => {
    const mockResponse = {
      matches: [{
        message: 'test',
        shortMessage: 'test',
        offset: 0,
        length: 4,
        replacements: ['test'],
        rule: { id: 'TEST' }
      }]
    }
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    
    const result = await checkLanguageTool('test')
    expect(result.matchCount).toBe(1)
    expect(result.correctedText).toBe('test')
  })
```

- [ ] **Step 7: checkLanguageTool API error**

```typescript
  it('jette erreur si API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    })
    
    await expect(checkLanguageTool('test')).rejects.toThrow('LanguageTool API error: 500')
  })
```

- [ ] **Step 8: checkLanguageTool timeout**

```typescript
  it('.timeout si réponse > 5s', async () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    
    const promise = checkLanguageTool('test')
    await expect(promise).rejects.toThrow()
  }, 10000)
```

- [ ] **Step 9: checkLTAvailable succès**

```typescript
describe('checkLTAvailable', () => {
  it('retourne true si serveur dispo', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true
    })
    
    const result = await checkLTAvailable()
    expect(result).toBe(true)
  })
```

- [ ] **Step 10: checkLTAvailable timeout**

```typescript
  it('retourne false si timeout', async () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    
    const result = await checkLTAvailable()
    expect(result).toBe(false)
  }, 5000)
```

- [ ] **Step 11: Commit**

```bash
git add tests/unit/languagetool.service.test.ts
git commit -m "test: add unit tests for languagetool service"
```

---

## Task 2: Tests unitaires - diff.ts

**Files:**
- Create: `tests/unit/diff.utils.test.ts`

- [ ] **Step 1: computeDiff sans changement**

```typescript
import { describe, it, expect } from 'vitest'
import { computeDiff, mergeDiffs } from '../../src/utils/diff'

describe('computeDiff', () => {
  it('retourne chunk unchanged si pas de changement', () => {
    const result = computeDiff('hello', 'hello')
    expect(result).toEqual([{ type: 'unchanged', text: 'hello' }])
  })
})
```

- [ ] **Step 2: computeDiff avec ajout**

```typescript
  it('retourne chunk added avec source', () => {
    const result = computeDiff('hello', 'hello world')
    expect(result).toContainEqual({
      type: 'added',
      text: ' world',
      source: 'llm'
    })
  })
```

- [ ] **Step 3: computeDiff avec suppression**

```typescript
  it('retourne chunk removed', () => {
    const result = computeDiff('hello world', 'hello')
    expect(result).toContainEqual({
      type: 'removed',
      text: ' world'
    })
  })
```

- [ ] **Step 4: computeDiff avec source llm**

```typescript
  it('source par défaut est llm', () => {
    const result = computeDiff('a', 'ab')
    const added = result.find(c => c.type === 'added')
    expect(added?.source).toBe('llm')
  })
```

- [ ] **Step 5: computeDiff avec source lt_pre**

```typescript
  it('source lt_pre', () => {
    const result = computeDiff('a', 'ab', 'lt_pre')
    const added = result.find(c => c.type === 'added')
    expect(added?.source).toBe('lt_pre')
  })
```

- [ ] **Step 6: computeDiff avec source lt_post**

```typescript
  it('source lt_post', () => {
    const result = computeDiff('a', 'ab', 'lt_post')
    const added = result.find(c => c.type === 'added')
    expect(added?.source).toBe('lt_post')
  })
```

- [ ] **Step 7: mergeDiffs adjacent même source**

```typescript
describe('mergeDiffs', () => {
  it('fusionne les chunks ajoutés adjacents avec même source', () => {
    const chunks1 = [{ type: 'added', text: 'hello', source: 'llm' }]
    const chunks2 = [{ type: 'added', text: ' world', source: 'llm' }]
    
    const result = mergeDiffs(chunks1, chunks2)
    expect(result).toEqual([{ type: 'added', text: 'hello world', source: 'llm' }])
  })
```

- [ ] **Step 8: mergeDiffs adjacent source différent**

```typescript
  it('ne fusionne pas si sources différentes', () => {
    const chunks1 = [{ type: 'added', text: 'hello', source: 'llm' }]
    const chunks2 = [{ type: 'added', text: ' world', source: 'lt_pre' }]
    
    const result = mergeDiffs(chunks1, chunks2)
    expect(result).toHaveLength(2)
  })
```

- [ ] **Step 9: mergeDiffs immutabilité**

```typescript
  it('ne mute pas les tableaux originaux', () => {
    const chunks1 = [{ type: 'added', text: 'a', source: 'llm' }]
    const chunks2: any[] = []
    
    mergeDiffs(chunks1, chunks2)
    expect(chunks1).toEqual([{ type: 'added', text: 'a', source: 'llm' }])
  })
```

- [ ] **Step 10: Commit**

```bash
git add tests/unit/diff.utils.test.ts
git commit -m "test: add unit tests for diff utility"
```

---

## Task 3: Tests d'intégration - Pipeline

**Files:**
- Create: `tests/integration/pipeline.test.ts`

### Données de test

```typescript
const testText = 'Bonjour, Il ont fait une erreure.';
const correctedByLLM = 'Bonjour, Il a fait une erreur.';
const correctedByLT = 'Bonjour, Il a fait une erreur.';
```

- [ ] **Step 1: Pipeline complet LT enabled**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCorrector } from '../../src/hooks/useCorrector'

vi.mock('../../src/services/languagetool', () => ({
  checkLanguageTool: vi.fn(),
  checkLTAvailable: vi.fn().mockResolvedValue(true)
}))

vi.mock('../../src/utils/api', () => ({
  correctText: vi.fn()
}))

import { checkLanguageTool } from '../../src/services/languagetool'
import { correctText } from '../../src/utils/api'

describe('Pipeline - Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exécute pre-LT → LLM → post-LT quand tout enabled', async () => {
    const mockPreLT = { matchCount: 1, correctedText: 'Bonjour, Il ont fait une erreur.', matches: [] }
    const mockPostLT = { matchCount: 0, correctedText: 'Bonjour, Il a fait une erreur.', matches: [] }
    
    ;(checkLanguageTool as any)
      .mockResolvedValueOnce(mockPreLT)
      .mockResolvedValueOnce(mockPostLT)
    ;(correctText as any).mockResolvedValue('Bonjour, Il a fait une erreur.')

    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setTextContent('Bonjour, Il ont fait une erreure.')
      await result.current.handleCorrect()
    })

    expect(checkLanguageTool).toHaveBeenCalledTimes(2)
    expect(checkLanguageTool).toHaveBeenNthCalledWith(1, 'Bonjour, Il ont fait une erreure.')
    expect(correctText).toHaveBeenCalledOnce()
    expect(checkLanguageTool).toHaveBeenNthCalledWith(2, 'Bonjour, Il a fait une erreur.')
  })
```

- [ ] **Step 2: Pipeline LT disabled**

```typescript
  it('skip pre et post LT si disabled', async () => {
    const mockPostLT = { matchCount: 0, correctedText: 'Bonjour.', matches: [] }
    ;(checkLanguageTool as any).mockResolvedValue(mockPostLT)
    ;(correctText as any).mockResolvedValue('Bonjour.')

    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setTextContent('Bonjour.')
      result.current.setSettings({ ...result.current.settings, ltEnabled: false })
      await result.current.handleCorrect()
    })

    expect(checkLanguageTool).not.toHaveBeenCalled()
    expect(correctText).toHaveBeenCalledOnce()
  })
```

- [ ] **Step 3: Pipeline pre-LT only**

```typescript
  it('exécute pre-LT uniquement si ltPostFire=false', async () => {
    const mockPreLT = { matchCount: 1, correctedText: 'Bonjour.', matches: [] }
    ;(checkLanguageTool as any).mockResolvedValue(mockPreLT)
    ;(correctText as any).mockResolvedValue('Bonjour.')

    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setTextContent('Bonjour')
      result.current.setSettings({ 
        ...result.current.settings, 
        ltEnabled: true,
        ltPreFire: true,
        ltPostFire: false 
      })
      await result.current.handleCorrect()
    })

    expect(checkLanguageTool).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 4: Pipeline post-LT only**

```typescript
  it('exécute post-LT uniquement si ltPreFire=false', async () => {
    const mockPostLT = { matchCount: 1, correctedText: 'Bonjour.', matches: [] }
    ;(checkLanguageTool as any).mockResolvedValue(mockPostLT)
    ;(correctText as any).mockResolvedValue('Bonjour')

    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setTextContent('Bonjour')
      result.current.setSettings({ 
        ...result.current.settings, 
        ltEnabled: true,
        ltPreFire: false,
        ltPostFire: true 
      })
      await result.current.handleCorrect()
    })

    expect(checkLanguageTool).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 5: Pipeline LLM fail**

```typescript
  it('propagation erreur si LLM fail', async () => {
    ;(checkLanguageTool as any).mockResolvedValue({ matchCount: 0, correctedText: '', matches: [] })
    ;(correctText as any).mockRejectedValue(new Error('LLM error'))

    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setTextContent('test')
      await result.current.handleCorrect()
    })

    expect(result.current.error).toBe('LLM error')
  })
```

- [ ] **Step 6: Pipeline pre-LT fail**

```typescript
  it('continue si pre-LT fail avec warning', async () => {
    ;(checkLanguageTool as any)
      .mockRejectedValueOnce(new Error('LT unavailable'))
      .mockResolvedValue({ matchCount: 0, correctedText: 'test', matches: [] })
    ;(correctText as any).mockResolvedValue('test')

    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setTextContent('test')
      await result.current.handleCorrect()
    })

    expect(result.current.ltWarning).toContain('Pre-fire')
    expect(correctText).toHaveBeenCalled()
  })
```

- [ ] **Step 7: Pipeline post-LT fail**

```typescript
  it('continue si post-LT fail avec warning', async () => {
    ;(checkLanguageTool as any)
      .mockResolvedValueOnce({ matchCount: 0, correctedText: 'test', matches: [] })
      .mockRejectedValueOnce(new Error('LT unavailable'))
    ;(correctText as any).mockResolvedValue('test')

    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setTextContent('test')
      await result.current.handleCorrect()
    })

    expect(result.current.ltWarning).toContain('Post-fire')
    expect(result.current.outputText).toBe('test')
  })
```

- [ ] **Step 8: Stats correctes**

```typescript
  it('stats ltPreCorrections et ltPostCorrections', async () => {
    ;(checkLanguageTool as any)
      .mockResolvedValueOnce({ matchCount: 2, correctedText: 'a', matches: [] })
      .mockResolvedValueOnce({ matchCount: 3, correctedText: 'b', matches: [] })
    ;(correctText as any).mockResolvedValue('b')

    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setTextContent('original')
      await result.current.handleCorrect()
    })

    expect(result.current.stats.ltPreCorrections).toBe(2)
    expect(result.current.stats.ltPostCorrections).toBe(3)
  })
```

- [ ] **Step 9: Texte vide**

```typescript
  it('erreur si texte vide', async () => {
    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setTextContent('')
      await result.current.handleCorrect()
    })

    expect(result.current.error).toBe('Veuillez entrer du texte')
  })
```

- [ ] **Step 10: Commit**

```bash
git add tests/integration/pipeline.test.ts
git commit -m "test: add integration tests for correction pipeline"
```

---

## Task 4: Tests E2E (optionnel)

**Files:**
- Create: `tests/e2e/fullCorrection.test.ts`

**Note:** Ces tests requièrent un serveur LanguageTool en cours d'exécution.

- [ ] **Step 1: E2E avec vrai serveur LT**

```typescript
import { describe, it, expect } from 'vitest'
import { checkLanguageTool, checkLTAvailable } from '../../src/services/languagetool'

const testText = `Bonjour Gwladys,

À la réunion de vendredis après-midi, les équipes national ont indicator n'avoir aucune information sur le rétablissement d'u service est que l'enquête n'été pas entre leurs main, met celle des services de la COSSIM.`;

describe('E2E - Real LanguageTool', () => {
  it.skipIf(!process.env.RUN_E2E)('corrige les erreurs réelles', async () => {
    const available = await checkLTAvailable()
    if (!available) {
      console.log('Skip: LT server not available')
      return
    }

    const result = await checkLanguageTool(testText)
    
    expect(result.matchCount).toBeGreaterThan(0)
    expect(result.correctedText).not.toBe(testText)
    expect(result.correctedText).toContain('vendredi')
    expect(result.correctedText).toContain('indiqué')
  })

  it.skipIf(!process.env.RUN_E2E)('timing < 5s', async () => {
    const available = await checkLTAvailable()
    if (!available) return

    const start = Date.now()
    await checkLanguageTool(testText)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(5000)
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/fullCorrection.test.ts
git commit -m "test: add e2e tests for real LT correction"
```

---

## Task 5: Vérification finale

- [ ] **Step 1: Exécuter tous les tests**

```bash
npm run test:run
```

Expected: Tous les tests passent (sauf E2E si LT pas dispo)

- [ ] **Step 2: Couverture**

```bash
npm run test:coverage
```

Vérifier que > 80% de couverture sur les fichiers testés

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "test: complete test suite for pipeline"
```

---

## Résumé

| Task | Description |
|------|-------------|
| 1 | Setup Vitest + configuration |
| 2 | Tests unitaires - languagetool.service.ts |
| 3 | Tests unitaires - diff.ts |
| 4 | Tests intégration - pipeline |
| 5 | Tests E2E - vrai serveur LT |
| 6 | Vérification + couverture |