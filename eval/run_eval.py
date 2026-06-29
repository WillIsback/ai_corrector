from __future__ import annotations
from typing import Tuple

import requests
import sacrebleu
from rouge_score import rouge_scorer as _rouge_lib


def parse_row(row: dict) -> Tuple[str, str, str]:
    """Extrait (catégorie, texte_erroné, référence) depuis une ligne du dataset."""
    category, erroneous = row["input"].split(": ", 1)
    return category.strip(), erroneous.strip(), row["target"].strip()


def compute_bleu(hypothesis: str, reference: str) -> float:
    """Score BLEU entre hypothesis et reference, normalisé entre 0.0 et 1.0."""
    result = sacrebleu.corpus_bleu([hypothesis], [[reference]])
    return result.score / 100.0


def compute_rouge_l(hypothesis: str, reference: str) -> float:
    """Score ROUGE-L F1 entre hypothesis et reference (0.0 à 1.0)."""
    scorer = _rouge_lib.RougeScorer(["rougeL"], use_stemmer=False)
    return scorer.score(reference, hypothesis)["rougeL"].fmeasure


def call_lt(text: str, port: int = 8010) -> str:
    """Appelle LanguageTool et retourne le texte avec corrections appliquées."""
    response = requests.post(
        f"http://localhost:{port}/api/lt/v2/check",
        data={"text": text, "language": "fr"},
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()

    matches = sorted(data["matches"], key=lambda m: m["offset"], reverse=True)
    result = text
    for match in matches:
        if not match.get("replacements"):
            continue
        replacement = match["replacements"][0]
        if isinstance(replacement, dict):
            replacement = replacement["value"]
        offset, length = match["offset"], match["length"]
        result = result[:offset] + replacement + result[offset + length:]

    return result
