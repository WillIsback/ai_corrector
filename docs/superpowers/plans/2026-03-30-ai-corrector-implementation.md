# AI Corrector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web application that corrects French text using an OpenAI-compatible LLM API, with diff-based version comparison and persistent settings

**Architecture:** React single-page application with Vite + Tailwind CSS. Uses localStorage for persistence. API calls to local OpenAI-compatible endpoint (localhost:30000).

**Tech Stack:** React 18, Vite 5, Tailwind CSS, TypeScript, diff-match-patch

---

## 1. Project Setup

### Task 1: Initialize React + Vite + TypeScript

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `index.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "ai-corrector",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.40",
    "tailwindcss": "^3.4.7",
    "typescript": "~5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Run npm install**

```bash
npm install
```

Expected: All dependencies installed.

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 25000,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Corrector</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Commit**

```bash
git add package.json vite.config.ts index.html
git commit -m "chore: init project with dependencies"
```

### Task 2: Configure TypeScript and Tailwind

**Files:**
- Create: `tsconfig.json`
- Create: `postcss.config.cjs`
- Create: `tailwind.config.js`
- Create: `src/main.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 2: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: Create postcss.config.cjs**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 4: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 5: Create src/main.tsx**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 6: Create src/App.tsx**

```typescript
function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <h1 className="text-3xl font-bold text-center py-8">AI Corrector</h1>
    </div>
  )
}

export default App
```

- [ ] **Step 7: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Start dev server**

```bash
npm run dev
```

Expected: Dev server running at http://localhost:25000

- [ ] **Step 9: Commit**

```bash
git add tsconfig.json tsconfig.node.json postcss.config.cjs tailwind.config.js src/main.tsx src/App.tsx src/index.css
git commit -m "chore: configure TypeScript and Tailwind"
```

---

## 2. Core Data Model and API

### Task 3: Create TypeScript types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create src/types.ts**

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
}

export interface DiffChunk {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  text: string;
}

export interface CorrectionStats {
  processingTime: number;
  modificationCount: number;
}

export interface CorrectionResult {
  originalText: string;
  correctedText: string;
  diff: DiffChunk[];
  stats: CorrectionStats;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add TypeScript types"
```

### Task 4: Create LLM API client

**Files:**
- Create: `src/utils/api.ts`

- [ ] **Step 1: Update src/utils/api.ts**

```typescript
import { CorrectionMode, CorrectionSettings } from '../types'

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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch('http://localhost:30000/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer no-key-needed',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

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
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/api.ts
git commit -m "feat: add LLM API client"
```

---

## 3. Diff View Implementation

### Task 5: Create diff utility

**Files:**
- Create: `src/utils/diff.ts`

- [ ] **Step 1: Install diff-match-patch**

```bash
npm install diff-match-patch
```

Expected: Package installed.

- [ ] **Step 2: Create src/utils/diff.ts**

```typescript
import { DiffChunk } from '../types'
import diff_match_patch from 'diff-match-patch'

export function computeDiff(original: string, corrected: string): DiffChunk[] {
  const dmp = new diff_match_patch()
  
  const diffs = dmp.diff_main(original, corrected)
  dmp.diff_cleanupSemantic(diffs)
  
  return diffs.map(([type, text]) => {
    switch (type) {
      case 0: // EQUAL
        return { type: 'unchanged', text }
      case 1: // INSERT
        return { type: 'added', text }
      case -1: // DELETE
        return { type: 'removed', text }
      default:
        return { type: 'unchanged', text }
    }
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/diff.ts package.json package-lock.json
git commit -m "feat: add diff utility"
```

---

## 4. State Management and Custom Hooks

### Task 6: Create useCorrector hook

**Files:**
- Create: `src/hooks/useCorrector.ts`

- [ ] **Step 1: Create src/hooks/useCorrector.ts**

```typescript
import { useState, useCallback, useEffect } from 'react'
import { diff_match_patch } from 'diff-match-patch'
import { correctText } from '../utils/api'
import { computeDiff } from '../utils/diff'
import { CorrectionMode, CorrectionSettings, CorrectionResult } from '../types'

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
    const savedMode = localStorage.getItem('ai-corrector:mode')
    const savedSettings = localStorage.getItem('ai-corrector:settings')
    
    if (savedMode) {
      setMode(savedMode as CorrectionMode)
    }
    
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch {
        // Use defaults
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('ai-corrector:mode', mode)
  }, [mode])

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
    setStats({ processingTime: 0, modificationCount: 0 })

    const startTime = performance.now()

    try {
      const corrected = await correctText(textContent, mode, settings)
      const diff = computeDiff(textContent, corrected)

      const dmp = new diff_match_patch()
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
    }
  }, [textContent, mode, settings])

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
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCorrector.ts
git commit -m "feat: add useCorrector hook"
```

---

## 5. UI Components

### Task 7: Create Header component

**Files:**
- Create: `src/components/Header.tsx`

- [ ] **Step 1: Create src/components/Header.tsx**

```tsx
import { useEffect, useState } from 'react'

interface Props {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenSettings: () => void
}

export function Header({ theme, onToggleTheme, onOpenSettings }: Props) {
  const [isDark, setIsDark] = useState(theme === 'dark')

  useEffect(() => {
    setIsDark(theme === 'dark')
  }, [theme])

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          AI Corrector
        </h1>
        
        <div className="flex items-center gap-4">
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="Settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: add Header component"
```

---

### Task 8: Create Sidebar component

**Files:**
- Create: `src/components/Sidebar.tsx`

- [ ] **Step 1: Create src/components/Sidebar.tsx**

```tsx
import { CorrectionMode } from '../types'

interface Props {
  mode: CorrectionMode
  setMode: (mode: CorrectionMode) => void
  settings: {
    mode: CorrectionMode
    fixGrammar: boolean
    fixSpelling: boolean
    fixSyntax: boolean
    fixStyle: boolean
  }
  setSettings: (settings: typeof settings) => void
}

const modeLabels: Record<CorrectionMode, string> = {
  formel: 'Formel / Professionnel',
  'semi-formel': 'Semi-formel',
  informel: 'Informel / Chat',
  technical: 'Technical / Clair',
}

export function Sidebar({ mode, setMode, settings, setSettings }: Props) {
  const handleModeChange = (newMode: CorrectionMode) => {
    setMode(newMode)
    setSettings({ ...settings, mode: newMode })
  }

  const handleSettingChange = (setting: keyof typeof settings, value: boolean) => {
    setSettings({ ...settings, [setting]: value })
  }

  return (
    <aside className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Mode de correction</h2>
      
      <div className="space-y-2">
        {Object.entries(modeLabels).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value={key}
              checked={mode === key}
              onChange={() => handleModeChange(key as CorrectionMode)}
              className="text-blue-600 focus:ring-blue-500 dark:text-blue-400 dark:focus:ring-blue-300"
            />
            <span className="text-gray-900 dark:text-gray-100">{label}</span>
          </label>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Corrections à appliquer</h3>
        
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.fixGrammar}
              onChange={(e) => handleSettingChange('fixGrammar', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-400"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Grammaire</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.fixSpelling}
              onChange={(e) => handleSettingChange('fixSpelling', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-400"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Orthographe</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.fixSyntax}
              onChange={(e) => handleSettingChange('fixSyntax', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-400"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Syntaxe</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.fixStyle}
              onChange={(e) => handleSettingChange('fixStyle', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-400"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Style</span>
          </label>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add Sidebar component"
```

---

### Task 9: Create Editor component

**Files:**
- Create: `src/components/Editor.tsx`

- [ ] **Step 1: Create src/components/Editor.tsx**

```tsx
interface Props {
  text: string
  onChange: (text: string) => void
  onCorrect: () => void
  isLoading: boolean
}

export function Editor({ text, onChange, onCorrect, isLoading }: Props) {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            📋 Texte à corriger
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Saisissez votre texte ci-dessous. Les corrections s'appliqueront en cliquant sur "Corriger".
          </p>
        </div>
        
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Colez votre texte ici pour le corriger..."
          className="w-full h-96 p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
                    rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                    text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                    resize-y font-medium"
          spellCheck={false}
        />
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={onCorrect}
            disabled={isLoading || !text.trim()}
            className={`px-6 py-2 rounded-lg font-semibold transition-all
              ${isLoading 
                ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
          >
            {isLoading ? 'Correction en cours...' : 'Corriger'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Editor.tsx
git commit -m "feat: add Editor component"
```

---

### Task 10: Create Output component with diff view

**Files:**
- Create: `src/components/Output.tsx`

- [ ] **Step 1: Create src/components/Output.tsx**

```tsx
import { DiffChunk } from '../types'

interface Props {
  diffChunks: DiffChunk[]
  stats: { processingTime: number; modificationCount: number }
  onCopy: (text: string) => void
  onReset: () => void
}

export function Output({ diffChunks, stats, onCopy, onReset }: Props) {
  const handleCopy = () => {
    const text = diffChunks.map(chunk => chunk.text).join('')
    onCopy(text)
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            ✨ Résultat corrigé
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Le texte ci-dessous a été corrigé selon vos paramètres.
          </p>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          {diffChunks.length === 0 ? (
            <div className="text-center text-gray-400 dark:text-gray-500 py-12">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Aucune correction disponible. Entrez du texte et cliquez sur "Corriger".</p>
            </div>
          ) : (
            <p className="text-lg leading-relaxed text-gray-800 dark:text-gray-200">
              {diffChunks.map((chunk, index) => {
                switch (chunk.type) {
                  case 'added':
                    return (
                      <span key={index} className="bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-200 px-0.5 rounded">
                        {chunk.text}
                      </span>
                    )
                  case 'removed':
                    return (
                      <del key={index} className="text-red-600 dark:text-red-400">
                        {chunk.text}
                      </del>
                    )
                  case 'modified':
                    return (
                      <span key={index} className="bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-200 px-0.5 rounded">
                        {chunk.text}
                      </span>
                    )
                  default:
                    return <span key={index}>{chunk.text}</span>
                }
              })}
            </p>
          )}
        </div>
        
        {diffChunks.length > 0 && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Temps de traitement</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.processingTime}ms</p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Modifications</h3>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.modificationCount}</p>
              </div>
            </div>
            
            <div className="mt-6 flex gap-4">
              <button
                onClick={handleCopy}
                className="flex-1 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                📋 Copier le texte
              </button>
              <button
                onClick={onReset}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors"
              >
                🔄 Réinitialiser
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Output.tsx
git commit -m "feat: add Output component with diff view"
```

---

### Task 11: Create Toast component

**Files:**
- Create: `src/components/Toast.tsx`

- [ ] **Step 1: Create src/components/Toast.tsx**

```tsx
import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface Props {
  toast: Toast | null
  onClose: () => void
}

export function Toast({ toast, onClose }: Props) {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(onClose, 3000)
      return () => clearTimeout(timer)
    }
  }, [toast, onClose])

  if (!toast) return null

  const getColorClass = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      case 'warning':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className={`fixed top-6 right-6 px-6 py-4 rounded-lg shadow-lg text-white flex items-center gap-3 z-50 animate-fade-in-out ${getColorClass()}`}>
      <span>{toast.message}</span>
      <button onClick={onClose} className="opacity-75 hover:opacity-100">
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Toast.tsx
git commit -m "feat: add Toast component"
```

---

### Task 12: Create main App with theme and state

**Files:**
- Create: `src/App.tsx` (replace)

- [ ] **Step 1: Replace src/App.tsx**

```tsx
import { useState, useEffect } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { Output } from './components/Output'
import { Toast } from './components/Toast'
import { useCorrector } from './hooks/useCorrector'

function App() {
  const {
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
  } = useCorrector()

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    const root = window.document.documentElement
    
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  const handleCloseToast = () => {
    setToast(null)
  }

  const handleCopySuccess = (text: string) => {
    navigator.clipboard.writeText(text)
    setToast({ id: 'copy-success', message: 'Texte copié dans le presse-papier !', type: 'success' })
  }

  const handleError = (message: string) => {
    setToast({ id: 'error', message, type: 'error' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Header 
        theme={theme} 
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        onOpenSettings={() => {}}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          mode={mode} 
          setMode={setMode}
          settings={settings}
          setSettings={setSettings}
        />
        
        <Editor 
          text={textContent}
          onChange={setTextContent}
          onCorrect={handleCorrect}
          isLoading={isLoading}
        />
        
        <Output 
          diffChunks={diffChunks}
          stats={stats}
          onCopy={handleCopySuccess}
          onReset={handleReset}
        />
      </div>

      {toast && <Toast toast={toast} onClose={handleCloseToast} />}
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 px-6 py-4">
          <p className="text-red-700 dark:text-red-400 text-center max-w-4xl mx-auto">{error}</p>
        </div>
      )}
    </div>
  )
}

export default App
```

- [ ] **Step 2: Update index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .animate-fade-in-out {
    animation: fade-in-out 0.3s ease-out forwards;
  }
  
  @keyframes fade-in-out {
    0% {
      opacity: 0;
      transform: translateX(100%);
    }
    10% {
      opacity: 1;
      transform: translateX(0);
    }
    80% {
      opacity: 1;
      transform: translateX(0);
    }
    100% {
      opacity: 0;
      transform: translateX(100%);
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/index.css
git commit -m "feat: add main App component with state management"
```

---

## 6. Testing and Final Setup

### Task 13: Create favicon

**Files:**
- Create: `public/favicon.svg`

- [ ] **Step 1: Create public/favicon.svg**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M15 12l-3 3m0 0l-3-3m3 3V4" />
  <path d="M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add public/favicon.svg
git commit -m "feat: add favicon"
```

### Task 14: Build and verify

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run dev server**

```bash
npm run dev
```

Expected: Dev server running at http://localhost:25000

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: add build verification"
```

---

## 7. Final Checklist

### Task 15: Code review and cleanup

- [ ] **Step 1: Check for console errors**

Open browser console and verify no errors on initial load.

- [ ] **Step 2: Test theme toggle**

Click theme toggle button and verify dark/light mode switching works.

- [ ] **Step 3: Test correction workflow**

1. Enter some French text with intentional errors
2. Click "Corriger" (actual API call will fail without real LLM)
3. Verify error handling shows toast
4. Check localStorage persistence on refresh

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: code review and final cleanup"
```

---

## 8. Deployment

### Task 16: Prepare for production

- [ ] **Step 1: Update README.md**

```markdown
# AI Corrector

Correcteur et reformateur de rédaction en français alimenté par LLM.

## Pré-requis

- Node.js 18+
- LLM API compatible OpenAI sur localhost:30000

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

L'application est accessible sur http://localhost:25000

## Build

```bash
npm run build
npx serve -s dist -l 25000
```

## Configuration

L'application se connecte à un LLM compatible OpenAI API sur `http://localhost:30000`.

## Fonctionnalités

- Correction complète (grammaire, orthographe, syntaxe, style)
- 4 modes de correction (Formel, Semi-formel, Informel, Technical)
- Diff view pour visualiser les modifications
- Persistancy des préférences
- Thème auto (dark/light)
- Toast notifications
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```