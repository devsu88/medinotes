export function SettingsMenu({
  open,
  onToggle,
  apiKey,
  setApiKey,
  doctor,
  setDoctor,
}: {
  open: boolean;
  onToggle: () => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  doctor: string;
  setDoctor: (v: string) => void;
}) {
  return (
    <>
      <button type="button" className="gear" onClick={onToggle} aria-expanded={open}>
        {apiKey ? 'Impostazioni' : 'Impostazioni · chiave mancante'}
      </button>
      {open && (
        <div className="settings" role="dialog" aria-label="Impostazioni">
          <label className="field">
            Chiave API OpenAI
            <input
              type="password"
              autoComplete="off"
              className="input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <p style={{ margin: '6px 0 12px', fontSize: 12, color: 'var(--mut)' }}>
            Resta nella memoria del browser e viene inviata solo con le tue richieste. Non viene salvata.
          </p>
          <label className="field">
            Nome del medico (opzionale)
            <input className="input" value={doctor} onChange={(e) => setDoctor(e.target.value)} />
          </label>
        </div>
      )}
    </>
  );
}
