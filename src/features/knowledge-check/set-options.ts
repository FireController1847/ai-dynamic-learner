import {
  DEFAULT_ANSWER_STRICTNESS,
  isAnswerStrictness,
  type AnswerStrictness,
} from '../../../packages/@dynamic-learner/answer-matching/src/index.ts';
import { isRecord } from '../../core/validation.ts';
import { MAX_QUESTIONS, MAX_TEXT } from './question-model.ts';

export const DEFAULT_QUIZ_ATTEMPTS = 3;
export type QuestionOrder = 'forward' | 'backward' | 'shuffle';
export type QuestionPresentation = 'scroll' | 'one-at-a-time';
export const QUESTION_PRESENTATIONS: readonly QuestionPresentation[] = ['scroll', 'one-at-a-time'];
const QUESTION_ORDERS: readonly QuestionOrder[] = ['forward', 'backward', 'shuffle'];

export interface SetOptions {
  description: string;
  shortAnswerStrictness: AnswerStrictness;
  fillBlankAnswerStrictness: AnswerStrictness;
  assessmentOrder: QuestionOrder;
  assessmentQuestionLimit: number | null;
  shuffleChoices: boolean;
  quizAttempts: number;
  quizPresentation: QuestionPresentation;
  quizAllowBack: boolean;
  testPresentation: QuestionPresentation;
  testAllowBack: boolean;
  timeLimitMinutes: number | null;
  showTestAnswers: boolean;
}

export function defaultSetOptions(): SetOptions {
  return {
    description: '',
    shortAnswerStrictness: DEFAULT_ANSWER_STRICTNESS,
    fillBlankAnswerStrictness: DEFAULT_ANSWER_STRICTNESS,
    assessmentOrder: 'forward',
    assessmentQuestionLimit: null,
    shuffleChoices: false,
    quizAttempts: DEFAULT_QUIZ_ATTEMPTS,
    quizPresentation: 'scroll',
    quizAllowBack: true,
    testPresentation: 'scroll',
    testAllowBack: true,
    timeLimitMinutes: null,
    showTestAnswers: true,
  };
}

export function validateSetOptions(value: unknown): asserts value is SetOptions {
  if (!isRecord(value)) throw new Error('Set options are invalid.');
  const defaults = defaultSetOptions();
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (!Object.hasOwn(value, key)) value[key] = defaultValue;
  }

  if (Object.keys(value).some(key => !Object.keys(defaults).includes(key)) ||
      typeof value.description !== 'string' || value.description.length > MAX_TEXT ||
      !isAnswerStrictness(value.shortAnswerStrictness) ||
      !isAnswerStrictness(value.fillBlankAnswerStrictness) ||
      !QUESTION_ORDERS.includes(value.assessmentOrder as QuestionOrder) ||
      (value.assessmentQuestionLimit !== null &&
        (typeof value.assessmentQuestionLimit !== 'number' || !Number.isInteger(value.assessmentQuestionLimit) ||
          value.assessmentQuestionLimit < 1 || value.assessmentQuestionLimit > MAX_QUESTIONS)) ||
      typeof value.shuffleChoices !== 'boolean' ||
      typeof value.quizAttempts !== 'number' || !Number.isInteger(value.quizAttempts) || value.quizAttempts < 1 ||
      !QUESTION_PRESENTATIONS.includes(value.quizPresentation as QuestionPresentation) ||
      !QUESTION_PRESENTATIONS.includes(value.testPresentation as QuestionPresentation) ||
      typeof value.quizAllowBack !== 'boolean' || typeof value.testAllowBack !== 'boolean' ||
      typeof value.showTestAnswers !== 'boolean' ||
      (value.timeLimitMinutes !== null && (typeof value.timeLimitMinutes !== 'number' || !Number.isInteger(value.timeLimitMinutes) ||
        value.timeLimitMinutes < 1 || value.timeLimitMinutes > 1440))) {
    throw new Error('Set options contain invalid Quiz or Test defaults.');
  }
}
