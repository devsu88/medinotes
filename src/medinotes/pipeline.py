"""Transcript in, checked note out. The model only ever sees the pseudonymized text."""

from __future__ import annotations

from pydantic import BaseModel

from .llm import Extractor
from .pseudonymize import pseudonymize
from .schema import CheckedNote
from .verify import check_note


class Result(BaseModel):
    note: CheckedNote
    sent_to_model: str  # exactly what left the machine, tokens included
    redactions: dict[str, int]  # distinct values replaced, per kind


def run(transcript: str, extractor: Extractor, known_names: list[str] | None = None) -> Result:
    masked = pseudonymize(transcript, known_names)
    checked = check_note(extractor.extract(masked.text), masked.text)
    restored = CheckedNote.model_validate(_map_strings(checked.model_dump(), masked.restore))
    return Result(note=restored, sent_to_model=masked.text, redactions=masked.counts())


def _map_strings(value, fn):
    if isinstance(value, str):
        return fn(value)
    if isinstance(value, list):
        return [_map_strings(v, fn) for v in value]
    if isinstance(value, dict):
        return {k: _map_strings(v, fn) for k, v in value.items()}
    return value
