"""Tests unitaires pour evaluate.py — tous les appels réseau sont mockés."""

import pandas as pd
import pytest


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


def test_filter_unevaluated_keeps_all_when_no_existing():
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
