import { isRecord } from '../../core/validation.ts';
import { MAX_TEXT } from './question-model.ts';

export interface SetOptions { description: string; timeLimitMinutes: number | null; showTestAnswers: boolean }
export function defaultSetOptions(): SetOptions { return { description: '', timeLimitMinutes: null, showTestAnswers: true }; }
export function validateSetOptions(value: unknown): asserts value is SetOptions {
  if (!isRecord(value) || Object.keys(value).some(key => !['description', 'timeLimitMinutes', 'showTestAnswers'].includes(key)) ||
      typeof value.description !== 'string' || value.description.length > MAX_TEXT || typeof value.showTestAnswers !== 'boolean' ||
      (value.timeLimitMinutes !== null && (typeof value.timeLimitMinutes !== 'number' || !Number.isInteger(value.timeLimitMinutes) ||
        value.timeLimitMinutes < 1 || value.timeLimitMinutes > 1440))) {
    throw new Error('Set options need a description up to 2,000 characters, a 1–1,440 minute time limit or no limit, and a Test answer visibility choice.');
  }
}
