"""HTTP API. Stateless: nothing is stored. The model key lives only in the server environment."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .brief import BriefResult, make_brief
from .llm import OpenAICompatibleExtractor
from .patients import Patient, get_patient, load_patients
from .pipeline import Result, run

app = FastAPI(title="MediNotes", docs_url=None, redoc_url=None)


class NoteRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=20_000)
    patient_name: str = Field(default="", max_length=200)
    doctor_name: str = Field(default="", max_length=200)


def _extractor() -> OpenAICompatibleExtractor:
    """The model client, with the server's own key (environment variable OPENAI_API_KEY)."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Servizio non configurato: manca la chiave del modello.")
    return OpenAICompatibleExtractor(api_key)


@app.post("/api/notes", response_model=Result)
def create_note(request: NoteRequest) -> Result:
    extractor = _extractor()
    names = [n for n in (request.patient_name, request.doctor_name) if n.strip()]
    try:
        return run(request.transcript, extractor, names)
    except Exception as exc:  # surface provider errors without echoing any clinical text
        raise HTTPException(status_code=502, detail=f"Model call failed: {type(exc).__name__}") from exc


class BriefRequest(BaseModel):
    patient_id: str
    reason: str = Field(min_length=1, max_length=500)


@app.get("/api/patients")
def patients() -> list[Patient]:
    return list(load_patients())


@app.post("/api/brief", response_model=BriefResult)
def create_brief(request: BriefRequest) -> BriefResult:
    extractor = _extractor()
    patient = get_patient(request.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Unknown patient.")
    try:
        return make_brief(patient, request.reason, extractor)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Model call failed: {type(exc).__name__}") from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


_static = Path(os.getenv("STATIC_DIR", "static"))
if _static.exists():

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(_static / "index.html")

    app.mount("/", StaticFiles(directory=_static, html=True), name="static")
