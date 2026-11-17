import { BRIEF_SECTIONS } from '../lib/types';
import type { BriefResult } from '../lib/types';

export function BriefTab({
  reason,
  setReason,
  brief,
  busy,
  canRun,
  onRun,
}: {
  reason: string;
  setReason: (v: string) => void;
  brief: BriefResult | null;
  busy: boolean;
  canRun: boolean;
  onRun: () => void;
}) {
  const unsupported = brief
    ? BRIEF_SECTIONS.flatMap(([key]) => brief.brief[key]).filter((i) => !i.supported).length
    : 0;
  return (
    <div>
      <div className="card">
        <label className="field">
          Motivo della visita di oggi
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button type="button" className="btn" style={{ marginTop: 12 }} onClick={onRun} disabled={!canRun || busy || !reason.trim()}>
          {busy ? 'Preparo la scheda…' : brief ? 'Aggiorna la scheda' : 'Prepara la scheda'}
        </button>
      </div>
      {brief && (
        <>
          <p role="status" className={`notice ${unsupported ? 'warn' : 'ok'}`}>
            {unsupported
              ? `${unsupported} punti senza citazione verificabile nella cartella: controllali.`
              : 'Ogni punto cita un record della cartella.'}
          </p>
          {BRIEF_SECTIONS.map(([key, label]) => (
            <div key={key} className="card">
              <h3>{label}</h3>
              {brief.brief[key].length === 0 && <p style={{ margin: 0, color: 'var(--mut)' }}>Nessun punto.</p>}
              {brief.brief[key].map((item, i) => (
                <div key={i} className="row">
                  <b>{item.record}</b>
                  <div>
                    {item.text}
                    <span className={`chip ${item.supported ? '' : 'w'}`}>
                      {item.supported ? 'citazione trovata' : 'da verificare'}
                    </span>
                    <div className="q">“{item.evidence}”</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
