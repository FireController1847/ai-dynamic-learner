import {
  DEFAULT_ANSWER_STRICTNESS,
  answerSimilarity,
  isAnswerCorrect,
  normalizeAnswer,
  type AnswerStrictness,
} from '../../../packages/@dynamic-learner/answer-matching/src/index.ts';

export {
  maskFillBlankAnswers,
  parseFillBlankTemplate,
  restoreFillBlankAnswers,
} from '../../core/fill-blank.ts';
export type {
  FillBlankAnswerSegment,
  FillBlankSegment,
  FillBlankTemplate,
  FillBlankTextSegment,
} from '../../core/fill-blank.ts';

export { DEFAULT_ANSWER_STRICTNESS };
export type { AnswerStrictness };

export const normalizeFillBlankAnswer = normalizeAnswer;
export const fillBlankAnswerSimilarity = answerSimilarity;

export function isFillBlankAnswerCorrect(
  answer: string,
  response: string,
  strictness: AnswerStrictness = DEFAULT_ANSWER_STRICTNESS,
): boolean {
  return isAnswerCorrect(answer, response, { strictness });
}
