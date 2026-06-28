# Design : Préparation release publique

**Date :** 2026-06-28
**Statut :** Approuvé

## Objectif

Préparer ai-corrector pour une release publique open source (MIT) en :
- éliminant les fuites d'informations personnelles
- rendant la configuration entièrement pilotée par variables d'environnement
- supprimant les dépendances vendor-specific (vLLM/Qwen3)
- fournissant une image Docker publiée sur ghcr.io
- mettant en place un pipeline CI/CD GitHub Actions

## Modèle de déploiement cible

**Self-hosted uniquement.** Pas d'interface pour saisir une clé API dans le navigateur. La configuration se fait exclusivement via variables d'environnement au démarrage du serveur. Deux cas d'usage :
- LLM local (Ollama, vLLM, LMStudio…)
- API distante compatible OpenAI (OpenAI, Groq, Mistral, Together, etc.) via `LLM_TARGET` + `LLM_API_KEY`

## Architecture : suppression du préfixe `/corrector`

Le préfixe `/corrector` est retiré de l'application. Les routes deviennent :

| Route | Fonction |
|-------|----------|
| `GET/POST /api/valid-words` | Mots validés utilisateur |
| `GET /api/lt/*` | Proxy LanguageTool |
| `POST /v1/chat/completions` | Proxy LLM instrumenté (OTEL) |
| `GET /v1/*` | Proxy LLM fallback |
| `GET /*` | Fichiers statiques (`dist/`) |

La gestion du préfixe de path est la responsabilité du reverse proxy (Traefik, Caddy, nginx). Le middleware `strip-corrector` de Traefik reste inchangé — il continue de strippper `/corrector` avant d'envoyer au serveur, et le serveur reçoit désormais directement `/api/...` et `/v1/...`.

Le code de normalisation de path dans `server.ts` (hack historique Caddy) est supprimé.

Les appels `fetch` dans le frontend (`src/utils/api.ts`, `src/services/languagetool.ts`) passent de `/corrector/v1/...` et `/corrector/api/...` à `/v1/...` et `/api/...`.

Le proxy Vite dev (`vite.config.ts`) est mis à jour en conséquence.

## Module `config.ts` (nouveau)

Fichier `config.ts` à la racine, importé par `server.ts` et `telemetry.ts`. Centralise toutes les variables d'environnement avec leurs valeurs par défaut :

```ts
export const config = {
  port:               Number(process.env.PORT ?? 25000),
  ltTarget:           process.env.LT_TARGET   ?? "http://127.0.0.1:3002",
  llmTarget:          process.env.LLM_TARGET  ?? "http://127.0.0.1:30000",
  llmApiKey:          process.env.LLM_API_KEY ?? "",
  llmModelName:       process.env.LLM_MODEL_NAME ?? "",
  llmDisableThinking: process.env.LLM_DISABLE_THINKING !== "false", // true par défaut
  corsOrigins:        (process.env.CORS_ORIGIN ?? "").split(",").filter(Boolean),
  otelEndpoint:       process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "",
}
```

`server.ts` et `telemetry.ts` remplacent leurs lectures directes de `process.env` par des imports de `config`.

## CORS

La liste blanche CORS actuelle (`.ts.net`, `localhost`, `127.0.0.1`) est remplacée par :
- `localhost` et `127.0.0.1` toujours autorisés
- Origines supplémentaires via `CORS_ORIGIN` (liste séparée par virgules, ex: `https://mondomaine.com`)

La référence à `.ts.net` (Tailscale) est retirée du code.

## AI-agnostic : `LLM_DISABLE_THINKING`

`chat_template_kwargs: { enable_thinking: false }` est conditionnel :

```ts
const extraParams = config.llmDisableThinking
  ? { chat_template_kwargs: { enable_thinking: false } }
  : {}

await llmClient.chat.completions.create({ ...llmBody, model, stream: true, ...extraParams })
```

`LLM_DISABLE_THINKING=true` par défaut (compatible vLLM/Qwen3). Mettre `false` pour OpenAI, Groq, Mistral, etc.

## Cleanup informations personnelles

| Fichier | Problème | Correction |
|---------|----------|------------|
| `start-ai-corrector.sh` | `LOG_DIR="/home/wderue/logs"` | `LOG_DIR="$HOME/logs"` |
| `README.md` | URL Tailscale privée, références Caddy | URL générique, mise à jour Traefik |
| `vite.config.ts` | Hôtes Tailscale dans `allowedHosts` | Suppression |

## Fichiers : git & données utilisateur

**`public/data/valid-words.json`** : contient des mots personnels de l'utilisateur.
- Ajouté à `.gitignore`
- Remplacé par `public/data/valid-words.json.example` contenant `{"words":[]}`
- Le Dockerfile crée le fichier vide au build si absent
- `server.ts` crée le fichier à la volée si absent (comportement actuel inchangé)

**`dist/`** : artefacts de build déjà dans `.gitignore` mais trackés.
- `git rm -r --cached dist/` pour désindexer
- Les artefacts sont distribués via GitHub Releases

## Dockerfile multi-stage

```dockerfile
# Stage 1 : build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json bun.lock ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 : runtime Bun
FROM oven/bun:alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY server.ts telemetry.ts config.ts package.json bun.lock ./
RUN bun install --production
RUN mkdir -p public/data && \
    [ -f public/data/valid-words.json ] || echo '{"words":[]}' > public/data/valid-words.json

EXPOSE 25000
CMD ["bun", "run", "server.ts"]
```

L'image est publiée sur `ghcr.io/<owner>/ai-corrector:latest` et `ghcr.io/<owner>/ai-corrector:<version>`.

## GitHub Actions

### `ci.yml` — Intégration continue

Déclenché sur : push sur `main`, toute pull request.

Étapes :
1. Checkout
2. Setup Node + Bun
3. `npm ci`
4. `npm run check` (biome lint + format check en une passe)
5. `npm test` (vitest)

### `release.yml` — Release et publication image

Déclenché sur : push de tag `v*` (ex: `v1.2.0`).

Étapes :
1. CI complet (lint + format + tests)
2. Build Docker multi-stage
3. Push image sur `ghcr.io` avec tags `:latest` et `:<version>`
4. Création GitHub Release avec :
   - Notes de release auto-générées
   - `install.sh` en asset téléchargeable

## `install.sh` — Script d'installation

Script interactif qui :
1. Crée un dossier `ai-corrector/`
2. Génère un `docker-compose.yml` avec l'image ghcr.io + LanguageTool
3. Demande interactivement : `LLM_TARGET`, `LLM_API_KEY`, `LLM_MODEL_NAME`
4. Crée un `.env` local avec les réponses
5. Lance `docker compose up -d`

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/ai-corrector/main/install.sh | bash
```

## `.env.example` complet

```env
# Serveur
PORT=25000
CORS_ORIGIN=https://mondomaine.com

# LLM (API compatible OpenAI)
LLM_TARGET=http://localhost:11434
LLM_API_KEY=sk-...
LLM_MODEL_NAME=llama3
LLM_DISABLE_THINKING=true   # Mettre false pour OpenAI, Groq, Mistral

# LanguageTool
LT_TARGET=http://localhost:3002

# Télémétrie OpenTelemetry (optionnel)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:6006
```

## Dépendances serveur manquantes

`openai` et `@opentelemetry/*` sont utilisés dans `server.ts` et `telemetry.ts` mais ne figurent pas dans `package.json`. Ils doivent être ajoutés en `dependencies` (pas `devDependencies`) pour être inclus dans `bun install --production` dans l'image Docker.

Packages à ajouter :
- `openai`
- `@opentelemetry/api`
- `@opentelemetry/sdk-trace-base`
- `@opentelemetry/exporter-trace-otlp-proto`
- `@opentelemetry/resources`

## Licence

Fichier `LICENSE` : MIT 2025.

## Ce qui n'est pas dans ce scope

- Interface utilisateur pour configurer la clé API
- Support multi-langue (LT est configuré en `fr` en dur)
- Documentation des `docs/superpowers/plans/` internes (contiennent des chemins personnels, mais ces fichiers ne sont pas exposés publiquement)
- Refactor de l'architecture des composants React
