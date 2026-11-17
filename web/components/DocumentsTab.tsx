import { useState } from 'react';
import { exportPrescriptionDraft, exportReferral, suggestQuestion } from '../lib/review';
import type { ExportMeta, Review } from '../lib/review';

/** A generated document with a copy button. Shows the reason instead when it cannot be built yet. */
function Document({ title, build, children }: { title: string; build: () => string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  let text = '';
  let problem = '';
  try {
    text = build();
  } catch (e) {
    problem = e instanceof Error ? e.message : 'Documento non disponibile';
  }
  return (
    <div className="card">
      <h3>{title}</h3>
      {children}
      {problem ? (
        <p className="notice warn" style={{ margin: '10px 0 0' }}>
          {problem}
        </p>
      ) : (
        <>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, margin: '10px 0' }}>
            {text}
          </pre>
          <button
            type="button"
            className="btn o"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? 'Copiato' : 'Copia'}
          </button>
        </>
      )}
    </div>
  );
}

export function DocumentsTab({
  review,
  setReview,
  meta,
}: {
  review: Review;
  setReview: (update: (r: Review) => Review) => void;
  meta: () => ExportMeta;
}) {
  const [specialist, setSpecialist] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const q = question ?? suggestQuestion(review);

  return (
    <div>
      <Document title="Bozza di prescrizione" build={() => exportPrescriptionDraft(review, meta())} />
      <Document title="Lettera di invio allo specialista" build={() => exportReferral(review, meta(), { specialist, question: q })}>
        <label className="field">
          Specialista (es. cardiologo)
          <input className="input" value={specialist} onChange={(e) => setSpecialist(e.target.value)} />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          Quesito clinico
          <textarea className="input" rows={3} value={q} onChange={(e) => setQuestion(e.target.value)} />
        </label>
      </Document>
      <div className="card">
        <h3>Messaggio al paziente (bozza)</h3>
        <textarea
          aria-label="Messaggio al paziente"
          className="input"
          rows={4}
          value={review.message}
          onChange={(e) => setReview((r) => ({ ...r, message: e.target.value }))}
        />
      </div>
    </div>
  );
}
