from medinotes.pseudonymize import cf_check_char
from medinotes.schema import Fact, Medication, Note

# Fictitious patient. The codice fiscale is built with the real check algorithm, so the validator accepts it.
CF_BODY = "RSSMRA85T10A562"
CF = CF_BODY + cf_check_char(CF_BODY)

TRANSCRIPT = (
    "Medico: Buongiorno signor Mario Rossi, come va la tosse?\n"
    "Paziente: Persiste da dieci giorni, soprattutto di notte. Ho avuto 37,8 di febbre ieri.\n"
    f"Medico: Verifico i dati: codice fiscale {CF}, nato il 10/12/1985, abita in via Garibaldi 12, "
    "telefono 333 1234567. Il torace è libero all'auscultazione.\n"
    "Medico: Prescrivo amoxicillina 1 g due volte al giorno per sei giorni. Ci rivediamo tra una settimana.\n"
)

PII = ["Mario", "Rossi", CF, "10/12/1985", "Garibaldi", "333 1234567"]


def good_note() -> Note:
    return Note(
        reason=[Fact(text="Tosse persistente", evidence="Persiste da dieci giorni, soprattutto di notte")],
        subjective=[Fact(text="Febbre 37,8 ieri", evidence="Ho avuto 37,8 di febbre ieri")],
        objective=[Fact(text="Torace libero", evidence="Il torace è libero all'auscultazione")],
        assessment=[],
        plan=[Fact(text="Controllo tra una settimana", evidence="Ci rivediamo tra una settimana")],
        medications=[
            Medication(
                name="amoxicillina",
                dose="1 g due volte al giorno",
                instructions="sei giorni",
                evidence="Prescrivo amoxicillina 1 g due volte al giorno per sei giorni",
            )
        ],
        patient_message=(
            "Buongiorno [NOME_1], prenda l'antibiotico come indicato. Ci rivediamo tra una settimana."
        ),
    )


class ScriptedExtractor:
    """Stands in for the model: records what it was sent and replays a fixed note."""

    def __init__(self, note: Note):
        self.note = note
        self.received: list[str] = []

    def extract(self, transcript: str) -> Note:
        self.received.append(transcript)
        return self.note
