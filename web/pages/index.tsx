import Head from 'next/head';
import { useState } from 'react';
import { SAMPLE } from '../lib/sample';
import {
  exportNote,
  exportPrescriptionDraft,
  exportReferral,
  newItem,
  newMedication,
  pendingCount,
  startReview,
  suggestQuestion,
} from '../lib/review';
import type { Item, MedItem, Review } from '../lib/review';
import { SECTIONS } from '../lib/types';
import type { Result, SectionKey } from '../lib/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

const quote = 'mt-1 border-l-2 border-slate-300 pl-2 text-sm text-slate-500 dark:border-slate-600';
const field =
  'w-full rounded border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-900';
const linkButton = 'text-sm text-blue-700 underline dark:text-blue-300';

function Status({ item }: { item: Item }) {
  if (item.manual) return <span className="ml-2 text-xs text-slate-500">aggiunto da te</span>;
  const resolved = !item.flagged || item.confirmed;
  return (
    <span
      className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${
        resolved
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
          : 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
      }`}
    >
      {!item.flagged ? 'citazione trovata' : item.confirmed ? 'rivisto' : 'da verificare'}
    </span>
  );
}

function Actions({
  item,
  onConfirm,
  onRemove,
}: {
  item: Item;
  onConfirm: () => void;
  onRemove: () => void;
}) {
  return (
    <span className="ml-3 space-x-3">
      {item.flagged && !item.confirmed && (
        <button type="button" className={linkButton} onClick={onConfirm}>
          Conferma
        </button>
      )}
      <button type="button" className={linkButton} onClick={onRemove}>
        Rimuovi
      </button>
    </span>
  );
}

/** A generated document with a copy button. Shows the reason instead when it cannot be built yet. */
function Document({ build }: { build: () => string }) {
  const [copied, setCopied] = useState(false);
  let text = '';
  let problem = '';
  try {
    text = build();
  } catch (e) {
    problem = e instanceof Error ? e.message : 'Documento non disponibile';
  }
  if (problem) return <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{problem}</p>;
  return (
    <div className="mt-2">
      <pre className="whitespace-pre-wrap rounded border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-900">
        {text}
      </pre>
      <button
        type="button"
        className={`${linkButton} mt-1`}
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? 'Copiato' : 'Copia'}
      </button>
    </div>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [patient, setPatient] = useState('');
  const [doctor, setDoctor] = useState('');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [specialist, setSpecialist] = useState('');
  const [question, setQuestion] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError('');
    setResult(null);
    setReview(null);
    setQuestion(null);
    try {
      const res = await fetch(`${API}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LLM-Key': apiKey },
        body: JSON.stringify({ transcript, patient_name: patient, doctor_name: doctor }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail ?? res.statusText);
      }
      const data: Result = await res.json();
      setResult(data);
      setReview(startReview(data.note));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setBusy(false);
    }
  }

  function loadSample() {
    setPatient(SAMPLE.patient);
    setDoctor(SAMPLE.doctor);
    setTranscript(SAMPLE.transcript);
  }

  function updateItem(id: string, patch: Partial<MedItem>) {
    setReview((r) => {
      if (!r) return r;
      const apply = <T extends Item>(items: T[]): T[] => items.map((i) => (i.id === id ? { ...i, ...patch } : i));
      const sections = { ...r.sections };
      for (const [key] of SECTIONS) sections[key] = apply(sections[key]);
      return { ...r, sections, medications: apply(r.medications) };
    });
  }

  // Editing counts as the doctor's confirmation: the text is now theirs.
  const edit = (id: string, patch: Partial<MedItem>) => updateItem(id, { ...patch, confirmed: true });

  function addItem(key: SectionKey) {
    setReview((r) => r && { ...r, sections: { ...r.sections, [key]: [...r.sections[key], newItem()] } });
  }

  const meta = () => ({ patient, doctor, date: new Date().toLocaleDateString('it-IT') });
  const exportText = () => exportNote(review!, meta());

  async function copyNote() {
    await navigator.clipboard.writeText(exportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadNote() {
    const url = URL.createObjectURL(new Blob([exportText()], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nota-di-visita.md';
    link.click();
    URL.revokeObjectURL(url);
  }

  const pending = review ? pendingCount(review) : 0;
  const redactions = result
    ? Object.entries(result.redactions)
        .map(([kind, n]) => `${kind} ${n}`)
        .join(' · ')
    : '';

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Head>
        <title>MediNotes</title>
      </Head>
      <h1 className="text-3xl font-bold">MediNotes</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        Dalla trascrizione di una visita di medicina generale a una nota di cartella che puoi rivedere
        e copiare, dove ogni affermazione rimanda alla frase da cui nasce.
      </p>
      <p
        role="note"
        className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
      >
        Demo dimostrativa: <strong>non è un dispositivo medico</strong> e non sostituisce il giudizio
        del medico. Usa solo dati fittizi. Nomi, codici fiscali, date, indirizzi e telefoni vengono
        sostituiti sul server prima della chiamata al modello, ma il filtro è basato su regole e non
        garantisce l&apos;anonimato.
      </p>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <label className="block text-sm md:col-span-3">
          Chiave API OpenAI (resta nella memoria del browser e non viene salvata)
          <input
            type="password"
            autoComplete="off"
            className={field}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Nome del paziente
          <input className={field} value={patient} onChange={(e) => setPatient(e.target.value)} />
        </label>
        <label className="block text-sm">
          Nome del medico
          <input className={field} value={doctor} onChange={(e) => setDoctor(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="button" onClick={loadSample} className={linkButton}>
            Carica una visita di esempio
          </button>
        </div>
        <label className="block text-sm md:col-span-3">
          Trascrizione della visita
          <textarea
            className={`${field} h-56 font-mono`}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        </label>
      </section>

      <button
        type="button"
        onClick={generate}
        disabled={busy || !transcript.trim() || !apiKey.trim()}
        className="mt-4 rounded bg-blue-600 px-5 py-2 font-medium text-white disabled:opacity-50"
      >
        {busy ? 'Elaborazione…' : 'Genera la nota'}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {result && review && (
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">Nota di visita</h2>
            <p
              role="status"
              className={`mt-2 rounded p-2 text-sm ${
                pending > 0
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
                  : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
              }`}
            >
              {pending > 0
                ? `${pending} elementi segnalati da rivedere prima di esportare: confermali, modificali o rimuovili.`
                : 'Nessun elemento in sospeso: la nota si può esportare.'}
            </p>

            {SECTIONS.map(([key, label]) => (
              <div key={key} className="mt-4">
                <h3 className="font-semibold">{label}</h3>
                <ul className="mt-1 space-y-2">
                  {review.sections[key]
                    .filter((i) => !i.removed)
                    .map((item) => (
                      <li key={item.id}>
                        <textarea
                          aria-label={`${label}: testo`}
                          className={field}
                          rows={2}
                          value={item.text}
                          onChange={(e) => edit(item.id, { text: e.target.value })}
                        />
                        <Status item={item} />
                        <Actions
                          item={item}
                          onConfirm={() => updateItem(item.id, { confirmed: true })}
                          onRemove={() => updateItem(item.id, { removed: true })}
                        />
                        {item.evidence && <blockquote className={quote}>“{item.evidence}”</blockquote>}
                      </li>
                    ))}
                </ul>
                <button type="button" className={`${linkButton} mt-1`} onClick={() => addItem(key)}>
                  + Aggiungi una voce
                </button>
              </div>
            ))}

            <div className="mt-4">
              <h3 className="font-semibold">Farmaci</h3>
              <ul className="mt-1 space-y-2">
                {review.medications
                  .filter((m) => !m.removed)
                  .map((med) => (
                    <li key={med.id}>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          aria-label="Farmaco"
                          className={field}
                          value={med.name}
                          onChange={(e) => edit(med.id, { name: e.target.value })}
                        />
                        <input
                          aria-label="Dose"
                          className={field}
                          value={med.dose}
                          onChange={(e) => edit(med.id, { dose: e.target.value })}
                        />
                        <input
                          aria-label="Durata o modo d'uso"
                          className={field}
                          value={med.instructions}
                          onChange={(e) => edit(med.id, { instructions: e.target.value })}
                        />
                      </div>
                      <Status item={med} />
                      <Actions
                        item={med}
                        onConfirm={() => updateItem(med.id, { confirmed: true })}
                        onRemove={() => updateItem(med.id, { removed: true })}
                      />
                      {med.flagged && !med.confirmed && (
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          La dose o il farmaco non compaiono nella trascrizione: controllali.
                        </p>
                      )}
                      {med.evidence && <blockquote className={quote}>“{med.evidence}”</blockquote>}
                    </li>
                  ))}
              </ul>
              <button
                type="button"
                className={`${linkButton} mt-1`}
                onClick={() => setReview((r) => r && { ...r, medications: [...r.medications, newMedication()] })}
              >
                + Aggiungi un farmaco
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={copyNote}
                disabled={pending > 0}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {copied ? 'Copiata' : 'Copia la nota'}
              </button>
              <button
                type="button"
                onClick={downloadNote}
                disabled={pending > 0}
                className="rounded border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 disabled:opacity-50 dark:text-blue-300"
              >
                Scarica (.md)
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <details>
                <summary className="cursor-pointer font-semibold">Bozza di prescrizione</summary>
                <Document build={() => exportPrescriptionDraft(review, meta())} />
              </details>
              <details>
                <summary className="cursor-pointer font-semibold">Lettera di invio allo specialista</summary>
                <label className="mt-2 block text-sm">
                  Specialista (es. cardiologo)
                  <input
                    className={field}
                    value={specialist}
                    onChange={(e) => setSpecialist(e.target.value)}
                  />
                </label>
                <label className="mt-2 block text-sm">
                  Quesito clinico
                  <textarea
                    className={field}
                    rows={3}
                    value={question ?? suggestQuestion(review)}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                </label>
                <Document
                  build={() =>
                    exportReferral(review, meta(), {
                      specialist,
                      question: question ?? suggestQuestion(review),
                    })
                  }
                />
              </details>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold">Messaggio al paziente (bozza)</h3>
              <textarea
                aria-label="Messaggio al paziente"
                className={`${field} mt-1`}
                rows={4}
                value={review.message}
                onChange={(e) => setReview({ ...review, message: e.target.value })}
              />
            </div>
          </div>

          <aside>
            <h2 className="text-xl font-semibold">Cosa ha visto il modello</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Questo è il testo inviato al provider: i dati identificativi sono già sostituiti.
            </p>
            <p className="mt-2 text-sm">Sostituzioni: {redactions || 'nessuna'}</p>
            <pre className="mt-2 whitespace-pre-wrap rounded border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-900">
              {result.sent_to_model}
            </pre>
          </aside>
        </section>
      )}
    </main>
  );
}
