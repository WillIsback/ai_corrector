# Protection des entités nommées — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher LanguageTool de corriger les noms propres et entités inconnues (ex: "Noota" → "N'opta") grâce à une pre-protection par placeholders et une validation interactive côté utilisateur.

**Architecture:** Avant l'appel LT, compromise.js détecte les entités et les remplace par des placeholders (`__PROT_N__`). Après LT, les entités sont restaurées et marquées "suspect" dans la sortie. L'utilisateur peut garder (→ persisté dans valid-words.json) ou rejeter (→ correction LT appliquée) chaque suspect via un popover.

**Tech Stack:** TypeScript, React, compromise.js, Bun (serveur), LanguageTool API

---

## Fichiers à créer/modifier

| Fichier | Action | Rôle |
|---------|--------|------|
| `src/types.ts` | Modifier | Ajouter `SuspectWord`, `ProtectedText` |
| `src/services/entityDetector.ts` | Créer | Détection + protection d'entités avec compromise.js |
| `src/services/validWords.ts` | Créer | Store mots valides (load, add, check) |
| `server.ts` | Créer | Serveur Bun (port 25000) — statique + proxy + valid-words |
| `src/services/languagetool.ts` | Modifier | Intégrer la protection par placeholders |
| `src/hooks/useCorrector.ts` | Modifier | Pipeline detect → protect → LT → restore |
| `src/components/Output.tsx` | Modifier | Rendu interactif avec SuspectBadge |
| `src/components/SuspectBadge.tsx` | Créer | Popover pour garder/rejeter un mot suspect |
| `vite.config.ts` | Modifier | Déplacer proxy LT/LLM vers Bun, garder HMR |
| `package.json` | Modifier | Ajouter `compromise`, script serveur |
| `tests/unit/entityDetector.test.ts` | Créer | Tests unitaires entityDetector |
| `tests/unit/validWords.test.ts` | Créer | Tests unitaires validWords |
| `tests/integration/entityProtection.test.ts` | Créer | Tests pipeline entity protection |

---

### Task 1 : Types et dépendances

**Files:**
- Modify: `src/types.ts`
- Modify: `package.json`

- [ ] **Step 1 : Ajouter les types SuspectWord et ProtectedText**

```typescript
// src/types.ts — ajouter en fin de fichier

export interface SuspectWord {
  placeholder: string;    // "__PROT_0__"
  originalText: string;   // "Noota"
  offset: number;         // position dans le texte original
  length: number;         // longueur du mot original
  wasCorrected: boolean;  // true si LT aurait corrigé ce mot
}

export interface ProtectedText {
  text: string;           // texte avec placeholders
  suspects: SuspectWord[];
}
```

- [ ] **Step 2 : Installer compromise**

Run: `npm install compromise`
Expected: compromise ajouté dans package.json dependencies

- [ ] **Step 3 : Commit**

```bash
git add src/types.ts package.json package-lock.json
git commit -m "feat: add entity protection types and compromise dependency"
```

---

### Task 2 : Entity Detector Service

**Files:**
- Create: `src/services/entityDetector.ts`
- Test: `tests/unit/entityDetector.test.ts`

- [ ] **Step 1 : Écrire le test de détection basique**

```typescript
// tests/unit/entityDetector.test.ts
import { describe, it, expect } from "vitest";
import { detectEntities, protectEntities, restoreEntities } from "../../src/services/entityDetector";

describe("detectEntities", () => {
  it("detects proper nouns as suspects", () => {
    const text = "Noota est une application française";
    const suspects = detectEntities(text, new Set());
    expect(suspects.length).toBeGreaterThan(0);
    expect(suspects[0].originalText).toBe("Noota");
    expect(suspects[0].offset).toBe(0);
  });

  it("excludes words from validWords set", () => {
    const text = "Noota est super";
    const validWords = new Set(["Noota"]);
    const suspects = detectEntities(text, validWords);
    expect(suspects).toHaveLength(0);
  });

  it("excludes words at start of sentence", () => {
    const text = "Application est importante.";
    const suspects = detectEntities(text, new Set());
    // "Application" est en début de phrase, pas un nom propre
    const hasApplication = suspects.some(s => s.originalText === "Application");
    expect(hasApplication).toBe(false);
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

Run: `npx vitest run tests/unit/entityDetector.test.ts`
Expected: FAIL — "Cannot find module ../../src/services/entityDetector"

- [ ] **Step 3 : Implémenter detectEntities**

```typescript
// src/services/entityDetector.ts
import nlp from "compromise";
import type { SuspectWord, ProtectedText } from "../types";

export function detectEntities(text: string, validWords: Set<string>): SuspectWord[] {
  const suspects: SuspectWord[] = [];
  const seen = new Set<string>();

  const doc = nlp(text);

  // Détecter les personnes, lieux, organisations
  const entities = [
    ...doc.people().out("offset"),
    ...doc.places().out("offset"),
    ...doc.organizations().out("offset"),
  ];

  for (const entity of entities) {
    const word = entity.text.trim();
    if (seen.has(word.toLowerCase())) continue;
    if (validWords.has(word)) continue;

    seen.add(word.toLowerCase());
    suspects.push({
      placeholder: `__PROT_${suspects.length}__`,
      originalText: word,
      offset: entity.offset.start,
      length: word.length,
      wasCorrected: false,
    });
  }

  // Heuristique : mots avec majuscule en milieu de phrase
  const words = text.split(/(\s+)/);
  let currentOffset = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isFirstWord = i === 0 || (i > 0 && words.slice(0, i).every(w => /^\s+$/.test(w)));
    const prevEndsWithPeriod = i > 0 && /[.!?]\s*$/.test(words[i - 1]);

    if (
      word.length > 1 &&
      /^[A-ZÀ-Ý]/.test(word) &&
      !isFirstWord &&
      !prevEndsWithPeriod &&
      !seen.has(word.toLowerCase()) &&
      !validWords.has(word) &&
      !/^\s+$/.test(word)
    ) {
      seen.add(word.toLowerCase());
      suspects.push({
        placeholder: `__PROT_${suspects.length}__`,
        originalText: word,
        offset: currentOffset,
        length: word.length,
        wasCorrected: false,
      });
    }

    currentOffset += word.length;
  }

  return suspects;
}

export function protectEntities(text: string, suspects: SuspectWord[]): string {
  // Remplacer en partant de la fin pour préserver les offsets
  const sorted = [...suspects].sort((a, b) => b.offset - a.offset);
  let result = text;

  for (const suspect of sorted) {
    result =
      result.slice(0, suspect.offset) +
      suspect.placeholder +
      result.slice(suspect.offset + suspect.length);
  }

  return result;
}

export function restoreEntities(
  ltText: string,
  suspects: SuspectWord[],
): { text: string; suspects: SuspectWord[] } {
  let result = ltText;
  const updatedSuspects: SuspectWord[] = [];

  for (const suspect of suspects) {
    const placeholderIndex = result.indexOf(suspect.placeholder);

    if (placeholderIndex === -1) {
      // Placeholder corrompu par LT — restaurer tel quel avec warning
      console.warn(`Placeholder ${suspect.placeholder} not found in LT output`);
      updatedSuspects.push({ ...suspect, wasCorrected: true });
      continue;
    }

    // Vérifier si le placeholder est toujours intact
    const wasIntact = placeholderIndex >= 0;

    // Restaurer le mot original
    result =
      result.slice(0, placeholderIndex) +
      suspect.originalText +
      result.slice(placeholderIndex + suspect.placeholder.length);

    updatedSuspects.push({
      ...suspect,
      offset: placeholderIndex,
      length: suspect.originalText.length,
      wasCorrected: !wasIntact,
    });
  }

  return { text: result, suspects: updatedSuspects };
}
```

- [ ] **Step 4 : Écrire les tests pour protectEntities et restoreEntities**

```typescript
// Ajouter à tests/unit/entityDetector.test.ts

describe("protectEntities", () => {
  it("replaces entities with placeholders", () => {
    const text = "Noota est super";
    const suspects: SuspectWord[] = [
      { placeholder: "__PROT_0__", originalText: "Noota", offset: 0, length: 5, wasCorrected: false },
    ];
    const result = protectEntities(text, suspects);
    expect(result).toBe("__PROT_0__ est super");
  });
});

describe("restoreEntities", () => {
  it("restores original text from placeholders", () => {
    const ltText = "__PROT_0__ est super";
    const suspects: SuspectWord[] = [
      { placeholder: "__PROT_0__", originalText: "Noota", offset: 0, length: 5, wasCorrected: false },
    ];
    const { text } = restoreEntities(ltText, suspects);
    expect(text).toBe("Noota est super");
  });

  it("handles corrupted placeholders", () => {
    const ltText = "CORRUPTED est super";
    const suspects: SuspectWord[] = [
      { placeholder: "__PROT_0__", originalText: "Noota", offset: 0, length: 5, wasCorrected: false },
    ];
    const { text, suspects: updated } = restoreEntities(ltText, suspects);
    expect(updated[0].wasCorrected).toBe(true);
  });
});
```

- [ ] **Step 5 : Exécuter tous les tests entityDetector**

Run: `npx vitest run tests/unit/entityDetector.test.ts`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add src/services/entityDetector.ts tests/unit/entityDetector.test.ts
git commit -m "feat: add entity detection and protection service"
```

---

### Task 3 : Valid Words Store

**Files:**
- Create: `src/services/validWords.ts`
- Test: `tests/unit/validWords.test.ts`

- [ ] **Step 1 : Écrire les tests**

```typescript
// tests/unit/validWords.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadValidWords, addValidWord, isWordValid, resetCache } from "../../src/services/validWords";

beforeEach(() => {
  resetCache();
  vi.restoreAllMocks();
});

describe("loadValidWords", () => {
  it("loads words from API", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ words: ["Noota", "Slack"] }),
    } as Response);

    const words = await loadValidWords();
    expect(words.has("Noota")).toBe(true);
    expect(words.has("Slack")).toBe(true);
  });

  it("returns empty set on fetch failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));
    const words = await loadValidWords();
    expect(words.size).toBe(0);
  });
});

describe("addValidWord", () => {
  it("sends POST to API", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ words: ["Noota"] }),
    } as Response);

    await addValidWord("Noota");
    expect(fetchMock).toHaveBeenCalledWith(
      "/corrector/api/valid-words",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("isWordValid", () => {
  it("returns true for loaded words", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ words: ["Noota"] }),
    } as Response);

    await loadValidWords();
    expect(isWordValid("Noota")).toBe(true);
    expect(isWordValid("Unknown")).toBe(false);
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

Run: `npx vitest run tests/unit/validWords.test.ts`
Expected: FAIL — "Cannot find module"

- [ ] **Step 3 : Implémenter validWords.ts**

```typescript
// src/services/validWords.ts

let validWordsCache: Set<string> | null = null;

export function resetCache(): void {
  validWordsCache = null;
}

export async function loadValidWords(): Promise<Set<string>> {
  if (validWordsCache) {
    return validWordsCache;
  }

  try {
    const response = await fetch("/corrector/api/valid-words");
    if (!response.ok) {
      console.warn("Could not load valid words, using empty set");
      validWordsCache = new Set();
      return validWordsCache;
    }

    const data = await response.json();
    validWordsCache = new Set(data.words || []);
    return validWordsCache;
  } catch (e) {
    console.warn("Failed to load valid words:", e);
    validWordsCache = new Set();
    return validWordsCache;
  }
}

export async function addValidWord(word: string): Promise<void> {
  try {
    const response = await fetch("/corrector/api/valid-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });

    if (response.ok) {
      const data = await response.json();
      validWordsCache = new Set(data.words || []);
    }
  } catch (e) {
    console.warn("Failed to add valid word:", e);
  }
}

export function isWordValid(word: string): boolean {
  return validWordsCache?.has(word) ?? false;
}
```

- [ ] **Step 4 : Exécuter les tests**

Run: `npx vitest run tests/unit/validWords.test.ts`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add src/services/validWords.ts tests/unit/validWords.test.ts
git commit -m "feat: add valid words store with API integration"
```

---

### Task 4 : Serveur Bun

**Files:**
- Create: `server.ts`

- [ ] **Step 1 : Créer le serveur Bun**

```typescript
// server.ts
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const PORT = 25000;
const DIST_DIR = join(import.meta.dir, "dist");
const VALID_WORDS_PATH = join(import.meta.dir, "public", "data", "valid-words.json");

const LT_TARGET = "http://127.0.0.1:3002";
const LLM_TARGET = "http://127.0.0.1:30000";

function readValidWords(): string[] {
  try {
    const data = JSON.parse(readFileSync(VALID_WORDS_PATH, "utf-8"));
    return data.words || [];
  } catch {
    return [];
  }
}

function writeValidWords(words: string[]): void {
  writeFileSync(VALID_WORDS_PATH, JSON.stringify({ words }, null, 2) + "\n");
}

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // === API: Valid Words ===
    if (path === "/corrector/api/valid-words") {
      // CORS headers
      const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      };

      if (req.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            ...headers,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      if (req.method === "GET") {
        return new Response(JSON.stringify({ words: readValidWords() }), { headers });
      }

      if (req.method === "POST") {
        try {
          const body = await req.json();
          const word = body.word?.trim();
          if (!word) {
            return new Response(JSON.stringify({ error: "word is required" }), {
              status: 400,
              headers,
            });
          }

          const words = readValidWords();
          if (!words.includes(word)) {
            words.push(word);
            writeValidWords(words);
          }

          return new Response(JSON.stringify({ words }), { headers });
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers,
          });
        }
      }
    }

    // === API: LanguageTool Proxy ===
    if (path.startsWith("/corrector/api/lt/")) {
      const ltPath = path.replace("/corrector/api/lt", "");
      const ltUrl = `${LT_TARGET}${ltPath}${url.search}`;

      try {
        const ltResponse = await fetch(ltUrl, {
          method: req.method,
          headers: req.headers,
          body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
          redirect: "follow",
        });

        const responseHeaders = new Headers(ltResponse.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");

        return new Response(ltResponse.body, {
          status: ltResponse.status,
          headers: responseHeaders,
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "LanguageTool unavailable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // === API: LLM Proxy ===
    if (path.startsWith("/corrector/v1/")) {
      const llmPath = path.replace("/corrector", "");
      const llmUrl = `${LLM_TARGET}${llmPath}${url.search}`;

      try {
        const llmResponse = await fetch(llmUrl, {
          method: req.method,
          headers: req.headers,
          body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
          redirect: "follow",
        });

        const responseHeaders = new Headers(llmResponse.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");

        return new Response(llmResponse.body, {
          status: llmResponse.status,
          headers: responseHeaders,
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "LLM unavailable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // === Static Files ===
    let filePath = join(DIST_DIR, path === "/" ? "index.html" : path);

    if (!existsSync(filePath)) {
      // SPA fallback
      filePath = join(DIST_DIR, "index.html");
    }

    const file = Bun.file(filePath);
    return new Response(file);
  },
});

console.log(`🚀 AI Corrector server running on http://localhost:${PORT}`);
```

- [ ] **Step 2 : Ajouter le script dans package.json**

Lire package.json et ajouter dans "scripts" :
```json
"serve": "bun run server.ts"
```

- [ ] **Step 3 : Tester le serveur localement**

Run: `bun run server.ts` (dans un terminal)
Puis: `curl -s http://localhost:25000/corrector/api/valid-words | head`
Expected: `{"words":["Noota"]}`

- [ ] **Step 4 : Commit**

```bash
git add server.ts package.json
git commit -m "feat: add Bun server with valid-words API and proxy routes"
```

---

### Task 5 : Intégration entity protection dans languagetool.ts

**Files:**
- Modify: `src/services/languagetool.ts`
- Test: `tests/unit/languagetool.service.test.ts`

- [ ] **Step 1 : Modifier checkLanguageTool pour accepter des suspects**

```typescript
// src/services/languagetool.ts — modifier les imports et la fonction

import type { LTMatch, LTResponse, SuspectWord } from "../types";
import { restoreEntities } from "./entityDetector";

// ... garder le code existant de loadProtectedAcronyms, isProtectedByAcronym ...

export interface LTCheckResult {
  correctedText: string;
  matchCount: number;
  matches: LTMatch[];
  suspects: SuspectWord[];
}

export async function checkLanguageTool(
  text: string,
  suspects: SuspectWord[] = [],
): Promise<LTCheckResult> {
  if (!text.trim()) {
    throw new Error("Le texte ne peut pas être vide");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const response = await fetch(`${LT_API_BASE}/v2/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      text,
      language: "fr",
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(
      `LanguageTool API error: ${response.status}. Vérifiez que le serveur LT tourne sur ${LT_API_BASE}`,
    );
  }

  const data: LTResponse = await response.json();
  const acronyms = await loadProtectedAcronyms();
  const correctedText = applyAutoFix(text, data.matches, acronyms);

  // Restaurer les entités protégées
  let finalText = correctedText;
  let finalSuspects = suspects;

  if (suspects.length > 0) {
    const restored = restoreEntities(correctedText, suspects);
    finalText = restored.text;
    finalSuspects = restored.suspects;
  }

  return {
    correctedText: finalText,
    matchCount: data.matches.length,
    matches: data.matches,
    suspects: finalSuspects,
  };
}
```

- [ ] **Step 2 : Exécuter les tests existants**

Run: `npx vitest run tests/unit/languagetool.service.test.ts`
Expected: Tests passent (le paramètre suspects est optionnel avec valeur par défaut [])

- [ ] **Step 3 : Commit**

```bash
git add src/services/languagetool.ts
git commit -m "feat: integrate entity protection into LanguageTool service"
```

---

### Task 6 : Pipeline useCorrector avec protection d'entités

**Files:**
- Modify: `src/hooks/useCorrector.ts`

- [ ] **Step 1 : Ajouter le state suspects et les imports**

```typescript
// src/hooks/useCorrector.ts — en haut du fichier
import { detectEntities, protectEntities } from "../services/entityDetector";
import { loadValidWords, addValidWord } from "../services/validWords";
import type { SuspectWord } from "../types";
```

Ajouter dans le state :
```typescript
const [suspects, setSuspects] = useState<SuspectWord[]>([]);
```

- [ ] **Step 2 : Modifier handleCorrect pour la protection d'entités**

Dans `handleCorrect`, remplacer le bloc "Pre-fire LT" par :

```typescript
// Charger les mots valides
const validWords = await loadValidWords();

// Détecter et protéger les entités avant LT
let currentSuspects: SuspectWord[] = [];
if (settings.ltEnabled && settings.ltPreFire) {
  currentSuspects = detectEntities(currentText, validWords);
  if (currentSuspects.length > 0) {
    currentText = protectEntities(currentText, currentSuspects);
  }
}

// Pre-fire LT avec texte protégé
if (settings.ltEnabled && settings.ltPreFire) {
  try {
    const preResult = await checkLanguageTool(currentText, currentSuspects);
    if (preResult.matchCount > 0 && preResult.correctedText !== currentText) {
      currentText = preResult.correctedText;
      currentSuspects = preResult.suspects;
      setStats((prev) => ({ ...prev, ltPreCorrections: preResult.matchCount }));
    }
  } catch (e) {
    console.warn("Pre-fire LT failed:", e);
    setLtWarning("Pre-correction LanguageTool non disponible");
  }
}
```

Après le post-fire LT (si activé), restaurer les suspects :
```typescript
// Stocker les suspects pour l'UI
setSuspects(currentSuspects);
```

- [ ] **Step 3 : Ajouter handleKeepWord et handleRejectWord**

```typescript
const handleKeepWord = useCallback(async (word: string) => {
  await addValidWord(word);
  setSuspects((prev) => prev.filter((s) => s.originalText !== word));
}, []);

const handleRejectWord = useCallback((word: string) => {
  // Enlever le suspect — le mot original reste dans le texte
  setSuspects((prev) => prev.filter((s) => s.originalText !== word));
}, []);
```

- [ ] **Step 4 : Retourner suspects et handlers dans le hook**

```typescript
return {
  // ... existant ...
  suspects,
  handleKeepWord,
  handleRejectWord,
};
```

- [ ] **Step 5 : Exécuter les tests**

Run: `npx vitest run tests/unit/useCorrector.test.ts`
Expected: Tests existants passent

- [ ] **Step 6 : Commit**

```bash
git add src/hooks/useCorrector.ts
git commit -m "feat: integrate entity protection into corrector pipeline"
```

---

### Task 7 : Composant SuspectBadge

**Files:**
- Create: `src/components/SuspectBadge.tsx`

- [ ] **Step 1 : Créer le composant SuspectBadge**

```tsx
// src/components/SuspectBadge.tsx
import { useState, useRef, useEffect } from "react";

interface Props {
  word: string;
  onKeep: () => void;
  onReject: () => void;
}

export function SuspectWord({ word, onKeep, onReject }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="underline decoration-wavy decoration-orange-400 cursor-pointer
                   hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded px-0.5
                   transition-colors"
      >
        {word}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800
                        border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg
                        p-3 min-w-48">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            "{word}" non reconnu par LanguageTool
          </p>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                onKeep();
                setIsOpen(false);
              }}
              className="text-sm px-3 py-1.5 bg-green-50 dark:bg-green-900/30
                         text-green-700 dark:text-green-300 rounded hover:bg-green-100
                         dark:hover:bg-green-900/50 text-left transition-colors"
            >
              Garder "{word}"
            </button>
            <button
              type="button"
              onClick={() => {
                onReject();
                setIsOpen(false);
              }}
              className="text-sm px-3 py-1.5 bg-orange-50 dark:bg-orange-900/30
                         text-orange-700 dark:text-orange-300 rounded hover:bg-orange-100
                         dark:hover:bg-orange-900/50 text-left transition-colors"
            >
              Accepter correction
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/components/SuspectBadge.tsx
git commit -m "feat: add SuspectBadge interactive component"
```

---

### Task 8 : Output interactif avec SuspectBadge

**Files:**
- Modify: `src/components/Output.tsx`

- [ ] **Step 1 : Modifier Output pour afficher les suspects**

```tsx
// src/components/Output.tsx — modifier les props et le rendu

import { SuspectWord as SuspectBadge } from "./SuspectBadge";
import type { SuspectWord } from "../types";

interface Props {
  outputText: string;
  suspects: SuspectWord[];
  onKeepWord: (word: string) => void;
  onRejectWord: (word: string) => void;
  stats: {
    processingTime: number;
    modificationCount: number;
    ltPreCorrections: number;
    ltPostCorrections: number;
  };
  onCopy: (text: string) => void;
  onReset: () => void;
  isLoading: boolean;
  ltWarning?: string | null;
}

function renderTextWithSuspects(
  text: string,
  suspects: SuspectWord[],
  onKeep: (word: string) => void,
  onReject: (word: string) => void,
): React.ReactNode[] {
  if (suspects.length === 0) {
    return [<span key="text">{text}</span>];
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  const sorted = [...suspects].sort((a, b) => a.offset - b.offset);

  for (const suspect of sorted) {
    // Texte avant le suspect
    if (suspect.offset > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.slice(lastIndex, suspect.offset)}
        </span>
      );
    }

    // Le suspect cliquable
    parts.push(
      <SuspectBadge
        key={`suspect-${suspect.offset}`}
        word={suspect.originalText}
        onKeep={() => onKeep(suspect.originalText)}
        onReject={() => onReject(suspect.originalText)}
      />
    );

    lastIndex = suspect.offset + suspect.length;
  }

  // Texte après le dernier suspect
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return parts;
}

export function Output({
  outputText,
  suspects,
  onKeepWord,
  onRejectWord,
  stats,
  onCopy,
  onReset,
  isLoading,
  ltWarning,
}: Props) {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        {/* ... en-tête existant ... */}

        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          {outputText ? (
            <p className="text-lg leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {renderTextWithSuspects(outputText, suspects, onKeepWord, onRejectWord)}
            </p>
          ) : (
            /* ... état vide existant ... */
          )}
        </div>

        {/* ... stats et boutons existants ... */}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Mettre à jour App.tsx pour passer les nouvelles props**

```tsx
// src/App.tsx — ajouter suspects, handleKeepWord, handleRejectWord
const {
  // ... existant ...
  suspects,
  handleKeepWord,
  handleRejectWord,
} = useCorrector();

// Dans le JSX de Output :
<Output
  outputText={outputText}
  suspects={suspects}
  onKeepWord={handleKeepWord}
  onRejectWord={handleRejectWord}
  stats={stats}
  onCopy={handleCopySuccess}
  onReset={handleReset}
  isLoading={isLoading}
  ltWarning={ltWarning}
/>
```

- [ ] **Step 3 : Exécuter les tests**

Run: `npx vitest run`
Expected: Tests existants passent

- [ ] **Step 4 : Commit**

```bash
git add src/components/Output.tsx src/components/SuspectBadge.tsx src/App.tsx
git commit -m "feat: add interactive suspect display in Output component"
```

---

### Task 9 : Configuration Vite et package.json

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1 : Mettre à jour vite.config.ts pour le dev**

En mode dev, Vite reste sur un port séparé (ex: 25001) pour le HMR. Les appels API pointent vers le Bun server sur 25000.

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 25001,  // changé de 25000 à 25001
    host: true,
    allowedHosts: ["spark-787d-1.tail6cba9f.ts.net", "ai-corrector.spark-787d-1.tail6cba9f.ts.net"],
    proxy: {
      // Toutes les API vers le Bun server sur 25000
      "/corrector/api": {
        target: "http://127.0.0.1:25000",
        changeOrigin: true,
        secure: false,
      },
      "/corrector/v1": {
        target: "http://127.0.0.1:25000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
```

- [ ] **Step 2 : Ajouter le script serve dans package.json**

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "serve": "bun run server.ts",
  "serve:all": "bun run server.ts & vite",
  "lint": "biome check .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3 : Commit**

```bash
git add vite.config.ts package.json
git commit -m "config: update Vite for Bun server integration"
```

---

### Task 10 : Tests d'intégration

**Files:**
- Create: `tests/integration/entityProtection.test.ts`

- [ ] **Step 1 : Écrire le test d'intégration pipeline**

```typescript
// tests/integration/entityProtection.test.ts
import { describe, it, expect } from "vitest";
import { detectEntities, protectEntities, restoreEntities } from "../../src/services/entityDetector";

describe("Entity protection pipeline", () => {
  it("protects and restores entities through LT-like flow", () => {
    const originalText = "Noota est une application sur Slack pour les équipes.";

    // Étape 1 : détection
    const suspects = detectEntities(originalText, new Set());
    expect(suspects.length).toBeGreaterThan(0);

    // Étape 2 : protection
    const protectedText = protectEntities(originalText, suspects);
    expect(protectedText).not.toContain("Noota");

    // Étape 3 : simuler une "correction" LT qui ne touche pas aux placeholders
    const ltCorrected = protectedText.replace("aplication", "application");

    // Étape 4 : restauration
    const { text: restored, suspects: updatedSuspects } = restoreEntities(ltCorrected, suspects);
    expect(restored).toContain("Noota");

    // Les suspects sont toujours présents pour l'UI
    expect(updatedSuspects.length).toBeGreaterThan(0);
  });

  it("handles text with no entities", () => {
    const text = "Bonjour, comment allez-vous ?";
    const suspects = detectEntities(text, new Set());
    const protectedText = protectEntities(text, suspects);
    expect(protectedText).toBe(text);
  });

  it("preserves valid words from detection", () => {
    const text = "Noota est super";
    const validWords = new Set(["Noota"]);
    const suspects = detectEntities(text, validWords);
    expect(suspects).toHaveLength(0);
  });
});
```

- [ ] **Step 2 : Exécuter le test**

Run: `npx vitest run tests/integration/entityProtection.test.ts`
Expected: PASS

- [ ] **Step 3 : Commit**

```bash
git add tests/integration/entityProtection.test.ts
git commit -m "test: add integration tests for entity protection pipeline"
```

---

### Task 11 : Vérification finale et lint

- [ ] **Step 1 : Exécuter tous les tests**

Run: `npx vitest run`
Expected: Tous les tests passent

- [ ] **Step 2 : Typecheck**

Run: `npx tsc --noEmit`
Expected: Pas d'erreurs TypeScript

- [ ] **Step 3 : Lint**

Run: `npx biome check .`
Expected: Pas d'erreurs

- [ ] **Step 4 : Build**

Run: `npm run build`
Expected: Build réussi dans dist/

- [ ] **Step 5 : Test manuel du serveur Bun**

Run: `bun run server.ts`
Puis ouvrir `http://localhost:25000` dans le navigateur
Expected: L'app se charge, la correction fonctionne, les suspects sont affichés

- [ ] **Step 6 : Commit final**

```bash
git add -A
git commit -m "feat: complete entity protection feature"
```
