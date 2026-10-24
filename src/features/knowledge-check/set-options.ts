import {
  DEFAULT_ANSWER_STRICTNESS,
  isAnswerStrictness,
  type AnswerStrictness,
} from '../../../packages/@dynamic-learner/answer-matching/src/index.ts';
import { isRecord } from '../../core/validation.ts';
import { MAX_QUESTIONS, MAX_TEXT } from './question-model.ts';

export const DEFAULT_QUIZ_ATTEMPTS = 3;
export const DEFAULT_SESSION_QUESTION_LIMIT = 25;
export const DEFAULT_TEST_QUESTION_LIMIT = 38;
export type QuestionOrder = 'forward' | 'backward' | 'shuffle';
export type QuestionPresentation = 'scroll' | 'one-at-a-time';
export const QUESTION_PRESENTATIONS: readonly QuestionPresentation[] = ['scroll', 'one-at-a-time'];
const QUESTION_ORDERS: readonly QuestionOrder[] = ['forward', 'backward', 'shuffle'];

export interface SetOptions {
  description: string;
  shortAnswerStrictness: AnswerStrictness;
  fillBlankAnswerStrictness: AnswerStrictness;
  assessmentOrder: QuestionOrder;
  quizQuestionLimit: number | null;
  testQuestionLimit: number | null;
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
    assessmentOrder: 'shuffle',
    quizQuestionLimit: DEFAULT_SESSION_QUESTION_LIMIT,
    testQuestionLimit: DEFAULT_TEST_QUESTION_LIMIT,
    shuffleChoices: true,
    quizAttempts: DEFAULT_QUIZ_ATTEMPTS,
    quizPresentation: 'scroll',
    quizAllowBack: true,
    testPresentation: 'scroll',
    testAllowBack: true,
    timeLimitMinutes: null,
    showTestAnswers: true,
  };
}

function validQuestionLimit(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) &&
    value >= 1 && value <= MAX_QUESTIONS);
}

export function validateSetOptions(value: unknown): asserts value is SetOptions {
  if (!isRecord(value)) throw new Error('Set options are invalid.');
  // Migrate the old shared Study/Quiz/Test limit into both creator-controlled limits.
  if (Object.hasOwn(value, 'assessmentQuestionLimit')) {
    const legacy = value.assessmentQuestionLimit;
    if (!validQuestionLimit(legacy)) throw new Error('The legacy question limit is invalid.');
    if (!Object.hasOwn(value, 'quizQuestionLimit')) value.quizQuestionLimit = legacy;
    if (!Object.hasOwn(value, 'testQuestionLimit')) value.testQuestionLimit = legacy;
    delete value.assessmentQuestionLimit;
  }
  const defaults = defaultSetOptions();
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (!Object.hasOwn(value, key)) value[key] = defaultValue;
  }

  if (Object.keys(value).some(key => !Object.keys(defaults).includes(key)) ||
      typeof value.description !== 'string' || value.description.length > MAX_TEXT ||
      !isAnswerStrictness(value.shortAnswerStrictness) ||
      !isAnswerStrictness(value.fillBlankAnswerStrictness) ||
      !QUESTION_ORDERS.includes(value.assessmentOrder as QuestionOrder) ||
      !validQuestionLimit(value.quizQuestionLimit) ||
      !validQuestionLimit(value.testQuestionLimit) ||
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
