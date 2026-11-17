"""Fictitious patient records, read from a JSON file that ships with the app (the demo's 'database')."""

from __future__ import annotations

import json
from datetime import date
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

DATA = Path(__file__).parent / "data" / "patients.json"


class Entry(BaseModel):
    id: str
    date: date
    type: str
    text: str


class Patient(BaseModel):
    id: str
    name: str
    birth_year: int
    sex: str
    problems: list[str]
    entries: list[Entry]


@lru_cache
def load_patients() -> tuple[Patient, ...]:
    patients = []
    for raw in json.loads(DATA.read_text(encoding="utf-8")):
        raw["entries"] = [{**e, "id": f"R{n}"} for n, e in enumerate(raw["entries"], start=1)]
        patients.append(Patient.model_validate(raw))
    return tuple(patients)


def get_patient(patient_id: str) -> Patient | None:
    return next((p for p in load_patients() if p.id == patient_id), None)


def age_label(when: date, today: date) -> str:
    """How long ago a record is, in words. Exact dates never go to the model."""
    months = (today.year - when.year) * 12 + today.month - when.month
    if months < 1:
        return "meno di un mese fa"
    if months < 24:
        return f"{months} mesi fa"
    return f"{months // 12} anni fa"
