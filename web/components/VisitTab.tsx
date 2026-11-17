export function VisitTab({
  transcript,
  setTranscript,
  sample,
  busy,
  canRun,
  onRun,
}: {
  transcript: string;
  setTranscript: (v: string) => void;
  sample?: string;
  busy: boolean;
  canRun: boolean;
  onRun: () => void;
}) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label htmlFor="transcript" style={{ fontSize: 13, fontWeight: 500, color: 'var(--mut)' }}>
          Trascrizione della visita
        </label>
        {sample && (
          <button type="button" className="link" onClick={() => setTranscript(sample)}>
            Carica una visita di esempio
          </button>
        )}
      </div>
      <textarea
        id="transcript"
        className="input mono"
        style={{ marginTop: 6, height: 260 }}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
      />
      <button type="button" className="btn" style={{ marginTop: 12 }} onClick={onRun} disabled={!canRun || busy || !transcript.trim()}>
        {busy ? 'Elaborazione…' : 'Genera la nota'}
      </button>
    </div>
  );
}
