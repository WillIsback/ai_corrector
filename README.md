# AI Corrector

Correcteur et reformateur de rédaction en français alimenté par LLM.

## Pré-requis

- Node.js 18+
- vLLM serveur (port 30000) ou API compatible OpenAI

**Important**: Si vous utilisez vLLM, configurez un proxy pour contourner les problèmes CORS.

## Installation

```bash
npm install
```

## Configuration

Créez un fichier `.env.local` à la racine du projet:

```env
VITE_LLM_API_BASE_URL=http://localhost:30000
VITE_LLM_API_PATH=/v1/chat/completions
VITE_LLM_MODEL_NAME=Intel/Qwen3-Coder-Next-int4-AutoRound
```

### Configuration CORS (vLLM)

Le serveur vLLM ne supporte pas les requêtes OPTIONS (preflight CORS). Pour résoudre cela, le proxy Vite redirige automatiquement les requêtes `/v1/*` vers le serveur LLM.

**Si vous utilisez un autre serveur API**, assurez-vous qu'il supporte les CORS ou configurez un proxy dans `vite.config.ts`.

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

## Problemes connus

### ERR_CONNECTION_REFUSED

Si vous voyez l'erreur "Impossible de contacter le serveur de correction":
1. Vérifiez que le serveur LLM tourne sur le port configuré
2. Testez: `curl -s http://localhost:30000/v1/models`
3. Si le serveur est lancé mais que le navigateur ne peut pas se connecter, vérifiez la configuration CORS

### Veuillez entrer du texte

Cette erreur apparaissait dans les versions antérieures à la correction de mars 2026. Elle était causée par:
- Un `finally` block qui effaçait les erreurs immédiatement après leur affichage
- Une incompatibilité CORS avec vLLM

**Fix appliqué**: 
- Suppression de `setError(null)` dans la clause `finally`
- Ajout d'un proxy Vite pour contourner les problèmes CORS

## Fonctionnalités

- Correction complète (grammaire, orthographe, syntaxe, style)
- 4 modes de correction (Formel, Semi-formel, Informel, Technical)
- Diff view pour visualiser les modifications
- Persistancy des préférences
- Thème auto (dark/light)
- Toast notifications
