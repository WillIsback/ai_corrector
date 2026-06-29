import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from run_eval import compute_bleu, compute_rouge_l

def test_bleu_perfect_match():
    import pytest
    assert compute_bleu("les chats mangent.", "les chats mangent.") == pytest.approx(1.0, abs=1e-6)

def test_bleu_no_match():
    assert compute_bleu("aaa bbb ccc.", "xxx yyy zzz.") < 0.2

def test_bleu_partial_match():
    score = compute_bleu("les chats mangent du pain.", "les chats mangent.")
    assert 0.0 < score < 1.0

def test_rouge_perfect_match():
    assert compute_rouge_l("les chats mangent.", "les chats mangent.") == 1.0

def test_rouge_no_match():
    assert compute_rouge_l("aaa bbb ccc.", "xxx yyy zzz.") < 0.1

def test_rouge_partial_match():
    score = compute_rouge_l("les chats mangent du pain.", "les chats mangent.")
    assert 0.0 < score < 1.0
