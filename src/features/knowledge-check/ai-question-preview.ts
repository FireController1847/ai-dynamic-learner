import { h } from 'vue';
import { MarkdownContent } from '../../components/markdown-content.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { questionTypeLabel } from './ai-question-mix.ts';
import { questionDisplayPrompt, type Question } from './question-model.ts';

/** Identical, safe question previews for new sets and questions appended to a set. */
export function reviewAiQuestionPreview(question: Question, index: number) {
  const answers = question.type === 'parameterized'
    ? (question.parameters?.rules.answers ?? []).map(answer => `${answer.label}: ${answer.expression ?? `Solver output ${answer.solverKey}`}`)
    : question.type === 'dropdown' ? (question.matches ?? []).map(row => `${row.label}: ${row.answer}`)
    : question.type === 'fill-in-the-blanks' ? parseFillBlankTemplate(question.prompt).answers
    : question.type === 'statement' ? [] : question.correctAnswers ?? [question.answer];
  return h('li', { key: question.id }, [
    h('span', { class: 'study-ai-muted' }, `${index + 1} · ${questionTypeLabel(question.type)}`),
    h('strong', questionDisplayPrompt(question)),
    question.context?.trim() ? h(MarkdownContent, { text: question.context, class: 'knowledge-question-context' }) : null,
    question.type === 'dropdown' ? h('ul', (question.matches ?? []).map(row => h('li', row.label))) : null,
    question.parameters?.rules.solver?.package ? h('p', { class: 'study-ai-muted' },
      `Includes uploaded solver: ${question.parameters.rules.solver.package.label}. Code runs only when previewing or reviewing a generated variant.`) : null,
    question.choices.length ? h('ul', question.choices.map(choice => h('li', choice))) : null,
    question.type !== 'statement' ? h('details', [
      h('summary', 'Reveal answer'),
      h('p', answers.join(' · ')),
      question.explanation ? h('p', question.explanation) : null,
    ]) : null,
  ]);
}
