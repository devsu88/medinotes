import { ageLabel } from '../lib/age';
import type { BriefResult, Patient } from '../lib/types';

export function ContextPanel({ patient, brief }: { patient: Patient; brief: BriefResult | null }) {
  const toCheck = brief?.brief.to_check ?? [];
  return (
    <aside className="ctx" aria-label="Contesto del paziente">
      {patient.alerts.map((a) => (
        <div key={a} className="alert">
          ⚠ {a}
        </div>
      ))}
      <h4>Da ricordare oggi</h4>
      {toCheck.length ? (
        <ul style={{ margin: '0 8px 14px', paddingLeft: 16, fontSize: 13 }}>
          {toCheck.map((i, n) => (
            <li key={n}>{i.text}</li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: '0 8px 14px', color: 'var(--mut)', fontSize: 13 }}>
          Prepara la scheda per vedere cosa chiedere o controllare in questa visita.
        </p>
      )}
      <h4>Cartella</h4>
      <div className="tl" style={{ marginLeft: 14 }}>
        {[...patient.entries].reverse().map((e) => (
          <div key={e.id}>
            {e.text}
            <small>
              {ageLabel(e.date)} · {e.type} · {e.id}
            </small>
          </div>
        ))}
      </div>
    </aside>
  );
}
