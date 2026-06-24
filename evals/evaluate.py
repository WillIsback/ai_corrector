#!/usr/bin/env python3
"""
evaluate.py — Évalue les traces ai-corrector dans Phoenix avec 3 juges LLM.

Usage:
  python -m evals.evaluate --last 50
  python -m evals.evaluate --since 2026-06-20

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

from evals.evaluators import (
    EVAL_CHOICES,
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
    Construit le DataFrame d'entrée pour create_classifier() selon l'évaluateur.
    Les colonnes correspondent aux placeholders {var} dans les templates.
    """
    if eval_name == "faithfulness":
        return pd.DataFrame(
            {
                "input_text": spans["attributes.input.text"].fillna("").values,
                "output_text": spans["attributes.output.text"].fillna("").values,
            },
            index=spans["span_id"].values,
        )

    if eval_name == "grammar":
        return pd.DataFrame(
            {
                "output_text": spans["attributes.output.text"].fillna("").values,
            },
            index=spans["span_id"].values,
        )

    if eval_name == "style_adherence":
        return pd.DataFrame(
            {
                "output_text": spans["attributes.output.text"].values,
                "correction_mode": spans["attributes.correction.mode"].fillna("unknown").values,
            },
            index=spans["span_id"].values,
        )

    raise ValueError(f"eval_name inconnu : '{eval_name}'. Choix : {list(EVAL_CONFIGS)}")


def filter_unevaluated(
    spans: pd.DataFrame, existing_eval_ids: set[str]
) -> pd.DataFrame:
    """Retire les spans déjà évalués."""
    if not existing_eval_ids:
        return spans
    return spans[~spans["span_id"].isin(existing_eval_ids)]


def _detect_model(endpoint: str, api_key: str) -> str:
    """Auto-détecte le premier modèle disponible sur vLLM."""
    import openai
    client = openai.OpenAI(base_url=endpoint, api_key=api_key)
    models = client.models.list()
    return models.data[0].id


def main(last: Optional[int], since: Optional[str]) -> None:
    from phoenix.client import Client
    from phoenix.client.__generated__.v1 import AnnotationResult
    from phoenix.client.resources.spans import SpanAnnotationData
    from phoenix.evals import LLM, create_classifier, evaluate_dataframe

    print(f"[evaluate] Connexion à Phoenix : {PHOENIX_ENDPOINT}")
    client = Client(base_url=PHOENIX_ENDPOINT)

    print("[evaluate] Récupération des spans llm.chat…")
    try:
        spans_df = client.spans.get_spans_dataframe(
            project_name="ai-corrector",
            root_spans_only=False,
            limit=last or 100,
        )
    except Exception as e:
        print(f"[evaluate] Erreur Phoenix : {e}", file=sys.stderr)
        sys.exit(1)

    if spans_df is None or len(spans_df) == 0:
        print("[evaluate] Aucun span trouvé.")
        return

    # Filtrer sur le nom du span et la présence de output.text
    if "name" in spans_df.columns:
        spans_df = spans_df[spans_df["name"] == "llm.chat"].copy()

    if "attributes.output.text" not in spans_df.columns:
        print("[evaluate] Aucun span avec 'attributes.output.text'. Lance d'abord une correction.")
        sys.exit(0)

    spans_df = spans_df[spans_df["attributes.output.text"].notna()].copy()
    spans_df = spans_df[spans_df["attributes.output.text"].str.strip() != ""].copy()

    # Filtre temporel
    if since:
        cutoff = datetime.fromisoformat(since).replace(tzinfo=timezone.utc)
        if "start_time" in spans_df.columns:
            spans_df = spans_df[pd.to_datetime(spans_df["start_time"], utc=True) >= cutoff]

    # S'assurer que span_id est une colonne
    if "span_id" not in spans_df.columns:
        spans_df = spans_df.reset_index()
        if "span_id" not in spans_df.columns:
            spans_df["span_id"] = spans_df.index.astype(str)

    spans_df = spans_df.reset_index(drop=True)

    print(f"[evaluate] {len(spans_df)} span(s) à évaluer")
    if len(spans_df) == 0:
        print("[evaluate] Rien à évaluer.")
        return

    # Configurer le LLM-as-judge
    model_name = LLM_MODEL or _detect_model(LLM_ENDPOINT, LLM_API_KEY)
    print(f"[evaluate] LLM-as-judge : {model_name} @ {LLM_ENDPOINT}")

    llm = LLM(
        provider="openai",
        model=model_name,
        sync_client_kwargs={"base_url": LLM_ENDPOINT, "api_key": LLM_API_KEY},
        async_client_kwargs={"base_url": LLM_ENDPOINT, "api_key": LLM_API_KEY},
    )

    # Lancer les 3 évaluateurs et pousser les résultats
    for eval_name, template in EVAL_CONFIGS.items():
        print(f"[evaluate] Évaluation '{eval_name}'…")
        try:
            eval_df = build_eval_dataframe(spans_df, eval_name)
            evaluator = create_classifier(
                name=eval_name,
                prompt_template=template,
                llm=llm,
                choices=EVAL_CHOICES,
            )
            results = evaluate_dataframe(dataframe=eval_df, evaluators=[evaluator])

            # Construire les annotations à pousser vers Phoenix
            annotations: list[SpanAnnotationData] = []
            for span_id, row in results.iterrows():
                score = float(row.get("score", 0.0))
                label = str(row.get("label", "incorrect"))
                annotations.append(
                    SpanAnnotationData(
                        name=eval_name,
                        annotator_kind="LLM",
                        span_id=str(span_id),
                        result=AnnotationResult(score=score, label=label),
                        metadata={},
                        identifier="",
                    )
                )

            client.spans.log_span_annotations(span_annotations=annotations, sync=True)
            correct_count = sum(1 for a in annotations if a["result"]["label"] == "correct")
            avg_score = sum(a["result"]["score"] for a in annotations) / len(annotations) if annotations else 0
            print(f"  → {correct_count}/{len(annotations)} correct (score moyen: {avg_score:.2f})")

        except Exception as e:
            print(f"  [ERREUR] {eval_name}: {e}", file=sys.stderr)

    print("[evaluate] Terminé. Ouvre Phoenix pour voir les scores.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Évaluer les traces ai-corrector dans Phoenix")
    parser.add_argument("--last", type=int, default=None)
    parser.add_argument("--since", type=str, default=None)
    args = parser.parse_args()
    if args.last is None and args.since is None:
        args.last = 20
    main(last=args.last, since=args.since)
