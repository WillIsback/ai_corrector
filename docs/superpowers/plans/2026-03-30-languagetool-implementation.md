# LanguageTool-Enhanced AI Corrector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LanguageTool as a pre/post-corrector to catch LLM under-corrections, with source-differentiated diff view.

**Architecture:** Sequential pipeline (Input → Pre-fire LT → LLM → Post-fire LT → Output). LT runs via self-hosted Docker on localhost:3001. Diff view shows LLM corrections in blue, LT corrections in orange.

**Tech Stack:** React + TypeScript + Vite + diff-match-patch

---

## File Structure

```
src/
├── services/
│   └── languagetool.ts      # NEW: LT API client with auto-fix logic
├── hooks/
│   └── useLanguageTool.ts   # NEW: LT connection check hook
├── types.ts                 # MODIFY: Add LT types and source to DiffChunk
├── utils/
│   ├── diff.ts              # MODIFY: Include source info in diff
│   └── api.ts               # MODIFY: Add LT-aware pipeline
├── components/
│   ├── Sidebar.tsx          # MODIFY: Add LT settings toggles
│   └── Output.tsx           # MODIFY: Apply source-based coloring
└── hooks/
    └── useCorrector.ts      # MODIFY: Integrate pre/post LT pipeline
```

---

## Tasks

### Task 1: Add TypeScript types for LanguageTool

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Update types.ts**

Replace the entire file content with:

```typescript
export type CorrectionMode = 
  | 'formel'
  | 'semi-formel'
  | 'informel'
  | 'technical';

export interface CorrectionSettings {
  mode: CorrectionMode;
  fixGrammar: boolean;
  fixSpelling: boolean;
  fixSyntax: boolean;
  fixStyle: boolean;
  ltEnabled: boolean;
  ltPreFire: boolean;
  ltPostFire: boolean;
}

export type CorrectionSource = 'llm' | 'lt_pre' | 'lt_post';

export type DiffChunkType = 'unchanged' | 'added' | 'removed';

export interface DiffChunk {
  type: DiffChunkType;
  text: string;
  source?: CorrectionSource;
  ltMatchId?: string;
}

export interface CorrectionStats {
  processingTime: number;
  modificationCount: number;
  ltPreCorrections: number;
  ltPostCorrections: number;
}

export interface CorrectionResult {
  originalText: string;
  correctedText: string;
  diff: DiffChunk[];
  stats: CorrectionStats;
}

export type ToastType = 'success' | 'error' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

// LanguageTool types
export interface LTMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: string[];
  rule: { id: string };
}

export interface LTResponse {
  matches: LTMatch[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add LanguageTool types and source tracking"
```

---

### Task 2: Create LanguageTool service

**Files:**
- Create: `src/services/languagetool.ts`

- [ ] **Step 1: Create languagetool.ts**

Create the file with:

```typescript
import { LTMatch, LTResponse } from '../types';

const LT_API_BASE = 'http://localhost:3001';

export interface LTCheckResult {
  correctedText: string;
  matchCount: number;
  matches: LTMatch[];
}

export async function checkLanguageTool(text: string): Promise<LTCheckResult> {
  const response = await fetch(`${LT_API_BASE}/v2/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      language: 'fr',
    }),
  });

  if (!response.ok) {
    throw new Error(`LanguageTool API error: ${response.status}`);
  }

  const data: LTResponse = await response.json();
  const correctedText = applyAutoFix(text, data.matches);
  
  return {
    correctedText,
    matchCount: data.matches.length,
    matches: data.matches,
  };
}

function applyAutoFix(text: string, matches: LTMatch[]): string {
  if (matches.length === 0) {
    return text;
  }

  const validMatches = matches
    .filter(m => m.replacements.length > 0)
    .sort((a, b) => b.offset - a.offset);

  let result = text;
  for (const match of validMatches) {
    const firstReplacement = match.replacements[0];
    result = 
      result.slice(0, match.offset) + 
      firstReplacement + 
      result.slice(match.offset + match.length);
  }

  return result;
}

export async function checkLTAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${LT_API_BASE}/v2/languages`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/languagetool.ts
git commit -m "feat: add LanguageTool service with auto-fix"
```

---

### Task 3: Create useLanguageTool hook

**Files:**
- Create: `src/hooks/useLanguageTool.ts`

- [ ] **Step 1: Create useLanguageTool.ts**

Create the file with:

```typescript
import { useState, useEffect } from 'react';
import { checkLTAvailable } from '../services/languagetool';

export function useLanguageTool() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function check() {
      setIsChecking(true);
      const available = await checkLTAvailable();
      setIsAvailable(available);
      setIsChecking(false);
    }
    check();
  }, []);

  return { isAvailable, isChecking };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useLanguageTool.ts
git commit -m "feat: add useLanguageTool hook for connection check"
```

---

### Task 4: Update diff utility with source tracking

**Files:**
- Modify: `src/utils/diff.ts`

- [ ] **Step 1: Update diff.ts**

Replace the entire file content with:

```typescript
import { DiffChunk, CorrectionSource } from '../types';
import diff_match_patch from 'diff-match-patch';

export function computeDiff(
  original: string, 
  corrected: string, 
  source: CorrectionSource = 'llm'
): DiffChunk[] {
  const dmp = new diff_match_patch();
  
  const diffs = dmp.diff_main(original, corrected);
  dmp.diff_cleanupSemantic(diffs);
  
  return diffs.map(([type, text]: [number, string]) => {
    switch (type) {
      case 0: 
        return { type: 'unchanged', text };
      case 1: 
        return { type: 'added', text, source };
      case -1: 
        return { type: 'removed', text };
      default:
        return { type: 'unchanged', text };
    }
  });
}

export function mergeDiffs(chunks1: DiffChunk[], chunks2: DiffChunk[]): DiffChunk[] {
  const result: DiffChunk[] = [...chunks1];
  
  for (const chunk of chunks2) {
    if (chunk.type === 'added' && chunk.source) {
      const lastChunk = result[result.length - 1];
      if (lastChunk && lastChunk.type === 'added' && lastChunk.source === chunk.source) {
        lastChunk.text += chunk.text;
      } else {
        result.push(chunk);
      }
    }
  }
  
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/diff.ts
git commit -m "feat: add source tracking to diff utility"
```

---

### Task 5: Update useCorrector with LT pipeline

**Files:**
- Modify: `src/hooks/useCorrector.ts`

- [ ] **Step 1: Update useCorrector.ts**

Replace the entire file content with:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCorrector.ts
git commit -m "feat: integrate LanguageTool pre/post pipeline"
```

---

### Task 6: Update Sidebar with LT settings

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Update Sidebar.tsx imports**

Add `CorrectionSource` to the import:
```typescript
import { CorrectionMode, CorrectionSettings } from '../types'
import React from 'react'
```

- [ ] **Step 2: Add LT settings section**

Find the closing `</div>` after the Style checkbox (around line 127) and add the LT settings section before the final `</aside>`:

Add this section just before `</aside>`:

```tsx
      {settings.ltEnabled && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">LanguageTool</h3>
          
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.ltPreFire}
                onChange={(e) => setSettings({ ...settings, ltPreFire: e.target.checked })}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="text-sm text-gray-900 dark:text-gray-100">Pré-correction</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.ltPostFire}
                onChange={(e) => setSettings({ ...settings, ltPostFire: e.target.checked })}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="text-sm text-gray-900 dark:text-gray-100">Post-correction</span>
            </label>
          </div>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.ltEnabled}
            onChange={(e) => setSettings({ ...settings, ltEnabled: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Activer LanguageTool</span>
        </label>
      </div>
    </aside>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add LanguageTool settings to Sidebar"
```

---

### Task 7: Update Output component with source coloring

**Files:**
- Modify: `src/components/Output.tsx`

- [ ] **Step 1: Update Output.tsx**

Replace the chunk rendering section (lines 38-57) with source-aware styling:

```tsx
            <p className="text-lg leading-relaxed text-gray-800 dark:text-gray-200">
              {diffChunks.map((chunk, index) => {
                if (chunk.type === 'removed') {
                  return (
                    <del key={index} className="text-red-600 dark:text-red-400">
                      {chunk.text}
                    </del>
                  );
                }
                
                if (chunk.type === 'added') {
                  const colorClass = chunk.source === 'llm' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-200'
                    : 'bg-orange-100 dark:bg-orange-900 text-orange-900 dark:text-orange-200';
                  
                  return (
                    <span key={index} className={`px-0.5 rounded ${colorClass}`}>
                      {chunk.text}
                    </span>
                  );
                }
                
                return <span key={index}>{chunk.text}</span>;
              })}
            </p>
```

- [ ] **Step 2: Add LT stats to Output display**

Find the stats section (around line 64-73) and add LT correction counts:

Replace that section with:

```tsx
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Temps</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.processingTime}ms</p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Modifications</h3>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.modificationCount}</p>
              </div>

              {stats.ltPreCorrections > 0 && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-1">LT Pré</h3>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.ltPreCorrections}</p>
                </div>
              )}

              {stats.ltPostCorrections > 0 && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-1">LT Post</h3>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.ltPostCorrections}</p>
                </div>
              )}
            </div>
```

- [ ] **Step 3: Add LT warning banner**

Add a warning banner if `ltWarning` is present. Add this after the stats section (before the buttons):

```tsx
            {ltWarning && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ {ltWarning}
                </p>
              </div>
            )}
```

- [ ] **Step 4: Update Props interface**

Update the Props interface to include `ltWarning`:

```tsx
interface Props {
  diffChunks: DiffChunk[]
  stats: { processingTime: number; modificationCount: number; ltPreCorrections: number; ltPostCorrections: number }
  onCopy: (text: string) => void
  onReset: () => void
  isLoading: boolean
  ltWarning?: string | null
}
```

And update the function signature:

```tsx
export function Output({ diffChunks, stats, onCopy, onReset, isLoading, ltWarning }: Props) {
```

- [ ] **Step 5: Update App.tsx to pass ltWarning**

Check App.tsx and update the `<Output />` component call to pass `ltWarning={ltWarning}`.

- [ ] **Step 6: Commit**

```bash
git add src/components/Output.tsx src/App.tsx
git commit -m "feat: add source-based coloring to diff view"
```

---

### Task 8: Add LT setup banner component

**Files:**
- Create: `src/components/LTSetupBanner.tsx`

- [ ] **Step 1: Create LTSetupBanner.tsx**

Create the file with:

```tsx
import React from 'react'

interface Props {
  onDismiss?: () => void
}

export function LTSetupBanner({ onDismiss }: Props) {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-amber-600 dark:text-amber-400 text-xl">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              LanguageTool n'est pas disponible
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Lancez le conteneur Docker pour activer la correction automatique:
            </p>
            <code className="block mt-1 text-xs bg-amber-100 dark:bg-amber-800 px-2 py-1 rounded font-mono">
              docker run --rm -p 3001:3001 erik.UUID/languagetool:latest
            </code>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add banner to App.tsx**

Read App.tsx, then:
1. Import the banner component
2. Use the `useLanguageTool` hook to check availability
3. Render the banner when LT is not available

Add to the imports:
```tsx
import { LTSetupBanner } from './components/LTSetupBanner'
import { useLanguageTool } from './hooks/useLanguageTool'
```

Add inside the main div (before the Sidebar):
```tsx
const { isAvailable: ltAvailable } = useLanguageTool()

return (
  <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
    {!ltAvailable && <LTSetupBanner />}
    {/* rest of the app */}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LTSetupBanner.tsx src/App.tsx
git commit -m "feat: add LanguageTool setup banner"
```

---

### Task 9: Verify build and test

- [ ] **Step 1: Run TypeScript check**

```bash
npm run build
```

Expected: Build succeeds without errors

- [ ] **Step 2: Test the app manually**

1. Start dev server: `npm run dev`
2. Verify LT setup banner appears (if Docker not running)
3. Test correction with LT enabled
4. Verify diff view shows blue for LLM, orange for LT corrections
5. Check stats show LT correction counts

- [ ] **Step 3: Commit final changes if any**

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add TypeScript types for LT |
| 2 | Create LanguageTool service |
| 3 | Create useLanguageTool hook |
| 4 | Update diff utility with source tracking |
| 5 | Update useCorrector with LT pipeline |
| 6 | Update Sidebar with LT settings |
| 7 | Update Output with source coloring |
| 8 | Add LT setup banner |
| 9 | Verify build |
