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


def call_lt(text: str, port: int = 8010, base_url: str | None = None) -> str:
    """Appelle LanguageTool et retourne le texte avec corrections appliquées."""
    url = f"{base_url}/v2/check" if base_url else f"http://localhost:{port}/api/lt/v2/check"
    response = requests.post(
        url,
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


def call_llm(text: str, port: int = 1234, base_url: str | None = None, api_key: str = "no-key-needed") -> str:
    """Appelle le serveur LLM via SSE (format OpenAI) et retourne le texte corrigé."""
    url = f"{base_url}/chat/completions" if base_url else f"http://localhost:{port}/v1/chat/completions"
    response = requests.post(
        url,
        json={
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "temperature": 0.3,
        },
        headers={"Authorization": f"Bearer {api_key}"},
        stream=True,
        timeout=120,
    )
    response.raise_for_status()

    content_chunks: list[str] = []
    for line in response.iter_lines():
        if not line:
            continue
        decoded = line.decode("utf-8") if isinstance(line, bytes) else line
        if decoded == "data: [DONE]":
            break
        if not decoded.startswith("data: "):
            continue
        try:
            payload = json.loads(decoded[6:])
        except json.JSONDecodeError:
            continue
        # Format OpenAI standard (vLLM/OpenAI)
        choices = payload.get("choices", [])
        if choices:
            delta = choices[0].get("delta", {})
            chunk = delta.get("content", "")
            if chunk:
                content_chunks.append(chunk)
        # Format custom (serveur local ai-corrector)
        elif payload.get("text_done"):
            return payload.get("text", "")

    if not content_chunks:
        raise ValueError("LLM : aucun contenu reçu dans le stream SSE")

    # Le LLM retourne un JSON : {"texte_corrige": "..."}
    raw = "".join(content_chunks).strip()
    try:
        data = json.loads(raw)
        return data.get("texte_corrige", raw)
    except json.JSONDecodeError:
        # Si ce n'est pas du JSON valide, retourner le texte brut
        return raw


LLM_PORT = int(os.environ.get("LLM_PORT", 1234))
LT_PORT = int(os.environ.get("LT_PORT", 8010))
LLM_SAMPLE = int(os.environ.get("LLM_SAMPLE", 200))
LT_SAMPLE = int(os.environ.get("LT_SAMPLE", 1000))
SEED = 42
LT_BASE_URL = os.environ.get("LT_BASE_URL", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "no-key-needed")
PHOENIX_ENDPOINT = os.environ.get("PHOENIX_ENDPOINT", "http://localhost:6006")


def load_eval_dataset(n: int, seed: int = SEED) -> pd.DataFrame:
    """Charge N exemples parsés depuis fdemelo/spelling-correction-french-news."""
    ds = hf_load_dataset("fdemelo/spelling-correction-french-news", split="train")
    df = ds.to_pandas().sample(n=n, random_state=seed).reset_index(drop=True)
    rows = [parse_row(row) for _, row in df.iterrows()]
    return pd.DataFrame(rows, columns=["category", "erroneous", "reference"])


def run_phoenix_eval() -> None:
    from phoenix.client import Client

    client = Client(base_url=PHOENIX_ENDPOINT)

    def bleu_eval(output: str, expected: dict) -> float:
        return compute_bleu(output or "", expected.get("reference", ""))

    def rouge_eval(output: str, expected: dict) -> float:
        return compute_rouge_l(output or "", expected.get("reference", ""))

    # --- LLM ---
    print(f"Chargement dataset LLM ({LLM_SAMPLE} exemples)...")
    llm_df = load_eval_dataset(LLM_SAMPLE)
    llm_px_df = pd.DataFrame({
        "input": llm_df["erroneous"],
        "reference": llm_df["reference"],
        "category": llm_df["category"],
    })
    llm_dataset = client.datasets.create_dataset(
        name="french-gec-llm",
        dataframe=llm_px_df,
        input_keys=["input", "category"],
        output_keys=["reference"],
    )

    def llm_task(input: dict) -> str:
        return call_llm(
            input["input"],
            port=LLM_PORT,
            base_url=LLM_BASE_URL or None,
            api_key=LLM_API_KEY,
        )

    print("Lancement évaluation LLM...")
    client.experiments.run_experiment(
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
    lt_dataset = client.datasets.create_dataset(
        name="french-gec-lt",
        dataframe=lt_px_df,
        input_keys=["input", "category"],
        output_keys=["reference"],
    )

    def lt_task(input: dict) -> str:
        return call_lt(
            input["input"],
            port=LT_PORT,
            base_url=LT_BASE_URL or None,
        )

    print("Lancement évaluation LanguageTool...")
    client.experiments.run_experiment(
        dataset=lt_dataset,
        task=lt_task,
        evaluators=[bleu_eval, rouge_eval],
        experiment_name="lt-eval",
    )

    print(f"Évaluation terminée. Ouvrir {PHOENIX_ENDPOINT} pour voir les résultats.")


if __name__ == "__main__":
    run_phoenix_eval()
