import { MAX_QUESTIONS, QUESTION_TYPES, type QuestionType } from './question-model.ts';

export type QuestionWeights = Record<QuestionType, number>;
export const AI_QUESTION_TYPES = ['multiple-choice', 'true-false', 'fill-in-the-blanks', 'dropdown', 'short-answer', 'statement'] as const;
export const DEFAULT_AI_WEIGHTS: QuestionWeights = {
  'multiple-choice': 58, 'true-false': 23, 'fill-in-the-blanks': 14, dropdown: 5, 'short-answer': 0, statement: 0,
};
export const questionTypeLabel = (type: QuestionType) => QUESTION_TYPES.find(entry => entry.id === type)?.label ?? type;

/** Keep the edited value; share its change equally, respecting each 0–100 bound. */
export function rebalanceQuestionWeights(weights: QuestionWeights, edited: QuestionType, requested: number): QuestionWeights {
  const valid = AI_QUESTION_TYPES.every(type => Number.isInteger(weights[type]) && weights[type] >= 0 && weights[type] <= 100) &&
    AI_QUESTION_TYPES.reduce((sum, type) => sum + weights[type], 0) === 100;
  const next = { ...(valid ? weights : DEFAULT_AI_WEIGHTS) };
  const value = Number.isFinite(requested) ? Math.max(0, Math.min(100, Math.round(requested))) : next[edited];
  const difference = value - next[edited];
  next[edited] = value;
  let remaining = Math.abs(difference);
  while (remaining > 0) {
    const available = AI_QUESTION_TYPES.filter(type => type !== edited &&
      (difference > 0 ? next[type] > 0 : next[type] < 100));
    const share = Math.max(1, Math.floor(remaining / available.length));
    for (const type of available) {
      const change = Math.min(remaining, share, difference > 0 ? next[type] : 100 - next[type]);
      next[type] += difference > 0 ? -change : change;
      remaining -= change;
    }
  }
  return next;
}

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
  const result: QuestionWeights = { 'multiple-choice': 0, 'true-false': 0, 'fill-in-the-blanks': 0, dropdown: 0, 'short-answer': 0, statement: 0 };
  const remainders = AI_QUESTION_TYPES.map((type, order) => {
    const exact = weights[type] * count / 100;
    result[type] = Math.floor(exact);
    return { type, order, remainder: exact - result[type] };
  }).sort((left, right) => right.remainder - left.remainder || left.order - right.order);
  const remaining = count - AI_QUESTION_TYPES.reduce((sum, type) => sum + result[type], 0);
  for (const entry of remainders.slice(0, remaining)) result[entry.type] += 1;
  return result;
}
