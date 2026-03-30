# AI Corrector - Design Spécification

## 1. Overview

**AI Corrector** est une application web de correction rédactionnelle en français qui utilise un modèle LLM (OpenAI-compatible API) pour corriger la grammaire, l'orthographe, la syntaxe et le style du texte tout en conservant le ton original.

### 1.1 Objectifs
- Correction complète (grammaire, orthographe, syntaxe, style)
- Conservation du ton de l'auteur
- Interface web simple et réactive
- Mode agnostique vis-à-vis du modèle LLM (API OpenAI-compatible)

### 1.2 Contraintes
- Server-side : pas de backend, frontend seule
- LLM dispo sur localhost:30000 (OpenAI-compatible)
- Exposé sur port 25000 via Tailscale VPN
- Vanilla React (sans framework added)

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (Port 25000)                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    React + Vite + Tailwind                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐  │   │
│  │  │  Header     │  │   Main      │  │  Sidebar/Settings  │  │   │
│  │  │ - Title     │  │ - Input     │  │ - Mode selector    │  │   │
│  │  │ - Theme     │  │ - Output    │  │ - Options          │  │   │
│  │  └─────────────┘  └─────────────┘  └──────────────────────┘  │   │
│  │  ┌─────────────────────────────────────────────────────────┐  │   │
│  │  │                   Footer                                   │   │   │
│  │  │ - Stats (time, modifications) | Actions (copy, reset)    │   │   │
│  │  └─────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   LLM API (localhost:30000)                        │
│                  OpenAI-compatible endpoint                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 Structure des fichiers
```
ai_corrector/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Editor.tsx
│   │   ├── Output.tsx
│   │   └── Toast.tsx
│   ├── hooks/
│   │   └── useCorrector.ts
│   ├── utils/
│   │   ├── api.ts
│   │   └── diff.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

## 3. Fonctionnalités

### 3.1 Correction
- **Modes de correction** (4 options):
  1. **Formel/Professionnel** : Langage formel, ton professionnel
  2. **Semi-formel** : Langage neutre, adapté au courrier
  3. **Informel/Chat** : Langage décontracté, style conversationnel
  4. **Technical/Clair** : Texte technique, clarté et précision

- **Prompt système** :
```
Tu es un correcteur rédactionnel expert en français. 
Ton rôle est de corriger la grammaire, l'orthographe, la syntaxe et le style du texte fourni.
Conserve scrupuleusement le ton de l'auteur et le sens du message.
Applique le mode de correction suivant: {mode}.
Renvoie uniquement le texte corrigé, sans commentaires ni introductions.
```

### 3.2 Interface utilisateur

**Header**:
- Titre "AI Corrector"
- Bouton toggle thème (dark/light)
- Icône de configuration (ouverture sidebar)

**Main Area**:
- **Input**: textarea pour le texte à corriger
- **Output**: affichage diff view avec modifications mises en évidence
  - Texte inchangé : couleur grise
  - Texte correction : couleur verte
  - Ajouts : soulignement vert
  - Suppressions : strikethrough rouge

**Sidebar**:
- Sélection du mode de correction
- Affichage des options (checkboxes pour activer/désactiver types de corrections)

**Footer**:
- Statistiques:
  - Temps de traitement
  - Nombre de modifications
- Actions:
  - [Copier le texte corrigé]
  - [Réinitialiser]

### 3.3 State management

**State principaux** (React state + localStorage):
- `textContent`: texte saisi
- `outputText`: texte corrigé
- `diffView`: résultat diff structuré
- `mode`: mode de correction sélectionné
- `settings`: options de correction (object)
- `isLoading`: état de chargement
- `error`: erreur éventuelle
- `stats`: `{ processingTime, modificationCount }`

**Persistance** (localStorage):
- `ai-corrector:mode`
- `ai-corrector:settings`

## 4. Flow d'utilisation

```
1. User ouvre l'application (port 25000)
2. L'application charge les préférences depuis localStorage
3. User rentre du texte dans le textarea
4. User configure les options (mode, etc.) dans la sidebar
5. User clique sur "Corriger"
6. Application:
   a. Affiche "Chargement..."
   b. Appelle localhost:30000/v1/chat/completions
   c. Reçoit le texte corrigé
   d. Génère le diff view
   e. Stocke stats (temps, modifications)
7. Affichage du résultat avec diff view
8. User peut:
   - Copier le texte (→ toast confirmation)
   - Réinitialiser (→ reset fields)
   - Modifier le texte et corriger à nouveau
```

## 5. Technical specifications

### 5.1 API LLM
- **Endpoint**: `http://localhost:30000/v1/chat/completions`
- **Method**: POST
- **Headers**:
  ```json
  {
    "Content-Type": "application/json",
    "Authorization": "Bearer no-key-needed"
  }
  ```
- **Request body**:
  ```json
  {
    "model": "auto",
    "messages": [
      { "role": "system", "content": "Prompt système ci-dessus" },
      { "role": "user", "content": "{texte à corriger}" }
    ],
    "temperature": 0.3
  }
  ```

### 5.2 Diff view algorithm
- Utiliser un algorithme de diff (ex: diff-match-patch ou similar)
- Comparer texte original vs texte corrigé
- Générer structure:
  ```ts
  type DiffChunk = {
    type: 'unchanged' | 'added' | 'removed' | 'modified';
    text: string;
  };
  ```

### 5.3 Thème
- Detection: `window.matchMedia('(prefers-color-scheme: dark)').matches`
- Storage: `localStorage.setItem('ai-corrector:theme', 'dark' | 'light')`
- Classes: `dark:` ou `light:` de Tailwind

### 5.4 Toast system
- Position: top-right
- Duration: 3000ms
- Types: success, error, warning
- Animation: fade-in/fade-out

## 6. Error handling

### 6.1 Errors to handle
- **API timeout** (30s max)
- **API error** (non-200 status)
- **Network error** (no connection)
- **Empty text** (input vide)
- **Text too large** (warning, pas blocking)

### 6.2 Toast messages
```ts
{
  timeout: { message: 'Délai d\'attente dépassé', type: 'error' },
  apiError: { message: 'Erreur de l\'API LLM', type: 'error' },
  network: { message: 'Erreur de connexion', type: 'error' },
  empty: { message: 'Veuillez entrer du texte', type: 'warning' },
  copySuccess: { message: 'Texte copié !', type: 'success' }
}
```

## 7. Performance considerations

- **Debounce** sur input: 300ms (pas de correction en temps réel, mais debounce pour éviter calls API excessifs)
- **AbortController** pour annuler requête API si user change texte rapidement
- **Lazy loading** components (React.lazy)
- **Code splitting** route-based

## 8. Testing strategy

### 8.1 Unit tests
- `api.ts` : appel API, error handling
- `diff.ts` : algorithme de diff
- `useCorrector.ts` : hooks state management

### 8.2 Integration tests
- Complete workflow: input → API call → output
- Error scenarios: timeout, network error
- Theme toggle: dark/light switching
- Persistence: localStorage loading

### 8.3 E2E tests
- Cypress or Playwright
- Test complete user journey
- Test error scenarios

## 9. Deployment

### 9.1 Build
```bash
npm run build
```

### 9.2 Serve
```bash
npx serve -s dist -l 25000
# ou
vite Preview --host 0.0.0.0 --port 25000
```

### 9.3 Tailscale expose
```bash
tailscale serve https 25000
```

## 10. Future enhancements (not in scope v1)

- **Historique** des textes corrigés
- **Export** en fichier (txt, markdown)
- **Multiple languages** support
- **Collaborative editing** (version tracking)
- **Custom prompts** by user
- **Context window management** (long texts)
