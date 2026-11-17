"""Score the pipeline on the synthetic consultations in ``eval/cases.json``.

``python -m medinotes.evaluate`` needs a real model (LLM_API_KEY, optional LLM_MODEL/LLM_BASE_URL).
The scoring functions are pure, so they are tested without one.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from .llm import Extractor, OpenAICompatibleExtractor
from .pipeline import Result, run
from .verify import normalize

CASES = Path(__file__).resolve().parents[2] / "eval" / "cases.json"
SECTIONS = ("reason", "subjective", "objective", "assessment", "plan")


def load_cases(path: Path = CASES) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def _section_text(result: Result, section: str) -> str:
    return normalize(" ".join(f"{f.text} {f.evidence}" for f in getattr(result.note, section)))


def _same_medication(gold: dict, predicted) -> bool:
    return normalize(gold["name"]) in normalize(predicted.name) and gold["dose"] in (predicted.dose or "")


def score_case(result: Result, case: dict) -> dict:
    """Counts for one consultation. Aggregation happens in ``summarize``."""
    gold = case["gold"]

    hits = misses = 0
    for section in SECTIONS:
        text = _section_text(result, section)
        for keyword in gold[section]:
            hit = normalize(keyword) in text
            hits, misses = hits + hit, misses + (not hit)

    gold_meds = gold["medications"]
    predicted = result.note.medications
    matched_pred = sum(any(_same_medication(g, m) for g in gold_meds) for m in predicted)
    matched_gold = sum(any(_same_medication(g, m) for m in predicted) for g in gold_meds)

    facts = [f for section in SECTIONS for f in getattr(result.note, section)]
    flagged = sum(not f.supported for f in facts) + sum(
        not (m.supported and m.dose_supported) for m in predicted
    )
    return {
        "keyword_hits": hits,
        "keyword_total": hits + misses,
        "med_tp": matched_pred,
        "med_pred": len(predicted),
        "med_gold": len(gold_meds),
        "med_gold_found": matched_gold,
        "flagged": flagged,
        "statements": len(facts) + len(predicted),
        "pii_leaked": sum(v in result.sent_to_model for v in case["pii"]),
    }


def summarize(scores: list[dict]) -> dict:
    total = {k: sum(s[k] for s in scores) for k in scores[0]}
    precision = total["med_tp"] / total["med_pred"] if total["med_pred"] else 1.0
    recall = total["med_gold_found"] / total["med_gold"] if total["med_gold"] else 1.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "cases": len(scores),
        "medication_precision": round(precision, 2),
        "medication_recall": round(recall, 2),
        "medication_f1": round(f1, 2),
        "key_fact_recall": round(total["keyword_hits"] / total["keyword_total"], 2),
        "flagged_statements": f"{total['flagged']}/{total['statements']}",
        "pii_values_leaked": total["pii_leaked"],
    }


def evaluate(extractor: Extractor, cases: list[dict] | None = None) -> dict:
    cases = cases if cases is not None else load_cases()
    scores = [score_case(run(c["transcript"], extractor, c["names"]), c) for c in cases]
    return summarize(scores)


if __name__ == "__main__":
    key = os.environ["LLM_API_KEY"]
    print(json.dumps(evaluate(OpenAICompatibleExtractor(key)), indent=2, ensure_ascii=False))
