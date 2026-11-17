export interface Fact {
  text: string;
  evidence: string;
  supported: boolean;
}

export interface Medication {
  name: string;
  dose: string | null;
  instructions: string | null;
  evidence: string;
  supported: boolean;
  dose_supported: boolean;
}

export const SECTIONS = [
  ['reason', 'Motivo della visita'],
  ['subjective', 'Soggettivo'],
  ['objective', 'Oggettivo'],
  ['assessment', 'Valutazione'],
  ['plan', 'Piano'],
] as const;

export type SectionKey = (typeof SECTIONS)[number][0];

export type Note = Record<SectionKey, Fact[]> & {
  medications: Medication[];
  patient_message: string;
};

export interface Result {
  note: Note;
  sent_to_model: string;
  redactions: Record<string, number>;
}

export function unsupportedCount(note: Note): number {
  const facts = SECTIONS.flatMap(([key]) => note[key]);
  return (
    facts.filter((f) => !f.supported).length +
    note.medications.filter((m) => !m.supported || !m.dose_supported).length
  );
}
