from __future__ import annotations
from typing import Tuple
import json
import os

import pandas as pd
import requests
import sacrebleu
from datasets import load_dataset as hf_load_dataset
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


SYSTEM_PROMPT = (
    "Tu es un correcteur editorial expert en francais. "
    "Mode: Formel et professionnel. "
    "Corrections actives: grammaire, orthographe, syntaxe, style. "
    "Corrige UNIQUEMENT ce qui necessite une correction selon ces criteres. "
    "Ne change pas le sens ni le style au-dela du mode demande. "
    "Reponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ou apres:\n"
    '{"texte_corrige": "le texte corrige complet"}'
)


def call_llm(text: str, port: int = 1234) -> str:
    """Appelle le serveur LLM via SSE et retourne le texte corrigé."""
    response = requests.post(
        f"http://localhost:{port}/v1/chat/completions",
        json={
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "temperature": 0.3,
        },
        headers={"Authorization": "Bearer no-key-needed"},
        stream=True,
        timeout=30,
    )
    response.raise_for_status()

    for line in response.iter_lines():
        if not line:
            continue
        decoded = line.decode("utf-8") if isinstance(line, bytes) else line
        if not decoded.startswith("data: "):
            continue
        payload = json.loads(decoded[6:])
        if payload.get("text_done"):
            return payload.get("text", "")

    raise ValueError("LLM : aucun événement text_done reçu dans le stream SSE")


LLM_PORT = int(os.environ.get("LLM_PORT", 1234))
LT_PORT = int(os.environ.get("LT_PORT", 8010))
LLM_SAMPLE = int(os.environ.get("LLM_SAMPLE", 200))
LT_SAMPLE = int(os.environ.get("LT_SAMPLE", 1000))
SEED = 42


def load_eval_dataset(n: int, seed: int = SEED) -> pd.DataFrame:
    """Charge N exemples parsés depuis fdemelo/spelling-correction-french-news."""
    ds = hf_load_dataset("fdemelo/spelling-correction-french-news", split="train")
    df = ds.to_pandas().sample(n=n, random_state=seed).reset_index(drop=True)
    rows = [parse_row(row) for _, row in df.iterrows()]
    return pd.DataFrame(rows, columns=["category", "erroneous", "reference"])


def run_phoenix_eval() -> None:
    import phoenix as px
    from phoenix.experiments import run_experiment

    client = px.Client()

    def bleu_eval(output: str, expected: dict) -> float:
        return compute_bleu(output or "", expected["reference"])

    def rouge_eval(output: str, expected: dict) -> float:
        return compute_rouge_l(output or "", expected["reference"])

    # --- LLM ---
    print(f"Chargement dataset LLM ({LLM_SAMPLE} exemples)...")
    llm_df = load_eval_dataset(LLM_SAMPLE)
    llm_px_df = pd.DataFrame({
        "input": llm_df["erroneous"],
        "reference": llm_df["reference"],
        "category": llm_df["category"],
    })
    llm_dataset = client.upload_dataset(
        dataframe=llm_px_df,
        input_keys=["input", "category"],
        output_keys=["reference"],
        dataset_name="french-gec-llm",
    )

    def llm_task(example: dict) -> str:
        return call_llm(example["input"]["input"], port=LLM_PORT)

    print(f"Lancement évaluation LLM...")
    run_experiment(
        dataset=llm_dataset,
        task=llm_task,
        evaluators=[bleu_eval, rouge_eval],
        experiment_name="llm-eval",
    )

    # --- LanguageTool ---
    print(f"Chargement dataset LT ({LT_SAMPLE} exemples)...")
    lt_df = load_eval_dataset(LT_SAMPLE)
    lt_px_df = pd.DataFrame({
        "input": lt_df["erroneous"],
        "reference": lt_df["reference"],
        "category": lt_df["category"],
    })
    lt_dataset = client.upload_dataset(
        dataframe=lt_px_df,
        input_keys=["input", "category"],
        output_keys=["reference"],
        dataset_name="french-gec-lt",
    )

    def lt_task(example: dict) -> str:
        return call_lt(example["input"]["input"], port=LT_PORT)

    print(f"Lancement évaluation LanguageTool...")
    run_experiment(
        dataset=lt_dataset,
        task=lt_task,
        evaluators=[bleu_eval, rouge_eval],
        experiment_name="lt-eval",
    )

    print("Évaluation terminée. Ouvrir http://localhost:6006 pour voir les résultats.")


if __name__ == "__main__":
    run_phoenix_eval()
