from fastapi.testclient import TestClient

from medinotes import app as app_module
from medinotes.pipeline import run
from medinotes.schema import Fact

from .conftest import PII, TRANSCRIPT, ScriptedExtractor, good_note


def test_the_model_never_receives_identifying_data():
    extractor = ScriptedExtractor(good_note())
    run(TRANSCRIPT, extractor, ["Mario Rossi"])

    assert len(extractor.received) == 1
    for value in PII:
        assert value not in extractor.received[0]


def test_result_exposes_what_was_sent_and_restores_originals_in_the_note():
    result = run(TRANSCRIPT, ScriptedExtractor(good_note()), ["Mario Rossi"])

    assert "[NOME_1]" in result.sent_to_model
    assert "Mario" not in result.sent_to_model
    assert result.redactions["NOME"] >= 1
    assert "Mario" in result.note.patient_message  # token restored for the doctor
    assert "[NOME_1]" not in result.note.patient_message


def test_a_quote_the_model_invented_is_flagged_not_dropped():
    note = good_note()
    note.assessment = [Fact(text="Diabete", evidence="Il paziente è diabetico da anni")]
    result = run(TRANSCRIPT, ScriptedExtractor(note))

    assert result.note.assessment[0].supported is False
    assert result.note.subjective[0].supported is True


def test_api_returns_a_checked_note_and_needs_a_server_key(monkeypatch):
    monkeypatch.setattr(app_module, "OpenAICompatibleExtractor", lambda key: ScriptedExtractor(good_note()))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    client = TestClient(app_module.app)
    body = {"transcript": TRANSCRIPT, "patient_name": "Mario Rossi"}

    assert client.post("/api/notes", json=body).status_code == 503  # no server key configured

    monkeypatch.setenv("OPENAI_API_KEY", "server-key")
    ok = client.post("/api/notes", json=body)
    assert ok.status_code == 200
    assert ok.json()["note"]["medications"][0]["name"] == "amoxicillina"
    assert "Rossi" not in ok.json()["sent_to_model"]


def test_provider_errors_do_not_echo_clinical_text(monkeypatch):
    class Boom:
        def extract(self, transcript):
            raise RuntimeError(transcript)  # a provider error that quotes its input

    monkeypatch.setattr(app_module, "OpenAICompatibleExtractor", lambda key: Boom())
    monkeypatch.setenv("OPENAI_API_KEY", "server-key")
    client = TestClient(app_module.app)
    resp = client.post("/api/notes", json={"transcript": TRANSCRIPT})

    assert resp.status_code == 502
    assert "tosse" not in resp.text and "RuntimeError" in resp.text
