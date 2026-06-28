# AI Corrector

Correcteur et reformateur de rédaction en français alimenté par LLM.

## Architecture

```
Traefik (HTTPS/reverse proxy)
  └─ PathPrefix /corrector → strip → Bun server (:25000)
       ├─ Fichiers statiques (dist/)
       ├─ GET/POST /api/valid-words → public/data/valid-words.json
       ├─ Proxy /api/lt/* → LanguageTool (:3002)
       └─ Proxy /v1/* → LLM provider

Vite dev (:25001) → proxy API → Bun (:25000)
```

### Pipeline de correction

```
Input → detectEntities (compromise.js) → getEntityOffsets
      → LT (filtre les matches sur les entités)
      → LLM
      → markEntitiesInOutput (cherche les entités dans la sortie)
      → SuspectBadge (marqueur orange cliquable)
```

Les entités (noms propres, marques) sont détectées dans le texte d'entrée et **protégées des corrections LanguageTool** via un filtrage par offsets. L'utilisateur peut valider un mot (Garder → `valid-words.json`) ou accepter la correction LT.

## Pré-requis

- Bun (runtime serveur)
- Node.js 20+ (build)
- Fournisseur LLM compatible OpenAI API (Ollama, vLLM, OpenAI, Groq, Mistral…)
- LanguageTool Docker (port 3002, optionnel)

## Installation

```bash
npm install
```

## Installation Docker (recommandé)

```bash
# Installation rapide
curl -fsSL https://raw.githubusercontent.com/OWNER/ai-corrector/main/install.sh | bash

# Ou avec Docker directement
docker run -e LLM_TARGET=http://host.docker.internal:11434 \
           -e LLM_MODEL_NAME=llama3 \
           -p 25000:25000 \
           ghcr.io/OWNER/ai-corrector:latest
```

## Configuration

Variables d'environnement serveur (fichier `.env` à la racine) :

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

### Fichier des mots valides

`public/data/valid-words.json` contient les mots que l'utilisateur a validés (protégés du marquage). Format:

```json
{
  "words": ["Noota", "Slack"]
}
```

Ce fichier est modifié dynamiquement via l'API `POST /corrector/api/valid-words` (quand l'utilisateur clique "Garder").

## Démarrage

### Production (Bun server)

```bash
npm run build
bun run server.ts
```

Accès : http://localhost:25000

### Développement (Vite + Bun)

```bash
# Terminal 1 : Bun server (API + proxy)
bun run server.ts

# Terminal 2 : Vite dev (HMR)
npm run dev
```

- Bun : http://localhost:25000 (API)
- Vite : http://localhost:25001 (dev avec HMR)

### Scripts

```bash
./start-ai-corrector.sh       # LanguageTool + AI Corrector (production)
./start-ai-corrector.sh lt    # LanguageTool seul
./start-ai-corrector.sh app   # AI Corrector seul
```

## Tests

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # avec couverture
```

## Build

```bash
npm run build
```

Sortie : `dist/` (servi par Bun server)

## Problèmes connus

### ERR_CONNECTION_REFUSED

1. Vérifier que le serveur LLM tourne : `curl -s http://localhost:11434/v1/models`
2. Vérifier que Bun server tourne : `curl -s http://localhost:25000/corrector/api/valid-words`

### LanguageTool ne corrige pas

Vérifier que LT tourne : `curl -s http://localhost:3002/v2/languages`

## Fonctionnalités

- Correction complète (grammaire, orthographe, syntaxe, style)
- 4 modes de correction (Formel, Semi-formel, Informel, Technical)
- Protection des entités nommées (noms propres, marques)
- Validation interactive des mots suspects (Garder/Rejeter)
- Diff view pour visualiser les modifications
- Persistance des préférences (localStorage)
- Thème auto (dark/light)
