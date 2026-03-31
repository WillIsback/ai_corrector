# Design : Protection des entités nommées contre LanguageTool

## Problème

LanguageTool corrige à tort des noms propres, marques et entités inconnues.
Exemple : "Noota" (application) → "N'opta", "Slack" → "Slac k".

Le dictionnaire d'acronymes existant (`dictionnaire.csv`) couvre les sigles institutionnels mais pas les noms de marques, personnes ou produits non standard.

## Objectif

Empêcher LT de corrompre les entités nommées, tout en permettant à l'utilisateur de valider ou rejeter les corrections suspectes de manière interactive.

## Approche choisie : Pre-protection par placeholders

Avant d'envoyer le texte à LT, détecter les entités avec compromise.js, les remplacer par des placeholders, laisser LT corriger le texte protégé, puis restaurer les entités originales et les marquer comme "suspect" dans la sortie.

## Architecture

```
Editor (texte brut)
  → entityDetector.ts : detectEntities() → SuspectWord[]
  → entityDetector.ts : protectEntities() → texte avec __PROT_N__
  → languagetool.ts : checkLanguageTool(texte_protégé)
  → entityDetector.ts : restoreEntities() → texte final + suspects
  → useCorrector.ts : state suspects
  → Output.tsx : rendu interactif avec SuspectBadge
```

## Composants

### 1. Entity Detector Service — `src/services/entityDetector.ts`

**Dépendance :** `compromise` (npm install compromise)

**Types :**

```typescript
interface SuspectWord {
  placeholder: string;    // "__PROT_0__"
  originalText: string;   // "Noota"
  offset: number;         // position dans le texte original
  length: number;         // longueur du mot original
  wasCorrected: boolean;  // true si la restauration remplace une correction LT
}

interface ProtectedText {
  text: string;           // texte avec placeholders
  suspects: SuspectWord[];
}
```

**Fonctions :**

- `detectEntities(text: string, validWords: Set<string>): SuspectWord[]`
  - Utilise `compromise(text).people()`, `.places()`, `.organizations()`
  - Heuristique supplémentaire : mots avec majuscule en milieu de phrase
  - Exclut les mots déjà dans `validWords` et le dictionnaire d'acronymes
  - Exclut les mots de début de phrase (faux positifs courants)

- `protectEntities(text: string, suspects: SuspectWord[]): string`
  - Remplace chaque entité par `__PROT_N__` (en partant de la fin pour préserver les offsets)

- `restoreEntities(protectedText: string, ltText: string, suspects: SuspectWord[]): { text: string, suspects: SuspectWord[] }`
  - Cherche chaque `__PROT_N__` dans le texte LT
  - Restaure le mot original
  - Marque `wasCorrected = true` si le placeholder a été altéré ou si les mots autour ont changé

### 2. Modification de `src/services/languagetool.ts`

**Changements :**

- `checkLanguageTool()` accepte un paramètre optionnel `suspects: SuspectWord[]`
- Avant l'appel API : texte déjà protégé (placeholders en place)
- Après l'appel API : passe le résultat à `restoreEntities()`
- Retourne `LTCheckResult` enrichi avec `suspects: SuspectWord[]`

```typescript
export interface LTCheckResult {
  correctedText: string;
  matchCount: number;
  matches: LTMatch[];
  suspects: SuspectWord[];  // nouveau
}
```

### 3. Valid Words Store — `src/services/validWords.ts`

**Fonctions :**

- `loadValidWords(): Promise<Set<string>>` — charge depuis GET `/corrector/api/valid-words`
- `addValidWord(word: string): Promise<void>` — POST `/corrector/api/valid-words` avec `{ word }`
- `isWordValid(word: string): boolean` — check synchrone après chargement initial
- Cache en mémoire (Set) avec chargement au premier appel

### 4. Bun Server — `server.ts` (nouveau fichier racine)

**Port :** 25000 (remplace `npx serve` en prod et le proxy Vite en dev)

**Responsabilités :**
- Sert les fichiers statiques depuis `dist/` (production)
- Proxy `/corrector/api/lt/*` → `http://localhost:3002` (LanguageTool)
- Proxy `/corrector/v1/*` → `http://localhost:30000` (LLM)
- Nouveau : routes `/corrector/api/valid-words`

**Routes valid-words :**

```
GET  /corrector/api/valid-words
  → lit public/data/valid-words.json
  → retourne { words: string[] }

POST /corrector/api/valid-words
  → body: { word: string }
  → lit le fichier, ajoute le mot s'il n'existe pas, réécrit
  → retourne { words: string[] } (liste mise à jour)
```

**Impact Caddy :** Aucun. Caddy reverse_proxy vers `host.docker.internal:25000` reste inchangé.

**En mode dev :** Vite tourne sur un autre port (ex: 25001) pour le HMR. L'app pointe vers `localhost:25000` (Bun) pour les API.
**En prod :** Bun sert `dist/` + API. Un seul process.

### 5. Output interactif — `src/components/Output.tsx`

**Changements :**

- Reçoit `suspects: SuspectWord[]` en props
- Parse le texte de sortie pour identifier les positions des suspects
- Rend chaque mot suspect avec `<SuspectBadge>`

**Composant `SuspectBadge` :**

```tsx
interface SuspectBadgeProps {
  word: string;
  onKeep: () => void;    // → addValidWord(word) + enlève le marquage
  onReject: () => void;  // → remplace par correction LT dans le texte
}
```

- Style : soulignement orange ondulé (`decoration-wavy decoration-orange-400`)
- Popover au clic avec les deux options

### 6. Modification de `src/hooks/useCorrector.ts`

**Changements :**

- Nouveau state : `suspects: SuspectWord[]`
- Avant l'appel LT : charger validWords, exécuter detectEntities + protectEntities
- Après l'appel LT : exécuter restoreEntities
- Passer `suspects` à Output
- Nouvelles fonctions : `handleKeepWord(word)` et `handleRejectWord(word)`

## Flux de données détaillé

```
1. User clique "Corriger"
2. useCorrector: loadValidWords() → Set<string>
3. useCorrector: detectEntities(textContent, validWords) → suspects[]
4. useCorrector: protectEntities(textContent, suspects) → protectedText
5. useCorrector: checkLanguageTool(protectedText) → ltResult (avec suspects)
6. useCorrector: llmCorrected = correctText(ltResult.correctedText, settings)
7. useCorrector: restoreEntities sur llmCorrected si postFire LT
8. Output: rendu du texte avec SuspectBadge pour chaque suspect
9. User clique "Garder" sur un suspect → addValidWord(word)
   → le mot est ajouté à valid-words.json
   → le suspect est retiré de la liste
   → le texte est re-rendu sans le marquage
10. User clique "Rejeter" → la correction LT est appliquée pour ce mot
    → le suspect est retiré de la liste
    → le texte est mis à jour avec la correction
```

## Fichiers à créer/modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/services/entityDetector.ts` | **Créer** | Service de détection et protection d'entités |
| `src/services/validWords.ts` | **Créer** | Store des mots valides (load, add, check) |
| `server.ts` | **Créer** | Serveur Bun (port 25000) — statique + proxy LT/LLM + valid-words |
| `src/services/languagetool.ts` | **Modifier** | Intégrer la protection par placeholders |
| `src/hooks/useCorrector.ts` | **Modifier** | Pipeline : detect → protect → LT → restore |
| `src/components/Output.tsx` | **Modifier** | Rendu interactif avec SuspectBadge |
| `src/types.ts` | **Modifier** | Ajouter SuspectWord, ProtectedText |
| `package.json` | **Modifier** | Ajouter dépendance `compromise`, script serveur |
| `vite.config.ts` | **Modifier** | Retirer le proxy LT (géré par Bun), garder HMR |

## Dépendances

- `compromise` — NLP léger en JS (détection d'entités)
- `bun` — runtime serveur (déjà mentionné par l'utilisateur)

## Gestion d'erreurs

- Si compromise.js échoue : fallback sur le dictionnaire seul (pas de crash)
- Si le serveur valid-words est inaccessible : les mots ne sont pas persistants mais l'app fonctionne
- Si un placeholder est corrompu par LT : log warning, garder le placeholder tel quel

## Tests

- Unit : `entityDetector.ts` — détection d'entités sur différents textes
- Unit : `validWords.ts` — load, add, duplicate handling
- Integration : pipeline complet avec texte contenant des entités
- E2E : interaction utilisateur avec SuspectBadge

## Limites connues

- compromise.js est moins précis que spaCy pour le NER français
- Les entités composées de mots communs (ex: "Apple" la marque vs "apple" le fruit) peuvent générer des faux positifs
- Le placeholder `__PROT_N__` pourrait être corrompu si LT détecte un problème de typographie autour (faible risque)
