import { Fragment, h, render, type VNodeChild } from 'vue';
import { MarkdownContent } from '../../../components/markdown-content.ts';
import type { PublicationQuestion, PublicationView } from './publication-model.ts';
import type { PublicationRenderer } from './paged-runtime.ts';
import { studyAnswerKey, studyHeading, studyRenderer } from './study-renderer.ts';
import gapStyles from './gap-sheet.css?publication';

/**
 * Real printer-visible rules, not background gradients that vanish in PDF.
 * The number of rules is reduced slightly in landscape to respect page height.
 */
function writingLines(count: number): VNodeChild {
  return h('div', { class: 'gap-writing-lines', 'aria-label': 'Space for a written answer' },
    Array.from({ length: count }, (_, index) =>
      h('div', { key: index, class: 'gap-writing-line', 'aria-hidden': 'true' })));
}

function gapQuestion(question: PublicationQuestion, view: PublicationView): VNodeChild {
  const isStatement = question.kind === 'statement';
  const landscape = view.settings.orientation === 'landscape';
  const generatedParts = question.sourceType === 'parameterized' && question.responseLabels.length > 1
    ? question.responseLabels : [];
  return h('article', { key: question.id, class: 'gap-question', 'data-publication-question': '' }, [
    h('p', { class: ['gap-question-prompt', `study-question-style-${view.settings.questionStyle}`] }, [
      h('span', { class: 'gap-question-number' }, `${question.number}.`),
      h('span', question.prompt),
    ]),
    question.context ? h(MarkdownContent, { text: question.context }) : null,
    ...(generatedParts.length
      ? generatedParts.map(label => h('div', { class: 'gap-response-part' }, [
        h('p', { class: 'gap-response-label' }, label),
        writingLines(landscape ? 2 : 3),
      ]))
      : [
        h('p', { class: 'gap-response-label' }, isStatement ? 'Notes / reflection' :
          question.sourceType === 'parameterized' ? 'Answer / working' : 'Response'),
        writingLines(landscape ? 4 : 6),
      ]),
  ]);
}

/** Full-width handwritten question pages; the text answer key is a separate section. */
function gapContent(view: PublicationView, document: Document): DocumentFragment {
  if (view.settings.layout !== 'gap') throw new Error('Choose Gap to create this sheet.');
  const mount = document.createElement('div');
  try {
    render(h(Fragment, [
      ...(view.settings.content === 'key' ? [] : [
        studyHeading(view, 'GAP SHEET'),
        ...view.questions.map(question => gapQuestion(question, view)),
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

export const gapRenderer: PublicationRenderer = {
  content: gapContent,
  styles: [...studyRenderer.styles, gapStyles],
};
