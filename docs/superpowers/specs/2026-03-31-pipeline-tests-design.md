# Tests exhaustifs du pipeline de correction (hors UI)

> **Date:** 2026-03-31
> **Contexte:** Validation de l'implémentation LanguageTool dans le pipeline de correction

## Objectif

Tester exhaustivement le pipeline de correction avec LanguageTool, sans涉及 UI. Couverture: tests unitaires, d'intégration et e2e.

## Architecture de test proposée

```
tests/
├── unit/
│   ├── languagetool.service.test.ts    # Tests service LT (auto-fix, API)
│   ├── diff.utils.test.ts              # Tests computeDiff, mergeDiffs
│   └── useCorrector.logic.test.ts      # Tests logique du hook (sans UI)
├── integration/
│   └── pipeline.test.ts                # Tests pipeline complet (mocké)
└── e2e/
    └── fullCorrection.test.ts          # Tests avec vrai serveur LT
```

## Données de test

**Texte principal (erreurs réelles):**
```
Bonjour Gwladys,

À la réunion de vendredis après-midi, les équipes national ont indicator n'avoir aucune information sur le rétablissement d'u service est que l'enquête n'été pas entre leurs main, met celle des services de la COSSIM (Centre opérationnel de la sécurité des systèmes d'information ministériels). Ils nous on par ailleurs montrait le contenu du mail qui sera envoyé aux agents impactés.

Je reviens vers vous dès que je reçois une réponse satisfaisante.

Cordialement,
```

**Erreurs attendues:**
- "vendredis" → "vendredi" (accord)
- "ont indicator" → "ont indiqué" (conjugaison)
- "d'u service" → "d'un service" (article)
- "n'été pas" → "n'tait pas" (conjugaison)
- "leurs main" → "leurs mains" (accord)
- "met" → "mais" (confusion)
- "nous on" → "nous ont" (homophone)

**Cas limites:**
- Texte sans erreurs → LT retourne 0 matches
- Erreurs grammaire uniquement
- Erreurs orthographe uniquement
- Texte vide → erreur attendue
- Texte très long → timeout handling

## Couverture de tests

### 1. Unit tests - languagetool.service.ts

| Cas | Description |
|-----|-------------|
| applyAutoFix_empty | Pas de matches → retourne texte original |
| applyAutoFix_single | Un match → applique première replacement |
| applyAutoFix_multiple | Multiples matches → applique en ordre décroissant d'offset |
| applyAutoFix_noReplacement | Match sans replacement → ignoré |
| checkLanguageTool_empty | Texte vide → Error |
| checkLanguageTool_timeout | Timeout 5s → AbortError |
| checkLanguageTool_apiError | API error → Error avec message |
| checkLTAvailable_success | Serveur dispo → true |
| checkLTAvailable_timeout | Timeout 2s → false |

### 2. Unit tests - diff.ts

| Cas | Description |
|-----|-------------|
| computeDiff_noChange | Identique → chunk unchanged |
| computeDiff_added | Ajout → chunk added avec source |
| computeDiff_removed | Suppression → chunk removed |
| computeDiff_source_llm | Source=llm → colorié bleu |
| computeDiff_source_lt_pre | Source=lt_pre → colorié orange |
| computeDiff_source_lt_post | Source=lt_post → colorié orange |
| mergeDiffs_adjacentSameSource | Adjacents même source → fusionnés |
| mergeDiffs_adjacentDiffSource | Adjacents source différent → non fusionnés |
| mergeDiffs_immutability | Pas de mutation des tableaux originaux |

### 3. Integration tests - Pipeline

| Cas | Description |
|-----|-------------|
| pipeline_allEnabled | LT pré+post + LLM →順序 correcte |
| pipeline_ltDisabled | LT désactivé → skip pre et post |
| pipeline_ltPreOnly | Pré seul → skip post |
| pipeline_ltPostOnly | Post seul → skip pré |
| pipeline_llmFail | LLM error → propagation erreur |
| pipeline_preLtFail | Pre-LT fail → warning, continue LLM |
| pipeline_postLtFail | Post-LT fail → warning, output LLM |
| pipeline_stats | Stats → ltPreCorrections, ltPostCorrections |

### 4. E2E tests (optionnel)

| Cas | Description |
|-----|-------------|
| e2e_realCorrection | Texte réel → correction appliquée |
| e2e_timing | Timing pre/post fire < 5s |

## Stack

- **Framework:** Vitest (native Vite, rapide)
- **Mocks:** Vitest fn, mockfetch
- **E2E:** testcontainers ou mock HTTP

## Priorité

1. Unit tests (languagetool.ts, diff.ts) - critiques pour LT
2. Integration test pipeline (mocks HTTP)
3. E2E test - optionnel si Docker dispo