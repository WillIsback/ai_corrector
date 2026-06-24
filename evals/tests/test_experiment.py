"""Tests unitaires pour experiment.py — appels réseau mockés."""

import pytest


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
    """Tous les modes doivent produire un prompt non-vide (>50 chars)."""
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
