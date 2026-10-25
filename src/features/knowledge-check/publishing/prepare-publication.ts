import { parseFillBlankTemplate, maskFillBlankAnswers } from '../../../core/fill-blank.ts';
import type { CheckItem } from '../library-model.ts';
import { MAX_NAME_LENGTH } from '../library-model.ts';
import { MAX_TEXT, questionReady, validateQuestions, type Question } from '../question-model.ts';
import { materializeQuestionAsync } from '../parameterized-model.ts';
import { materializeChoicePool } from '../multiple-choice-pool.ts';
import { validatePublicationSettings, type PreparedPublication, type PublicationQuestion,
  type PublicationSettings } from './publication-model.ts';

function normalizeQuestion(question: Question, number: number, sourceType: Question['type']): PublicationQuestion {
  const base = {
    id: question.id, number, sourceType, prompt: question.prompt, context: question.context ?? '',
    explanation: question.explanation, choices: [] as string[], responseLabels: [] as string[], selection: null,
  };
  switch (question.type) {
    case 'statement': return { ...base, kind: 'statement', answers: [] };
    case 'multiple-choice': return { ...base, kind: 'choice', choices: [...question.choices],
      selection: question.correctAnswers !== undefined ? 'multiple' : 'single',
      answers: (question.correctAnswers ?? [question.answer]).map(text => ({ label: 'Answer', text })) };
    case 'true-false': return { ...base, kind: 'choice', selection: 'single', choices: ['True', 'False'],
      answers: [{ label: 'Answer', text: question.answer }] };
    case 'short-answer': return { ...base, kind: 'response', responseLabels: ['Answer'],
      answers: [{ label: 'Answer', text: question.answer }] };
    case 'fill-in-the-blanks': {
      const answers = parseFillBlankTemplate(question.prompt).answers.map((text, index) =>
        ({ label: `Blank ${index + 1}`, text }));
      return { ...base, kind: 'blanks', prompt: maskFillBlankAnswers(question.prompt),
        responseLabels: answers.map(answer => answer.label), answers };
    }
    case 'dropdown': return { ...base, kind: 'matching', choices: [...question.choices],
      responseLabels: (question.matches ?? []).map(row => row.label),
      answers: (question.matches ?? []).map(row => ({ label: row.label, text: row.answer })) };
    case 'parameterized': {
      if (!question.generated) throw new Error('Generate concrete questions before publishing.');
      const answers = question.generated.answers.map(answer => ({ label: answer.label, text: answer.text }));
      return { ...base, kind: 'response', responseLabels: answers.map(answer => answer.label), answers };
    }
  }
}

/**
 * Validates a detached authored snapshot before async work. Never reads sessions,
 * attempts or statistics, mutates the set, or saves generated variants. Uploaded
 * solvers execute only through the existing sandbox and honor cancellation.
 */
export async function preparePublication(
  item: CheckItem, settings: PublicationSettings, signal?: AbortSignal,
): Promise<PreparedPublication> {
  validatePublicationSettings(settings);
  if (settings.layout === 'gap') throw new Error('Gap publishing is coming soon. Choose Study or Bubble.');
  const seed = settings.seed;
  const sourceId = item.id, title = item.name, description = item.options?.description ?? '';
  if (!title.trim() || title.length > MAX_NAME_LENGTH || description.length > MAX_TEXT) {
    throw new Error('The knowledge set title or description is invalid.');
  }
  const snapshot: unknown = JSON.parse(JSON.stringify(item.questions));
  validateQuestions(snapshot);
  if (!snapshot.length) throw new Error('Add questions before preparing a publication.');
  if (snapshot.some(question => !questionReady(question))) throw new Error('Complete every question before publishing.');
  const questions: PublicationQuestion[] = [];
  for (const [index, original] of snapshot.entries()) {
    signal?.throwIfAborted();
    const questionSeed = `${seed}:${original.id}`;
    const concrete = await materializeQuestionAsync(original, questionSeed, signal);
    const question = materializeChoicePool(concrete, questionSeed);
    questions.push(normalizeQuestion(question, index + 1, original.type));
  }
  signal?.throwIfAborted();
  return { version: 1, sourceId, title, description, seed, questions };
}
