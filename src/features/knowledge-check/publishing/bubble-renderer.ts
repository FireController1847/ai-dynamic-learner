import { Fragment, h, render, type VNodeChild } from 'vue';
import type { PublicationBubbleKeyEntry, PublicationQuestion, PublicationView } from './publication-model.ts';
import type { PublicationRenderer } from './paged-runtime.ts';
import { studyHeading, studyQuestions, studyRenderer } from './study-renderer.ts';
import { documentHeading } from './publication-heading.ts';
import bubbleStyles from './bubble-sheet.css?publication';

const letter = (i: number) => String.fromCharCode(65 + i);

/** Choice-only optical rows: one per question, or one per matching sub-question. */
function bubbleRow(number: string, count: number, multiple: boolean,
  correctIndices: readonly number[] = []): VNodeChild {
  return h('div', { key: number, class: 'bubble-response-row' }, [
    h('strong', { class: 'bubble-response-number' }, number),
    h('div', { class: 'bubble-response-marks', 'aria-label': `Bubbles for question ${number}` },
      Array.from({ length: count }, (_, i) => h('span', {
        class: ['bubble-response-mark', { 'bubble-response-mark-filled': correctIndices.includes(i) }],
      }, letter(i)))),
    multiple ? h('span', { class: 'bubble-response-multiple', title: 'Select all that apply' }, '*') : null,
  ]);
}

function bubbleRows(question: PublicationQuestion, key?: PublicationBubbleKeyEntry): VNodeChild[] {
  if (question.kind === 'choice') return [
    bubbleRow(`${question.number}.`, question.choices.length, question.selection === 'multiple',
      key?.rows[0]),
  ];
  if (question.kind === 'matching') return question.responseLabels.map((_label, i) =>
    bubbleRow(`${question.number}.${i + 1}`, question.choices.length, false, key?.rows[i]));
  // Unsupported kinds are excluded in preparation; Statements have no answers.
  return [];
}

/** The blank answer sheet and its answer key share exactly the same optical grid. */
function responseSheet(view: PublicationView, filled = false): VNodeChild {
  const keys = filled
    ? new Map<number, PublicationBubbleKeyEntry>(view.bubbleKey.map(entry => [entry.number, entry]))
    : null;
  return h('section', {
    class: ['bubble-response-sheet', { 'bubble-response-sheet-appended': !filled || view.settings.content === 'both' }],
    'aria-label': filled ? 'Bubble answer key' : 'Bubble answer sheet',
  }, [
    documentHeading(filled ? 'Answer key' : 'Answer sheet', view.title,
      filled ? view.settings.keyMetadata : view.settings.questionMetadata, ['bubble-sheet-heading'],
      h('p', { class: 'bubble-sheet-note' }, filled
        ? 'Filled circles indicate the correct answers.'
        : 'Darken the circle for your answer. For questions marked *, select all that apply.')),
    h('div', { class: 'bubble-response-rows' },
      view.questions.flatMap(question => bubbleRows(question, keys?.get(question.number)))),
  ]);
}

/** The optical sheet never contains correct answers; the optional key follows it. */
function bubbleContent(view: PublicationView, document: Document): DocumentFragment {
  if (view.settings.layout !== 'bubble') throw new Error('Choose Bubble to create this sheet.');
  const mount = document.createElement('div');
  try {
    render(h(Fragment, [
      ...(view.settings.content === 'key' ? [] : [
        studyHeading(view, 'BUBBLE SHEET'),
        ...studyQuestions(view, false, true),
        responseSheet(view),
      ]),
      ...(view.settings.content === 'questions' ? [] : [responseSheet(view, true)]),
    ]), mount);
    const fragment = document.createDocumentFragment();
    for (const child of mount.childNodes) fragment.append(document.importNode(child, true));
    return fragment;
  } finally {
    render(null, mount);
  }
}

export const bubbleRenderer: PublicationRenderer = {
  content: bubbleContent, styles: [...studyRenderer.styles, bubbleStyles],
};
