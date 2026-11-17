"""The only module that talks to a model. Swappable: anything with ``extract`` works."""

from __future__ import annotations

import os
from typing import Protocol

from openai import OpenAI

from .brief import Brief
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


BRIEF_PROMPT = """\
Sei un assistente di un medico di medicina generale. Ricevi la cartella di un paziente, un record per
riga con un id come [R3], e il motivo della visita di oggi. I dati identificativi sono sostituiti da
segnaposto come [NOME_1]: lasciali invariati.

Prepara una scheda per il medico, in italiano, usando solo ciò che è scritto nei record:
- "relevant": storia ed esiti pertinenti al motivo della visita. Ignora ciò che non c'entra.
- "therapy": terapia in corso, allergie e intolleranze, anche se non legate al motivo.
- "to_check": cosa chiedere o controllare oggi, se i record lo suggeriscono (controlli scaduti,
  assunzione irregolare, un'allergia che pesa su una possibile prescrizione).

Per ogni punto indica in "record" l'id del record e in "evidence" una citazione LETTERALE di quel
record. Non inventare nulla. Se una sezione è vuota, restituisci una lista vuota.
"""


class Extractor(Protocol):
    def extract(self, transcript: str) -> Note: ...


class OpenAICompatibleExtractor:
    """Structured output with the OpenAI API: visit notes and pre-visit briefs."""

    def __init__(self, api_key: str, model: str | None = None):
        self._client = OpenAI(api_key=api_key)
        self._model = model or os.getenv("LLM_MODEL", "gpt-6-luna")

    def _parse(self, system: str, user: str, schema):
        completion = self._client.chat.completions.parse(
            model=self._model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format=schema,
        )
        parsed = completion.choices[0].message.parsed
        if parsed is None:
            raise ValueError("The model returned no structured output.")
        return parsed

    def extract(self, transcript: str) -> Note:
        return self._parse(SYSTEM_PROMPT, f"Trascrizione:\n\n{transcript}", Note)

    def write_brief(self, context: str) -> Brief:
        return self._parse(BRIEF_PROMPT, context, Brief)
