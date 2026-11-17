// The doctor's review of a generated note. Pure functions: the UI only calls these.
import { SECTIONS } from './types.ts';
import type { Note, SectionKey } from './types.ts';

export interface Item {
  id: string;
  text: string;
  evidence: string;
  flagged: boolean; // the grounding check could not find the quote or the dose
  confirmed: boolean; // the doctor accepted or edited it
  removed: boolean;
  manual: boolean; // written by the doctor, with no quote
}

export interface MedItem extends Item {
  name: string;
  dose: string;
  instructions: string;
}

export interface Review {
  sections: Record<SectionKey, Item[]>;
  medications: MedItem[];
  message: string;
}

let counter = 0;
const nextId = () => `i${++counter}`;

export function startReview(note: Note): Review {
  const sections = {} as Record<SectionKey, Item[]>;
  for (const [key] of SECTIONS) {
    sections[key] = note[key].map((f) => ({
      id: nextId(),
      text: f.text,
      evidence: f.evidence,
      flagged: !f.supported,
      confirmed: false,
      removed: false,
      manual: false,
    }));
  }
  const medications = note.medications.map((m) => ({
    id: nextId(),
    text: '',
    name: m.name,
    dose: m.dose ?? '',
    instructions: m.instructions ?? '',
    evidence: m.evidence,
    flagged: !(m.supported && m.dose_supported),
    confirmed: false,
    removed: false,
    manual: false,
  }));
  return { sections, medications, message: note.patient_message };
}

export function newItem(partial: Partial<Item> = {}): Item {
  return { id: nextId(), text: '', evidence: '', flagged: false, confirmed: true, removed: false, manual: true, ...partial };
}

export function newMedication(): MedItem {
  return { ...newItem(), name: '', dose: '', instructions: '' };
}

/** Flagged items the doctor has neither confirmed, edited nor removed. */
export function pendingCount(review: Review): number {
  const all: Item[] = [...SECTIONS.flatMap(([key]) => review.sections[key]), ...review.medications];
  return all.filter((i) => i.flagged && !i.confirmed && !i.removed).length;
}

const kept = <T extends Item>(items: T[]) => items.filter((i) => !i.removed);

export interface ExportMeta {
  patient: string;
  doctor: string;
  date: string;
}

/** Text of the chart note. Throws while flagged items are unresolved. */
export function exportNote(review: Review, meta: ExportMeta): string {
  if (pendingCount(review) > 0) throw new Error('Ci sono elementi segnalati ancora da rivedere.');
  const lines = ['# Nota di visita', ''];
  if (meta.patient.trim()) lines.push(`Paziente: ${meta.patient.trim()}`);
  if (meta.doctor.trim()) lines.push(`Medico: ${meta.doctor.trim()}`);
  lines.push(`Data: ${meta.date}`, '');
  for (const [key, label] of SECTIONS) {
    const items = kept(review.sections[key]).filter((i) => i.text.trim());
    if (!items.length) continue;
    lines.push(`## ${label}`, ...items.map((i) => `- ${i.text.trim()}`), '');
  }
  const meds = kept(review.medications).filter((m) => m.name.trim());
  if (meds.length) {
    lines.push('## Farmaci');
    for (const m of meds) {
      lines.push(`- ${[m.name, m.dose, m.instructions].map((p) => p.trim()).filter(Boolean).join(' · ')}`);
    }
    lines.push('');
  }
  lines.push('Bozza generata con MediNotes e rivista dal medico.');
  return lines.join('\n') + '\n';
}

const header = (title: string, meta: ExportMeta) =>
  [
    title,
    '',
    ...(meta.patient.trim() ? [`Paziente: ${meta.patient.trim()}`] : []),
    ...(meta.doctor.trim() ? [`Medico: ${meta.doctor.trim()}`] : []),
    `Data: ${meta.date}`,
    '',
  ];

const bullets = (items: Item[]) =>
  kept(items)
    .filter((i) => i.text.trim())
    .map((i) => `- ${i.text.trim()}`);

/** Medication list to copy into the practice software. A draft, never a prescription. */
export function exportPrescriptionDraft(review: Review, meta: ExportMeta): string {
  if (pendingCount(review) > 0) throw new Error('Ci sono elementi segnalati ancora da rivedere.');
  const meds = kept(review.medications).filter((m) => m.name.trim());
  if (!meds.length) throw new Error('Nessun farmaco da prescrivere.');
  const lines = [
    ...header('Bozza di prescrizione', meta),
    ...meds.map(
      (m, n) => `${n + 1}. ${[m.name, m.dose, m.instructions].map((p) => p.trim()).filter(Boolean).join(' · ')}`,
    ),
    '',
    'Bozza da trascrivere nel gestionale: non è una ricetta e non ha valore prescrittivo.',
  ];
  return lines.join('\n') + '\n';
}

const REQUEST = /(visita|specialist|invio|mand|esam|ecograf|radiograf|risonanz|\btac\b|analisi)/i;

/** Plan items that look like a request to a colleague or for tests: a starting point for the doctor. */
export function suggestQuestion(review: Review): string {
  return kept(review.sections.plan)
    .map((i) => i.text.trim())
    .filter((t) => REQUEST.test(t))
    .join('\n');
}

export function exportReferral(
  review: Review,
  meta: ExportMeta,
  letter: { specialist: string; question: string },
): string {
  if (pendingCount(review) > 0) throw new Error('Ci sono elementi segnalati ancora da rivedere.');
  if (!letter.question.trim()) throw new Error('Scrivi il quesito clinico.');
  const to = letter.specialist.trim();
  const blocks: [string, string[]][] = [
    ['Anamnesi', bullets(review.sections.subjective)],
    ['Esame obiettivo', bullets(review.sections.objective)],
    ['Valutazione', bullets(review.sections.assessment)],
    [
      'Terapia in corso o prescritta',
      kept(review.medications)
        .filter((m) => m.name.trim())
        .map((m) => `- ${[m.name, m.dose, m.instructions].map((p) => p.trim()).filter(Boolean).join(' · ')}`),
    ],
  ];
  const lines = [
    ...header('Lettera di invio', meta),
    to ? `Al Collega, ${to},` : 'Gentile Collega,',
    '',
    'ti invio il paziente per il seguente quesito clinico:',
    letter.question.trim(),
    '',
    ...blocks.flatMap(([title, rows]) => (rows.length ? [`${title}:`, ...rows, ''] : [])),
    'Cordiali saluti.',
  ];
  return lines.join('\n') + '\n';
}
