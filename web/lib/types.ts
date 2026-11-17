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

export interface RecordEntry {
  id: string;
  date: string;
  type: string;
  text: string;
}

export interface Patient {
  id: string;
  name: string;
  birth_year: number;
  sex: string;
  problems: string[];
  entries: RecordEntry[];
}

export interface BriefItem {
  text: string;
  record: string;
  evidence: string;
  supported: boolean;
}

export type BriefSection = 'relevant' | 'therapy' | 'to_check';

export interface BriefResult {
  brief: Record<BriefSection, BriefItem[]>;
  sent_to_model: string;
  redactions: Record<string, number>;
}

export const BRIEF_SECTIONS: [BriefSection, string][] = [
  ['relevant', 'Rilevante per oggi'],
  ['therapy', 'Terapia, allergie e intolleranze'],
  ['to_check', 'Da chiedere o controllare'],
];
