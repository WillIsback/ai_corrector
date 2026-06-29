"""
Rapport comparatif LLM vs LanguageTool.

Usage :
    python eval/report.py

Variables d'environnement (toutes optionnelles) :
    LLM_BASE_URL   URL de base du serveur LLM  (défaut: http://localhost:1234/v1)
    LT_BASE_URL    URL de base de LT           (défaut: http://localhost:8010/api/lt)
    LLM_API_KEY    Clé API LLM                 (défaut: no-key-needed)
    LLM_SAMPLE     Nombre d'exemples LLM       (défaut: 50)
    LT_SAMPLE      Nombre d'exemples LT        (défaut: 200)
    FEW_SHOT_N     Nombre de pires exemples    (défaut: 5)
    SKIP_LLM       Si "1", ignore le moteur LLM
    SKIP_LT        Si "1", ignore le moteur LT
"""
from __future__ import annotations

import os
import sys
import textwrap
import traceback

import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from run_eval import (
    call_llm,
    call_lt,
    compute_bleu,
    compute_rouge_l,
    load_eval_dataset,
)

# ── Configuration ──────────────────────────────────────────────────────────────
LLM_SAMPLE = int(os.environ.get("LLM_SAMPLE", 50))
LT_SAMPLE = int(os.environ.get("LT_SAMPLE", 200))
FEW_SHOT_N = int(os.environ.get("FEW_SHOT_N", 5))
LLM_PORT = int(os.environ.get("LLM_PORT", 1234))
LT_PORT = int(os.environ.get("LT_PORT", 8010))
LT_BASE_URL = os.environ.get("LT_BASE_URL", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "no-key-needed")
SKIP_LLM = os.environ.get("SKIP_LLM", "0") == "1"
SKIP_LT = os.environ.get("SKIP_LT", "0") == "1"
SEED = 42


# ── Helpers ────────────────────────────────────────────────────────────────────

def _trunc(text: str, width: int = 80) -> str:
    return textwrap.shorten(text, width=width, placeholder="…")


def _score_row(output: str, reference: str) -> dict:
    bleu = compute_bleu(output, reference)
    rouge = compute_rouge_l(output, reference)
    return {"bleu": bleu, "rouge": rouge, "score": (bleu + rouge) / 2}


def run_engine(
    df: pd.DataFrame,
    engine_name: str,
    call_fn,
) -> pd.DataFrame:
    """Applique call_fn sur chaque ligne et retourne un DataFrame de résultats."""
    records = []
    total = len(df)
    for i, row in df.iterrows():
        try:
            output = call_fn(row["erroneous"])
        except Exception as exc:
            print(f"  [{engine_name}] erreur ligne {i}: {exc}", file=sys.stderr)
            output = row["erroneous"]  # fallback : texte inchangé

        scores = _score_row(output, row["reference"])
        records.append(
            {
                "engine": engine_name,
                "category": row["category"],
                "erroneous": row["erroneous"],
                "reference": row["reference"],
                "output": output,
                **scores,
            }
        )
        if (i + 1) % 10 == 0 or (i + 1) == total:
            print(f"  [{engine_name}] {i + 1}/{total}", end="\r", flush=True)

    print()  # newline after progress
    return pd.DataFrame(records)


# ── Formatting ─────────────────────────────────────────────────────────────────

def _md_table(headers: list[str], rows: list[list]) -> str:
    col_widths = [max(len(str(h)), max((len(str(r[j])) for r in rows), default=0))
                  for j, h in enumerate(headers)]
    sep = "| " + " | ".join("-" * w for w in col_widths) + " |"
    header_line = "| " + " | ".join(str(h).ljust(col_widths[j]) for j, h in enumerate(headers)) + " |"
    lines = [header_line, sep]
    for row in rows:
        lines.append("| " + " | ".join(str(row[j]).ljust(col_widths[j]) for j in range(len(headers))) + " |")
    return "\n".join(lines)


def print_summary_table(frames: list[pd.DataFrame]) -> None:
    all_df = pd.concat(frames, ignore_index=True)

    print("\n## Tableau comparatif global\n")
    headers = ["Moteur", "N", "BLEU moy.", "ROUGE-L moy.", "BLEU min", "ROUGE-L min", "Score moy."]
    rows = []
    for engine, grp in all_df.groupby("engine"):
        rows.append([
            engine,
            len(grp),
            f"{grp['bleu'].mean():.4f}",
            f"{grp['rouge'].mean():.4f}",
            f"{grp['bleu'].min():.4f}",
            f"{grp['rouge'].min():.4f}",
            f"{grp['score'].mean():.4f}",
        ])
    print(_md_table(headers, rows))

    print("\n## Par catégorie\n")
    cat_headers = ["Catégorie", "Moteur", "N", "BLEU moy.", "ROUGE-L moy.", "Score moy."]
    cat_rows = []
    for (cat, engine), grp in all_df.groupby(["category", "engine"]):
        cat_rows.append([
            cat,
            engine,
            len(grp),
            f"{grp['bleu'].mean():.4f}",
            f"{grp['rouge'].mean():.4f}",
            f"{grp['score'].mean():.4f}",
        ])
    print(_md_table(cat_headers, cat_rows))


def print_few_shots(df: pd.DataFrame, engine_name: str, n: int) -> None:
    worst = df.nsmallest(n, "score")
    print(f"\n## Pires exemples — {engine_name} (N={n})\n")
    for rank, (_, row) in enumerate(worst.iterrows(), 1):
        print(f"### #{rank} · score={row['score']:.4f}  BLEU={row['bleu']:.4f}  ROUGE-L={row['rouge']:.4f}  [{row['category']}]")
        print(f"**Entrée :**   {_trunc(row['erroneous'], 120)}")
        print(f"**Sortie :**   {_trunc(row['output'], 120)}")
        print(f"**Référence:** {_trunc(row['reference'], 120)}")
        print()


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    frames: list[pd.DataFrame] = []

    if not SKIP_LLM:
        print(f"Chargement dataset LLM ({LLM_SAMPLE} exemples)…")
        llm_df = load_eval_dataset(LLM_SAMPLE, seed=SEED)
        print(f"Appel moteur LLM…")
        llm_results = run_engine(
            llm_df,
            "LLM",
            lambda text: call_llm(
                text,
                port=LLM_PORT,
                base_url=LLM_BASE_URL or None,
                api_key=LLM_API_KEY,
            ),
        )
        frames.append(llm_results)
    else:
        print("LLM ignoré (SKIP_LLM=1)")

    if not SKIP_LT:
        print(f"Chargement dataset LT ({LT_SAMPLE} exemples)…")
        lt_df = load_eval_dataset(LT_SAMPLE, seed=SEED)
        print(f"Appel moteur LanguageTool…")
        lt_results = run_engine(
            lt_df,
            "LanguageTool",
            lambda text: call_lt(
                text,
                port=LT_PORT,
                base_url=LT_BASE_URL or None,
            ),
        )
        frames.append(lt_results)
    else:
        print("LanguageTool ignoré (SKIP_LT=1)")

    if not frames:
        print("Aucun moteur actif. Définissez SKIP_LLM=0 ou SKIP_LT=0.", file=sys.stderr)
        sys.exit(1)

    print("\n" + "=" * 70)
    print("# Rapport d'évaluation — Correction grammaticale (français)")
    print("=" * 70)
    print_summary_table(frames)

    for df in frames:
        engine = df["engine"].iloc[0]
        print_few_shots(df, engine, FEW_SHOT_N)


if __name__ == "__main__":
    main()
