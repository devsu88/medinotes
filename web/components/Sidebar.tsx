import { initials } from '../lib/age';
import type { Patient } from '../lib/types';

export function Sidebar({
  patients,
  selected,
  done,
  onSelect,
}: {
  patients: Patient[];
  selected: string | null;
  done: Set<string>;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="sidebar" aria-label="Pazienti di oggi">
      <h6>Oggi · {patients.length} pazienti</h6>
      {patients.map((p) => (
        <button
          key={p.id}
          type="button"
          className="pt"
          aria-current={selected === p.id}
          onClick={() => onSelect(p.id)}
        >
          <span className="av">{initials(p.name)}</span>
          <div>
            <b>{p.name}</b>
            <small className={done.has(p.id) ? 'done' : undefined}>
              {p.appointment_time} · {done.has(p.id) ? 'Nota pronta' : p.appointment_reason}
            </small>
          </div>
        </button>
      ))}
    </nav>
  );
}
