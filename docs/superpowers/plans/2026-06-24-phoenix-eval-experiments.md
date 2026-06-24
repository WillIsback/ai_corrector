# Phoenix Eval & Experiments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir le tracing Phoenix d'ai-corrector pour activer l'évaluation LLM-as-judge automatique et la comparaison de modèles via Phoenix Experiments.

**Architecture:** Le pipeline de correction est orchestré côté frontend (useCorrector.ts). Le serveur Bun ne voit que les appels individuels (LT proxy + LLM). On enrichit le span `llm.chat` existant avec `correction.mode`, `input.text` et `output.text` (le frontend envoie `correction_mode` comme champ custom, le serveur l'extrait avant de transmettre à vLLM). Les scripts Python ponctuels (`evals/`) s'appuient sur `arize-phoenix-evals` pour évaluer les traces et lancer des experiments.

**Tech Stack:** Bun/TypeScript (server), Vitest (tests TS), Python 3.10+ (evals), arize-phoenix>=8.0, arize-phoenix-evals>=0.20, openai (Python SDK), pandas

---

## File Map

| Fichier | Action | Rôle |
|---|---|---|
| `src/utils/api.ts` | Modifier | Ajouter `correction_mode` dans la requête LLM |
| `server.ts` | Modifier | Extraire `correction_mode`, enrichir span `llm.chat` |
| `tests/unit/api.correctionMode.test.ts` | Créer | Test: `correction_mode` présent dans le body envoyé |
| `evals/requirements.txt` | Créer | Dépendances Python |
| `evals/__init__.py` | Créer | Package marker |
| `evals/evaluators.py` | Créer | 3 templates LLM-as-judge |
| `evals/evaluate.py` | Créer | Script ponctuel: fetch traces → log evaluations |
| `evals/experiment.py` | Créer | Script ponctuel: Phoenix Experiments pour comparaison modèles |
| `evals/tests/test_evaluators.py` | Créer | Tests unitaires des templates |
| `evals/tests/test_evaluate.py` | Créer | Tests du script evaluate avec mocks |

---

## Task 1 — Passer `correction_mode` depuis le frontend

**Files:**
- Modify: `src/utils/api.ts:117-127` (la construction du `request`)
- Modify: `src/utils/api.ts:71-85` (interface `LLMRequest`)
- Test: `tests/unit/api.correctionMode.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/unit/api.correctionMode.test.ts` :

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { correctText } from "../../src/utils/api";
import type { CorrectionSettings } from "../../src/types";

const defaultSettings: CorrectionSettings = {
  mode: "formel",
  fixGrammar: true,
  fixSpelling: true,
  fixSyntax: true,
  fixStyle: true,
  ltEnabled: true,
  ltPreFire: true,
  ltPostFire: false,
  model: "",
};

describe("correctText — correction_mode", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: "test",
          object: "chat.completion",
          created: 0,
          model: "qwen3",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({
                  texte_corrige: "Texte corrigé.",
                  corrections: [],
                }),
              },
              finish_reason: "stop",
            },
          ],
        }),
      })
    );
    vi.stubGlobal("import.meta", { env: {} });
  });

  it("envoie correction_mode dans le body de la requête LLM", async () => {
    await correctText("Texte a corriger.", { ...defaultSettings, mode: "informel" });

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.correction_mode).toBe("informel");
  });

  it("envoie correction_mode pour chaque mode", async () => {
    for (const mode of ["formel", "semi-formel", "technique", "technical"] as const) {
      await correctText("Texte.", { ...defaultSettings, mode: mode as CorrectionSettings["mode"] });
      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1);
      const body = JSON.parse(fetchCall[1].body);
      expect(body.correction_mode).toBe(mode);
    }
  });
});
```

- [ ] **Step 2: Vérifier que le test échoue**

```bash
cd /home/will/ai_corrector
bunx vitest run tests/unit/api.correctionMode.test.ts
```

Attendu: FAIL — `body.correction_mode` est `undefined`.

- [ ] **Step 3: Ajouter `correction_mode` à l'interface `LLMRequest` dans `src/utils/api.ts`**

Localiser l'interface `LLMRequest` (ligne ~71) et ajouter le champ optionnel :

```typescript
export interface LLMRequest {
  model: string;
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
  temperature: number;
  max_tokens?: number;
  chat_template_kwargs?: {
    enable_thinking?: boolean;
  };
  response_format?: {
    type: "json_object";
  };
  correction_mode?: string;
}
```

- [ ] **Step 4: Ajouter `correction_mode` dans la construction du `request` dans `correctText`**

Localiser la construction de `request` (ligne ~117) et ajouter le champ :

```typescript
  const request: LLMRequest = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 2048,
    chat_template_kwargs: { enable_thinking: false },
    response_format: { type: "json_object" },
    correction_mode: settings.mode,
  };
```

- [ ] **Step 5: Vérifier que le test passe**

```bash
bunx vitest run tests/unit/api.correctionMode.test.ts
```

Attendu: PASS (2 tests).

- [ ] **Step 6: Vérifier que les tests existants passent toujours**

```bash
bunx vitest run
```

Attendu: tous les tests passent.

- [ ] **Step 7: Commit**

```bash
git add src/utils/api.ts tests/unit/api.correctionMode.test.ts
git commit -m "feat(tracing): envoyer correction_mode dans la requête LLM"
```

---

## Task 2 — Enrichir le span `llm.chat` dans `server.ts`

**Files:**
- Modify: `server.ts:145-195`

Le serveur reçoit maintenant `correction_mode` dans le body. Il faut :
1. L'extraire (et ne **pas** l'envoyer à vLLM qui ne le connaît pas)
2. Extraire `input.text` depuis le dernier message `user`
3. Extraire `output.text` depuis la réponse LLM (parser le JSON `texte_corrige`)
4. Ajouter ces attributs au span

Il n'y a pas de test unitaire aisé pour les spans OTel sans un collecteur mock. La vérification se fait manuellement dans Phoenix UI après un appel réel.

- [ ] **Step 1: Modifier le handler LLM dans `server.ts`**

Remplacer le bloc LLM Chat Completions (lignes 145–195) par :

```typescript
    // === API: LLM — Chat Completions (OpenAI SDK → OTEL instrumented) ===
    if (path === "/corrector/v1/chat/completions" && req.method === "POST") {
      console.log("[LLM] Chat completion via SDK");
      const startTime = Date.now();

      const span = tracer.startSpan("llm.chat", {
        kind: SpanKind.CLIENT,
      });

      try {
        const body = await req.json() as any;

        // Extraire les métadonnées de correction (non transmises à vLLM)
        const correctionMode: string = body.correction_mode ?? "unknown";
        const { correction_mode: _mode, ...llmBody } = body;

        // Extraire le texte d'entrée depuis le dernier message user
        const messages: Array<{ role: string; content: string }> = llmBody.messages ?? [];
        const userMessage = [...messages].reverse().find((m) => m.role === "user");
        const inputText: string = userMessage?.content ?? "";

        span.setAttributes({
          "openinference.span.kind": "LLM",
          "llm.model_name": llmBody.model ?? "unknown",
          "input.value": JSON.stringify(messages),
          "input.mime_type": "application/json",
          "input.text": inputText.slice(0, 2000),
          "correction.mode": correctionMode,
        });

        const completion = await llmClient.chat.completions.create({
          ...llmBody,
          // Enforce disable thinking mode — vLLM/Qwen3 specific
          chat_template_kwargs: { enable_thinking: false },
        });

        const duration = Date.now() - startTime;
        console.log(`[LLM] Réponse: ${completion.usage?.total_tokens ?? "?"} tokens en ${duration}ms`);

        // Extraire le texte corrigé depuis la réponse JSON du LLM
        let outputText = "";
        try {
          const rawContent = completion.choices?.[0]?.message?.content ?? "";
          const parsed = JSON.parse(rawContent);
          outputText = parsed.texte_corrige ?? parsed.corrected_text ?? rawContent;
        } catch {
          outputText = completion.choices?.[0]?.message?.content ?? "";
        }

        span.setAttributes({
          "output.value": JSON.stringify(completion.choices),
          "output.mime_type": "application/json",
          "output.text": outputText.slice(0, 2000),
          "llm.token_count.total": completion.usage?.total_tokens ?? 0,
          "llm.token_count.prompt": completion.usage?.prompt_tokens ?? 0,
          "llm.token_count.completion": completion.usage?.completion_tokens ?? 0,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        const headers = getCorsHeaders(req);
        return new Response(JSON.stringify(completion), { headers });
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[LLM] Erreur après ${duration}ms:`, error instanceof Error ? error.message : error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : "Unknown error" });
        span.end();
        return new Response(
          JSON.stringify({ error: "LLM unavailable", details: error instanceof Error ? error.message : "Unknown error" }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      }
    }
```

- [ ] **Step 2: Vérifier que tous les tests TypeScript passent**

```bash
cd /home/will/ai_corrector && bunx vitest run
```

Attendu: tous les tests passent (les changements serveur ne sont pas testés par les tests unitaires existants).

- [ ] **Step 3: Vérification manuelle — lancer le serveur et faire une correction**

```bash
bun run server.ts &
# Ouvrir ai-corrector dans le navigateur, faire une correction
# Vérifier dans Phoenix UI (port 6006) que le span llm.chat affiche :
#   - input.text: le texte soumis
#   - output.text: le texte corrigé extrait
#   - correction.mode: le mode sélectionné
```

- [ ] **Step 4: Commit**

```bash
git add server.ts
git commit -m "feat(tracing): enrichir span llm.chat avec input.text, output.text, correction.mode"
```

---

## Task 3 — Setup environnement Python evals

**Files:**
- Create: `evals/requirements.txt`
- Create: `evals/__init__.py`
- Create: `evals/tests/__init__.py`

- [ ] **Step 1: Créer `evals/requirements.txt`**

```
arize-phoenix>=8.0.0
arize-phoenix-evals>=0.20.0
openai>=1.0.0
pandas>=2.0.0
```

- [ ] **Step 2: Créer les fichiers `__init__.py`**

```bash
touch /home/will/ai_corrector/evals/__init__.py
mkdir -p /home/will/ai_corrector/evals/tests
touch /home/will/ai_corrector/evals/tests/__init__.py
```

- [ ] **Step 3: Installer les dépendances dans un venv**

```bash
cd /home/will/ai_corrector
python3 -m venv evals/.venv
source evals/.venv/bin/activate
pip install -r evals/requirements.txt
```

Attendu: installation sans erreur.

- [ ] **Step 4: Vérifier la connexion à Phoenix**

```bash
python3 -c "
import phoenix as px
client = px.Client(endpoint='http://localhost:6006')
projects = client.list_projects()
print('Projets Phoenix:', [p.name for p in projects])
"
```

Attendu: liste incluant `ai-corrector`.

- [ ] **Step 5: Commit**

```bash
git add evals/requirements.txt evals/__init__.py evals/tests/__init__.py
git commit -m "chore(evals): setup environnement Python pour Phoenix evals"
```

---

## Task 4 — Écrire les 3 évaluateurs LLM-as-judge (`evals/evaluators.py`)

**Files:**
- Create: `evals/evaluators.py`
- Create: `evals/tests/test_evaluators.py`

- [ ] **Step 1: Écrire le test des templates**

Créer `evals/tests/test_evaluators.py` :

```python
from evals.evaluators import (
    FAITHFULNESS_TEMPLATE,
    GRAMMAR_TEMPLATE,
    STYLE_TEMPLATE,
    EVAL_RAILS,
)


def test_faithfulness_template_contains_placeholders():
    """Le template fidélité doit référencer input et output."""
    assert "{input_text}" in FAITHFULNESS_TEMPLATE
    assert "{output_text}" in FAITHFULNESS_TEMPLATE


def test_grammar_template_contains_placeholder():
    """Le template grammaire n'a besoin que du texte corrigé."""
    assert "{output_text}" in GRAMMAR_TEMPLATE


def test_style_template_contains_placeholders():
    """Le template style doit référencer le texte corrigé et le mode."""
    assert "{output_text}" in STYLE_TEMPLATE
    assert "{correction_mode}" in STYLE_TEMPLATE


def test_rails_are_binary():
    """Les rails doivent être 'correct' et 'incorrect'."""
    assert set(EVAL_RAILS) == {"correct", "incorrect"}


def test_faithfulness_template_renders():
    """Le template fidélité doit se formatter sans erreur."""
    rendered = FAITHFULNESS_TEMPLATE.format(
        input_text="Bonjour le monde.",
        output_text="Bonjour le monde.",
    )
    assert "Bonjour le monde." in rendered


def test_style_template_renders():
    """Le template style doit se formatter avec un mode."""
    rendered = STYLE_TEMPLATE.format(
        output_text="Bonjour le monde.",
        correction_mode="formel",
    )
    assert "formel" in rendered
```

- [ ] **Step 2: Vérifier que le test échoue**

```bash
cd /home/will/ai_corrector
source evals/.venv/bin/activate
python3 -m pytest evals/tests/test_evaluators.py -v
```

Attendu: ModuleNotFoundError ou ImportError — `evals.evaluators` n'existe pas encore.

- [ ] **Step 3: Créer `evals/evaluators.py`**

```python
"""
Prompt templates LLM-as-judge pour l'évaluation des corrections françaises.

Chaque template suit le format arize-phoenix-evals : une chaîne avec
des placeholders {var} que llm_classify() injecte depuis le DataFrame.

Rails : "correct" (bonne correction) ou "incorrect" (correction défaillante).
"""

EVAL_RAILS = ["correct", "incorrect"]

# ---------------------------------------------------------------------------
# 1. Fidélité — le sens original est-il préservé ?
# ---------------------------------------------------------------------------
FAITHFULNESS_TEMPLATE = """\
Tu es un expert en langue française. On t'a demandé de corriger un texte.
Évalue si le texte corrigé préserve fidèlement le sens et l'intention
du texte original, sans ajouter ni supprimer d'information.

Texte original :
{input_text}

Texte corrigé :
{output_text}

Le sens original est-il entièrement préservé dans le texte corrigé ?
Réponds UNIQUEMENT par "correct" (sens préservé) ou "incorrect" (sens altéré).
Réponds en un seul mot, sans explication.
"""

# ---------------------------------------------------------------------------
# 2. Grammaire — le texte corrigé est-il correct en français ?
# ---------------------------------------------------------------------------
GRAMMAR_TEMPLATE = """\
Tu es un expert en grammaire française. Évalue si le texte suivant
est grammaticalement correct en français : absence de fautes d'orthographe,
d'accord, de conjugaison et de syntaxe.

Texte à évaluer :
{output_text}

Ce texte est-il grammaticalement correct ?
Réponds UNIQUEMENT par "correct" (sans fautes) ou "incorrect" (contient des fautes).
Réponds en un seul mot, sans explication.
"""

# ---------------------------------------------------------------------------
# 3. Respect du registre — le ton correspond-il au mode demandé ?
# ---------------------------------------------------------------------------
STYLE_TEMPLATE = """\
Tu es un expert en stylistique française. On a demandé une correction
en mode "{correction_mode}".

Registres de référence :
- formel : langage soutenu, vouvoiement implicite, phrases complètes
- semi-formel : neutre et poli, adapté au courrier professionnel
- informel : décontracté, langage naturel conversationnel
- technical : précis et concis, vocabulaire technique, pas d'ornements

Texte corrigé à évaluer :
{output_text}

Le texte respecte-t-il le registre "{correction_mode}" ?
Réponds UNIQUEMENT par "correct" (registre respecté) ou "incorrect" (registre inadapté).
Réponds en un seul mot, sans explication.
"""
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
python3 -m pytest evals/tests/test_evaluators.py -v
```

Attendu: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add evals/evaluators.py evals/tests/test_evaluators.py
git commit -m "feat(evals): 3 templates LLM-as-judge (fidélité, grammaire, style)"
```

---

## Task 5 — Script d'évaluation principal (`evals/evaluate.py`)

**Files:**
- Create: `evals/evaluate.py`
- Create: `evals/tests/test_evaluate.py`

- [ ] **Step 1: Écrire les tests avec mocks**

Créer `evals/tests/test_evaluate.py` :

```python
"""Tests unitaires pour evaluate.py — tous les appels réseau sont mockés."""

import pandas as pd
import pytest
from unittest.mock import MagicMock, patch


def _make_spans_df():
    """DataFrame minimal simulant des spans récupérés depuis Phoenix."""
    return pd.DataFrame(
        {
            "span_id": ["span-001", "span-002"],
            "attributes.input.text": ["Bonjour le monde.", "Je vais bien."],
            "attributes.output.text": ["Bonjour le monde.", "Je vais bien."],
            "attributes.correction.mode": ["formel", "informel"],
        }
    )


def test_build_eval_dataframe_faithfulness():
    """build_eval_dataframe doit produire les colonnes attendues par le template fidélité."""
    from evals.evaluate import build_eval_dataframe

    spans = _make_spans_df()
    df = build_eval_dataframe(spans, eval_name="faithfulness")

    assert "input_text" in df.columns
    assert "output_text" in df.columns
    assert len(df) == 2


def test_build_eval_dataframe_grammar():
    """Le DataFrame grammaire n'a pas besoin de input_text."""
    from evals.evaluate import build_eval_dataframe

    spans = _make_spans_df()
    df = build_eval_dataframe(spans, eval_name="grammar")

    assert "output_text" in df.columns
    assert len(df) == 2


def test_build_eval_dataframe_style():
    """Le DataFrame style doit inclure correction_mode."""
    from evals.evaluate import build_eval_dataframe

    spans = _make_spans_df()
    df = build_eval_dataframe(spans, eval_name="style_adherence")

    assert "output_text" in df.columns
    assert "correction_mode" in df.columns
    assert df["correction_mode"].tolist() == ["formel", "informel"]


def test_build_eval_dataframe_unknown_raises():
    """Un eval_name inconnu lève ValueError."""
    from evals.evaluate import build_eval_dataframe

    with pytest.raises(ValueError, match="eval_name inconnu"):
        build_eval_dataframe(_make_spans_df(), eval_name="unknown")


def test_filter_unevaluated_keeps_all_when_no_existing(monkeypatch):
    """Sans évaluations existantes, tous les spans sont retournés."""
    from evals.evaluate import filter_unevaluated

    spans = _make_spans_df()
    result = filter_unevaluated(spans, existing_eval_ids=set())
    assert len(result) == 2


def test_filter_unevaluated_excludes_already_evaluated():
    """Les spans déjà évalués sont filtrés."""
    from evals.evaluate import filter_unevaluated

    spans = _make_spans_df()
    result = filter_unevaluated(spans, existing_eval_ids={"span-001"})
    assert len(result) == 1
    assert result.iloc[0]["span_id"] == "span-002"
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
python3 -m pytest evals/tests/test_evaluate.py -v
```

Attendu: ImportError — `evals.evaluate` n'existe pas.

- [ ] **Step 3: Créer `evals/evaluate.py`**

```python
#!/usr/bin/env python3
"""
evaluate.py — Évalue les traces ai-corrector dans Phoenix avec 3 juges LLM.

Usage:
  python evals/evaluate.py --last 50
  python evals/evaluate.py --since 2026-06-20

Variables d'environnement:
  PHOENIX_ENDPOINT   URL du serveur Phoenix (défaut: http://localhost:6006)
  LLM_ENDPOINT       URL vLLM (défaut: http://localhost:30000/v1)
  LLM_MODEL          Nom du modèle LLM-as-judge (défaut: auto-détecté)
  LLM_API_KEY        Clé API vLLM (défaut: "unused")
"""

import argparse
import os
import sys
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
import phoenix as px
from phoenix.evals import OpenAIModel, llm_classify
from phoenix.trace import SpanEvaluations

from evals.evaluators import (
    EVAL_RAILS,
    FAITHFULNESS_TEMPLATE,
    GRAMMAR_TEMPLATE,
    STYLE_TEMPLATE,
)

PHOENIX_ENDPOINT = os.getenv("PHOENIX_ENDPOINT", "http://localhost:6006")
LLM_ENDPOINT = os.getenv("LLM_ENDPOINT", "http://localhost:30000/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "unused")

EVAL_CONFIGS = {
    "faithfulness": FAITHFULNESS_TEMPLATE,
    "grammar": GRAMMAR_TEMPLATE,
    "style_adherence": STYLE_TEMPLATE,
}


def build_eval_dataframe(spans: pd.DataFrame, eval_name: str) -> pd.DataFrame:
    """
    Construit le DataFrame d'entrée pour llm_classify() selon l'évaluateur.

    Les colonnes correspondent aux placeholders {var} dans les templates.
    """
    if eval_name == "faithfulness":
        return pd.DataFrame(
            {
                "span_id": spans["span_id"],
                "input_text": spans["attributes.input.text"].fillna(""),
                "output_text": spans["attributes.output.text"].fillna(""),
            }
        ).set_index("span_id")

    if eval_name == "grammar":
        return pd.DataFrame(
            {
                "span_id": spans["span_id"],
                "output_text": spans["attributes.output.text"].fillna(""),
            }
        ).set_index("span_id")

    if eval_name == "style_adherence":
        return pd.DataFrame(
            {
                "span_id": spans["span_id"],
                "output_text": spans["attributes.output.text"].fillna(""),
                "correction_mode": spans["attributes.correction.mode"].fillna("unknown"),
            }
        ).set_index("span_id")

    raise ValueError(f"eval_name inconnu : '{eval_name}'. Choix : {list(EVAL_CONFIGS)}")


def filter_unevaluated(
    spans: pd.DataFrame, existing_eval_ids: set[str]
) -> pd.DataFrame:
    """Retire les spans déjà évalués."""
    if not existing_eval_ids:
        return spans
    return spans[~spans["span_id"].isin(existing_eval_ids)]


def _detect_model(client: "openai.OpenAI") -> str:
    """Auto-détecte le premier modèle disponible sur vLLM."""
    models = client.models.list()
    return models.data[0].id


def main(last: Optional[int], since: Optional[str]) -> None:
    print(f"[evaluate] Connexion à Phoenix : {PHOENIX_ENDPOINT}")
    px_client = px.Client(endpoint=PHOENIX_ENDPOINT)

    # Récupérer les spans du projet ai-corrector
    print("[evaluate] Récupération des spans llm.chat…")
    try:
        spans_df = px_client.get_spans_dataframe(
            project_name="ai-corrector",
            root_spans_only=False,
        )
    except Exception as e:
        print(f"[evaluate] Erreur Phoenix : {e}", file=sys.stderr)
        sys.exit(1)

    # Filtrer sur le nom du span
    if "name" in spans_df.columns:
        spans_df = spans_df[spans_df["name"] == "llm.chat"].copy()

    # Filtrer sur la présence de output.text (spans enrichis)
    if "attributes.output.text" not in spans_df.columns:
        print("[evaluate] Aucun span avec 'output.text' trouvé. Lance d'abord une correction.")
        sys.exit(0)
    spans_df = spans_df[spans_df["attributes.output.text"].notna()].copy()
    spans_df = spans_df[spans_df["attributes.output.text"].str.strip() != ""].copy()

    # Appliquer les filtres temporels/quantitatifs
    if since:
        cutoff = datetime.fromisoformat(since).replace(tzinfo=timezone.utc)
        if "start_time" in spans_df.columns:
            spans_df = spans_df[pd.to_datetime(spans_df["start_time"], utc=True) >= cutoff]
    if last:
        spans_df = spans_df.tail(last)

    spans_df = spans_df.reset_index(drop=True)
    spans_df["span_id"] = spans_df.index.astype(str) if "span_id" not in spans_df.columns else spans_df["span_id"]

    print(f"[evaluate] {len(spans_df)} span(s) à évaluer")
    if len(spans_df) == 0:
        print("[evaluate] Rien à évaluer.")
        return

    # Configurer le modèle LLM-as-judge
    import openai as _openai
    raw_client = _openai.OpenAI(base_url=LLM_ENDPOINT, api_key=LLM_API_KEY)
    model_name = LLM_MODEL or _detect_model(raw_client)
    print(f"[evaluate] LLM-as-judge : {model_name} @ {LLM_ENDPOINT}")

    judge_model = OpenAIModel(
        model=model_name,
        base_url=LLM_ENDPOINT,
        api_key=LLM_API_KEY,
    )

    # Lancer les 3 évaluateurs et pousser les résultats
    for eval_name, template in EVAL_CONFIGS.items():
        print(f"[evaluate] Évaluation '{eval_name}'…")
        try:
            eval_df = build_eval_dataframe(spans_df, eval_name)
            results = llm_classify(
                dataframe=eval_df,
                template=template,
                model=judge_model,
                rails=EVAL_RAILS,
                provide_explanation=False,
                concurrency=4,
            )
            # Convertir "correct"→1.0 / "incorrect"→0.0
            results["score"] = (results["label"] == "correct").astype(float)
            results = results.rename(columns={"label": "label"})

            px_client.log_evaluations(
                SpanEvaluations(eval_name=eval_name, dataframe=results)
            )
            correct_count = (results["label"] == "correct").sum()
            print(f"  → {correct_count}/{len(results)} correct "
                  f"(score moyen: {results['score'].mean():.2f})")
        except Exception as e:
            print(f"  [ERREUR] {eval_name}: {e}", file=sys.stderr)

    print("[evaluate] Terminé. Ouvre Phoenix pour voir les scores.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Évaluer les traces ai-corrector dans Phoenix")
    parser.add_argument("--last", type=int, default=None, help="Évaluer les N derniers spans")
    parser.add_argument("--since", type=str, default=None, help="Évaluer depuis cette date (YYYY-MM-DD)")
    args = parser.parse_args()

    if args.last is None and args.since is None:
        args.last = 20  # défaut : 20 derniers spans

    main(last=args.last, since=args.since)
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
python3 -m pytest evals/tests/test_evaluate.py -v
```

Attendu: 6 tests PASS.

- [ ] **Step 5: Smoke test sur de vraies traces**

S'assurer que des corrections ont été envoyées depuis l'UI ai-corrector, puis :

```bash
source evals/.venv/bin/activate
python3 -m evals.evaluate --last 5
```

Attendu: affichage des scores pour les 3 évaluateurs, pas d'erreur.
Vérifier dans Phoenix UI → onglet "Evaluations" que les scores sont visibles sur les spans.

- [ ] **Step 6: Commit**

```bash
git add evals/evaluate.py evals/tests/test_evaluate.py
git commit -m "feat(evals): script d'évaluation LLM-as-judge (fidélité, grammaire, style)"
```

---

## Task 6 — Script Phoenix Experiments (`evals/experiment.py`)

**Files:**
- Create: `evals/experiment.py`
- Create: `evals/tests/test_experiment.py`

- [ ] **Step 1: Écrire les tests**

Créer `evals/tests/test_experiment.py` :

```python
"""Tests unitaires pour experiment.py — appels réseau mockés."""

import pytest
from unittest.mock import MagicMock, patch


def test_build_system_prompt_formel():
    """Le prompt formel doit mentionner le mode formel."""
    from evals.experiment import build_system_prompt

    prompt = build_system_prompt("formel")
    assert "formel" in prompt.lower() or "professionnel" in prompt.lower()


def test_build_system_prompt_informel():
    """Le prompt informel doit mentionner le mode conversationnel."""
    from evals.experiment import build_system_prompt

    prompt = build_system_prompt("informel")
    assert "informel" in prompt.lower() or "conversationnel" in prompt.lower()


def test_build_system_prompt_all_modes():
    """Tous les modes doivent produire un prompt non-vide."""
    from evals.experiment import build_system_prompt

    for mode in ["formel", "semi-formel", "informel", "technical"]:
        assert len(build_system_prompt(mode)) > 50


def test_parse_corrected_text_valid_json():
    """parse_corrected_text doit extraire texte_corrige du JSON LLM."""
    from evals.experiment import parse_corrected_text

    raw = '{"texte_corrige": "Bonjour le monde.", "corrections": []}'
    assert parse_corrected_text(raw) == "Bonjour le monde."


def test_parse_corrected_text_fallback():
    """En cas de JSON invalide, retourner le texte brut."""
    from evals.experiment import parse_corrected_text

    raw = "Texte corrigé sans JSON."
    assert parse_corrected_text(raw) == "Texte corrigé sans JSON."


def test_parse_corrected_text_corrected_text_key():
    """Accepter aussi la clé corrected_text."""
    from evals.experiment import parse_corrected_text

    raw = '{"corrected_text": "Hello world.", "corrections": []}'
    assert parse_corrected_text(raw) == "Hello world."
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
python3 -m pytest evals/tests/test_experiment.py -v
```

Attendu: ImportError — `evals.experiment` n'existe pas.

- [ ] **Step 3: Créer `evals/experiment.py`**

```python
#!/usr/bin/env python3
"""
experiment.py — Lance un Phoenix Experiment pour comparer des modèles LLM.

Usage:
  MODEL=qwen3-8b   python evals/experiment.py --dataset corrections-fr-v1
  MODEL=mistral-7b python evals/experiment.py --dataset corrections-fr-v1

Variables d'environnement:
  PHOENIX_ENDPOINT    URL du serveur Phoenix (défaut: http://localhost:6006)
  CORRECTOR_ENDPOINT  URL du serveur ai-corrector (défaut: http://localhost:25000)
  LLM_ENDPOINT        URL vLLM (défaut: http://localhost:30000/v1)
  MODEL               Nom du modèle à tester (requis)
  LLM_API_KEY         Clé API vLLM (défaut: "unused")
"""

import json
import os
import sys
from typing import Any

import phoenix as px
from phoenix.evals import OpenAIModel, llm_classify
from phoenix.experiments import evaluate_experiment, run_experiment
from phoenix.experiments.types import Example

from evals.evaluators import (
    EVAL_RAILS,
    FAITHFULNESS_TEMPLATE,
    GRAMMAR_TEMPLATE,
    STYLE_TEMPLATE,
)

PHOENIX_ENDPOINT = os.getenv("PHOENIX_ENDPOINT", "http://localhost:6006")
CORRECTOR_ENDPOINT = os.getenv("CORRECTOR_ENDPOINT", "http://localhost:25000")
LLM_ENDPOINT = os.getenv("LLM_ENDPOINT", "http://localhost:30000/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "unused")
MODEL = os.getenv("MODEL", "")


def build_system_prompt(mode: str) -> str:
    """Construit le system prompt selon le mode de correction."""
    mode_descriptions = {
        "formel": "Formel et professionnel",
        "semi-formel": "Neutre, adapté au courrier professionnel",
        "informel": "Décontracté, style conversationnel",
        "technical": "Texte technique, clarté et précision",
    }
    description = mode_descriptions.get(mode, f"Mode {mode}")

    return (
        "Tu es un correcteur éditorial expert en français. Corrige les fautes du texte fourni.\n\n"
        "RÈGLES :\n"
        "- Corrige orthographe, grammaire, syntaxe selon le mode indiqué\n"
        "- Garde la même structure et le même sens que le texte original\n"
        "- Ne reformule PAS les phrases sauf si la syntaxe est incorrecte\n\n"
        f"Mode: {description}.\n\n"
        "RÉPONDS UNIQUEMENT avec un objet JSON valide, sans markdown, sans ```json, "
        "avec cette structure exacte :\n"
        '{\n  "texte_corrige": "le texte intégralement corrigé",\n'
        '  "corrections": [\n    { "original": "mot ou expression fautive", '
        '"corrected": "correction appliquée" }\n  ]\n}\n\n'
        "Si le texte ne contient aucune faute, renvoie le texte tel quel avec "
        "un tableau corrections vide.\n\nTEXTE À CORRIGER :"
    )


def parse_corrected_text(raw: str) -> str:
    """Extrait le texte corrigé depuis la réponse JSON du LLM."""
    try:
        parsed = json.loads(raw)
        return (
            parsed.get("texte_corrige")
            or parsed.get("corrected_text")
            or raw
        )
    except (json.JSONDecodeError, AttributeError):
        return raw


def make_correction_task(model_name: str):
    """
    Retourne la fonction task pour Phoenix Experiments.

    Chaque exemple du dataset doit avoir :
      input = {"input_text": str, "correction_mode": str}
    """
    import requests

    def correction_task(example: Example) -> dict[str, Any]:
        input_text: str = example.input.get("input_text", "")
        mode: str = example.input.get("correction_mode", "formel")

        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": build_system_prompt(mode)},
                {"role": "user", "content": input_text},
            ],
            "temperature": 0.1,
            "max_tokens": 2048,
            "chat_template_kwargs": {"enable_thinking": False},
            "response_format": {"type": "json_object"},
            "correction_mode": mode,
        }

        response = requests.post(
            f"{CORRECTOR_ENDPOINT}/corrector/v1/chat/completions",
            json=payload,
            timeout=60,
            headers={"Authorization": f"Bearer {LLM_API_KEY or 'unused'}"},
        )
        response.raise_for_status()
        data = response.json()
        raw_content = data["choices"][0]["message"]["content"]
        corrected = parse_corrected_text(raw_content)

        return {
            "corrected_text": corrected,
            "input_text": input_text,
            "correction_mode": mode,
        }

    return correction_task


def main(dataset_name: str) -> None:
    if not MODEL:
        print("[experiment] Variable MODEL manquante. Ex: MODEL=qwen3-8b python evals/experiment.py …", file=sys.stderr)
        sys.exit(1)

    print(f"[experiment] Connexion à Phoenix : {PHOENIX_ENDPOINT}")
    px_client = px.Client(endpoint=PHOENIX_ENDPOINT)

    print(f"[experiment] Chargement du dataset '{dataset_name}'…")
    try:
        dataset = px_client.get_dataset(name=dataset_name)
    except Exception as e:
        print(f"[experiment] Dataset '{dataset_name}' introuvable : {e}", file=sys.stderr)
        print("[experiment] Crée le dataset depuis Phoenix UI (filtre les traces bien évaluées → Export as Dataset).")
        sys.exit(1)

    print(f"[experiment] {len(dataset)} exemples — modèle : {MODEL}")

    task = make_correction_task(model_name=MODEL)
    experiment = run_experiment(
        dataset=dataset,
        task=task,
        experiment_name=f"model-comparison/{MODEL}",
        metadata={"model": MODEL, "endpoint": LLM_ENDPOINT},
    )

    print(f"[experiment] Experiment '{experiment.experiment_name}' créé. Lancement des évaluations…")

    # Configurer le LLM-as-judge
    judge_model = OpenAIModel(
        model=MODEL,
        base_url=LLM_ENDPOINT,
        api_key=LLM_API_KEY,
    )

    def faithfulness_evaluator(output, example):
        import pandas as pd
        df = pd.DataFrame([{
            "input_text": output.get("input_text", ""),
            "output_text": output.get("corrected_text", ""),
        }])
        result = llm_classify(df, FAITHFULNESS_TEMPLATE, judge_model, EVAL_RAILS)
        label = result["label"].iloc[0] if len(result) > 0 else "incorrect"
        return 1.0 if label == "correct" else 0.0

    def grammar_evaluator(output, example):
        import pandas as pd
        df = pd.DataFrame([{"output_text": output.get("corrected_text", "")}])
        result = llm_classify(df, GRAMMAR_TEMPLATE, judge_model, EVAL_RAILS)
        label = result["label"].iloc[0] if len(result) > 0 else "incorrect"
        return 1.0 if label == "correct" else 0.0

    def style_evaluator(output, example):
        import pandas as pd
        df = pd.DataFrame([{
            "output_text": output.get("corrected_text", ""),
            "correction_mode": output.get("correction_mode", "formel"),
        }])
        result = llm_classify(df, STYLE_TEMPLATE, judge_model, EVAL_RAILS)
        label = result["label"].iloc[0] if len(result) > 0 else "incorrect"
        return 1.0 if label == "correct" else 0.0

    evaluate_experiment(
        experiment=experiment,
        evaluators=[faithfulness_evaluator, grammar_evaluator, style_evaluator],
    )

    print(f"[experiment] Terminé. Compare les modèles dans Phoenix UI → Experiments.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Lancer un Phoenix Experiment de comparaison de modèles")
    parser.add_argument("--dataset", required=True, help="Nom du dataset Phoenix (ex: corrections-fr-v1)")
    args = parser.parse_args()
    main(dataset_name=args.dataset)
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
python3 -m pytest evals/tests/test_experiment.py -v
```

Attendu: 6 tests PASS.

- [ ] **Step 5: Vérifier tous les tests Python**

```bash
python3 -m pytest evals/tests/ -v
```

Attendu: 12 tests PASS au total (6 evaluators + 6 experiment).

- [ ] **Step 6: Smoke test experiment (optionnel — nécessite un dataset)**

Si un dataset `corrections-fr-v1` existe déjà dans Phoenix :
```bash
MODEL=qwen3-8b python3 -m evals.experiment --dataset corrections-fr-v1
```

Sinon, créer d'abord le dataset depuis Phoenix UI :
1. Aller dans Phoenix → Traces → Projet `ai-corrector`
2. Filtrer les spans avec `faithfulness = correct` ET `style_adherence = correct`
3. Sélectionner → "Add to Dataset" → nommer `corrections-fr-v1`
4. Définir le mapping : `input = {input_text, correction_mode}`, `output = {corrected_text}`

- [ ] **Step 7: Commit final**

```bash
git add evals/experiment.py evals/tests/test_experiment.py
git commit -m "feat(evals): script Phoenix Experiments pour comparaison de modèles"
```

---

## Vérification des critères de succès

Après l'implémentation complète, vérifier :

```bash
# 1. Tests TypeScript
cd /home/will/ai_corrector && bunx vitest run
# Attendu : tous PASS

# 2. Tests Python
source evals/.venv/bin/activate && python3 -m pytest evals/tests/ -v
# Attendu : 12 tests PASS

# 3. Span enrichi dans Phoenix
# → Faire une correction dans l'UI → Phoenix → span llm.chat → voir input.text, output.text, correction.mode

# 4. Évaluations dans Phoenix
python3 -m evals.evaluate --last 5
# → Phoenix → Evaluations → 3 scores par span

# 5. Experiment dans Phoenix
MODEL=<nom-modele> python3 -m evals.experiment --dataset corrections-fr-v1
# → Phoenix → Experiments → tableau comparatif
```
