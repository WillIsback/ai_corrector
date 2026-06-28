# Public Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Préparer ai-corrector pour une release publique open source MIT avec image Docker ghcr.io et pipeline CI/CD GitHub Actions.

**Architecture:** Suppression du préfixe `/corrector` de l'application (le reverse proxy le gère). Création d'un module `config.ts` centralisant toutes les variables d'environnement. Image Docker multi-stage publiée automatiquement sur tag `v*`.

**Tech Stack:** Bun (runtime serveur), Vite + React (frontend), Biome (lint/format), Vitest (tests), GitHub Actions (CI/CD), Docker (image multi-stage), ghcr.io (registry).

---

## Carte des fichiers

| Fichier | Action | Rôle |
|---------|--------|------|
| `config.ts` | Créer | Config centralisée — toutes les env vars avec defaults |
| `server.ts` | Modifier | Utiliser `config`, routes sans `/corrector`, CORS, thinking toggle |
| `telemetry.ts` | Modifier | Utiliser `config.otelEndpoint` |
| `src/utils/api.ts` | Modifier | Fetch `/v1/...` au lieu de `/corrector/v1/...` |
| `src/services/languagetool.ts` | Modifier | Default LT_API_BASE → `/api/lt` |
| `vite.config.ts` | Modifier | Supprimer Tailscale `allowedHosts`, proxy `/api` et `/v1` |
| `package.json` | Modifier | Ajouter `openai` + `@opentelemetry/*` en `dependencies` |
| `.env.example` | Modifier | Toutes les variables serveur documentées |
| `.gitignore` | Modifier | Ajouter `public/data/valid-words.json` |
| `start-ai-corrector.sh` | Modifier | `LOG_DIR="$HOME/logs"` |
| `README.md` | Modifier | Traefik, URL génériques, setup Docker |
| `LICENSE` | Créer | MIT 2025 |
| `Dockerfile` | Créer | Multi-stage : Node builder + Bun runtime |
| `install.sh` | Créer | Script interactif one-liner |
| `.github/workflows/ci.yml` | Créer | Lint + format + tests sur push/PR |
| `.github/workflows/release.yml` | Créer | Build + push image + GitHub Release sur tag `v*` |
| `public/data/valid-words.json.example` | Créer | Template vide `{"words":[]}` |
| `tests/unit/config.test.ts` | Créer | Tests du module config |
| `tests/unit/api.correctionMode.test.ts` | Modifier | Corriger mock SSE |
| `tests/unit/validWords.test.ts` | Supprimer | Teste un module inexistant |
| `tests/unit/useCorrector.test.ts` | Modifier | Retirer imports de modules inexistants |
| `tests/integration/entityProtection.test.ts` | Supprimer | Teste un module inexistant |
| `tests/unit/entityDetector.test.ts` | Supprimer | Teste un module inexistant |
| `tests/unit/diff.utils.test.ts` | Supprimer | Teste un module inexistant |

---

## Task 1 : Corriger les tests pré-existants

Plusieurs tests référencent des modules inexistants (`entityDetector`, `validWords`, `diff`) et le mock SSE de `api.correctionMode.test.ts` est incorrect. Ces échecs doivent être résolus avant tout changement pour avoir une baseline propre.

**Files:**
- Delete: `tests/integration/entityProtection.test.ts`
- Delete: `tests/unit/entityDetector.test.ts`
- Delete: `tests/unit/diff.utils.test.ts`
- Delete: `tests/unit/validWords.test.ts`
- Modify: `tests/unit/api.correctionMode.test.ts`
- Modify: `tests/unit/useCorrector.test.ts`

- [ ] **Step 1 : Vérifier l'état actuel des tests**

```bash
npm run test:run 2>&1 | grep -E "FAIL|PASS|Tests "
```

Résultat attendu : 6 fichiers failed, 5 passed.

- [ ] **Step 2 : Supprimer les tests de modules inexistants**

```bash
rm tests/integration/entityProtection.test.ts
rm tests/unit/entityDetector.test.ts
rm tests/unit/diff.utils.test.ts
rm tests/unit/validWords.test.ts
```

- [ ] **Step 3 : Retirer les imports cassés dans `useCorrector.test.ts`**

Lire le fichier pour identifier les imports à supprimer :

```bash
head -20 tests/unit/useCorrector.test.ts
```

Supprimer toutes les lignes importées de `../../src/services/validWords` et les usages associés dans ce fichier. Les tests qui utilisent `loadValidWords`, `addValidWord`, `isWordValid` doivent être supprimés ou mockés avec `vi.mock`.

Remplacer le contenu complet du fichier par une version sans ces imports. Identifier les tests qui fonctionnent encore (ceux qui ne dépendent que de `useCorrector`) et les garder. Exemple de mock si `validWords` est appelé indirectement :

```ts
vi.mock("../../src/services/validWords", () => ({
  loadValidWords: vi.fn().mockResolvedValue(new Set()),
  addValidWord: vi.fn().mockResolvedValue(undefined),
  isWordValid: vi.fn().mockReturnValue(false),
  resetCache: vi.fn(),
}));
```

- [ ] **Step 4 : Corriger le mock SSE dans `api.correctionMode.test.ts`**

Le mock actuel retourne une réponse sans `body`. La fonction `correctText` consomme un `ReadableStream` SSE. Remplacer le mock dans `beforeEach` par :

```ts
function makeSseMock(payload: object) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    }),
  });
}
```

Dans chaque test, utiliser `vi.stubGlobal("fetch", makeSseMock({ done: true, corrections: [] }))`.

Pour les tests qui vérifient le body envoyé (`toHaveBeenCalledWith`), utiliser `vi.spyOn(global, "fetch")` et inspecter les arguments séparément du mock de retour.

- [ ] **Step 5 : Vérifier que les tests passent**

```bash
npm run test:run 2>&1 | grep -E "FAIL|PASS|Tests "
```

Résultat attendu : 0 failed, tous les fichiers restants passent.

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "fix(tests): corriger les tests orphelins et le mock SSE"
```

---

## Task 2 : Dépendances serveur manquantes dans `package.json`

`openai` et les packages `@opentelemetry/*` sont dans `bun.lock` mais pas dans `package.json`. L'image Docker avec `bun install --production` ne les installerait pas.

**Files:**
- Modify: `package.json`

- [ ] **Step 1 : Ajouter les dépendances serveur**

Ouvrir `package.json` et déplacer / ajouter dans `"dependencies"` :

```json
"dependencies": {
  "@opentelemetry/api": "^1.9.0",
  "@opentelemetry/exporter-trace-otlp-proto": "^0.219.0",
  "@opentelemetry/resources": "^2.8.0",
  "@opentelemetry/sdk-trace-base": "^2.8.0",
  "compromise": "^14.15.0",
  "diff-match-patch": "^1.0.5",
  "openai": "^6.44.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

- [ ] **Step 2 : Mettre à jour le lockfile**

```bash
npm install
```

- [ ] **Step 3 : Vérifier que les tests passent toujours**

```bash
npm run test:run 2>&1 | grep -E "FAIL|PASS|Tests "
```

- [ ] **Step 4 : Commit**

```bash
git add package.json package-lock.json
git commit -m "fix(deps): déclarer les dépendances serveur dans package.json"
```

---

## Task 3 : Module `config.ts` centralisé

**Files:**
- Create: `config.ts`
- Create: `tests/unit/config.test.ts`

- [ ] **Step 1 : Écrire le test**

Créer `tests/unit/config.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("PORT defaults to 25000", async () => {
    const { config } = await import("../../config");
    expect(config.port).toBe(25000);
  });

  it("PORT reads from env var", async () => {
    vi.stubEnv("PORT", "9000");
    const { config } = await import("../../config");
    expect(config.port).toBe(9000);
  });

  it("llmDisableThinking defaults to true", async () => {
    const { config } = await import("../../config");
    expect(config.llmDisableThinking).toBe(true);
  });

  it("llmDisableThinking=false when LLM_DISABLE_THINKING=false", async () => {
    vi.stubEnv("LLM_DISABLE_THINKING", "false");
    const { config } = await import("../../config");
    expect(config.llmDisableThinking).toBe(false);
  });

  it("corsOrigins defaults to empty array", async () => {
    const { config } = await import("../../config");
    expect(config.corsOrigins).toEqual([]);
  });

  it("CORS_ORIGIN parses comma-separated list", async () => {
    vi.stubEnv("CORS_ORIGIN", "https://a.com,https://b.com");
    const { config } = await import("../../config");
    expect(config.corsOrigins).toEqual(["https://a.com", "https://b.com"]);
  });

  it("otelEndpoint defaults to empty string", async () => {
    const { config } = await import("../../config");
    expect(config.otelEndpoint).toBe("");
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue (module absent)**

```bash
npm run test:run -- tests/unit/config.test.ts 2>&1 | tail -10
```

Résultat attendu : FAIL — module `config` not found.

- [ ] **Step 3 : Créer `config.ts`**

```ts
export const config = {
  port: Number(process.env.PORT ?? 25000),
  ltTarget: process.env.LT_TARGET ?? "http://127.0.0.1:3002",
  llmTarget: process.env.LLM_TARGET ?? "http://127.0.0.1:30000",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModelName: process.env.LLM_MODEL_NAME ?? "",
  llmDisableThinking: process.env.LLM_DISABLE_THINKING !== "false",
  corsOrigins: (process.env.CORS_ORIGIN ?? "").split(",").filter(Boolean),
  otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "",
};
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
npm run test:run -- tests/unit/config.test.ts 2>&1 | tail -5
```

Résultat attendu : PASS, 7 tests.

- [ ] **Step 5 : Commit**

```bash
git add config.ts tests/unit/config.test.ts
git commit -m "feat: module config.ts centralisé avec variables d'environnement"
```

---

## Task 4 : Mettre à jour `telemetry.ts`

**Files:**
- Modify: `telemetry.ts`

- [ ] **Step 1 : Remplacer la lecture directe de `process.env` par `config`**

Remplacer le contenu de `telemetry.ts` :

```ts
export {};

import { trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { config } from "./config.ts";

if (config.otelEndpoint) {
  const resource = resourceFromAttributes({
    "service.name": "ai-corrector",
    "openinference.project.name": "ai-corrector",
  });

  const exporter = new OTLPTraceExporter({ url: `${config.otelEndpoint}/v1/traces` });
  const provider = new BasicTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);

  console.log("[otel] Telemetry enabled →", config.otelEndpoint);
} else {
  console.log("[otel] OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled");
}
```

- [ ] **Step 2 : Vérifier les tests**

```bash
npm run test:run 2>&1 | grep -E "FAIL|PASS|Tests "
```

Résultat attendu : 0 failed.

- [ ] **Step 3 : Commit**

```bash
git add telemetry.ts
git commit -m "refactor(telemetry): utiliser config centralisé"
```

---

## Task 5 : Refactorer `server.ts`

Quatre changements simultanés dans ce fichier : (1) importer depuis `config`, (2) supprimer le préfixe `/corrector` des routes, (3) CORS configurable, (4) `LLM_DISABLE_THINKING` conditionnel.

**Files:**
- Modify: `server.ts`

- [ ] **Step 1 : Remplacer les constantes d'env par l'import config**

En haut de `server.ts`, remplacer :

```ts
// Avant
const LT_TARGET = process.env.LT_TARGET ?? "http://127.0.0.1:3002";
const LLM_TARGET = process.env.LLM_TARGET ?? "http://127.0.0.1:30000";
const LLM_API_KEY = process.env.LLM_API_KEY ?? "";
const LLM_MODEL_NAME = process.env.LLM_MODEL_NAME ?? "";
```

Par :

```ts
import { config } from "./config.ts";

const PORT = config.port;
const DIST_DIR = join(import.meta.dir, "dist");
const VALID_WORDS_PATH = join(import.meta.dir, "public", "data", "valid-words.json");
```

Et remplacer toutes les occurrences de `LT_TARGET`, `LLM_TARGET`, `LLM_API_KEY`, `LLM_MODEL_NAME` par `config.ltTarget`, `config.llmTarget`, `config.llmApiKey`, `config.llmModelName` dans le reste du fichier.

- [ ] **Step 2 : Mettre à jour `getCorsHeaders` pour utiliser `config.corsOrigins`**

```ts
function getCorsHeaders(req: Request): Headers {
  const origin = req.headers.get("Origin") ?? "";
  const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
  const isAllowed = isLocalhost || config.corsOrigins.some((o) => origin === o);
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (isAllowed) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}
```

Faire la même mise à jour pour le bloc de vérification CORS inline dans les proxies LT et LLM (deux endroits dans le fichier qui répètent la logique `origin.includes(...)`). Remplacer ces blocs par la même logique `isLocalhost || config.corsOrigins.some(...)`.

- [ ] **Step 3 : Supprimer la normalisation de path et les routes `/corrector/`**

Supprimer ce bloc entier (lignes ~58-63 de `server.ts`) :

```ts
// Normalize path: Caddy's handle_path strips /corrector prefix,
// so re-add it for API routes that arrive without the prefix.
if ((path.startsWith("/api/") || path.startsWith("/v1/")) && !path.startsWith("/corrector/")) {
  path = `/corrector${path}`;
}
```

Puis renommer toutes les routes :

| Avant | Après |
|-------|-------|
| `path === "/corrector/api/valid-words"` | `path === "/api/valid-words"` |
| `path.startsWith("/corrector/api/lt/")` | `path.startsWith("/api/lt/")` |
| `path === "/corrector/v1/chat/completions"` | `path === "/v1/chat/completions"` |
| `path.startsWith("/corrector/v1/")` | `path.startsWith("/v1/")` |

Dans le proxy LT, mettre à jour la construction de l'URL :

```ts
// Avant
const ltPath = path.replace("/corrector/api/lt", "");
// Après
const ltPath = path.replace("/api/lt", "");
```

Dans le proxy LLM fallback :

```ts
// Avant
const llmPath = path.replace("/corrector", "");
// Après — path est déjà /v1/..., pas besoin de remplacer
const llmPath = path;
```

- [ ] **Step 4 : Rendre `chat_template_kwargs` conditionnel**

Dans le bloc `llmClient.chat.completions.create(...)`, remplacer :

```ts
const stream = await llmClient.chat.completions.create({
  ...llmBody,
  model: resolvedModel,
  stream: true,
  // Enforce disable thinking mode — vLLM/Qwen3 specific
  chat_template_kwargs: { enable_thinking: false },
} as any);
```

Par :

```ts
const extraParams = config.llmDisableThinking
  ? { chat_template_kwargs: { enable_thinking: false } }
  : {};

const stream = await llmClient.chat.completions.create({
  ...llmBody,
  model: resolvedModel,
  stream: true,
  ...extraParams,
} as any);
```

- [ ] **Step 5 : Mettre à jour le log de démarrage**

```ts
console.log(`🚀 AI Corrector server running on http://localhost:${config.port}`);
```

- [ ] **Step 6 : Vérifier les tests**

```bash
npm run test:run 2>&1 | grep -E "FAIL|PASS|Tests "
```

Résultat attendu : 0 failed.

- [ ] **Step 7 : Commit**

```bash
git add server.ts
git commit -m "refactor(server): config centralisé, routes sans préfixe /corrector, CORS et thinking configurable"
```

---

## Task 6 : Mettre à jour le frontend

**Files:**
- Modify: `src/utils/api.ts`
- Modify: `src/services/languagetool.ts`

- [ ] **Step 1 : Mettre à jour `src/utils/api.ts`**

Remplacer les deux occurrences de `/corrector/v1/` :

```ts
// ligne ~70
const response = await fetch("/v1/models", {
  headers: { Authorization: "Bearer no-key-needed" },
});

// ligne ~168
const response = await fetch("/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer no-key-needed" },
  body: JSON.stringify(request),
  signal: controller.signal,
});
```

- [ ] **Step 2 : Mettre à jour `src/services/languagetool.ts`**

Ligne 3, changer le fallback :

```ts
// Avant
const LT_API_BASE = import.meta.env.VITE_LT_API_BASE || "/corrector/api/lt";
// Après
const LT_API_BASE = import.meta.env.VITE_LT_API_BASE || "/api/lt";
```

- [ ] **Step 3 : Vérifier les tests**

```bash
npm run test:run 2>&1 | grep -E "FAIL|PASS|Tests "
```

Résultat attendu : 0 failed.

- [ ] **Step 4 : Build de vérification**

```bash
npm run build 2>&1 | tail -5
```

Résultat attendu : build sans erreur, output dans `dist/`.

- [ ] **Step 5 : Commit**

```bash
git add src/utils/api.ts src/services/languagetool.ts
git commit -m "refactor(frontend): fetch sans préfixe /corrector"
```

---

## Task 7 : Mettre à jour `vite.config.ts`

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1 : Remplacer le contenu**

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 25001,
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:25000",
        changeOrigin: true,
        secure: false,
      },
      "/v1": {
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

- [ ] **Step 2 : Vérifier les tests et le build**

```bash
npm run test:run 2>&1 | grep -E "FAIL|PASS|Tests "
npm run build 2>&1 | tail -3
```

- [ ] **Step 3 : Commit**

```bash
git add vite.config.ts
git commit -m "refactor(vite): supprimer allowedHosts Tailscale, proxy /api et /v1"
```

---

## Task 8 : Cleanup informations personnelles

**Files:**
- Modify: `start-ai-corrector.sh`
- Modify: `README.md`

- [ ] **Step 1 : Corriger `start-ai-corrector.sh`**

Ligne 7, remplacer :

```bash
# Avant
LOG_DIR="/home/wderue/logs"
# Après
LOG_DIR="${LOG_DIR:-$HOME/logs}"
```

- [ ] **Step 2 : Mettre à jour `README.md`**

Remplacer les sections suivantes :

**Section Architecture** — mettre à jour pour Traefik (pas Caddy) :

```
Traefik (HTTPS/reverse proxy)
  └─ PathPrefix /corrector → strip → Bun server (:25000)
       ├─ Fichiers statiques (dist/)
       ├─ GET/POST /api/valid-words → public/data/valid-words.json
       ├─ Proxy /api/lt/* → LanguageTool (:3002)
       └─ Proxy /v1/* → LLM provider
```

**Section Pré-requis** — remplacer "vLLM serveur (port 30000)" par :

```
- Bun (runtime serveur)
- Node.js 20+ (build)
- Fournisseur LLM compatible OpenAI API (Ollama, vLLM, OpenAI, Groq, Mistral…)
- LanguageTool Docker (port 3002, optionnel)
```

**Section Configuration** — remplacer l'exemple `.env.local` par les variables serveur documentées :

```env
PORT=25000
LLM_TARGET=http://localhost:11434
LLM_API_KEY=sk-...
LLM_MODEL_NAME=llama3
LLM_DISABLE_THINKING=true   # false pour OpenAI, Groq, Mistral
LT_TARGET=http://localhost:3002
CORS_ORIGIN=https://mondomaine.com
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:6006  # optionnel
```

**Supprimer** la ligne contenant l'URL Tailscale privée (`spark-787d-1.tail6cba9f.ts.net`) et la section "Accès distant (Tailscale)".

**Ajouter** une section "Docker (recommandé)" avec :

```bash
# Installation rapide
curl -fsSL https://raw.githubusercontent.com/OWNER/ai-corrector/main/install.sh | bash

# Ou manuellement avec Docker
docker run -e LLM_TARGET=... -e LLM_MODEL_NAME=... -p 25000:25000 ghcr.io/OWNER/ai-corrector:latest
```

- [ ] **Step 3 : Commit**

```bash
git add start-ai-corrector.sh README.md
git commit -m "fix: supprimer les informations personnelles et les URLs privées"
```

---

## Task 9 : Git & fichiers utilisateur

**Files:**
- Modify: `.gitignore`
- Create: `public/data/valid-words.json.example`

- [ ] **Step 1 : Ajouter `valid-words.json` au `.gitignore`**

Ajouter à la fin de `.gitignore` :

```
# Données utilisateur (générées au runtime)
public/data/valid-words.json
```

- [ ] **Step 2 : Créer le fichier example**

```bash
echo '{"words":[]}' > public/data/valid-words.json.example
```

- [ ] **Step 3 : Désindexer `valid-words.json` du tracking git**

```bash
git rm --cached public/data/valid-words.json
```

- [ ] **Step 4 : Désindexer `dist/` du tracking git**

```bash
git rm -r --cached dist/
```

- [ ] **Step 5 : Commit**

```bash
git add .gitignore public/data/valid-words.json.example
git commit -m "chore: exclure valid-words.json et dist/ du tracking git"
```

---

## Task 10 : `.env.example` complet et `LICENSE`

**Files:**
- Modify: `.env.example`
- Create: `LICENSE`

- [ ] **Step 1 : Remplacer `.env.example`**

```env
# AI Corrector — Configuration

# ── Serveur ────────────────────────────────────────────────────────────────
PORT=25000

# Origines CORS autorisées (séparées par virgules, localhost toujours autorisé)
# CORS_ORIGIN=https://mondomaine.com

# ── LLM (API compatible OpenAI) ────────────────────────────────────────────
# URL du serveur LLM
LLM_TARGET=http://localhost:11434

# Clé API (laisser vide si non requis, ex: Ollama local)
# LLM_API_KEY=sk-...

# Nom du modèle (auto-détecté si vide)
# LLM_MODEL_NAME=llama3

# Désactiver le mode "thinking" — true par défaut (vLLM/Qwen3)
# Mettre false pour OpenAI, Groq, Mistral, etc.
LLM_DISABLE_THINKING=true

# ── LanguageTool ───────────────────────────────────────────────────────────
LT_TARGET=http://localhost:3002

# ── Télémétrie OpenTelemetry (optionnel) ───────────────────────────────────
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:6006
```

- [ ] **Step 2 : Créer `LICENSE`**

```
MIT License

Copyright (c) 2025 AI Corrector Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3 : Commit**

```bash
git add .env.example LICENSE
git commit -m "chore: .env.example complet et licence MIT"
```

---

## Task 11 : Dockerfile multi-stage

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1 : Créer `.dockerignore`**

```
node_modules/
dist/
.git/
.env
.env.local
*.log
docs/
evals/
tests/
*.test.ts
*.test.tsx
.vscode/
.idea/
```

- [ ] **Step 2 : Créer `Dockerfile`**

```dockerfile
# Stage 1 : Build frontend
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2 : Runtime Bun
FROM oven/bun:alpine
WORKDIR /app

# Copier les artefacts du build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Copier les fichiers serveur
COPY server.ts telemetry.ts config.ts package.json bun.lock ./

# Installer uniquement les dépendances de production
RUN bun install --production --frozen-lockfile

# Créer le fichier valid-words.json vide si absent
RUN mkdir -p public/data && \
    [ -f public/data/valid-words.json ] || echo '{"words":[]}' > public/data/valid-words.json

EXPOSE 25000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun run -e 'fetch("http://localhost:25000").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'

CMD ["bun", "run", "server.ts"]
```

- [ ] **Step 3 : Vérifier le build Docker localement**

```bash
docker build -t ai-corrector:test .
```

Résultat attendu : image buildée sans erreur.

- [ ] **Step 4 : Tester le container**

```bash
docker run --rm -p 25000:25000 \
  -e LLM_TARGET=http://host.docker.internal:11434 \
  -e LLM_MODEL_NAME=test \
  ai-corrector:test &
sleep 3
curl -f http://localhost:25000/api/valid-words && echo "OK"
docker stop $(docker ps -q --filter ancestor=ai-corrector:test)
```

Résultat attendu : `{"words":[]}` retourné.

- [ ] **Step 5 : Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat(docker): Dockerfile multi-stage Node builder + Bun runtime"
```

---

## Task 12 : Script `install.sh`

**Files:**
- Create: `install.sh`

- [ ] **Step 1 : Créer `install.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

IMAGE="ghcr.io/OWNER/ai-corrector:latest"

echo -e "${BOLD}AI Corrector — Installation${NC}"
echo ""

# Vérifier Docker
if ! command -v docker &>/dev/null; then
  echo -e "${RED}Erreur : Docker est requis.${NC}"
  echo "Installer Docker : https://docs.docker.com/get-docker/"
  exit 1
fi

# Créer le dossier d'installation
INSTALL_DIR="${INSTALL_DIR:-ai-corrector}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo -e "${YELLOW}Configuration du fournisseur LLM :${NC}"
read -rp "URL de l'API LLM [http://localhost:11434] : " LLM_TARGET_INPUT
LLM_TARGET="${LLM_TARGET_INPUT:-http://localhost:11434}"

read -rp "Clé API (laisser vide si non requise) : " LLM_API_KEY
read -rp "Nom du modèle (ex: llama3, gpt-4o) : " LLM_MODEL_NAME

read -rp "Désactiver le mode thinking vLLM/Qwen3? [O/n] : " THINKING_CHOICE
if [[ "${THINKING_CHOICE,,}" == "n" ]]; then
  LLM_DISABLE_THINKING="false"
else
  LLM_DISABLE_THINKING="true"
fi

# Écrire le .env
cat > .env << EOF
LLM_TARGET=${LLM_TARGET}
LLM_API_KEY=${LLM_API_KEY}
LLM_MODEL_NAME=${LLM_MODEL_NAME}
LLM_DISABLE_THINKING=${LLM_DISABLE_THINKING}
LT_TARGET=http://languagetool:8010
PORT=25000
EOF

# Écrire le docker-compose.yml
cat > docker-compose.yml << COMPOSE
version: '3.8'

services:
  languagetool:
    image: erikvl87/languagetool:latest
    container_name: ai-corrector-lt
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8010/v2/languages"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  ai-corrector:
    image: ${IMAGE}
    container_name: ai-corrector
    ports:
      - "25000:25000"
    env_file: .env
    depends_on:
      languagetool:
        condition: service_healthy
    restart: unless-stopped
COMPOSE

echo ""
echo -e "${GREEN}Démarrage d'AI Corrector...${NC}"
docker compose pull
docker compose up -d

echo ""
echo -e "${GREEN}✓ AI Corrector disponible sur http://localhost:25000${NC}"
echo -e "  Logs : docker compose logs -f"
echo -e "  Arrêt : docker compose down"
```

- [ ] **Step 2 : Rendre exécutable**

```bash
chmod +x install.sh
```

- [ ] **Step 3 : Commit**

```bash
git add install.sh
git commit -m "feat: script d'installation one-liner"
```

---

## Task 13 : GitHub Actions — CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1 : Créer le dossier**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2 : Créer `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_call:

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Lint & format check
        run: npm run check

      - name: Run tests
        run: npm run test:run
```

- [ ] **Step 3 : Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: workflow GitHub Actions lint + format + tests"
```

---

## Task 14 : GitHub Actions — Release

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1 : Créer `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  release:
    needs: ci
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest

      - name: Build and push Docker image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

      - name: Patch install.sh with actual image name
        run: |
          sed -i "s|ghcr.io/OWNER/ai-corrector:latest|ghcr.io/${{ github.repository }}:latest|g" install.sh

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          files: install.sh
```

- [ ] **Step 2 : Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: workflow release — Docker build + push ghcr.io + GitHub Release"
```

---

## Task 15 : Vérification finale

- [ ] **Step 1 : Run complet des tests**

```bash
npm run test:run 2>&1 | grep -E "FAIL|PASS|Tests "
```

Résultat attendu : 0 failed.

- [ ] **Step 2 : Biome check complet**

```bash
npm run check
```

Résultat attendu : exit 0, aucune erreur.

- [ ] **Step 3 : Build frontend**

```bash
npm run build
```

Résultat attendu : `dist/` généré sans erreur.

- [ ] **Step 4 : Build Docker**

```bash
docker build -t ai-corrector:final .
```

Résultat attendu : image buildée, toutes les couches en cache.

- [ ] **Step 5 : Vérifier l'absence de leaks personnels**

```bash
grep -r "wderue\|tail6cba9f\|spark-787d\|192\.168\." \
  --include="*.ts" --include="*.tsx" --include="*.sh" \
  --include="*.yml" --include="*.md" --include="*.json" \
  . 2>/dev/null | grep -v ".git" | grep -v "docs/superpowers/plans/2026-03-31"
```

Résultat attendu : aucun résultat (ou uniquement les anciens plans internes).

- [ ] **Step 6 : Tag de release**

```bash
git tag v1.2.0
git push origin main --tags
```

Le workflow `release.yml` se déclenche, build l'image Docker, la pousse sur ghcr.io et crée la GitHub Release avec `install.sh`.
