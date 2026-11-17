"""The only module that talks to a model. Swappable: anything with ``extract`` works."""

from __future__ import annotations

import os
from typing import Protocol

from openai import OpenAI

from .schema import Note

SYSTEM_PROMPT = """\
Sei un assistente che prepara la documentazione di una visita di medicina generale a partire dalla
trascrizione del colloquio. Il testo è già stato pseudonimizzato: segnaposto come [NOME_1] o
[DATA_2] sostituiscono i dati identificativi. Lasciali invariati, non provare a indovinarli.

Regole:
- Riporta solo ciò che è stato detto nel colloquio. Non aggiungere diagnosi, esami o farmaci.
- Per ogni affermazione e per ogni farmaco copia in "evidence" una citazione LETTERALE della
  trascrizione, senza modificarla.
- Se una sezione non ha contenuto, restituisci una lista vuota.
- Per i farmaci riporta la dose esattamente come detta. Se non è stata detta, usa null.
- Scrivi in italiano. Il messaggio al paziente è breve, chiaro e senza gergo, e non promette nulla
  che il medico non abbia detto.
"""


class Extractor(Protocol):
    def extract(self, transcript: str) -> Note: ...


class OpenAICompatibleExtractor:
    """Structured extraction with the OpenAI API."""

    def __init__(self, api_key: str, model: str | None = None):
        self._client = OpenAI(api_key=api_key)
        self._model = model or os.getenv("LLM_MODEL", "gpt-6-luna")

    def extract(self, transcript: str) -> Note:
        completion = self._client.chat.completions.parse(
            model=self._model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Trascrizione:\n\n{transcript}"},
            ],
            response_format=Note,
        )
        note = completion.choices[0].message.parsed
        if note is None:
            raise ValueError("The model returned no structured note.")
        return note
