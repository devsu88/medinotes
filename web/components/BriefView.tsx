import { BRIEF_SECTIONS } from '../lib/types';
import type { BriefResult } from '../lib/types';

export function BriefView({ result }: { result: BriefResult }) {
  const unsupported = BRIEF_SECTIONS.flatMap(([key]) => result.brief[key]).filter((i) => !i.supported).length;
  return (
    <div className="mt-4">
      <p
        role="status"
        className={`rounded p-2 text-sm ${
          unsupported
            ? 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
            : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
        }`}
      >
        {unsupported
          ? `${unsupported} punti senza citazione verificabile nella cartella: controllali.`
          : 'Ogni punto cita un record della cartella.'}
      </p>
      {BRIEF_SECTIONS.map(([key, label]) => (
        <div key={key} className="mt-4">
          <h3 className="font-semibold">{label}</h3>
          {result.brief[key].length === 0 ? (
            <p className="text-sm text-slate-500">Nessun punto.</p>
          ) : (
            <ul className="mt-1 list-disc space-y-2 pl-5">
              {result.brief[key].map((item, i) => (
                <li key={i}>
                  {item.text}
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${
                      item.supported
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
                    }`}
                  >
                    {item.supported ? `record ${item.record}` : 'da verificare'}
                  </span>
                  <blockquote className="mt-1 border-l-2 border-slate-300 pl-2 text-sm text-slate-500 dark:border-slate-600">
                    “{item.evidence}”
                  </blockquote>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
