import type { Patient } from '../lib/types';

const year = new Date().getFullYear();

export function PatientPicker({
  patients,
  selected,
  onSelect,
}: {
  patients: Patient[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      {patients.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onSelect(p.id)}
            aria-pressed={selected === p.id}
            className={`w-full rounded border p-3 text-left ${
              selected === p.id
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
            }`}
          >
            <span className="block font-semibold">{p.name}</span>
            <span className="block text-sm text-slate-500">
              {year - p.birth_year} anni · {p.sex === 'F' ? 'donna' : 'uomo'}
            </span>
            <span className="mt-1 block text-sm">{p.problems.join(', ')}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
