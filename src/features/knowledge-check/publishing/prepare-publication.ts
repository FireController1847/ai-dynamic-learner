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

/** A single policy drives both visible warnings and publication filtering. */
function bubbleExclusion(question: Pick<Question, 'type' | 'choices'>): string {
  switch (question.type) {
    case 'short-answer': return 'Short Answer requires typed answers';
    case 'fill-in-the-blanks': return 'Fill in the Blanks requires written answers';
    case 'parameterized': return 'Parameterized questions are not supported in Bubble yet';
    case 'multiple-choice':
    case 'dropdown': return question.choices.length > 8 ? 'more than eight choices (A–H)' : '';
    default: return '';
  }
}

export function bubblePublicationExclusions(questions: readonly Pick<Question, 'type' | 'choices'>[]) {
  return questions.flatMap((question, index) => {
    const reason = bubbleExclusion(question);
    return reason ? [{ number: index + 1, reason }] : [];
  });
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
  const included = snapshot.map((question, index) => ({ question, number: index + 1 }))
    .filter(({ question }) => settings.layout !== 'bubble' || !bubbleExclusion(question));
  if (!included.length) throw new Error('No supported questions remain for Bubble. Add a choice-based question or choose Study.');
  if (included.some(({ question }) => !questionReady(question))) throw new Error('Complete every included question before publishing.');
  const questions: PublicationQuestion[] = [];
  for (const { question: original, number } of included) {
    signal?.throwIfAborted();
    const questionSeed = `${seed}:${original.id}`;
    const concrete = await materializeQuestionAsync(original, questionSeed, signal);
    const question = materializeChoicePool(concrete, questionSeed);
    questions.push(normalizeQuestion(question, number, original.type));
  }
  signal?.throwIfAborted();
  return { version: 1, sourceId, title, description, seed, questions };
}
