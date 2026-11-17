"""HTTP API. Stateless: nothing is stored, and the visitor's own API key travels in a header."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
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


@app.post("/api/notes", response_model=Result)
def create_note(
    request: NoteRequest,
    x_llm_key: str | None = Header(default=None),
) -> Result:
    # The visitor supplies the key. A server-side key is only for local development.
    api_key = x_llm_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key (header X-LLM-Key).")
    names = [n for n in (request.patient_name, request.doctor_name) if n.strip()]
    try:
        return run(request.transcript, OpenAICompatibleExtractor(api_key), names)
    except Exception as exc:  # surface provider errors without echoing any clinical text
        raise HTTPException(status_code=502, detail=f"Model call failed: {type(exc).__name__}") from exc


class BriefRequest(BaseModel):
    patient_id: str
    reason: str = Field(min_length=1, max_length=500)


@app.get("/api/patients")
def patients() -> list[Patient]:
    return list(load_patients())


@app.post("/api/brief", response_model=BriefResult)
def create_brief(request: BriefRequest, x_llm_key: str | None = Header(default=None)) -> BriefResult:
    api_key = x_llm_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key (header X-LLM-Key).")
    patient = get_patient(request.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Unknown patient.")
    try:
        return make_brief(patient, request.reason, OpenAICompatibleExtractor(api_key))
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
