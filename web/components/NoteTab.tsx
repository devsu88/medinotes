import { useState } from 'react';
import { exportNote, newItem, newMedication, pendingCount } from '../lib/review';
import type { ExportMeta, Item, MedItem, Review } from '../lib/review';
import { SECTIONS } from '../lib/types';
import type { Result, SectionKey } from '../lib/types';

function Status({ item }: { item: Item }) {
  if (item.manual) return <span className="chip m">aggiunto da te</span>;
  const resolved = !item.flagged || item.confirmed;
  return (
    <span className={`chip ${resolved ? '' : 'w'}`}>
      {!item.flagged ? 'citazione trovata' : item.confirmed ? 'rivisto' : 'da verificare'}
    </span>
  );
}

function Actions({ item, onConfirm, onRemove }: { item: Item; onConfirm: () => void; onRemove: () => void }) {
  return (
    <span style={{ marginLeft: 10, display: 'inline-flex', gap: 10 }}>
      {item.flagged && !item.confirmed && (
        <button type="button" className="link" onClick={onConfirm}>
          Conferma
        </button>
      )}
      <button type="button" className="link quiet" onClick={onRemove}>
        Rimuovi
      </button>
    </span>
  );
}

export function NoteTab({
  review,
  setReview,
  result,
  meta,
}: {
  review: Review;
  setReview: (update: (r: Review) => Review) => void;
  result: Result;
  meta: () => ExportMeta;
}) {
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

  const addItem = (key: SectionKey) =>
    setReview((r) => ({ ...r, sections: { ...r.sections, [key]: [...r.sections[key], newItem()] } }));

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
    <div>
      <p role="status" className={`notice ${pending > 0 ? 'warn' : 'ok'}`}>
        {pending > 0
          ? `${pending} ${pending === 1 ? 'elemento segnalato' : 'elementi segnalati'} da rivedere prima di esportare: confermalo, modificalo o rimuovilo.`
          : 'Nessun elemento in sospeso: la nota si può esportare.'}
      </p>

      <div className="card">
        <h3>Nota di visita</h3>
        {SECTIONS.map(([key, label]) => (
          <div key={key} className="row">
            <b>{label}</b>
            <div>
              {review.sections[key]
                .filter((i) => !i.removed)
                .map((item) => (
                  <div key={item.id} style={{ marginBottom: 10 }}>
                    <textarea
                      aria-label={`${label}: testo`}
                      className="edit"
                      rows={Math.max(1, Math.ceil(item.text.length / 80))}
                      value={item.text}
                      onChange={(e) => edit(item.id, { text: e.target.value })}
                    />
                    <Status item={item} />
                    <Actions
                      item={item}
                      onConfirm={() => updateItem(item.id, { confirmed: true })}
                      onRemove={() => updateItem(item.id, { removed: true })}
                    />
                    {item.evidence && <div className="q">“{item.evidence}”</div>}
                  </div>
                ))}
              <button type="button" className="link" onClick={() => addItem(key)}>
                + Aggiungi una voce
              </button>
            </div>
          </div>
        ))}
        <div className="row">
          <b>Farmaci</b>
          <div>
            {review.medications
              .filter((m) => !m.removed)
              .map((med) => (
                <div key={med.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <input aria-label="Farmaco" className="input" value={med.name} onChange={(e) => edit(med.id, { name: e.target.value })} />
                    <input aria-label="Dose" className="input" value={med.dose} onChange={(e) => edit(med.id, { dose: e.target.value })} />
                    <input
                      aria-label="Durata o modo d'uso"
                      className="input"
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
                    <div style={{ color: 'var(--warn)', fontSize: 13 }}>
                      La dose o il farmaco non compaiono nella trascrizione: controllali.
                    </div>
                  )}
                  {med.evidence && <div className="q">“{med.evidence}”</div>}
                </div>
              ))}
            <button
              type="button"
              className="link"
              onClick={() => setReview((r) => ({ ...r, medications: [...r.medications, newMedication()] }))}
            >
              + Aggiungi un farmaco
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={copyNote} disabled={pending > 0}>
          {copied ? 'Copiata' : 'Copia la nota'}
        </button>
        <button type="button" className="btn o" onClick={downloadNote} disabled={pending > 0}>
          Scarica (.md)
        </button>
      </div>

      <details className="card" style={{ marginTop: 18 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Cosa ha visto il modello</summary>
        <p style={{ color: 'var(--mut)', fontSize: 13 }}>
          Questo è il testo inviato al provider: i dati identificativi sono già sostituiti. Sostituzioni:{' '}
          {redactions || 'nessuna'}.
        </p>
        <pre className="mono" style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>
          {result.sent_to_model}
        </pre>
      </details>
    </div>
  );
}
