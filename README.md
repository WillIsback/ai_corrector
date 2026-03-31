# AI Corrector

Correcteur et reformateur de rédaction en français alimenté par LLM.

## Architecture

```
Caddy (HTTPS/Tailscale :443)
  └─ /corrector* → Bun server (:25000)
       ├─ Fichiers statiques (dist/)
       ├─ GET/POST /corrector/api/valid-words → public/data/valid-words.json
       ├─ Proxy /corrector/api/lt/* → LanguageTool (:3002)
       └─ Proxy /corrector/v1/* → LLM (:30000)

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
- Node.js 18+ (build)
- vLLM serveur (port 30000) ou API compatible OpenAI
- LanguageTool Docker (port 3002)

## Installation

```bash
npm install
```

## Configuration

`.env.local` à la racine du projet:

```env
VITE_LLM_API_BASE_URL=http://localhost:30000
VITE_LLM_API_PATH=/v1/chat/completions
VITE_LLM_MODEL_NAME=Intel/Qwen3-Coder-Next-int4-AutoRound
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

## Accès distant (Tailscale)

URL : https://spark-787d-1.tail6cba9f.ts.net/corrector

Caddy reverse proxy → Bun server (:25000). La config Caddy utilise `handle_path /corrector*` qui **supprime le préfixe `/corrector`** avant de transmettre au serveur. Le serveur Bun normalise les chemins pour gérer les deux formats.

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

1. Vérifier que le serveur LLM tourne : `curl -s http://localhost:30000/v1/models`
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
