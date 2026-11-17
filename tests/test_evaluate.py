import pytest

from medinotes.evaluate import evaluate, load_cases, score_case, summarize
from medinotes.pipeline import run
from medinotes.pseudonymize import pseudonymize

from .conftest import ScriptedExtractor, good_note

CASES = load_cases()


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["id"])
def test_no_listed_identifier_survives_pseudonymization(case):
    masked = pseudonymize(case["transcript"], case["names"]).text
    leaked = [v for v in case["pii"] if v in masked]
    assert leaked == []


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["id"])
def test_every_gold_keyword_is_in_the_transcript(case):
    # Guards the gold labels themselves: an unreachable keyword would cap the score for no reason.
    from medinotes.verify import normalize

    text = normalize(case["transcript"])
    gold = case["gold"]
    for section in ("reason", "subjective", "objective", "assessment", "plan"):
        for keyword in gold[section]:
            assert normalize(keyword) in text, (case["id"], keyword)
    for med in gold["medications"]:
        assert normalize(med["name"]) in text and med["dose"] in text


def test_a_wrong_medication_counts_against_precision():
    case = CASES[0]  # bronchitis: paracetamol, while good_note() prescribes amoxicillin
    result = run(case["transcript"], ScriptedExtractor(good_note()), case["names"])
    score = score_case(result, case)
    assert score["pii_leaked"] == 0
    assert score["med_tp"] == 0 and score["med_pred"] == 1


def test_summary_handles_cases_without_medications():
    empty = next(c for c in CASES if not c["gold"]["medications"])
    from medinotes.schema import Note

    blank = Note(
        reason=[], subjective=[], objective=[], assessment=[], plan=[], medications=[], patient_message=""
    )
    summary = summarize(
        [score_case(run(empty["transcript"], ScriptedExtractor(blank), empty["names"]), empty)]
    )
    assert summary["medication_precision"] == 1.0 and summary["medication_recall"] == 1.0
    assert summary["pii_values_leaked"] == 0


def test_evaluate_runs_end_to_end_with_a_scripted_model():
    summary = evaluate(ScriptedExtractor(good_note()))
    assert summary["cases"] == len(CASES)
    assert summary["pii_values_leaked"] == 0
