from datetime import date

from fastapi.testclient import TestClient

from medinotes import app as app_module
from medinotes.brief import Brief, BriefItem, build_context, make_brief
from medinotes.patients import age_label, get_patient, load_patients

TODAY = date(2026, 11, 17)


class ScriptedWriter:
    def __init__(self, brief: Brief):
        self.brief = brief
        self.received: list[str] = []

    def write_brief(self, context: str) -> Brief:
        self.received.append(context)
        return self.brief


def item(record: str, evidence: str, text: str = "punto") -> BriefItem:
    return BriefItem(text=text, record=record, evidence=evidence)


def test_every_patient_loads_with_numbered_records():
    patients = load_patients()
    assert len(patients) == 5
    for p in patients:
        assert [e.id for e in p.entries] == [f"R{n}" for n in range(1, len(p.entries) + 1)]


def test_age_label_is_relative():
    assert age_label(date(2026, 11, 3), TODAY) == "meno di un mese fa"
    assert age_label(date(2026, 8, 20), TODAY) == "3 mesi fa"
    assert age_label(date(2019, 4, 12), TODAY) == "7 anni fa"


def test_the_model_sees_no_calendar_date_and_no_patient_name():
    patient = get_patient("p2")
    writer = ScriptedWriter(Brief(relevant=[], therapy=[], to_check=[]))
    make_brief(patient, "visita per Mario Rossi, tosse", writer, TODAY)

    sent = writer.received[0]
    assert "Mario" not in sent and "Rossi" not in sent
    assert "2019" not in sent and "2026" not in sent
    assert "anni fa" in sent


def test_context_is_one_record_per_line_in_date_order():
    lines = build_context(get_patient("p1"), "controllo", TODAY).split("\n\n")[0].split("\n")
    assert [line[:4] for line in lines] == ["[R1]", "[R2]", "[R3]", "[R4]", "[R5]"]


def test_quotes_are_checked_against_the_cited_record():
    patient = get_patient("p2")
    good = item("R1", "Diagnosi di allergia alle penicilline")
    wrong_record = item("R4", "Diagnosi di allergia alle penicilline")  # real quote, wrong record
    invented = item("R2", "Ha avuto un infarto")
    unknown = item("R99", "Diagnosi di allergia alle penicilline")
    brief = Brief(relevant=[], therapy=[good], to_check=[wrong_record, invented, unknown])
    result = make_brief(patient, "tosse", ScriptedWriter(brief), TODAY)

    assert [i.supported for i in result.brief.therapy] == [True]
    assert [i.supported for i in result.brief.to_check] == [False, False, False]


def test_api_lists_patients_and_builds_a_brief(monkeypatch):
    brief = Brief(relevant=[], therapy=[item("R1", "allergia alle penicilline")], to_check=[])
    monkeypatch.setattr(app_module, "OpenAICompatibleExtractor", lambda key: ScriptedWriter(brief))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    client = TestClient(app_module.app)

    assert len(client.get("/api/patients").json()) == 5
    body = {"patient_id": "p2", "reason": "tosse"}
    assert client.post("/api/brief", json=body).status_code == 401
    assert (
        client.post("/api/brief", json={**body, "patient_id": "nope"}, headers={"X-LLM-Key": "k"}).status_code
        == 404
    )
    ok = client.post("/api/brief", json=body, headers={"X-LLM-Key": "k"})
    assert ok.status_code == 200 and ok.json()["brief"]["therapy"][0]["supported"] is True
