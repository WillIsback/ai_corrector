from evals.evaluators import (
    FAITHFULNESS_TEMPLATE,
    GRAMMAR_TEMPLATE,
    STYLE_TEMPLATE,
    EVAL_CHOICES,
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


def test_eval_choices_are_binary():
    """Les choix doivent être 'correct' (1.0) et 'incorrect' (0.0)."""
    assert "correct" in EVAL_CHOICES
    assert "incorrect" in EVAL_CHOICES
    assert EVAL_CHOICES["correct"] == 1.0
    assert EVAL_CHOICES["incorrect"] == 0.0


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
