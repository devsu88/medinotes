import Head from 'next/head';
import { useEffect, useState } from 'react';
import { BriefTab } from '../components/BriefTab';
import { ContextPanel } from '../components/ContextPanel';
import { DocumentsTab } from '../components/DocumentsTab';
import { NoteTab } from '../components/NoteTab';
import { SettingsMenu } from '../components/SettingsMenu';
import { Sidebar } from '../components/Sidebar';
import { VisitTab } from '../components/VisitTab';
import { startReview } from '../lib/review';
import type { Review } from '../lib/review';
import { SAMPLES } from '../lib/samples';
import type { BriefResult, Patient, Result } from '../lib/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

type Tab = 'brief' | 'visit' | 'note' | 'docs';

const TABS: [Tab, string][] = [
  ['brief', 'Scheda'],
  ['visit', 'Visita'],
  ['note', 'Nota'],
  ['docs', 'Documenti'],
];

interface Session {
  tab: Tab;
  reason: string;
  brief: BriefResult | null;
  transcript: string;
  note: { result: Result; review: Review } | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? res.statusText);
  }
  return res.json();
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export default function Home() {
  const [doctor, setDoctor] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'brief' | 'note' | null>(null);

  useEffect(() => {
    call<Patient[]>('/api/patients')
      .then((list) => {
        setPatients(list);
        setSelectedId(list[0]?.id ?? null);
      })
      .catch(() => setError('Impossibile caricare i pazienti di esempio.'));
  }, []);

  const patient = patients.find((p) => p.id === selectedId) ?? null;
  const session: Session | null = patient
    ? (sessions[patient.id] ?? { tab: 'brief', reason: patient.appointment_reason, brief: null, transcript: '', note: null })
    : null;

  function patch(id: string, change: Partial<Session>) {
    setSessions((all) => {
      const p = patients.find((x) => x.id === id)!;
      const current = all[id] ?? { tab: 'brief', reason: p.appointment_reason, brief: null, transcript: '', note: null };
      return { ...all, [id]: { ...current, ...change } };
    });
  }

  function setReview(update: (r: Review) => Review) {
    if (!patient || !session?.note) return;
    patch(patient.id, { note: { ...session.note, review: update(session.note.review) } });
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
    if (!patient || !session) return;
    const result = await run('brief', () =>
      call<BriefResult>('/api/brief', post({ patient_id: patient.id, reason: session.reason })),
    );
    if (result) patch(patient.id, { brief: result });
  }

  async function makeNote() {
    if (!patient || !session) return;
    const result = await run('note', () =>
      call<Result>('/api/notes', post({ transcript: session.transcript, patient_name: patient.name, doctor_name: doctor })),
    );
    if (result) patch(patient.id, { note: { result, review: startReview(result.note) }, tab: 'note' });
  }

  const meta = () => ({ patient: patient?.name ?? '', doctor, date: new Date().toLocaleDateString('it-IT') });
  const done = new Set(Object.entries(sessions).filter(([, s]) => s.note).map(([id]) => id));

  return (
    <div className="app">
      <Head>
        <title>MediNotes</title>
      </Head>
      <header className="topbar">
        <span className="logo">
          MEDI<b>NOTES</b>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <small>Demo con pazienti fittizi</small>
          <SettingsMenu
            open={settingsOpen}
            onToggle={() => setSettingsOpen((o) => !o)}
            doctor={doctor}
            setDoctor={setDoctor}
          />
        </span>
      </header>

      <div className="body">
        <Sidebar patients={patients} selected={selectedId} done={done} onSelect={setSelectedId} />

        <main className="work">
          {patient && session ? (
            <>
              <div className="head">
                <div>
                  <h1>{patient.name}</h1>
                  <div className="tags">
                    <span className="tag">
                      {new Date().getFullYear() - patient.birth_year} anni · {patient.sex === 'F' ? 'donna' : 'uomo'}
                    </span>
                    {patient.problems.map((p) => (
                      <span key={p} className="tag">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="tabs" role="tablist">
                {TABS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={session.tab === key}
                    onClick={() => patch(patient.id, { tab: key })}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {error && (
                <p role="alert" className="notice err">
                  {error}
                </p>
              )}

              {session.tab === 'brief' && (
                <BriefTab
                  reason={session.reason}
                  setReason={(reason) => patch(patient.id, { reason })}
                  brief={session.brief}
                  busy={busy === 'brief'}
                  canRun={busy === null}
                  onRun={makeBrief}
                />
              )}
              {session.tab === 'visit' && (
                <VisitTab
                  transcript={session.transcript}
                  setTranscript={(transcript) => patch(patient.id, { transcript })}
                  sample={SAMPLES[patient.id]}
                  busy={busy === 'note'}
                  canRun={busy === null}
                  onRun={makeNote}
                />
              )}
              {session.tab === 'note' &&
                (session.note ? (
                  <NoteTab review={session.note.review} setReview={setReview} result={session.note.result} meta={meta} />
                ) : (
                  <p className="notice info">Genera prima la nota dalla trascrizione, nella scheda Visita.</p>
                ))}
              {session.tab === 'docs' &&
                (session.note ? (
                  <DocumentsTab review={session.note.review} setReview={setReview} meta={meta} />
                ) : (
                  <p className="notice info">I documenti si preparano dalla nota rivista: genera prima la nota.</p>
                ))}

              <p className="disclaimer">
                Demo dimostrativa con pazienti fittizi: usa solo dati fittizi. Non è un dispositivo medico e non
                sostituisce il giudizio del medico. Nomi, codici fiscali, date, indirizzi e telefoni vengono sostituiti
                sul server prima della chiamata al modello, ma il filtro è basato su regole e non garantisce
                l&apos;anonimato.
              </p>
            </>
          ) : (
            <p>Caricamento…</p>
          )}
        </main>

        {patient && <ContextPanel patient={patient} brief={session?.brief ?? null} />}
      </div>
    </div>
  );
}
