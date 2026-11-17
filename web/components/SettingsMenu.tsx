export function SettingsMenu({
  open,
  onToggle,
  doctor,
  setDoctor,
}: {
  open: boolean;
  onToggle: () => void;
  doctor: string;
  setDoctor: (v: string) => void;
}) {
  return (
    <>
      <button type="button" className="gear" onClick={onToggle} aria-expanded={open}>
        Impostazioni
      </button>
      {open && (
        <div className="settings" role="dialog" aria-label="Impostazioni">
          <label className="field">
            Nome del medico (opzionale)
            <input className="input" value={doctor} onChange={(e) => setDoctor(e.target.value)} />
          </label>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--mut)' }}>
            Compare nelle note e nei documenti esportati. Non viene salvato.
          </p>
        </div>
      )}
    </>
  );
}
