"""
Rapport comparatif LLM vs LanguageTool.

Génère dans benchmark/ :
  - report_YYYYMMDD_HHMMSS.md   tableau Markdown + few shots
  - report_YYYYMMDD_HHMMSS.png  graphique seaborn (score par rang, hue=catégorie)

Usage :
    python eval/report.py

Variables d'environnement (toutes optionnelles) :
    LLM_BASE_URL   URL de base du serveur LLM  (défaut: http://localhost:1234/v1)
    LT_BASE_URL    URL de base de LT           (défaut: http://localhost:8010)
    LLM_API_KEY    Clé API LLM                 (défaut: no-key-needed)
    LLM_SAMPLE     Nombre d'exemples LLM       (défaut: 50)
    LT_SAMPLE      Nombre d'exemples LT        (défaut: 200)
    FEW_SHOT_N     Nombre de pires exemples    (défaut: 5)
    SKIP_LLM       Si "1", ignore le moteur LLM
    SKIP_LT        Si "1", ignore le moteur LT
    BENCHMARK_DIR  Dossier de sortie           (défaut: ../benchmark)
"""
from __future__ import annotations

import os
import sys
import textwrap
from datetime import datetime
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # backend non-interactif
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

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

_here = Path(__file__).parent
BENCHMARK_DIR = Path(os.environ.get("BENCHMARK_DIR", str(_here / ".." / "benchmark")))


# ── Helpers ────────────────────────────────────────────────────────────────────

def _log(msg: str) -> None:
    """Affiche un message de progression sur stderr uniquement."""
    print(msg, file=sys.stderr, flush=True)


def _trunc(text: str, width: int = 120) -> str:
    return textwrap.shorten(text, width=width, placeholder="…")


def _score_row(output: str, reference: str) -> dict:
    bleu = compute_bleu(output, reference)
    rouge = compute_rouge_l(output, reference)
    return {"bleu": bleu, "rouge": rouge, "score": (bleu + rouge) / 2}


def run_engine(df: pd.DataFrame, engine_name: str, call_fn) -> pd.DataFrame:
    records = []
    total = len(df)
    for i, row in df.iterrows():
        try:
            output = call_fn(row["erroneous"])
        except Exception as exc:
            _log(f"  [{engine_name}] erreur ligne {i}: {exc}")
            output = row["erroneous"]

        scores = _score_row(output, row["reference"])
        records.append({
            "engine": engine_name,
            "category": row["category"],
            "erroneous": row["erroneous"],
            "reference": row["reference"],
            "output": output,
            **scores,
        })
        if (i + 1) % 10 == 0 or (i + 1) == total:
            _log(f"  [{engine_name}] {i + 1}/{total}")

    return pd.DataFrame(records)


# ── Markdown ───────────────────────────────────────────────────────────────────

def _md_table(headers: list[str], rows: list[list]) -> str:
    col_widths = [
        max(len(str(h)), max((len(str(r[j])) for r in rows), default=0))
        for j, h in enumerate(headers)
    ]
    sep = "| " + " | ".join("-" * w for w in col_widths) + " |"
    header_line = "| " + " | ".join(str(h).ljust(col_widths[j]) for j, h in enumerate(headers)) + " |"
    lines = [header_line, sep]
    for row in rows:
        lines.append(
            "| " + " | ".join(str(row[j]).ljust(col_widths[j]) for j in range(len(headers))) + " |"
        )
    return "\n".join(lines)


def build_report(frames: list[pd.DataFrame], chart_filename: str, run_ts: str) -> str:
    all_df = pd.concat(frames, ignore_index=True)
    lines: list[str] = []

    lines.append(f"# Rapport d'évaluation — Correction grammaticale (français)")
    lines.append(f"\n_Généré le {run_ts}_\n")

    # Tableau global
    lines.append("## Tableau comparatif global\n")
    headers = ["Moteur", "N", "BLEU moy.", "ROUGE-L moy.", "BLEU min", "ROUGE-L min", "Score moy."]
    rows = []
    for engine, grp in all_df.groupby("engine"):
        rows.append([
            engine, len(grp),
            f"{grp['bleu'].mean():.4f}", f"{grp['rouge'].mean():.4f}",
            f"{grp['bleu'].min():.4f}", f"{grp['rouge'].min():.4f}",
            f"{grp['score'].mean():.4f}",
        ])
    lines.append(_md_table(headers, rows))

    # Par catégorie
    lines.append("\n## Par catégorie\n")
    cat_headers = ["Catégorie", "Moteur", "N", "BLEU moy.", "ROUGE-L moy.", "Score moy."]
    cat_rows = []
    for (cat, engine), grp in all_df.groupby(["category", "engine"]):
        cat_rows.append([
            cat, engine, len(grp),
            f"{grp['bleu'].mean():.4f}", f"{grp['rouge'].mean():.4f}",
            f"{grp['score'].mean():.4f}",
        ])
    lines.append(_md_table(cat_headers, cat_rows))

    # Graphique
    lines.append(f"\n## Graphique comparatif\n")
    lines.append(f"![Score par rang — LLM vs LanguageTool](./{chart_filename})\n")

    # Few shots par moteur
    for df in frames:
        engine = df["engine"].iloc[0]
        worst = df.nsmallest(FEW_SHOT_N, "score")
        lines.append(f"\n## Pires exemples — {engine} (N={FEW_SHOT_N})\n")
        for rank, (_, row) in enumerate(worst.iterrows(), 1):
            lines.append(
                f"### #{rank} · score={row['score']:.4f}  "
                f"BLEU={row['bleu']:.4f}  ROUGE-L={row['rouge']:.4f}  [{row['category']}]"
            )
            lines.append(f"**Entrée :**   {_trunc(row['erroneous'])}")
            lines.append(f"**Sortie :**   {_trunc(row['output'])}")
            lines.append(f"**Référence:** {_trunc(row['reference'])}")
            lines.append("")

    return "\n".join(lines)


# ── Graphique seaborn ──────────────────────────────────────────────────────────

def build_chart(frames: list[pd.DataFrame], output_path: Path) -> None:
    """
    Line chart : score par rang (exemples triés du meilleur au pire),
    une ligne par moteur, hue = catégorie.
    Deux sous-graphes : BLEU et ROUGE-L.
    """
    # Construire un DataFrame long avec rang par groupe (engine × category)
    records = []
    for df in frames:
        for (engine, cat), grp in df.groupby(["engine", "category"]):
            sorted_grp = grp.sort_values("score", ascending=False).reset_index(drop=True)
            for rank, (_, row) in enumerate(sorted_grp.iterrows(), 1):
                records.append({
                    "Moteur": engine,
                    "Catégorie": cat,
                    "Rang": rank,
                    "BLEU": row["bleu"],
                    "ROUGE-L": row["rouge"],
                    "Score": row["score"],
                })
    long_df = pd.DataFrame(records)

    sns.set_theme(style="whitegrid", palette="tab10")
    fig, axes = plt.subplots(1, 2, figsize=(14, 5), sharey=False)
    fig.suptitle("LLM vs LanguageTool — distribution des scores par catégorie", fontsize=13, y=1.02)

    for ax, metric in zip(axes, ["BLEU", "ROUGE-L"]):
        sns.lineplot(
            data=long_df,
            x="Rang",
            y=metric,
            hue="Catégorie",
            style="Moteur",
            estimator=None,
            alpha=0.8,
            ax=ax,
        )
        ax.set_title(metric)
        ax.set_xlabel("Rang (du meilleur au pire)")
        ax.set_ylabel(f"Score {metric}")
        ax.legend(title="Catégorie / Moteur", fontsize=8, title_fontsize=8)

    plt.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    _log(f"Graphique : {output_path}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    md_path = BENCHMARK_DIR / f"report_{ts}.md"
    chart_filename = f"report_{ts}.png"
    chart_path = BENCHMARK_DIR / chart_filename

    frames: list[pd.DataFrame] = []

    if not SKIP_LLM:
        _log(f"Chargement dataset LLM ({LLM_SAMPLE} exemples)…")
        llm_df = load_eval_dataset(LLM_SAMPLE, seed=SEED)
        _log("Appel moteur LLM…")
        frames.append(run_engine(
            llm_df, "LLM",
            lambda text: call_llm(text, port=LLM_PORT, base_url=LLM_BASE_URL or None, api_key=LLM_API_KEY),
        ))
    else:
        _log("LLM ignoré (SKIP_LLM=1)")

    if not SKIP_LT:
        _log(f"Chargement dataset LT ({LT_SAMPLE} exemples)…")
        lt_df = load_eval_dataset(LT_SAMPLE, seed=SEED)
        _log("Appel moteur LanguageTool…")
        frames.append(run_engine(
            lt_df, "LanguageTool",
            lambda text: call_lt(text, port=LT_PORT, base_url=LT_BASE_URL or None),
        ))
    else:
        _log("LanguageTool ignoré (SKIP_LT=1)")

    if not frames:
        _log("Aucun moteur actif. Définissez SKIP_LLM=0 ou SKIP_LT=0.")
        sys.exit(1)

    run_ts = datetime.now().strftime("%d/%m/%Y à %H:%M")

    _log("Génération du graphique…")
    build_chart(frames, chart_path)

    _log("Génération du rapport Markdown…")
    report_md = build_report(frames, chart_filename, run_ts)
    md_path.write_text(report_md, encoding="utf-8")

    _log(f"Rapport : {md_path}")


if __name__ == "__main__":
    main()
