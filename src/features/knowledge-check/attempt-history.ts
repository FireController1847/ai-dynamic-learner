import type { GeneratedVariant } from '../../core/parameterized/generator.ts';
import { validateGeneratedVariant } from '../../core/parameterized/variant-validation.ts';
import { createId, isValidId } from '../../core/ids.ts';
import { isRecord } from '../../core/validation.ts';
import { answerCorrect, cloneQuestion, questionScored, validateQuestions, type Question, type QuestionResponse } from './question-model.ts';
import { validateSetOptions } from './set-options.ts';
import { answerStrictnessForQuestion, type SessionSettings } from './session-settings.ts';

export type AssessmentMode = 'quiz' | 'test';

/** Frozen, portable results of one completed attempt; never used to resume answering. */
export interface ReviewAttempt {
  id: string;
  mode: AssessmentMode;
  completedAt: number;
  settings: SessionSettings;
  questions: Question[];
  variants: Record<string, GeneratedVariant>;
  responses: Record<string, QuestionResponse>;
  feedbackResponses: Record<string, QuestionResponse>;
  attempts: Record<string, number>;
  correctIds: string[];
  score: number;
  scoredCount: number;
  expired: boolean;
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function completedReviewAttempt(
  mode: AssessmentMode,
  settings: SessionSettings,
  questions: readonly Question[],
  responses: Record<string, QuestionResponse>,
  feedbackResponses: Record<string, QuestionResponse>,
  attempts: Record<string, number>,
  expired: boolean,
): ReviewAttempt {
  const variants: Record<string, GeneratedVariant> = {};
  const templates = questions.map(question => {
    if (question.generated) variants[question.id] = copy(question.generated);
    const template = cloneQuestion(question);
    delete template.generated;
    return template;
  });
  const correctIds = questions.filter(question => questionScored(question) &&
    answerCorrect(question, responses[question.id] ?? '', answerStrictnessForQuestion(settings, question.type)))
    .map(question => question.id);
  return {
    id: createId(), mode, completedAt: Date.now(), settings: copy(settings),
    questions: copy(templates), variants,
    responses: copy(responses), feedbackResponses: copy(feedbackResponses),
    attempts: { ...attempts }, correctIds,
    score: correctIds.length, scoredCount: questions.filter(questionScored).length, expired,
  };
}

export function reviewedQuestions(attempt: ReviewAttempt): Question[] {
  return attempt.questions.map(question => ({
    ...cloneQuestion(question),
    ...(attempt.variants[question.id] ? { generated: copy(attempt.variants[question.id]) } : {}),
  }));
}

function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validResponses(value: unknown, ids: Set<string>): boolean {
  return isRecord(value) && Object.entries(value).every(([id, response]) =>
    ids.has(id) && (typeof response === 'string' && response.length <= 2000 ||
      Array.isArray(response) && response.length <= 1000 &&
      response.every(entry => typeof entry === 'string' && entry.length <= 2000)));
}

/** Review history is part of the workspace/backups, so it must be validated on load. */
export function validateReviewHistory(value: unknown): asserts value is ReviewAttempt[] {
  if (!Array.isArray(value)) throw new Error('Review attempt history must be a list.');
  const seen = new Set<string>();
  for (const attempt of value) {
    if (!isRecord(attempt) || Object.keys(attempt).some(key => ![
      'id', 'mode', 'completedAt', 'settings', 'questions', 'variants', 'responses',
      'feedbackResponses', 'attempts', 'correctIds', 'score', 'scoredCount', 'expired',
    ].includes(key)) || !isValidId(attempt.id) || seen.has(attempt.id) ||
        (attempt.mode !== 'quiz' && attempt.mode !== 'test') ||
        !natural(attempt.completedAt) || attempt.completedAt > 8640000000000000 ||
        typeof attempt.expired !== 'boolean') {
      throw new Error('A saved Review attempt is invalid.');
    }
    seen.add(attempt.id);
    validateQuestions(attempt.questions, { allowGeneratedHistorySnapshots: true });
    if (!attempt.questions.length) throw new Error('A Review attempt has no questions.');
    const ids = new Set((attempt.questions as Question[]).map(question => question.id));
    if (!isRecord(attempt.settings) || Object.keys(attempt.settings).some(key => ![
      'order','presentation','allowBack','questionLimit','shuffleChoices','shortAnswerStrictness',
      'fillBlankAnswerStrictness','quizAttempts','timeLimitMinutes','showTestAnswers',
    ].includes(key))) throw new Error('A Review attempt has invalid settings.');
    const settings = attempt.settings;
    validateSetOptions({
      description: '', assessmentOrder: settings.order, assessmentQuestionLimit: settings.questionLimit,
      quizPresentation: settings.presentation, testPresentation: settings.presentation,
      quizAllowBack: settings.allowBack, testAllowBack: settings.allowBack,
      shuffleChoices: settings.shuffleChoices, shortAnswerStrictness: settings.shortAnswerStrictness,
      fillBlankAnswerStrictness: settings.fillBlankAnswerStrictness, quizAttempts: settings.quizAttempts,
      timeLimitMinutes: settings.timeLimitMinutes, showTestAnswers: settings.showTestAnswers,
    });
    if (!isRecord(attempt.variants) || Object.entries(attempt.variants).some(([id, variant]) => {
      const question = (attempt.questions as Question[]).find(q => q.id === id);
      // Materializing a parameterized template changes its public type for choice,
      // true/false, blank, and dropdown presentations. Those are still generated.
      if (!question || !['parameterized', 'multiple-choice', 'true-false', 'fill-in-the-blanks', 'dropdown'].includes(question.type)) return true;
      validateGeneratedVariant(variant);
      return false;
    }) || (attempt.questions as Question[]).some(q => q.type === 'parameterized' && !Object.hasOwn(attempt.variants as Record<string, unknown>, q.id))) {
      throw new Error('A Review attempt contains invalid generated questions.');
    }
    if (!validResponses(attempt.responses, ids) || !validResponses(attempt.feedbackResponses, ids) ||
        !isRecord(attempt.attempts) || Object.entries(attempt.attempts).some(([id, count]) => !ids.has(id) || !natural(count)) ||
        !Array.isArray(attempt.correctIds) || attempt.correctIds.length > ids.size ||
        new Set(attempt.correctIds).size !== attempt.correctIds.length ||
        attempt.correctIds.some(id => typeof id !== 'string' || !ids.has(id)) ||
        !natural(attempt.score) || attempt.score !== attempt.correctIds.length ||
        !natural(attempt.scoredCount) ||
        attempt.scoredCount !== (attempt.questions as Question[]).filter(questionScored).length ||
        attempt.score > attempt.scoredCount) {
      throw new Error('A Review attempt contains invalid responses or scores.');
    }
  }
}
