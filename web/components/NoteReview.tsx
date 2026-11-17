import { useState } from 'react';
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
import type { ExportMeta, Item, MedItem, Review } from '../lib/review';
import { SECTIONS } from '../lib/types';
import type { Result, SectionKey } from '../lib/types';
import { field, linkButton, quote } from './styles';

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

function Actions({ item, onConfirm, onRemove }: { item: Item; onConfirm: () => void; onRemove: () => void }) {
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

/** Review of one generated note, and the documents built from it. Mount with a new key per note. */
export function NoteReview({ result, patient, doctor }: { result: Result; patient: string; doctor: string }) {
  const [review, setReview] = useState<Review>(() => startReview(result.note));
  const [specialist, setSpecialist] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function updateItem(id: string, patch: Partial<MedItem>) {
    setReview((r) => {
      const apply = <T extends Item>(items: T[]): T[] => items.map((i) => (i.id === id ? { ...i, ...patch } : i));
      const sections = { ...r.sections };
      for (const [key] of SECTIONS) sections[key] = apply(sections[key]);
      return { ...r, sections, medications: apply(r.medications) };
    });
  }

  // Editing counts as the doctor's confirmation: the text is now theirs.
  const edit = (id: string, patch: Partial<MedItem>) => updateItem(id, { ...patch, confirmed: true });

  function addItem(key: SectionKey) {
    setReview((r) => ({ ...r, sections: { ...r.sections, [key]: [...r.sections[key], newItem()] } }));
  }

  const meta = (): ExportMeta => ({ patient, doctor, date: new Date().toLocaleDateString('it-IT') });

  async function copyNote() {
    await navigator.clipboard.writeText(exportNote(review, meta()));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadNote() {
    const url = URL.createObjectURL(new Blob([exportNote(review, meta())], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nota-di-visita.md';
    link.click();
    URL.revokeObjectURL(url);
  }

  const pending = pendingCount(review);
  const redactions = Object.entries(result.redactions)
    .map(([kind, n]) => `${kind} ${n}`)
    .join(' · ');

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="text-lg font-semibold">Nota di visita</h3>
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
            <h4 className="font-semibold">{label}</h4>
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
          <h4 className="font-semibold">Farmaci</h4>
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
            onClick={() => setReview((r) => ({ ...r, medications: [...r.medications, newMedication()] }))}
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
              <input className={field} value={specialist} onChange={(e) => setSpecialist(e.target.value)} />
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
                exportReferral(review, meta(), { specialist, question: question ?? suggestQuestion(review) })
              }
            />
          </details>
        </div>

        <div className="mt-6">
          <h4 className="font-semibold">Messaggio al paziente (bozza)</h4>
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
        <h3 className="text-lg font-semibold">Cosa ha visto il modello</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Questo è il testo inviato al provider: i dati identificativi sono già sostituiti.
        </p>
        <p className="mt-2 text-sm">Sostituzioni: {redactions || 'nessuna'}</p>
        <pre className="mt-2 whitespace-pre-wrap rounded border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-900">
          {result.sent_to_model}
        </pre>
      </aside>
    </section>
  );
}
