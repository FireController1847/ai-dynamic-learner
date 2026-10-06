import { isRecord } from '../../core/validation.ts';
import { MAX_TEXT } from './question-model.ts';

export const DEFAULT_QUIZ_ATTEMPTS = 3;

export interface SetOptions {
  description: string;
  quizAttempts: number;
  timeLimitMinutes: number | null;
  showTestAnswers: boolean;
}

export function defaultSetOptions(): SetOptions {
  return { description: '', quizAttempts: DEFAULT_QUIZ_ATTEMPTS, timeLimitMinutes: null, showTestAnswers: true };
}

export function validateSetOptions(value: unknown): asserts value is SetOptions {
  if (!isRecord(value)) throw new Error('Set options are invalid.');
  // Review sets saved before Quiz attempts existed use the current default.
  if (!Object.hasOwn(value, 'quizAttempts')) value.quizAttempts = DEFAULT_QUIZ_ATTEMPTS;

  if (Object.keys(value).some(key => !['description', 'quizAttempts', 'timeLimitMinutes', 'showTestAnswers'].includes(key)) ||
      typeof value.description !== 'string' || value.description.length > MAX_TEXT ||
      typeof value.quizAttempts !== 'number' || !Number.isInteger(value.quizAttempts) || value.quizAttempts < 1 ||
      typeof value.showTestAnswers !== 'boolean' ||
      (value.timeLimitMinutes !== null && (typeof value.timeLimitMinutes !== 'number' || !Number.isInteger(value.timeLimitMinutes) ||
        value.timeLimitMinutes < 1 || value.timeLimitMinutes > 1440))) {
    throw new Error('Set options need a description up to 2,000 characters, at least 1 Quiz attempt per question, a 1–1,440 minute time limit or no limit, and a Test answer visibility choice.');
  }
}
