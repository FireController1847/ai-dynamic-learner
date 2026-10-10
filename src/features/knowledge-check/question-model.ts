import {
  DEFAULT_ANSWER_STRICTNESS,
  isAnswerCorrect,
  type AnswerStrictness,
} from '../../../packages/@dynamic-learner/answer-matching/src/index.ts';
import { fillBlankCorrectness as evaluateFillBlankTemplate, maskFillBlankAnswers, parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { createId, isValidId } from '../../core/ids.ts';
import { isRecord } from '../../core/validation.ts';
import { dropdownCorrectness, dropdownProblem, MAX_DROPDOWN_CHOICES, validateDropdownMatches, type DropdownMatch } from './dropdown-model.ts';

export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer' | 'fill-in-the-blanks' | 'dropdown' | 'statement';
export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  answer: string;
  explanation: string;
  context?: string;
  choices: string[];
  matches?: DropdownMatch[];
}
export type QuestionResponse = string | string[];

export const QUESTION_TYPES: readonly { id: QuestionType; label: string }[] = [
  { id: 'multiple-choice', label: 'Multiple Choice' },
  { id: 'true-false', label: 'True or False' },
  { id: 'short-answer', label: 'Short Answer' },
  { id: 'fill-in-the-blanks', label: 'Fill in the Blanks' },
  { id: 'dropdown', label: 'Dropdown' },
  { id: 'statement', label: 'Statement' },
];
export const MAX_QUESTIONS = 200;
export const MAX_TEXT = 2000;
export const MAX_QUESTION_CONTEXT = 12000;

export function createQuestion(type: QuestionType = 'multiple-choice'): Question {
  return { id: createId(), type, prompt: '', answer: '', explanation: '',
    choices: type === 'multiple-choice' || type === 'dropdown' ? ['', '', '', ''] : [],
    ...(type === 'dropdown' ? { matches: [{ label: '', answer: '' }, { label: '', answer: '' }] } : {}) };
}

export function cloneQuestion(question: Question): Question {
  return { ...question, choices: [...question.choices],
    ...(question.matches ? { matches: question.matches.map(row => ({ ...row })) } : {}) };
}

export function questionReady(question: Question): boolean {
  if (!question.prompt.trim()) return false;
  if (question.type === 'statement') return true;
  if (question.type === 'dropdown') return !dropdownProblem(question.matches ?? [], question.choices);
  if (question.type === 'fill-in-the-blanks') return parseFillBlankTemplate(question.prompt).answers.length > 0;
  if (!question.answer.trim()) return false;
  if (question.type !== 'multiple-choice') return true;
  const choices = question.choices.map((choice) => choice.trim()).filter(Boolean);
  return choices.length >= 2 && choices.every(Boolean) && new Set(choices).size === choices.length &&
    choices.includes(question.answer.trim());
}

export function questionHasContent(question: Question): boolean {
  return Boolean(question.prompt.trim() || question.explanation.trim() || question.choices.some(choice => choice.trim()) ||
    question.answer.trim() || question.context?.trim() || question.matches?.some(row => row.label.trim() || row.answer.trim()));
}

export function questionProblem(question: Question): string {
  if (!question.prompt.trim()) return question.type === 'statement' ? 'Enter the statement.' : 'Enter the question.';
  if (question.type === 'statement') return '';
  if (question.type === 'dropdown') return dropdownProblem(question.matches ?? [], question.choices);
  if (question.type === 'fill-in-the-blanks') {
    return parseFillBlankTemplate(question.prompt).answers.length ? '' : 'Create at least one blank in the question.';
  }
  if (!question.answer.trim()) return question.type === 'multiple-choice' ? 'Select a correct answer.' : 'Enter the correct answer.';
  if (!questionReady(question)) return 'Add at least two distinct answer choices and select one as correct.';
  return '';
}

export function questionsForSave(questions: Question[]): Question[] {
  const entered = questions.filter(questionHasContent);
  for (const [index, question] of entered.entries()) {
    const problem = questionProblem(question);
    if (problem) throw new Error(`Question ${index + 1}: ${problem}`);
  }
  return entered.map(question => ({ ...cloneQuestion(question), choices: question.choices.filter(choice => choice.trim()) }));
}

export function questionDisplayPrompt(question: Question): string {
  return question.type === 'fill-in-the-blanks' ? maskFillBlankAnswers(question.prompt) : question.prompt;
}

export function questionScored(question: Question): boolean {
  return question.type !== 'statement';
}

export function questionResponseAnswered(question: Question, response: QuestionResponse | undefined): boolean {
  if (question.type === 'statement') return true;
  if (question.type === 'dropdown') return Boolean(question.matches?.length) && Array.isArray(response) &&
    question.matches!.every((_row, index) => question.choices.some(choice => choice.trim() === response[index]?.trim()));
  if (question.type === 'fill-in-the-blanks') {
    const answers = parseFillBlankTemplate(question.prompt).answers;
    return answers.length > 0 && Array.isArray(response) && answers.every((_answer, index) => Boolean(response[index]?.trim()));
  }
  return typeof response === 'string' && Boolean(response.trim());
}

export function fillBlankCorrectness(
  question: Question,
  response: QuestionResponse | undefined,
  strictness: AnswerStrictness = DEFAULT_ANSWER_STRICTNESS,
): boolean[] {
  if (question.type !== 'fill-in-the-blanks') return [];
  const template = parseFillBlankTemplate(question.prompt);
  const responses = Array.isArray(response) ? response : [];
  return evaluateFillBlankTemplate(template, responses,
    (answer, submitted) => isAnswerCorrect(answer, submitted, { strictness }));
}

export function fillBlankCorrectCount(
  question: Question,
  response: QuestionResponse | undefined,
  strictness: AnswerStrictness = DEFAULT_ANSWER_STRICTNESS,
): number {
  return fillBlankCorrectness(question, response, strictness).filter(Boolean).length;
}

export function answerCorrect(
  question: Question,
  response: QuestionResponse,
  strictness: AnswerStrictness = DEFAULT_ANSWER_STRICTNESS,
): boolean {
  if (question.type === 'statement') return false;
  if (question.type === 'dropdown') return Boolean(question.matches?.length) && dropdownCorrectness(question.matches!, response).every(Boolean);
  if (question.type === 'fill-in-the-blanks') {
    const template = parseFillBlankTemplate(question.prompt);
    if (!template.answers.length || !Array.isArray(response)) return false;
    return fillBlankCorrectness(question, response, strictness).every(Boolean);
  }
  if (typeof response !== 'string') return false;
  if (question.type !== 'short-answer') return question.answer.trim() === response.trim();
  return isAnswerCorrect(question.answer, response, { strictness });
}

export function validateQuestions(value: unknown): asserts value is Question[] {
  if (!Array.isArray(value) || value.length > MAX_QUESTIONS) throw new Error(`A knowledge set supports up to ${MAX_QUESTIONS} questions.`);
  const ids = new Set<string>();
  for (const question of value as unknown[]) {
    if (!isRecord(question) || !isValidId(question.id) || ids.has(question.id) ||
        !QUESTION_TYPES.some((type) => type.id === question.type) ||
        Object.keys(question).some((key) => !['id', 'type', 'prompt', 'answer', 'explanation', 'choices', 'matches', 'context'].includes(key)) ||
        (Object.hasOwn(question, 'context') && (typeof question.context !== 'string' || question.context.length > MAX_QUESTION_CONTEXT)) ||
        [question.prompt, question.answer, question.explanation].some((text) => typeof text !== 'string' || text.length > MAX_TEXT) ||
        !Array.isArray(question.choices) || question.choices.length > (question.type === 'dropdown' ? MAX_DROPDOWN_CHOICES : 8) ||
        question.choices.some((choice) => typeof choice !== 'string' || choice.length > MAX_TEXT) ||
        (question.type !== 'multiple-choice' && question.type !== 'dropdown' && question.choices.length !== 0) ||
        (question.type === 'true-false' && !['', 'True', 'False'].includes(String(question.answer))) ||
        ((question.type === 'fill-in-the-blanks' || question.type === 'statement' || question.type === 'dropdown') && question.answer !== '') ||
        (question.type !== 'dropdown' && Object.hasOwn(question, 'matches')) ||
        (question.type === 'statement' && question.explanation !== '')) {
      throw new Error('A knowledge set contains invalid question data.');
    }
    if (question.type === 'dropdown') validateDropdownMatches(question.matches, MAX_TEXT);
    ids.add(question.id);
  }
}
