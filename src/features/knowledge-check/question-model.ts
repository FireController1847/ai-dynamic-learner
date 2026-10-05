import { createId, isValidId } from '../../core/ids.ts';
import { isRecord } from '../../core/validation.ts';

export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer';
export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  answer: string;
  explanation: string;
  choices: string[];
}
export const QUESTION_TYPES: readonly { id: QuestionType; label: string }[] = [
  { id: 'multiple-choice', label: 'Multiple Choice' },
  { id: 'true-false', label: 'True or False' },
  { id: 'short-answer', label: 'Short Answer' },
];
export const MAX_QUESTIONS = 200;
export const MAX_TEXT = 2000;

export function createQuestion(type: QuestionType = 'short-answer'): Question {
  return { id: createId(), type, prompt: '', answer: type === 'true-false' ? 'True' : '', explanation: '',
    choices: type === 'multiple-choice' ? ['', '', '', ''] : [] };
}

export function questionReady(question: Question): boolean {
  if (!question.prompt.trim() || !question.answer.trim()) return false;
  if (question.type !== 'multiple-choice') return true;
  const choices = question.choices.map((choice) => choice.trim());
  return choices.length >= 2 && choices.every(Boolean) && new Set(choices).size === choices.length &&
    choices.includes(question.answer.trim());
}

export function answerCorrect(question: Question, response: string): boolean {
  if (question.type !== 'short-answer') return question.answer.trim() === response.trim();
  const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  return normalize(question.answer) === normalize(response);
}

export function validateQuestions(value: unknown): asserts value is Question[] {
  if (!Array.isArray(value) || value.length > MAX_QUESTIONS) throw new Error(`A knowledge set supports up to ${MAX_QUESTIONS} questions.`);
  const ids = new Set<string>();
  for (const question of value as unknown[]) {
    if (!isRecord(question) || !isValidId(question.id) || ids.has(question.id) ||
        !QUESTION_TYPES.some((type) => type.id === question.type) ||
        Object.keys(question).some((key) => !['id', 'type', 'prompt', 'answer', 'explanation', 'choices'].includes(key)) ||
        [question.prompt, question.answer, question.explanation].some((text) => typeof text !== 'string' || text.length > MAX_TEXT) ||
        !Array.isArray(question.choices) || question.choices.length > 8 ||
        question.choices.some((choice) => typeof choice !== 'string' || choice.length > MAX_TEXT) ||
        (question.type !== 'multiple-choice' && question.choices.length !== 0) ||
        (question.type === 'true-false' && !['True', 'False'].includes(String(question.answer)))) {
      throw new Error('A knowledge set contains invalid question data.');
    }
    ids.add(question.id);
  }
}
