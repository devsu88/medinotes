"""Pre-visit brief: what in a patient's record matters for today's reason, with a quote for each point."""

from __future__ import annotations

import re
from datetime import date
from typing import Protocol

from pydantic import BaseModel, Field

from .patients import Patient, age_label
from .pseudonymize import pseudonymize
from .verify import normalize


class BriefItem(BaseModel):
    text: str = Field(description="One point for the doctor, in Italian.")
    record: str = Field(description="Id of the record it comes from, such as R3.")
    evidence: str = Field(description="Verbatim quote from that record.")


class Brief(BaseModel):
    relevant: list[BriefItem] = Field(description="History and results relevant to the reason for the visit.")
    therapy: list[BriefItem] = Field(
        description="Therapy currently in progress, and allergies or intolerances."
    )
    to_check: list[BriefItem] = Field(description="Things the records suggest asking or checking today.")


class CheckedBriefItem(BriefItem):
    supported: bool


class CheckedBrief(BaseModel):
    relevant: list[CheckedBriefItem]
    therapy: list[CheckedBriefItem]
    to_check: list[CheckedBriefItem]


class BriefResult(BaseModel):
    brief: CheckedBrief
    sent_to_model: str
    redactions: dict[str, int]


class BriefWriter(Protocol):
    def write_brief(self, context: str) -> Brief: ...


def build_context(patient: Patient, reason: str, today: date) -> str:
    """One line per record, labelled with how long ago it is. The model never sees a calendar date."""
    lines = [
        f"[{e.id}] ({age_label(e.date, today)}, {e.type}) {e.text}"
        for e in sorted(patient.entries, key=lambda e: e.date)
    ]
    return "\n".join(lines) + f"\n\nMOTIVO DELLA VISITA: {reason.strip()}"


def _records_by_id(masked: str) -> dict[str, str]:
    return {m.group(1): normalize(m.group(2)) for m in re.finditer(r"^\[(R\d+)\] (.*)$", masked, re.M)}


def _restore(value, fn):
    if isinstance(value, str):
        return fn(value)
    if isinstance(value, list):
        return [_restore(v, fn) for v in value]
    if isinstance(value, dict):
        return {k: _restore(v, fn) for k, v in value.items()}
    return value


def make_brief(patient: Patient, reason: str, writer: BriefWriter, today: date | None = None) -> BriefResult:
    masked = pseudonymize(build_context(patient, reason, today or date.today()), [patient.name])
    records = _records_by_id(masked.text)

    def check(item: BriefItem) -> CheckedBriefItem:
        quoted = bool(item.evidence.strip()) and normalize(item.evidence) in records.get(item.record, "")
        return CheckedBriefItem(**item.model_dump(), supported=quoted)

    brief = writer.write_brief(masked.text)
    checked = CheckedBrief(
        relevant=[check(i) for i in brief.relevant],
        therapy=[check(i) for i in brief.therapy],
        to_check=[check(i) for i in brief.to_check],
    )
    restored = CheckedBrief.model_validate(_restore(checked.model_dump(), masked.restore))
    return BriefResult(brief=restored, sent_to_model=masked.text, redactions=masked.counts())
