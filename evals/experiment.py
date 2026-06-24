#!/usr/bin/env python3
"""
experiment.py — Lance un Phoenix Experiment pour comparer des modèles LLM.

Usage:
  MODEL=qwen3-8b   python -m evals.experiment --dataset corrections-fr-v1
  MODEL=mistral-7b python -m evals.experiment --dataset corrections-fr-v1

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

from evals.evaluators import (
    EVAL_CHOICES,
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


def make_correction_task(model_name: str, corrector_endpoint: str, api_key: str):
    """
    Retourne la fonction task pour Phoenix Experiments.

    Chaque exemple du dataset doit avoir :
      input = {"input_text": str, "correction_mode": str}
    """
    import requests

    def correction_task(example: Any) -> dict[str, Any]:
        # Compatibilité avec l'API Phoenix Experiments v17
        if hasattr(example, 'input'):
            inp = example.input
        elif isinstance(example, dict):
            inp = example.get('input', example)
        else:
            inp = {}

        input_text: str = inp.get("input_text", "") if isinstance(inp, dict) else ""
        mode: str = inp.get("correction_mode", "formel") if isinstance(inp, dict) else "formel"

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
            f"{corrector_endpoint}/corrector/v1/chat/completions",
            json=payload,
            timeout=60,
            headers={"Authorization": f"Bearer {api_key or 'unused'}"},
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
    from phoenix.client import Client
    from phoenix.evals import LLM, create_classifier

    if not MODEL:
        print(
            "[experiment] Variable MODEL manquante. "
            "Ex: MODEL=qwen3-8b python -m evals.experiment --dataset corrections-fr-v1",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"[experiment] Connexion à Phoenix : {PHOENIX_ENDPOINT}")
    client = Client(base_url=PHOENIX_ENDPOINT)

    print(f"[experiment] Chargement du dataset '{dataset_name}'…")
    try:
        dataset = client.datasets.get_dataset(name=dataset_name)
    except Exception as e:
        print(f"[experiment] Dataset '{dataset_name}' introuvable : {e}", file=sys.stderr)
        print(
            "[experiment] Crée le dataset depuis Phoenix UI :\n"
            "  1. Traces → Projet ai-corrector\n"
            "  2. Filtrer spans avec bons scores → 'Add to Dataset'\n"
            "  3. Nommer 'corrections-fr-v1'\n"
            "  4. input = {input_text, correction_mode}, output = {corrected_text}"
        )
        sys.exit(1)

    print(f"[experiment] Modèle : {MODEL}")

    # Créer les 3 évaluateurs LLM-as-judge
    llm = LLM(
        provider="openai",
        model=MODEL,
        sync_client_kwargs={"base_url": LLM_ENDPOINT, "api_key": LLM_API_KEY},
        async_client_kwargs={"base_url": LLM_ENDPOINT, "api_key": LLM_API_KEY},
    )

    evaluators = [
        create_classifier(
            name="faithfulness",
            prompt_template=FAITHFULNESS_TEMPLATE,
            llm=llm,
            choices=EVAL_CHOICES,
        ),
        create_classifier(
            name="grammar",
            prompt_template=GRAMMAR_TEMPLATE,
            llm=llm,
            choices=EVAL_CHOICES,
        ),
        create_classifier(
            name="style_adherence",
            prompt_template=STYLE_TEMPLATE,
            llm=llm,
            choices=EVAL_CHOICES,
        ),
    ]

    task = make_correction_task(
        model_name=MODEL,
        corrector_endpoint=CORRECTOR_ENDPOINT,
        api_key=LLM_API_KEY,
    )

    print("[experiment] Lancement de l'experiment…")
    client.experiments.run_experiment(
        dataset=dataset,
        task=task,
        evaluators=evaluators,
        experiment_name=f"model-comparison/{MODEL}",
        experiment_metadata={"model": MODEL, "endpoint": LLM_ENDPOINT},
    )

    print("[experiment] Terminé. Compare les modèles dans Phoenix UI → Experiments.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Lancer un Phoenix Experiment de comparaison de modèles"
    )
    parser.add_argument(
        "--dataset", required=True, help="Nom du dataset Phoenix (ex: corrections-fr-v1)"
    )
    args = parser.parse_args()
    main(dataset_name=args.dataset)
