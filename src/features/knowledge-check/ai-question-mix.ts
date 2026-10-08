import { MAX_QUESTIONS, QUESTION_TYPES, type QuestionType } from './question-model.ts';

export type QuestionWeights = Record<QuestionType, number>;
export const AI_QUESTION_TYPES = ['multiple-choice', 'true-false', 'fill-in-the-blanks', 'short-answer', 'statement'] as const;
export const DEFAULT_AI_WEIGHTS: QuestionWeights = {
  'multiple-choice': 60, 'true-false': 25, 'fill-in-the-blanks': 15, 'short-answer': 0, statement: 0,
};
export const questionTypeLabel = (type: QuestionType) => QUESTION_TYPES.find(entry => entry.id === type)?.label ?? type;

export function questionMixProblem(weights: QuestionWeights, count: number): string {
  if (!Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS) return `Choose 1–${MAX_QUESTIONS} questions.`;
  if (AI_QUESTION_TYPES.some(type => !Number.isInteger(weights[type]) || weights[type] < 0 || weights[type] > 100)) {
    return 'Each percentage must be a whole number from 0 to 100.';
  }
  return AI_QUESTION_TYPES.reduce((sum, type) => sum + weights[type], 0) === 100 ? '' : 'Question percentages must total 100%.';
}

export function allocateQuestions(weights: QuestionWeights, count: number): QuestionWeights {
  const problem = questionMixProblem(weights, count);
  if (problem) throw new Error(problem);
  const result: QuestionWeights = { 'multiple-choice': 0, 'true-false': 0, 'fill-in-the-blanks': 0, 'short-answer': 0, statement: 0 };
  const remainders = AI_QUESTION_TYPES.map((type, order) => {
    const exact = weights[type] * count / 100;
    result[type] = Math.floor(exact);
    return { type, order, remainder: exact - result[type] };
  }).sort((left, right) => right.remainder - left.remainder || left.order - right.order);
  const remaining = count - AI_QUESTION_TYPES.reduce((sum, type) => sum + result[type], 0);
  for (const entry of remainders.slice(0, remaining)) result[entry.type] += 1;
  return result;
}
