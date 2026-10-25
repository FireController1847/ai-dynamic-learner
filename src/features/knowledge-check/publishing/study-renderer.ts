import { Fragment, h, render, type VNodeChild } from 'vue';
import { MarkdownContent } from '../../../components/markdown-content.ts';
import markdownStyles from '../../../styles/markdown-content.css?publication';
import katexStyles from 'katex/dist/katex.min.css?publication';
import studyStyles from './study-sheet.css?publication';
import type { PublicationQuestion, PublicationView } from './publication-model.ts';
import type { PublicationRenderer } from './paged-runtime.ts';

function questionContent(question: PublicationQuestion, newSection = false): VNodeChild {
  return h('article', { class: ['study-question', { 'study-question-section': newSection }], 'data-publication-question': '' }, [
    h('p', { class: 'study-question-prompt' }, [h('span', { class: 'study-question-number' }, `${question.number}.`),
      h('span', question.prompt)]),
    question.context ? h(MarkdownContent, { text: question.context }) : null,
    question.selection === 'multiple' ? h('p', { class: 'study-instruction' }, 'Circle all that apply.') : null,
    question.choices.length ? h('ol', { class: 'study-choices', type: 'A' },
      question.choices.map(choice => h('li', choice))) : null,
    question.kind === 'matching' || question.kind === 'response'
      ? h('div', { class: 'study-responses' }, question.responseLabels.map(label => h('p', [
        h('span', `${label}: `), h('span', { class: 'study-response-line' }, '\u00a0'),
      ]))) : null,
  ]);
}

function startsSection(question: PublicationQuestion, previous: PublicationQuestion | undefined): boolean {
  return Boolean(previous && (question.sourceType !== previous.sourceType || question.kind === 'statement' || previous.kind === 'statement'));
}

/**
 * Row-major pairs match the Study reference: 1/2, then 3/4. Each pair is a separate
 * presentation table and a top-level pagination block. Do not put the entire bank
 * in one table behind a keep-with-next heading: Paged.js can move that heading
 * backwards when the table overflows and leave the opening page empty.
 * No answers, explanations or correctness markers are rendered.
 */
function studyContent(view: PublicationView, document: Document): DocumentFragment {
  if (view.settings.layout !== 'study') throw new Error('Choose Study to create this sheet.');
  const pairs: VNodeChild[] = [];
  for (let index = 0; index < view.questions.length; index += 2) {
    const cells = [0, 1].map(offset => {
      const question = view.questions[index + offset];
      return h('td', question ? [questionContent(question,
        offset === 1 && startsSection(question, view.questions[index]))] : []);
    });
    pairs.push(h('table', { class: ['study-question-grid', {
      'study-comfortable': view.settings.titleLayout !== 'compact',
      'study-section-start': startsSection(view.questions[index]!, view.questions[index - 1]),
    }],
      role: 'presentation' }, [h('tbody', [h('tr', cells)])]));
  }
  const mount = document.createElement('div');
  try {
    render(h(Fragment, [
      h('header', { class: ['study-sheet-heading', `study-heading-${view.settings.titleLayout}`] }, [h('h1', view.title),
        h('p', { class: 'study-name-field' }, [h('span', 'Name:'),
          h('span', { class: 'study-name-line', 'aria-label': 'Write your name' }, '\u00a0')])]),
      ...pairs,
    ]), mount);
    const fragment = document.createDocumentFragment();
    for (const child of mount.childNodes) fragment.append(document.importNode(child, true));
    return fragment;
  } finally {
    render(null, mount);
  }
}

export const studyRenderer: PublicationRenderer = {
  content: studyContent, styles: [markdownStyles, katexStyles, studyStyles],
};
