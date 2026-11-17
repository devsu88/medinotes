"""Typed note produced by the model. Every statement carries the transcript passage it rests on."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Fact(BaseModel):
    text: str = Field(description="One clinical statement, in Italian, in the doctor's register.")
    evidence: str = Field(
        description="Verbatim quote from the transcript that supports the statement. Copy it exactly."
    )


class Medication(BaseModel):
    name: str = Field(description="Drug or active ingredient, as said in the consultation.")
    dose: str | None = Field(default=None, description="Dose and frequency exactly as said, or null.")
    instructions: str | None = Field(default=None, description="Duration or how to take it, or null.")
    evidence: str = Field(description="Verbatim quote from the transcript that mentions the drug.")


class Note(BaseModel):
    reason: list[Fact] = Field(description="Reason for the visit.")
    subjective: list[Fact] = Field(description="Symptoms and history reported by the patient (S).")
    objective: list[Fact] = Field(description="Findings, measurements and exam results (O).")
    assessment: list[Fact] = Field(description="The doctor's impression or diagnosis (A).")
    plan: list[Fact] = Field(description="Tests, referrals, advice and follow-up (P).")
    medications: list[Medication] = Field(description="Every drug prescribed, changed or stopped.")
    patient_message: str = Field(
        description="Short plain-language message to the patient, in Italian, repeating only what was said."
    )


class CheckedFact(Fact):
    supported: bool = Field(description="True when the evidence quote is found in the transcript.")


class CheckedMedication(Medication):
    supported: bool
    dose_supported: bool = Field(description="True when the dose digits appear in the transcript.")


class CheckedNote(BaseModel):
    reason: list[CheckedFact]
    subjective: list[CheckedFact]
    objective: list[CheckedFact]
    assessment: list[CheckedFact]
    plan: list[CheckedFact]
    medications: list[CheckedMedication]
    patient_message: str
