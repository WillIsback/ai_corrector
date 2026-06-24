"""
Prompt templates LLM-as-judge pour l'évaluation des corrections françaises.

Chaque template est une string avec des placeholders {var} compatibles avec
create_classifier() de arize-phoenix-evals 17.x.

Utilisation :
    from phoenix.evals import LLM, create_classifier, evaluate_dataframe
    from evals.evaluators import FAITHFULNESS_TEMPLATE, EVAL_CHOICES

    llm = LLM(provider='openai', model='qwen3',
               sync_client_kwargs={'base_url': 'http://localhost:30000/v1', 'api_key': 'unused'},
               async_client_kwargs={'base_url': 'http://localhost:30000/v1', 'api_key': 'unused'})

    evaluator = create_classifier(
        name='faithfulness',
        prompt_template=FAITHFULNESS_TEMPLATE,
        llm=llm,
        choices=EVAL_CHOICES,
    )
    results = evaluate_dataframe(dataframe=df, evaluators=[evaluator])
"""

# Scores: correct → 1.0, incorrect → 0.0
EVAL_CHOICES: dict[str, float] = {"correct": 1.0, "incorrect": 0.0}

# ---------------------------------------------------------------------------
# 1. Fidélité — le sens original est-il préservé ?
# Colonnes DataFrame requises : input_text, output_text
# ---------------------------------------------------------------------------
FAITHFULNESS_TEMPLATE = """\
Tu es un expert en langue française. On t'a demandé de corriger un texte.
Évalue si le texte corrigé préserve fidèlement le sens et l'intention
du texte original, sans ajouter ni supprimer d'information.

Texte original :
{input_text}

Texte corrigé :
{output_text}

Le sens original est-il entièrement préservé dans le texte corrigé ?
Réponds UNIQUEMENT par "correct" (sens préservé) ou "incorrect" (sens altéré).
Réponds en un seul mot, sans explication.
"""

# ---------------------------------------------------------------------------
# 2. Grammaire — le texte corrigé est-il correct en français ?
# Colonnes DataFrame requises : output_text
# ---------------------------------------------------------------------------
GRAMMAR_TEMPLATE = """\
Tu es un expert en grammaire française. Évalue si le texte suivant
est grammaticalement correct en français : absence de fautes d'orthographe,
d'accord, de conjugaison et de syntaxe.

Texte à évaluer :
{output_text}

Ce texte est-il grammaticalement correct ?
Réponds UNIQUEMENT par "correct" (sans fautes) ou "incorrect" (contient des fautes).
Réponds en un seul mot, sans explication.
"""

# ---------------------------------------------------------------------------
# 3. Respect du registre — le ton correspond-il au mode demandé ?
# Colonnes DataFrame requises : output_text, correction_mode
# ---------------------------------------------------------------------------
STYLE_TEMPLATE = """\
Tu es un expert en stylistique française. On a demandé une correction
en mode "{correction_mode}".

Registres de référence :
- formel : langage soutenu, vouvoiement implicite, phrases complètes
- semi-formel : neutre et poli, adapté au courrier professionnel
- informel : décontracté, langage naturel conversationnel
- technical : précis et concis, vocabulaire technique, pas d'ornements

Texte corrigé à évaluer :
{output_text}

Le texte respecte-t-il le registre "{correction_mode}" ?
Réponds UNIQUEMENT par "correct" (registre respecté) ou "incorrect" (registre inadapté).
Réponds en un seul mot, sans explication.
"""
