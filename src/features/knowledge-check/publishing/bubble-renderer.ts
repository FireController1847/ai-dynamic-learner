import { Fragment, h, render, type VNodeChild } from 'vue';
import type { PublicationQuestion, PublicationView } from './publication-model.ts';
import type { PublicationRenderer } from './paged-runtime.ts';
import { studyAnswerKey, studyHeading, studyQuestions, studyRenderer } from './study-renderer.ts';
import bubbleStyles from './bubble-sheet.css?publication';

const letter = (i: number) => String.fromCharCode(65 + i);

/** Choice-only optical rows: one per question, or one per matching sub-question. */
function bubbleRow(number: string, count: number, multiple: boolean): VNodeChild {
  return h('div', { key: number, class: 'bubble-response-row' }, [
    h('strong', { class: 'bubble-response-number' }, number),
    h('div', { class: 'bubble-response-marks', 'aria-label': `Bubbles for question ${number}` },
      Array.from({ length: count }, (_, i) => h('span', { class: 'bubble-response-mark' }, letter(i)))),
    multiple ? h('span', { class: 'bubble-response-multiple', title: 'Select all that apply' }, '*') : null,
  ]);
}

function bubbleRows(question: PublicationQuestion): VNodeChild[] {
  if (question.kind === 'choice') return [
    bubbleRow(`${question.number}.`, question.choices.length, question.selection === 'multiple'),
  ];
  if (question.kind === 'matching') return question.responseLabels.map((_label, i) =>
    bubbleRow(`${question.number}.${i + 1}`, question.choices.length, false));
  // Other scored kinds are rejected in preparation; Statements have no answers.
  return [];
}

function responseSheet(view: PublicationView): VNodeChild {
  return h('section', { class: 'bubble-response-sheet', 'aria-label': 'Bubble answer sheet' }, [
    h('header', { class: 'bubble-sheet-heading' }, [
      h('p', { class: 'bubble-sheet-kicker' }, 'DYNAMIC LEARNER / REVIEW'),
      h('h1', 'Answer sheet'),
      h('p', { class: 'bubble-sheet-title' }, view.title),
      h('p', { class: 'bubble-sheet-note' },
        'Darken the circle for your answer. For questions marked *, select all that apply.'),
      h('div', { class: 'bubble-sheet-identification' }, [
        h('p', ['Name', h('span', { class: 'bubble-sheet-id-line', 'aria-hidden': 'true' })]),
        h('p', ['Date', h('span', { class: 'bubble-sheet-id-line', 'aria-hidden': 'true' })]),
      ]),
    ]),
    h('div', { class: 'bubble-response-rows' }, view.questions.flatMap(bubbleRows)),
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
      ...(view.settings.content === 'questions' ? [] : [studyAnswerKey(view)]),
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
