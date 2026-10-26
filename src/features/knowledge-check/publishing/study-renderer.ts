import { Fragment, h, render, type VNodeChild } from 'vue';
import { MarkdownContent } from '../../../components/markdown-content.ts';
import markdownStyles from '../../../styles/markdown-content.css?publication';
import katexStyles from 'katex/dist/katex.min.css?publication';
import studyStyles from './study-sheet.css?publication';
import { publicationHasCover, type PublicationQuestion, type PublicationView } from './publication-model.ts';
import { documentHeading, publicationFields } from './publication-heading.ts';
import type { PublicationRenderer } from './paged-runtime.ts';

function questionContent(question: PublicationQuestion, style: PublicationView['settings']['questionStyle'],
  includeResponseLines = true, bubbleMatching = false): VNodeChild {
  return h('article', { class: 'study-question', 'data-publication-question': '' }, [
    h('p', { class: ['study-question-prompt', `study-question-style-${style}`] }, [h('span', { class: 'study-question-number' }, `${question.number}.`),
      h('span', question.prompt)]),
    question.context ? h(MarkdownContent, { text: question.context }) : null,
    question.selection === 'multiple' ? h('p', { class: 'study-instruction' }, 'Circle all that apply.') : null,
    question.choices.length ? h('ol', { class: 'study-choices', type: 'A' },
      question.choices.map(choice => h('li', choice))) : null,
    question.kind === 'matching' || question.kind === 'response'
      ? h('div', { class: 'study-responses' }, question.responseLabels.map((label, i) => h('p', [
        h('span', bubbleMatching && question.kind === 'matching' ? `${question.number}.${i + 1} ${label}` : `${label}: `),
        includeResponseLines ? h('span', { class: 'study-response-line' }, '\u00a0') : null,
      ]))) : null,
  ]);
}

function startsSection(question: PublicationQuestion, previous: PublicationQuestion | undefined): boolean {
  return Boolean(previous && (question.sourceType !== previous.sourceType || question.kind === 'statement' || previous.kind === 'statement'));
}

/** Paired tables align opposite questions; independent columns flow naturally. */
export function studyQuestions(view: PublicationView, includeResponseLines = true,
  bubbleMatching = false): VNodeChild[] {
  const comfortable = view.settings.titleLayout !== 'compact';
  if (view.settings.columns === 2 && view.settings.alignColumns) {
    const pairs: VNodeChild[] = [];
    for (let index = 0; index < view.questions.length; index += 2) {
      const cells = [0, 1].map(offset => {
        const question = view.questions[index + offset];
        return h('td', question ? [questionContent(question, view.settings.questionStyle, includeResponseLines, bubbleMatching)] : []);
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
  }, [questionContent(question, view.settings.questionStyle, includeResponseLines, bubbleMatching)]));
  return [h('div', {
    class: ['study-question-flow', { 'study-flow-two-columns': view.settings.columns === 2 }],
  }, items)];
}

/**
 * The optional first page is a print-ready document cover, not a question header
 * with a large top margin. Keep authored titles as text nodes and never print
 * answers, explanations, or a detailed knowledge-set description here.
 */
export function studyHeading(view: PublicationView, edition = 'STUDY SHEET'): VNodeChild {
  if (view.settings.titleLayout !== 'cover') {
    return documentHeading(edition === 'BUBBLE SHEET' ? 'Bubble sheet' : 'Study sheet', view.title,
      view.settings.questionMetadata, ['study-sheet-heading', `study-heading-${view.settings.titleLayout}`]);
  }

  if (!publicationHasCover(view.settings)) return null;
  const metadata = view.settings.questionMetadata;
  const questionCount = view.questions.length;
  return h('section', { class: 'study-sheet-cover', 'aria-label': 'Study sheet cover' }, [
    metadata.headerLeft || metadata.headerRight ? h('div', { class: 'study-cover-masthead' }, [
      metadata.headerLeft ? h('span', { class: 'study-cover-brand' }, 'DYNAMIC LEARNER') : null,
      metadata.headerRight ? h('span', { class: 'study-cover-edition' }, `REVIEW / ${edition}`) : null,
    ]) : null,
    h('div', { class: 'study-cover-main' }, [
      metadata.title ? h('div', { class: 'study-cover-accent', 'aria-hidden': 'true' }) : null,
      metadata.notes ? h('p', { class: 'study-cover-kicker' }, 'STUDY MATERIAL') : null,
      metadata.title ? h('h1', { class: 'study-cover-title' }, view.title) : null,
      metadata.questionCount ? h('p', { class: 'study-cover-subtitle' },
        `${questionCount} practice ${questionCount === 1 ? 'question' : 'questions'}`) : null,
    ]),
    h('div', { class: 'study-cover-bottom' }, [
      publicationFields(metadata, true),
      metadata.headerRight || metadata.questionCount ? h('div', { class: 'study-cover-footer' }, [
        metadata.headerRight ? h('span', edition === 'BUBBLE SHEET' ? 'BUBBLE / PRACTICE' : 'STUDY / PRACTICE') : null,
        metadata.questionCount ? h('span', `${questionCount} ${questionCount === 1 ? 'QUESTION' : 'QUESTIONS'}`) : null,
      ]) : null,
    ]),
  ]);
}

/** A separate, paginated answer-key section; no answers are embedded in question pages. */
export function studyAnswerKey(view: PublicationView): VNodeChild {
  return h('section', { class: ['study-answer-key', {
    'study-answer-key-appended': view.settings.content === 'both',
  }], 'aria-label': 'Answer key' }, [
    documentHeading('Answer key', view.title, view.settings.keyMetadata, ['study-answer-key-heading'],
      h('p', { class: 'study-answer-key-note' }, 'Answers correspond to the numbered questions in this version.')),
    h('div', { class: ['study-answer-key-entries', {
      'study-answer-key-two-columns': view.settings.columns === 2,
    }] }, view.answerKey.map(entry =>
      h('div', { key: entry.number, class: 'study-answer-key-entry' }, [
        h('strong', { class: 'study-answer-key-number' }, `${entry.number}.`),
        h('div', { class: 'study-answer-key-lines' }, entry.lines.map(line =>
          h('p', [
            line.label ? h('strong', `${line.label}: `) : null,
            h('span', line.text),
          ]))),
      ]))),
  ]);
}

function studyContent(view: PublicationView, document: Document): DocumentFragment {
  if (view.settings.layout !== 'study') throw new Error('Choose Study to create this sheet.');
  const mount = document.createElement('div');
  try {
    render(h(Fragment, [
      ...(view.settings.content === 'key' ? [] : [studyHeading(view), ...studyQuestions(view)]),
      ...(view.settings.content === 'questions' ? [] : [studyAnswerKey(view)]),
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
