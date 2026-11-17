"""Deterministic grounding checks: is what the model cites really in the transcript?"""

from __future__ import annotations

import re

from .schema import CheckedFact, CheckedMedication, CheckedNote, Fact, Medication, Note

_SECTIONS = ("reason", "subjective", "objective", "assessment", "plan")


def normalize(text: str) -> str:
    """Casefold, unify apostrophes and drop punctuation, so that formatting differences never matter."""
    text = text.casefold().replace("’", "'")
    text = re.sub(r"[^\w\s']", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _quoted(evidence: str, transcript_norm: str) -> bool:
    return bool(evidence.strip()) and normalize(evidence) in transcript_norm


def _numbers(text: str) -> list[str]:
    return re.findall(r"\d+(?:[.,]\d+)?", text)


def _dose_in_transcript(dose: str | None, transcript_norm: str) -> bool:
    """Every number of the dose must appear in the transcript (a wrong dose is the dangerous error)."""
    if not dose:
        return True
    haystack = set(re.findall(r"\d+(?:[.,]\d+)?", transcript_norm))
    return all(n in haystack for n in _numbers(dose))


def check_fact(fact: Fact, transcript_norm: str) -> CheckedFact:
    return CheckedFact(**fact.model_dump(), supported=_quoted(fact.evidence, transcript_norm))


def check_medication(med: Medication, transcript_norm: str) -> CheckedMedication:
    return CheckedMedication(
        **med.model_dump(),
        supported=_quoted(med.evidence, transcript_norm),
        dose_supported=_dose_in_transcript(med.dose, transcript_norm),
    )


def check_note(note: Note, transcript: str) -> CheckedNote:
    """Mark every statement whose quote is not literally in ``transcript``."""
    t = normalize(transcript)
    sections = {name: [check_fact(f, t) for f in getattr(note, name)] for name in _SECTIONS}
    return CheckedNote(
        **sections,
        medications=[check_medication(m, t) for m in note.medications],
        patient_message=note.patient_message,
    )
