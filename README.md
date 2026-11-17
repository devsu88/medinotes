# MediNotes

Turns the transcript of an Italian GP consultation into a structured note where **every statement
points to the sentence it came from**, and where **identifying data never reaches the model**.

> Demo project. It is **not a medical device**, it does not give diagnoses, and it must not be used
> with real patient data. The interface is in Italian because the consultations are.

**[Live demo](https://medinotes-taupe.vercel.app)**: paste your own OpenAI key (it is sent only with your request and never stored) and use fictitious data only.

## What it does

```text
transcript ─▶ pseudonymize (local, rules) ─▶ LLM, structured output ─▶ verify quotes ─▶ restore ─▶ note
                  │                                                         │
                  └─ the model only sees [NOME_1], [DATA_2], …              └─ unsupported items are flagged, not hidden
```

1. **Pseudonymization before the call.** Names, codice fiscale (with check-character validation),
   dates, phone numbers, emails and street addresses are replaced with tokens such as `[NOME_1]`.
   The same value always gets the same token, and the originals are put back in the output.
2. **Typed extraction.** The model fills a Pydantic schema: reason, S/O/A/P sections, medications
   and a plain-language message for the patient. Each statement carries a verbatim quote.
3. **Deterministic grounding checks.** Each quote must literally occur in the transcript the model
   saw. A medication dose must only contain numbers that appear in the transcript. Anything that
   fails is flagged for the doctor instead of silently dropped.
4. **Doctor review before export.** Every flagged item must be confirmed, edited or removed before
   the chart note can be copied or downloaded; editing counts as confirmation. The doctor can also
   add entries by hand. The chart note (Markdown) contains the reviewed text only, not the quotes.
5. **Documents from the reviewed note.** The same reviewed data produces a chart note, a medication
   list to copy into the practice software, and a referral letter (specialist and clinical question
   are editable; the question is pre-filled from plan items that ask for a visit or tests). They are
   templates over the doctor's own text, with no second model call, and each one states that it is a
   draft.
6. **Transparency.** The UI shows the exact text that was sent to the provider and how many values
   were replaced per kind.
7. **Stateless.** No database, no accounts, nothing logged or stored. The visitor's own API key
   travels in a request header and is used for that single call.

## Run it

```bash
uv sync
cd web && npm install && npm run build && cd ..
STATIC_DIR=web/out uv run uvicorn medinotes.app:app --port 8000
```

Open `http://localhost:8000`, paste an OpenAI API key and load
the sample visit. Set `LLM_MODEL` on the server to change the model (default `gpt-6-luna`).
`OPENAI_API_KEY` is only a convenience for local development: a public deployment should not set it.

On Vercel (what the live demo runs): static UI from `web/out` plus `api/index.py` as a Python function, see `vercel.json`.

With Docker: `docker build -t medinotes . && docker run -p 8000:8000 medinotes`.

## Tests and evaluation

```bash
uv run pytest        # no network, the model is replaced by a scripted fake
(cd web && npm test) # review and export logic
uv run ruff check .
```

- **PII-leak test (deterministic).** For five synthetic consultations, every identifier listed in
  `eval/cases.json` must be absent from the text handed to the model. A second test captures the
  prompt that the pipeline would send and checks the same thing end to end.
- **Grounding tests.** Invented quotes, wrong doses and missing doses are each covered.
- **Extraction quality.** `uv run --env-file .env python -m medinotes.evaluate` runs the five
  synthetic visits through a real model and reports medication precision/recall/F1, key-fact
  recall per section, the share of flagged statements and the number of leaked identifiers.

  Result with `gpt-6-luna` on the 5 synthetic visits:

  | Metric | Result |
  |---|---|
  | Medication precision / recall / F1 | 1.00 / 1.00 / 1.00 (5 medications) |
  | Key-fact recall | 0.97 |
  | Statements flagged as unsupported | 0 of 47 |
  | Identifiers leaked to the model | 0 |

  One run, five short visits: it shows the pipeline works, not how it behaves on real consultations.

The consultations are written by hand, fictitious, and use made-up identifiers. Five is a smoke
test, not a benchmark.

## Limitations

- Pseudonymization is rule-based. It misses names that appear with no title and are not typed in
  the form, cities and workplaces, unusual date formats and free-text identifiers. It reduces what
  leaves the machine; it does not anonymize.
- Dates are replaced, so the model cannot do date arithmetic on them.
- The quote check proves a statement is *quoted from* the transcript, not that the model
  *interpreted* it correctly. A real quote can still support a wrong conclusion.
- The exported note is a draft to paste into the practice software. It is not a signed medical record.
- Italian only, general-practice style consultations only, text input only (no audio yet).
- The evaluation set is small and synthetic.

## Layout

```text
src/medinotes/   pseudonymize · schema · verify · llm · pipeline · app · evaluate
eval/cases.json  five fictitious consultations with gold labels
web/             Next.js static export (Italian UI)
tests/           pseudonymization, grounding, pipeline, API, evaluation
```
