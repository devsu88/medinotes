from medinotes.schema import Fact, Medication
from medinotes.verify import check_fact, check_medication, check_note, normalize

from .conftest import TRANSCRIPT, good_note


def test_normalize_ignores_case_punctuation_and_spacing():
    assert normalize("Ho avuto  37,8 di FEBBRE!") == normalize("ho avuto 37 8 di febbre")


def test_literal_quote_is_supported_and_invented_quote_is_not():
    t = normalize(TRANSCRIPT)
    assert check_fact(Fact(text="x", evidence="Ho avuto 37,8 di febbre ieri"), t).supported
    assert not check_fact(Fact(text="x", evidence="Ha il diabete da anni"), t).supported
    assert not check_fact(Fact(text="x", evidence=""), t).supported


def test_wrong_dose_is_flagged_even_when_the_quote_is_real():
    t = normalize(TRANSCRIPT)
    real = Medication(name="amoxicillina", dose="1 g due volte", evidence="Prescrivo amoxicillina")
    wrong = Medication(name="amoxicillina", dose="2 g tre volte", evidence="Prescrivo amoxicillina")
    assert check_medication(real, t).dose_supported
    flagged = check_medication(wrong, t)
    assert flagged.supported and not flagged.dose_supported


def test_missing_dose_is_not_an_error():
    med = Medication(name="x", dose=None, evidence="Prescrivo amoxicillina")
    assert check_medication(med, normalize(TRANSCRIPT)).dose_supported


def test_whole_good_note_is_fully_supported():
    checked = check_note(good_note(), TRANSCRIPT)
    facts = [*checked.reason, *checked.subjective, *checked.objective, *checked.plan]
    assert all(f.supported for f in facts)
    assert all(m.supported and m.dose_supported for m in checked.medications)
