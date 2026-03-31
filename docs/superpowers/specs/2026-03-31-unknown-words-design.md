# Design: Mots Inconnus LanguageTool

**Date:** 2026-03-31  
**Statut:** En attente de validation utilisateur

## Contexte

LanguageTool corrige automatiquement des mots inconnus (ex: "Noota" → "N'opta") à cause du préfixe LT qui ne reconnaît pas les noms d'applications, marques, etc.

## Objectif

1. Détecter les mots "unknown" (camelCase, PascalCase)
2. Les marquer sans les corriger automatiquement
3. Permettre à l'utilisateur de les conserver ou corriger
4. Mémoriser les mots validés dans un fichier JSON

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   UTILISATEUR   │────▶│ LanguageTool    │────▶│   FILTRAGE      │
│   (texte input) │     │   (correction)  │     │   (isUnknown)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │  valid-words.json│◀────│   ADMIN PAGE   │
                        │  (mots validés)  │     │  /admin/valid-  │
                        └─────────────────┘     │    words        │
                                               └─────────────────┘
```

## Détection des mots unknown

### Fonction `isUnknownWord(text, offset, length, acronyms, validWords)`

**Entrée:** texte, position du match LT, dictionnaires (acronymes + mots validés)

**Logique:**

1. Extraire le mot à la position [offset, offset+length]
2. Nettoyer : supprimer ponctuation, garder uniquement lettres/chiffres
3. Si longueur < 2 → return false

4. **Cas non-UNKNOWN (corriger normalement):**
   - Mot dans dictionnaire.csv (acronymes)
   - Mot dans valid-words.json
   - Tout en MAJUSCULES avec ≥3 lettres (ex: "CGOS")
   - Premier caractère majuscule + reste minuscule (nom propre: "Paris")

5. **Cas UNKNOWN (marquer sans corriger):**
   - Majuscule au milieu (camelCase): "Noota", "NotaApp"
   - Plusieurs majuscules (PascalCase): "MonSuperApp"
   - Mot non reconnu par LT ET non dans les dictionnaires

**Exemples:**

| Mot | Détection | Comportement |
|-----|-----------|--------------|
| Noota | majuscule milieu | Marquer unknown |
| N'opta | apostrophe | Corriger |
| CGOS | tout majuscule | Protéger (acronyme) |
| Paris | nom propre classique | Corriger si erreur |
| bonjour | tout minuscule | Corriger |

## Implémentation

### 1. Fichier data/valid-words.json

```json
{
  "words": ["Noota", "Nota", "MonApp"]
}
```

### 2. Service languagetool.ts

- Charger `valid-words.json` au démarrage
- Fonction `isUnknownWord()` avec la logique ci-dessus
- Filtrer les matches LT avant d'appliquer les corrections auto
- Conserver les matches unknown pour l'affichage en highlight

### 3. UI - Highlights interactifs

- Les mots unknown sont highlight en jaune
- Clic sur le highlight → popover avec options:
  - "Conserver" → ajouter à valid-words.json
  - "Corriger" → appliquer la suggestion LT

### 4. Page Admin (/admin/valid-words)

Accessible via le bouton engrenage.

**Fonctionnalités:**
- Tableau des mots validés (triable, searchable)
- Ajouter un mot manuellement
- Supprimer un mot
- Export JSON (télécharger)
- Import JSON (fusionner)

## Choix techniques

- **Approche:** Filtrage des résultats LT, pas de bypass
- **Stockage:** Fichier JSON local (pas de backend)
- **UI:** Highlights avec popover interactif

## Étapes d'implémentation

1. Créer `data/valid-words.json` (vide ou avec mots initiaux)
2. Modifier `languagetool.ts` pour charger le fichier et filtrer
3. Ajouter `isUnknownWord()` dans le service
4. Créer la page Admin `/admin/valid-words`
5. Connecter le bouton engrenage à la page Admin
6. Implémenter les highlights unknown dans l'UI