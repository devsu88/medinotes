import Head from 'next/head';
import { useState } from 'react';
import { SAMPLE } from '../lib/sample';
import { SECTIONS, unsupportedCount } from '../lib/types';
import type { Fact, Medication, Result } from '../lib/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

const quote = 'mt-1 border-l-2 border-slate-300 pl-2 text-sm text-slate-500 dark:border-slate-600';
const field =
  'w-full rounded border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-900';

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${
        ok
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
          : 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
      }`}
    >
      {ok ? 'citazione trovata' : 'da verificare'}
    </span>
  );
}

function FactItem({ fact }: { fact: Fact }) {
  return (
    <li className="mb-2">
      {fact.text}
      <Badge ok={fact.supported} />
      <blockquote className={quote}>“{fact.evidence}”</blockquote>
    </li>
  );
}

function MedicationItem({ med }: { med: Medication }) {
  return (
    <li className="mb-2">
      <strong>{med.name}</strong>
      {med.dose ? ` · ${med.dose}` : ''}
      {med.instructions ? ` · ${med.instructions}` : ''}
      <Badge ok={med.supported && med.dose_supported} />
      {!med.dose_supported && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          La dose non compare nella trascrizione: controllala prima di usarla.
        </p>
      )}
      <blockquote className={quote}>“{med.evidence}”</blockquote>
    </li>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [patient, setPatient] = useState('');
  const [doctor, setDoctor] = useState('');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setError('');
    setResult(null);
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
      setResult(await res.json());
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

  const flagged = result ? unsupportedCount(result.note) : 0;
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
        Dalla trascrizione di una visita di medicina generale a una nota strutturata, dove ogni
        affermazione rimanda alla frase da cui nasce.
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
          Chiave API (compatibile OpenAI; resta nella memoria del browser e non viene salvata)
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
          <button
            type="button"
            onClick={loadSample}
            className="text-sm text-blue-700 underline dark:text-blue-300"
          >
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

      {result && (
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">Nota di visita</h2>
            <p
              role="status"
              className={`mt-2 rounded p-2 text-sm ${
                flagged > 0
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
                  : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
              }`}
            >
              {flagged > 0
                ? `${flagged} elementi senza riscontro nella trascrizione: controllali prima di usare la nota.`
                : 'Tutte le citazioni sono presenti nella trascrizione.'}
            </p>
            {SECTIONS.map(([key, label]) => (
              <div key={key} className="mt-4">
                <h3 className="font-semibold">{label}</h3>
                {result.note[key].length === 0 ? (
                  <p className="text-sm text-slate-500">Nessun elemento.</p>
                ) : (
                  <ul className="mt-1 list-disc pl-5">
                    {result.note[key].map((f, i) => (
                      <FactItem key={i} fact={f} />
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <div className="mt-4">
              <h3 className="font-semibold">Farmaci</h3>
              {result.note.medications.length === 0 ? (
                <p className="text-sm text-slate-500">Nessun farmaco.</p>
              ) : (
                <ul className="mt-1 list-disc pl-5">
                  {result.note.medications.map((m, i) => (
                    <MedicationItem key={i} med={m} />
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-4">
              <h3 className="font-semibold">Messaggio al paziente (bozza)</h3>
              <p className="mt-1 whitespace-pre-wrap rounded border border-slate-300 p-3 dark:border-slate-600">
                {result.note.patient_message}
              </p>
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
