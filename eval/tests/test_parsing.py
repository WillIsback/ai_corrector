import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from run_eval import parse_row

def test_parse_row_extracts_category_and_text():
    row = {
        "input": "grammaire: 145 mille lénages vont en bénéficier.",
        "target": "145 mille ménages vont en bénéficier.",
    }
    category, erroneous, reference = parse_row(row)
    assert category == "grammaire"
    assert erroneous == "145 mille lénages vont en bénéficier."
    assert reference == "145 mille ménages vont en bénéficier."

def test_parse_row_handles_colon_in_text():
    row = {
        "input": "orthographe: il dit: bonjour.",
        "target": "il dit: bonjour.",
    }
    category, erroneous, reference = parse_row(row)
    assert category == "orthographe"
    assert erroneous == "il dit: bonjour."
    assert reference == "il dit: bonjour."

def test_parse_row_strips_whitespace():
    row = {
        "input": "style:  texte avec espaces.  ",
        "target": "texte avec espaces.",
    }
    category, erroneous, reference = parse_row(row)
    assert category == "style"
    assert erroneous == "texte avec espaces."
    assert reference == "texte avec espaces."
