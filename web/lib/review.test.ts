import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  exportNote,
  exportPrescriptionDraft,
  exportReferral,
  newItem,
  pendingCount,
  startReview,
  suggestQuestion,
} from './review.ts';
import type { Note } from './types.ts';

const fact = (text: string, supported = true) => ({ text, evidence: `q ${text}`, supported });

const NOTE: Note = {
  reason: [fact('Tosse')],
  subjective: [fact('Febbre 37,8'), fact('Fumatore da anni', false)],
  objective: [],
  assessment: [fact('Bronchite virale')],
  plan: [fact('Controllo tra una settimana')],
  medications: [
    { name: 'paracetamolo', dose: '1000 mg', instructions: null, evidence: 'q', supported: true, dose_supported: true },
    { name: 'amoxicillina', dose: '2 g', instructions: null, evidence: 'q', supported: true, dose_supported: false },
  ],
  patient_message: 'Ciao',
};
const META = { patient: 'Mario Rossi', doctor: 'Bianchi', date: '17/11/2026' };

test('only unsupported statements start as pending', () => {
  assert.equal(pendingCount(startReview(NOTE)), 2); // one fact and one dose
});

test('export is refused until every flagged item is resolved', () => {
  assert.throws(() => exportNote(startReview(NOTE), META), /da rivedere/);
});

test('confirming, editing or removing resolves a flagged item', () => {
  const review = startReview(NOTE);
  review.sections.subjective[1].removed = true;
  review.medications[1].confirmed = true;
  assert.equal(pendingCount(review), 0);
});

test('export keeps edited text, drops removed items and adds the doctor’s own', () => {
  const review = startReview(NOTE);
  review.sections.subjective[1].removed = true;
  review.medications[1].confirmed = true;
  review.medications[1].dose = '1 g';
  review.sections.objective.push(newItem({ text: 'Torace libero' }));
  const out = exportNote(review, META);

  assert.match(out, /Paziente: Mario Rossi/);
  assert.match(out, /## Soggettivo\n- Febbre 37,8\n/);
  assert.doesNotMatch(out, /Fumatore/);
  assert.match(out, /- amoxicillina · 1 g/);
  assert.match(out, /## Oggettivo\n- Torace libero/);
  assert.doesNotMatch(out, /Ciao/); // the patient message is not part of the chart note
});

test('empty sections are left out', () => {
  const review = startReview({ ...NOTE, subjective: [], medications: [] });
  assert.doesNotMatch(exportNote(review, META), /## Soggettivo|## Farmaci/);
});

test('prescription draft lists the kept medications and says it is not a prescription', () => {
  const review = startReview(NOTE);
  review.sections.subjective[1].removed = true;
  review.medications[1].confirmed = true;
  const out = exportPrescriptionDraft(review, META);
  assert.match(out, /1\. paracetamolo · 1000 mg\n2\. amoxicillina · 2 g/);
  assert.match(out, /non è una ricetta/);
});

test('prescription draft is refused with unresolved items or without medications', () => {
  assert.throws(() => exportPrescriptionDraft(startReview(NOTE), META), /da rivedere/);
  assert.throws(() => exportPrescriptionDraft(startReview({ ...NOTE, subjective: [], medications: [] }), META), /Nessun farmaco/);
});

test('the suggested question picks plan items that ask for a visit or a test', () => {
  const review = startReview({
    ...NOTE,
    plan: [fact('Ecografia addominale'), fact('Bere molto'), fact('Visita cardiologica')],
  });
  assert.equal(suggestQuestion(review), 'Ecografia addominale\nVisita cardiologica');
});

test('referral letter needs a question and carries history, findings and therapy', () => {
  const review = startReview({ ...NOTE, subjective: [fact('Dolore toracico')], medications: [] });
  assert.throws(() => exportReferral(review, META, { specialist: '', question: ' ' }), /quesito/);
  const out = exportReferral(review, META, { specialist: 'cardiologo', question: 'Valutazione cardiologica' });
  assert.match(out, /Al Collega, cardiologo,/);
  assert.match(out, /Valutazione cardiologica/);
  assert.match(out, /Anamnesi:\n- Dolore toracico/);
  assert.doesNotMatch(out, /Terapia/); // no medications, no empty heading
});
