"""Local pseudonymization of Italian clinical text.

Direct identifiers are replaced by tokens such as ``[PAZIENTE_1]`` *before* the text leaves the
machine, and put back into the model output afterwards. Everything here is rule-based and runs
locally. It is a best-effort filter, not an anonymization guarantee: see the README limitations.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Odd-position values of the codice fiscale check character algorithm.
_ODD_VALUES = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23]
_ODD = {
    **dict(zip("0123456789", _ODD_VALUES[:10], strict=True)),
    **dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ", _ODD_VALUES, strict=True)),
}


def cf_check_char(first15: str) -> str:
    """Control character of a codice fiscale (the 16th) computed from the first 15."""
    total = 0
    for i, ch in enumerate(first15.upper()):
        if i % 2 == 0:
            total += _ODD[ch]
        else:
            total += int(ch) if ch.isdigit() else ord(ch) - ord("A")
    return chr(ord("A") + total % 26)


def is_valid_codice_fiscale(value: str) -> bool:
    value = value.upper()
    return len(value) == 16 and value[15] == cf_check_char(value[:15])


_MONTHS = "gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre"
_NAME = r"[A-ZÀ-Ý][a-zà-ÿ'’]+(?:[ -][A-ZÀ-Ý][a-zà-ÿ'’]+){0,2}"

# (kind, compiled pattern). Earlier entries win when two matches overlap.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("EMAIL", re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")),
    ("CF", re.compile(r"\b[A-Za-z]{6}\d{2}[A-Za-z]\d{2}[A-Za-z]\d{3}[A-Za-z]\b")),
    ("TEL", re.compile(r"(?<![\w/])(?:\+39[ .]?)?(?:3\d{2}[ .]?\d{6,7}|0\d{1,3}[ ./-]?\d{5,8})(?![\w/])")),
    (
        "INDIRIZZO",
        re.compile(
            r"\b(?i:via|viale|piazza|piazzale|corso|largo|vicolo|strada|contrada)\s+"
            r"(?:[A-ZÀ-Ý][\w'’.-]*\s+){0,3}[A-ZÀ-Ý][\w'’.-]*(?:\s*,?\s*(?i:n\.?\s*)?\d+[A-Za-z]?)?",
        ),
    ),
    (
        "DATA",
        re.compile(
            rf"\b\d{{1,2}}[/.-]\d{{1,2}}[/.-](?:\d{{4}}|\d{{2}})\b|\b\d{{1,2}}(?:º|°)?\s+(?:{_MONTHS})(?:\s+\d{{4}})?\b",
            re.IGNORECASE,
        ),
    ),
    # A title ("signor", "dott.ssa", …) followed by capitalised words is a person's name.
    (
        "NOME",
        re.compile(
            r"\b(?i:sig(?:\.ra|\.na)?|signor[ae]?|signorina|dott(?:\.ssa)?|dottor(?:essa)?|dr(?:\.ssa)?"
            rf"|prof(?:\.ssa)?)\.?\s+(?P<name>{_NAME})",
        ),
    ),
]

_TOKEN = re.compile(r"\[([A-Z]+)_(\d+)\]")


@dataclass
class Pseudonymized:
    text: str
    mapping: dict[str, str] = field(default_factory=dict)  # token -> original

    def restore(self, text: str) -> str:
        """Put the original values back wherever a token appears."""
        return _TOKEN.sub(lambda m: self.mapping.get(m.group(0), m.group(0)), text)

    def counts(self) -> dict[str, int]:
        """How many distinct values were replaced, per kind. Never exposes the values themselves."""
        out: dict[str, int] = {}
        for token in self.mapping:
            kind = _TOKEN.fullmatch(token).group(1)  # type: ignore[union-attr]
            out[kind] = out.get(kind, 0) + 1
        return out


def _known_name_pattern(names: list[str]) -> re.Pattern[str] | None:
    """Each full name typed by the user, then each of its words (>= 3 letters), as whole words."""
    full = [re.sub(r"\s+", " ", n.strip()) for n in names if n.strip()]
    parts = {p for name in full for p in name.split() if len(p) >= 3}
    candidates = sorted({*full, *parts}, key=len, reverse=True)
    if not candidates:
        return None
    alternatives = "|".join(re.escape(c).replace(r"\ ", r"\s+") for c in candidates)
    return re.compile(rf"(?<![\w])(?:{alternatives})(?![\w])", re.IGNORECASE)


def pseudonymize(text: str, known_names: list[str] | None = None) -> Pseudonymized:
    """Replace identifiers in ``text``.

    ``known_names`` are names the user already typed in the form (patient, doctor): every word of
    them is replaced wherever it appears, with or without a title in front.
    """
    spans: list[tuple[int, int, str]] = []

    def taken(start: int, end: int) -> bool:
        return any(start < e and s < end for s, e, _ in spans)

    named = _known_name_pattern(known_names or [])
    # Names the user typed go first, so "Mario Rossi" gets one token whether or not a title precedes it.
    passes = ([("NOME", named)] if named is not None else []) + _PATTERNS

    for kind, pattern in passes:
        for m in pattern.finditer(text):
            if kind == "CF" and not is_valid_codice_fiscale(m.group(0)):
                continue
            start, end = m.span("name") if "name" in pattern.groupindex else m.span()
            if not taken(start, end):
                spans.append((start, end, kind))
    spans.sort()

    mapping: dict[str, str] = {}
    token_for: dict[tuple[str, str], str] = {}
    counters: dict[str, int] = {}
    out: list[str] = []
    cursor = 0
    for start, end, kind in spans:
        original = text[start:end]
        key = (kind, re.sub(r"\s+", " ", original.casefold()))
        if key not in token_for:
            counters[kind] = counters.get(kind, 0) + 1
            token_for[key] = f"[{kind}_{counters[kind]}]"
            mapping[token_for[key]] = original
        out.append(text[cursor:start])
        out.append(token_for[key])
        cursor = end
    out.append(text[cursor:])
    return Pseudonymized("".join(out), mapping)
