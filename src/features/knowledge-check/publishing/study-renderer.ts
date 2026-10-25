import { Fragment, h, render, type VNodeChild } from 'vue';
import { MarkdownContent } from '../../../components/markdown-content.ts';
import markdownStyles from '../../../styles/markdown-content.css?publication';
import katexStyles from 'katex/dist/katex.min.css?publication';
import studyStyles from './study-sheet.css?publication';
import type { PublicationQuestion, PublicationView } from './publication-model.ts';
import type { PublicationRenderer } from './paged-runtime.ts';

function questionContent(question: PublicationQuestion, style: PublicationView['settings']['questionStyle'],
  newSection = false): VNodeChild {
  return h('article', { class: ['study-question', { 'study-question-section': newSection }], 'data-publication-question': '' }, [
    h('p', { class: ['study-question-prompt', `study-question-style-${style}`] }, [h('span', { class: 'study-question-number' }, `${question.number}.`),
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

/** Paired tables align opposite questions; independent columns flow naturally. */
function studyQuestions(view: PublicationView): VNodeChild[] {
  const comfortable = view.settings.titleLayout !== 'compact';
  if (view.settings.columns === 2 && view.settings.alignColumns) {
    const pairs: VNodeChild[] = [];
    for (let index = 0; index < view.questions.length; index += 2) {
      const cells = [0, 1].map(offset => {
        const question = view.questions[index + offset];
        return h('td', question ? [questionContent(question, view.settings.questionStyle,
          offset === 1 && startsSection(question, view.questions[index]))] : []);
      });
      pairs.push(h('table', { class: ['study-question-grid', {
        'study-comfortable': comfortable,
        'study-section-start': startsSection(view.questions[index]!, view.questions[index - 1]),
      }], role: 'presentation' }, [h('tbody', [h('tr', cells)])]));
    }
    return pairs;
  }
  const items = view.questions.map((question, index) => h('div', {
    key: question.id,
    class: ['study-flow-item', {
      'study-comfortable': comfortable,
      // Assign extra section spacing to the preceding item, not the next one:
      // top padding on the first item of a new CSS column caused visible offsets.
      'study-section-end': Boolean(view.questions[index + 1] &&
        startsSection(view.questions[index + 1]!, question)),
    }],
  }, [questionContent(question, view.settings.questionStyle)]));
  return [h('div', {
    class: ['study-question-flow', { 'study-flow-two-columns': view.settings.columns === 2 }],
  }, items)];
}

function studyContent(view: PublicationView, document: Document): DocumentFragment {
  if (view.settings.layout !== 'study') throw new Error('Choose Study to create this sheet.');
  const mount = document.createElement('div');
  try {
    render(h(Fragment, [
      h('header', { class: ['study-sheet-heading', `study-heading-${view.settings.titleLayout}`] }, [h('h1', view.title),
        h('p', { class: 'study-name-field' }, [h('span', 'Name:'),
          h('span', { class: 'study-name-line', 'aria-label': 'Write your name' }, '\u00a0')])]),
      ...studyQuestions(view),
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
