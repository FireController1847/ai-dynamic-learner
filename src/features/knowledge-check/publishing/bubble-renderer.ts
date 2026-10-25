import { Fragment, h, render, type VNodeChild } from 'vue';
import type { PublicationQuestion, PublicationView } from './publication-model.ts';
import type { PublicationRenderer } from './paged-runtime.ts';
import { studyAnswerKey, studyHeading, studyQuestions, studyRenderer } from './study-renderer.ts';
import bubbleStyles from './bubble-sheet.css?publication';

const letter = (index: number) => String.fromCharCode(65 + index);

/** An ordinary choice uses unfilled circles; written types receive ruled spaces. */
function answerRow(question: PublicationQuestion): VNodeChild {
  if (question.kind === 'choice') return h('div', {
    key: question.id, class: 'bubble-response-row bubble-response-choice',
  }, [
    h('strong', { class: 'bubble-response-number' }, `${question.number}.`),
    h('div', { class: 'bubble-response-marks', 'aria-label': `Choices for question ${question.number}` },
      question.choices.map((_choice, index) =>
        h('span', { class: 'bubble-response-mark', 'aria-label': `Choice ${letter(index)}` }, letter(index)))),
    question.selection === 'multiple' ? h('span', { class: 'bubble-response-multiple' }, 'Select all') : null,
  ]);

  const labels = question.responseLabels.length ? question.responseLabels : ['Answer'];
  return h('div', { key: question.id, class: 'bubble-response-row bubble-response-written' }, [
    h('strong', { class: 'bubble-response-number' }, `${question.number}.`),
    h('div', { class: 'bubble-write-fields' }, labels.map(label =>
      h('div', { class: 'bubble-write-field' }, [
        h('span', { class: 'bubble-write-label' }, label),
        h('span', { class: 'bubble-write-line', 'aria-hidden': 'true' }),
      ]))),
  ]);
}

function responseSheet(view: PublicationView): VNodeChild {
  const questions = view.questions.filter(question => question.kind !== 'statement');
  return h('section', { class: 'bubble-response-sheet', 'aria-label': 'Bubble answer sheet' }, [
    h('header', { class: 'bubble-sheet-heading' }, [
      h('p', { class: 'bubble-sheet-kicker' }, 'DYNAMIC LEARNER / REVIEW'),
      h('h1', 'Answer sheet'),
      h('p', { class: 'bubble-sheet-title' }, view.title),
      h('p', { class: 'bubble-sheet-note' },
        'Fill in the circle for each chosen letter. Mark all answers where instructed. Write other responses on the lines.'),
      h('div', { class: 'bubble-sheet-identification' }, [
        h('p', ['Name', h('span', { class: 'bubble-sheet-id-line', 'aria-hidden': 'true' })]),
        h('p', ['Date', h('span', { class: 'bubble-sheet-id-line', 'aria-hidden': 'true' })]),
      ]),
    ]),
    questions.length
      ? h('div', { class: ['bubble-response-rows', {
        'bubble-response-two-columns': view.settings.columns === 2,
      }] }, questions.map(answerRow))
      : h('p', { class: 'bubble-sheet-note' }, 'No responses are required for the informational items in this set.'),
  ]);
}

/** Uses exactly the same detached, answer-free questions and content policy as Study. */
function bubbleContent(view: PublicationView, document: Document): DocumentFragment {
  if (view.settings.layout !== 'bubble') throw new Error('Choose Bubble to create this sheet.');
  const mount = document.createElement('div');
  try {
    render(h(Fragment, [
      ...(view.settings.content === 'key' ? [] : [
        studyHeading(view, 'BUBBLE SHEET'),
        ...studyQuestions(view, false),
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
  content: bubbleContent,
  styles: [...studyRenderer.styles, bubbleStyles],
};
