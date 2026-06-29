import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import responses as resp_mock
from run_eval import call_lt


@resp_mock.activate
def test_call_lt_applies_single_correction():
    resp_mock.add(
        resp_mock.POST,
        "http://localhost:8010/api/lt/v2/check",
        json={
            "matches": [
                {
                    "offset": 4,
                    "length": 5,
                    "replacements": [{"value": "chats"}],
                    "rule": {"id": "SPELL"},
                }
            ]
        },
    )
    result = call_lt("les chtas mangent.", port=8010)
    assert result == "les chats mangent."


@resp_mock.activate
def test_call_lt_no_corrections():
    resp_mock.add(
        resp_mock.POST,
        "http://localhost:8010/api/lt/v2/check",
        json={"matches": []},
    )
    result = call_lt("texte correct.", port=8010)
    assert result == "texte correct."


@resp_mock.activate
def test_call_lt_applies_multiple_corrections_in_order():
    # Deux corrections, doivent être appliquées de la fin vers le début
    resp_mock.add(
        resp_mock.POST,
        "http://localhost:8010/api/lt/v2/check",
        json={
            "matches": [
                {"offset": 0, "length": 3, "replacements": [{"value": "Les"}], "rule": {"id": "UPPER"}},
                {"offset": 4, "length": 5, "replacements": [{"value": "chats"}], "rule": {"id": "SPELL"}},
            ]
        },
    )
    result = call_lt("les chtas mangent.", port=8010)
    assert result == "Les chats mangent."


from unittest.mock import patch, MagicMock
from run_eval import call_llm


def test_call_llm_extracts_corrected_text():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.iter_lines.return_value = iter([
        b'data: {"text_done": true, "text": "les chats mangent.", "duration": 1.2}',
        b'data: {"done": true, "corrections": []}',
    ])

    with patch("requests.post", return_value=mock_response):
        result = call_llm("les chtas mangent.", port=1234)

    assert result == "les chats mangent."


def test_call_llm_raises_if_no_text_done():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.iter_lines.return_value = iter([
        b'data: {"done": true, "corrections": []}',
    ])

    with patch("requests.post", return_value=mock_response):
        try:
            call_llm("texte.", port=1234)
            assert False, "devait lever ValueError"
        except ValueError as e:
            assert "text_done" in str(e)
