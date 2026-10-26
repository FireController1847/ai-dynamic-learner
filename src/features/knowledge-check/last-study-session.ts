import type { GeneratedVariant } from '../../core/parameterized/generator.ts';
import { validateGeneratedVariant } from '../../core/parameterized/variant-validation.ts';
import { isRecord } from '../../core/validation.ts';
import { cloneQuestion, validateQuestions, type Question, type QuestionResponse } from './question-model.ts';
import { validateSetOptions } from './set-options.ts';
import type { SessionSettings } from './session-settings.ts';

/** One replaceable Study recap per knowledge set, separate from Quiz/Test history. */
export interface LastStudySession {
  completedAt: number;
  settings: SessionSettings;
  questions: Question[];
  variants: Record<string, GeneratedVariant>;
  feedbackResponses: Record<string, QuestionResponse>;
  attempts: Record<string, number>;
  hints: string[];
  revealed: string[];
  studyChecks: number;
  studyCorrectChecks: number;
  studyUncreditedChecks?: number;
}
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
export function completedStudySession(
  settings: SessionSettings,
  questions: readonly Question[],
  feedbackResponses: Record<string, QuestionResponse>,
  attempts: Record<string, number>,
  hints: readonly string[],
  revealed: readonly string[],
  studyChecks: number,
  studyCorrectChecks: number,
  studyUncreditedChecks: number,
): LastStudySession {
  const variants: Record<string, GeneratedVariant> = {};
  const templates = questions.map(question => {
    if (question.generated) variants[question.id] = copy(question.generated);
    const template = cloneQuestion(question);
    delete template.generated;
    return template;
  });
  return {
    completedAt: Date.now(), settings: copy(settings), questions: copy(templates), variants,
    feedbackResponses: copy(feedbackResponses), attempts: { ...attempts },
    hints: [...hints], revealed: [...revealed], studyChecks, studyCorrectChecks, studyUncreditedChecks,
  };
}
export function reviewedStudyQuestions(session: LastStudySession): Question[] {
  return session.questions.map(question => ({
    ...cloneQuestion(question),
    ...(session.variants[question.id] ? { generated: copy(session.variants[question.id]) } : {}),
  }));
}
function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
/** Validate snapshots restored from IndexedDB or imported backups. */
export function validateLastStudySession(value: unknown): asserts value is LastStudySession {
  if (!isRecord(value) || Object.keys(value).some(key => ![
    'completedAt', 'settings', 'questions', 'variants', 'feedbackResponses', 'attempts',
    'hints', 'revealed', 'studyChecks', 'studyCorrectChecks', 'studyUncreditedChecks',
  ].includes(key)) ||
      !natural(value.completedAt) || value.completedAt > 8640000000000000 ||
      !natural(value.studyChecks) || !natural(value.studyCorrectChecks) ||
      value.studyCorrectChecks > value.studyChecks ||
      (value.studyUncreditedChecks !== undefined &&
        (!natural(value.studyUncreditedChecks) || value.studyCorrectChecks + value.studyUncreditedChecks > value.studyChecks))) {
    throw new Error('The last Study session is invalid.');
  }
  validateQuestions(value.questions, { allowGeneratedHistorySnapshots: true });
  const questions = value.questions;
  if (!questions.length) throw new Error('The last Study session contains no questions.');
  const ids = new Set(questions.map(question => question.id));
  if (!isRecord(value.settings) || Object.keys(value.settings).some(key => ![
    'order', 'presentation', 'allowBack', 'questionLimit', 'shuffleChoices',
    'shortAnswerStrictness', 'fillBlankAnswerStrictness', 'quizAttempts',
    'timeLimitMinutes', 'showTestAnswers',
  ].includes(key))) throw new Error('The last Study session settings are invalid.');
  const settings = value.settings;
  validateSetOptions({
    description: '', assessmentOrder: settings.order, quizQuestionLimit: settings.questionLimit, testQuestionLimit: settings.questionLimit,
    quizPresentation: settings.presentation, testPresentation: settings.presentation,
    quizAllowBack: settings.allowBack, testAllowBack: settings.allowBack,
    shuffleChoices: settings.shuffleChoices, shortAnswerStrictness: settings.shortAnswerStrictness,
    fillBlankAnswerStrictness: settings.fillBlankAnswerStrictness, quizAttempts: settings.quizAttempts,
    timeLimitMinutes: settings.timeLimitMinutes, showTestAnswers: settings.showTestAnswers,
  });
  if (!isRecord(value.variants) || Object.entries(value.variants).some(([id, variant]) => {
    const question = questions.find(entry => entry.id === id);
    if (!question || !['parameterized', 'multiple-choice', 'true-false', 'fill-in-the-blanks', 'dropdown'].includes(question.type)) return true;
    validateGeneratedVariant(variant);
    return false;
  })) throw new Error('The last Study session contains invalid generated questions.');
  if (!isRecord(value.feedbackResponses) || Object.entries(value.feedbackResponses).some(([id, response]) =>
    !ids.has(id) || !(typeof response === 'string' && response.length <= 2000 ||
      Array.isArray(response) && response.length <= 1000 &&
      response.every(entry => typeof entry === 'string' && entry.length <= 2000)))) {
    throw new Error('The last Study session contains invalid answers.');
  }
  if (!isRecord(value.attempts) || Object.entries(value.attempts).some(([id, count]) => !ids.has(id) || !natural(count))) {
    throw new Error('The last Study session contains invalid checks.');
  }
  for (const key of ['hints', 'revealed'] as const) {
    const list = value[key];
    if (!Array.isArray(list) || list.length > ids.size || new Set(list).size !== list.length ||
        list.some(id => typeof id !== 'string' || !ids.has(id))) {
      throw new Error('The last Study session contains invalid hints or answer reveals.');
    }
  }
}
