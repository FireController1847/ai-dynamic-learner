import { answerSimilarity, normalizeAnswer } from '../../core/answer-matching.ts';
export {
  isFillBlankAnswerCorrect,
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

export const normalizeFillBlankAnswer = normalizeAnswer;
export const fillBlankAnswerSimilarity = answerSimilarity;
