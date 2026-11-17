import pytest

from medinotes.pseudonymize import cf_check_char, is_valid_codice_fiscale, pseudonymize

from .conftest import CF, PII, TRANSCRIPT


def test_codice_fiscale_check_character():
    assert is_valid_codice_fiscale(CF)
    assert not is_valid_codice_fiscale(CF[:-1] + ("A" if CF[-1] != "A" else "B"))
    # Published example: RSSMRA85T10A562S
    assert cf_check_char("RSSMRA85T10A562") == "S"


def test_invalid_codice_fiscale_is_left_alone():
    fake = "RSSMRA85T10A562" + ("A" if CF[-1] != "A" else "B")
    assert fake in pseudonymize(f"codice {fake}").text


@pytest.mark.parametrize(
    "text, kind",
    [
        ("scrivere a m.rossi@example.it", "EMAIL"),
        ("chiami il 333 1234567", "TEL"),
        ("telefono fisso 06 1234567", "TEL"),
        ("nato il 10/12/1985", "DATA"),
        ("visita del 3 marzo 2026", "DATA"),
        ("abita in via Giuseppe Garibaldi 12", "INDIRIZZO"),
        ("ha parlato con la dott.ssa Bianchi", "NOME"),
        ("il signor Giovanni De Luca", "NOME"),
    ],
)
def test_each_identifier_kind_is_replaced(text, kind):
    result = pseudonymize(text)
    assert f"[{kind}_1]" in result.text
    assert result.counts() == {kind: 1}


def test_clinical_text_is_not_touched():
    text = "Prendi 500 mg per via orale. Pressione 130/80, glicemia 105. Controllo tra 2 settimane."
    assert pseudonymize(text).text == text


def test_known_names_are_replaced_without_a_title_and_case_insensitively():
    result = pseudonymize("Mario ha detto che ROSSI sta meglio. Rossi conferma.", ["Mario Rossi"])
    assert "mario" not in result.text.lower() and "rossi" not in result.text.lower()
    assert result.counts() == {"NOME": 2}  # one token per distinct word


def test_same_value_gets_the_same_token_and_restore_is_exact():
    text = "Paziente Mario Rossi. Il signor Mario Rossi tossisce."
    result = pseudonymize(text, ["Mario Rossi"])
    assert result.text.count("[NOME_1]") == 2
    assert result.restore(result.text) == text


def test_transcript_round_trip_and_no_pii_left():
    result = pseudonymize(TRANSCRIPT, ["Mario Rossi"])
    for value in PII:
        assert value not in result.text
    assert result.restore(result.text) == TRANSCRIPT


def test_counts_never_expose_values():
    counts = pseudonymize(TRANSCRIPT, ["Mario Rossi"]).counts()
    assert all(isinstance(v, int) for v in counts.values())
    assert set(counts) >= {"CF", "DATA", "TEL", "INDIRIZZO", "NOME"}
