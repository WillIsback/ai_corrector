# Phoenix Eval & Experiments — ai-corrector

**Date :** 2026-06-24
**Objectif :** Exploiter Phoenix au-delà du tracing basique — évaluation automatique LLM-as-judge et comparaison de modèles open-source via Phoenix Experiments.

---

## Contexte

ai-corrector dispose déjà d'un tracing OTel basique : un span `llm.chat` avec input/output/tokens envoyé à Phoenix via OTLP. Phoenix tourne dans le stack monitoring (`stacks/monitoring/docker-compose.yml`, port 6006).

Le projet étant une pipeline de correction de texte français (LanguageTool → LLM → LanguageTool), l'objectif est de construire un flywheel :

**Tracer → Évaluer → Valider → Comparer les modèles**

Usage final : avant de déployer un nouveau modèle open-source (Mistral, LLaMA, etc.), le passer sur un dataset réel de corrections françaises et voir objectivement s'il fait mieux que Qwen3 sur 3 critères de qualité.

---

## Architecture globale

```
┌─────────────────────────────────────────────────────┐
│                   ai-corrector                       │
│                                                      │
│  User input                                          │
│      │                                               │
│      ▼                                               │
│  [span: correction.request]  ← span racine           │
│      ├── [span: lt.pre]      ← LanguageTool pre      │
│      ├── [span: llm.chat]    ← Qwen3/vLLM (enrichi) │
│      └── [span: lt.post]     ← LanguageTool post     │
└────────────────────┬────────────────────────────────┘
                     │ OTLP
                     ▼
             ┌──────────────┐
             │   Phoenix    │ (port 6006, déjà opérationnel)
             └──────┬───────┘
                    │
        ┌───────────┼───────────────┐
        ▼           ▼               ▼
   [Traces]    [Datasets]     [Experiments]
                    │               │
              traces filtrées  Qwen3 vs Mistral
              par score        vs LLaMA → scores
              exportées        comparatifs

┌─────────────────────────┐
│  evals/evaluate.py      │ script ponctuel
│  LLM-as-judge × 3       │
│  faithfulness           │
│  grammar                │
│  style_adherence        │
│  → log_evaluations()    │
└─────────────────────────┘

┌─────────────────────────┐
│  evals/experiment.py    │ script ponctuel
│  task: appel corrector  │
│  avec modèle variable   │
│  → Phoenix Experiment   │
└─────────────────────────┘
```

---

## Section 1 — Enrichissement du tracing (server.ts)

### Span racine `correction.request`

Nouveau span qui enveloppe tout le pipeline de correction. C'est le point d'entrée que le LLM-as-judge utilisera pour comparer le texte avant/après.

**Attributs :**
```
input.text            texte original soumis par l'utilisateur
correction.mode       "formel" | "semi-formel" | "informel" | "technical"
lt.enabled            bool — LanguageTool activé ou non
lt.pre_fire           bool
lt.post_fire          bool
output.text           texte final après tout le pipeline
modifications.count   nombre total de changements appliqués
```

### Span `lt.pre` (si ltPreFire activé)

```
lt.matches_count      nombre de suggestions LanguageTool
lt.rules_triggered    liste des rule IDs ex: ["ACCORD_GENRE", "VIRGULE"]
```

### Span `lt.post` (si ltPostFire activé)

```
lt.matches_count      nombre de suggestions restantes après passage LLM
```

### Span `llm.chat` (enrichi)

Existant, on ajoute :
```
llm.prompt_template   le system prompt selon le mode (tronqué à 500 chars)
```

Les attributs existants (`llm.model_name`, `input.value`, `output.value`, `llm.token_count.*`) sont conservés.

---

## Section 2 — Script d'évaluation LLM-as-judge (`evals/`)

### Structure des fichiers

```
evals/
├── evaluate.py       script principal — récupère traces, lance les judges
├── experiment.py     comparaison de modèles via Phoenix Experiments
├── evaluators.py     définition des 3 prompts LLM-as-judge
└── requirements.txt  arize-phoenix, openai, pandas
```

### Les 3 évaluateurs (`evaluators.py`)

Chaque évaluateur est un template de prompt envoyé au LLM local (vLLM/Qwen3) via `arize-phoenix-evals`. Output : score flottant 0-1 + label catégoriel.

| Évaluateur | Inputs utilisés | Critère évalué |
|---|---|---|
| `faithfulness` | `input.text` + `output.text` | Le sens original est-il préservé ? |
| `grammar` | `output.text` seul | Le texte corrigé est-il grammaticalement correct ? |
| `style_adherence` | `output.text` + `correction.mode` | Le registre correspond-il au mode demandé ? |

### Fonctionnement de `evaluate.py`

```
1. px.Client() → connexion Phoenix (PHOENIX_COLLECTOR_ENDPOINT)
2. Récupérer les spans "correction.request" sans évaluation existante
3. Pour chaque span :
   a. Extraire input.text, output.text, correction.mode
   b. Lancer les 3 évaluateurs en parallèle (ThreadPoolExecutor)
   c. px.Client().log_evaluations() → pousse les scores vers Phoenix
4. Afficher résumé : N spans évalués, scores moyens par critère
```

### Usage

```bash
# Évaluer les 50 dernières traces
python evals/evaluate.py --last 50

# Évaluer depuis une date
python evals/evaluate.py --since 2026-06-20
```

---

## Section 3 — Datasets et Experiments (`evals/experiment.py`)

### Création du dataset (manuelle, une fois)

Dans Phoenix UI, filtrer les traces avec scores élevés (ex: `faithfulness > 0.8 AND style_adherence > 0.8`) et les exporter comme Dataset nommé `corrections-fr-v1`.

Chaque exemple du dataset contient :
```
input_text        texte original
correction_mode   mode demandé
expected_output   texte corrigé validé (référence)
```

### Task Phoenix

Une "task" est une fonction Python qui prend un exemple du dataset et appelle ai-corrector avec le modèle configuré via la variable d'environnement `MODEL` :

```python
def correction_task(example):
    response = requests.post(
        "http://localhost:25000/corrector/v1/chat/completions",
        json={"model": os.environ["MODEL"], "messages": [...]}
    )
    return {"corrected_text": ...}
```

### Usage

```bash
MODEL=qwen3-8b   python evals/experiment.py --dataset corrections-fr-v1
MODEL=mistral-7b python evals/experiment.py --dataset corrections-fr-v1
MODEL=llama3-8b  python evals/experiment.py --dataset corrections-fr-v1
```

Phoenix lance automatiquement les 3 évaluateurs sur chaque output et affiche un tableau comparatif dans l'UI :

```
Dataset: corrections-fr-v1 (N exemples)

Model          │ faithfulness │ grammar │ style_adherence │ avg
───────────────┼──────────────┼─────────┼─────────────────┼──────
qwen3-8b       │    0.87      │  0.91   │      0.83       │ 0.87
mistral-7b     │    0.79      │  0.88   │      0.71       │ 0.79
llama3-8b      │    0.82      │  0.85   │      0.76       │ 0.81
```

---

## Critères de succès

- [ ] Les traces dans Phoenix affichent un span racine `correction.request` avec `input.text` et `output.text`
- [ ] `python evals/evaluate.py --last 10` pousse 3 scores sur chaque trace sans erreur
- [ ] Les scores apparaissent dans Phoenix UI sous l'onglet "Evaluations"
- [ ] Un dataset `corrections-fr-v1` existe dans Phoenix avec au moins 20 exemples
- [ ] `evals/experiment.py` tourne sur le dataset et produit un tableau comparatif dans Phoenix

---

## Contraintes

- Le LLM-as-judge utilise le même endpoint vLLM local — ne pas lancer `evaluate.py` pendant un usage intensif du corrector (partage la même ressource GPU)
- `arize-phoenix-evals` requiert Python 3.10+
- La variable `PHOENIX_COLLECTOR_ENDPOINT` doit pointer vers `http://localhost:6006` (ou l'IP du nœud monitoring si différent)
