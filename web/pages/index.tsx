import Head from 'next/head';
import { useEffect, useState } from 'react';
import { BriefView } from '../components/BriefView';
import { NoteReview } from '../components/NoteReview';
import { PatientPicker } from '../components/PatientPicker';
import { field, linkButton, primaryButton } from '../components/styles';
import { SAMPLES } from '../lib/samples';
import type { BriefResult, Patient, Result } from '../lib/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? res.statusText);
  }
  return res.json();
}

const post = (apiKey: string, body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-LLM-Key': apiKey },
  body: JSON.stringify(body),
});

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">
        <span className="mr-2 rounded-full bg-blue-600 px-2.5 py-0.5 text-sm text-white">{n}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [doctor, setDoctor] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [brief, setBrief] = useState<BriefResult | null>(null);
  const [transcript, setTranscript] = useState('');
  const [note, setNote] = useState<{ key: number; result: Result } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'brief' | 'note' | null>(null);

  useEffect(() => {
    call<Patient[]>('/api/patients')
      .then(setPatients)
      .catch(() => setError('Impossibile caricare i pazienti di esempio.'));
  }, []);

  const patient = patients.find((p) => p.id === selectedId) ?? null;

  function select(id: string) {
    setSelectedId(id);
    setBrief(null);
    setNote(null);
    setTranscript('');
    setError('');
  }

  async function run<T>(kind: 'brief' | 'note', work: () => Promise<T>): Promise<T | null> {
    setBusy(kind);
    setError('');
    try {
      return await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function makeBrief() {
    setBrief(null);
    const result = await run('brief', () =>
      call<BriefResult>('/api/brief', post(apiKey, { patient_id: patient!.id, reason })),
    );
    if (result) setBrief(result);
  }

  async function makeNote() {
    setNote(null);
    const result = await run('note', () =>
      call<Result>(
        '/api/notes',
        post(apiKey, { transcript, patient_name: patient!.name, doctor_name: doctor }),
      ),
    );
    if (result) setNote((n) => ({ key: (n?.key ?? 0) + 1, result }));
  }

  const hasKey = apiKey.trim().length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Head>
        <title>MediNotes</title>
      </Head>
      <h1 className="text-3xl font-bold">MediNotes</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        Dalla cartella del paziente alla nota di visita: una scheda prima dell&apos;appuntamento, la nota
        dalla trascrizione, e i documenti pronti da rivedere. Ogni affermazione rimanda alla frase da cui
        nasce.
      </p>
      <p
        role="note"
        className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
      >
        Demo dimostrativa: <strong>non è un dispositivo medico</strong> e non sostituisce il giudizio del
        medico. I pazienti sono fittizi: usa solo dati fittizi anche nelle trascrizioni. Nomi, codici
        fiscali, date, indirizzi e telefoni vengono sostituiti sul server prima della chiamata al modello,
        ma il filtro è basato su regole e non garantisce l&apos;anonimato.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <label className="block text-sm md:col-span-2">
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
          Nome del medico (opzionale)
          <input className={field} value={doctor} onChange={(e) => setDoctor(e.target.value)} />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <Step n={1} title="Scegli il paziente">
        <PatientPicker patients={patients} selected={selectedId} onSelect={select} />
      </Step>

      {patient && (
        <Step n={2} title="Scheda prima della visita">
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Cartella di {patient.name} ({patient.entries.length} record)
            </summary>
            <ul className="mt-2 space-y-2 text-sm">
              {patient.entries.map((e) => (
                <li key={e.id}>
                  <strong>{e.id}</strong> · {new Date(e.date).toLocaleDateString('it-IT')} · {e.type}
                  <br />
                  {e.text}
                </li>
              ))}
            </ul>
          </details>
          <label className="mt-4 block text-sm">
            Motivo della visita di oggi
            <input
              className={field}
              value={reason}
              placeholder="es. tosse e febbre da tre giorni"
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={makeBrief}
            disabled={busy !== null || !hasKey || !reason.trim()}
            className={`${primaryButton} mt-3`}
          >
            {busy === 'brief' ? 'Preparo la scheda…' : 'Prepara la scheda'}
          </button>
          {brief && <BriefView result={brief} />}
        </Step>
      )}

      {patient && (
        <Step n={3} title="Visita">
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="transcript">Trascrizione della visita</label>
            {SAMPLES[patient.id] && (
              <button type="button" className={linkButton} onClick={() => setTranscript(SAMPLES[patient.id])}>
                Carica una visita di esempio
              </button>
            )}
          </div>
          <textarea
            id="transcript"
            className={`${field} mt-1 h-56 font-mono`}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
          <button
            type="button"
            onClick={makeNote}
            disabled={busy !== null || !hasKey || !transcript.trim()}
            className={`${primaryButton} mt-3`}
          >
            {busy === 'note' ? 'Elaborazione…' : 'Genera la nota'}
          </button>
        </Step>
      )}

      {patient && note && (
        <Step n={4} title="Nota, revisione e documenti">
          <NoteReview key={note.key} result={note.result} patient={patient.name} doctor={doctor} />
        </Step>
      )}
    </main>
  );
}
