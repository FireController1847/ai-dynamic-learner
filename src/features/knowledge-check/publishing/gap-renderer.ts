import { Fragment, h, render, type VNodeChild } from 'vue';
import { MarkdownContent } from '../../../components/markdown-content.ts';
import type { PublicationQuestion, PublicationView } from './publication-model.ts';
import type { PublicationRenderer } from './paged-runtime.ts';
import { studyAnswerKey, studyHeading, studyRenderer } from './study-renderer.ts';
import gapStyles from './gap-sheet.css?publication';

/** Question text followed by uninterrupted white space for handwriting.
 * No guides, labels, or per-answer boxes: the space is intentionally blank.
 */
function gapQuestion(question: PublicationQuestion, view: PublicationView): VNodeChild {
  return h('article', {
    key: question.id, class: ['gap-question', {
      'gap-question-landscape': view.settings.orientation === 'landscape',
    }], 'data-publication-question': '',
  }, [
    h('p', { class: ['gap-question-prompt', `study-question-style-${view.settings.questionStyle}`] }, [
      h('span', { class: 'gap-question-number' }, `${question.number}.`),
      h('span', question.prompt),
    ]),
    question.context ? h(MarkdownContent, { text: question.context }) : null,
  ]);
}

/** Full-width questions and plain paper beneath them; the key is separate. */
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
