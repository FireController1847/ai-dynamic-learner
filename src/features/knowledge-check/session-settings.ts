import type { AnswerStrictness } from '../../../packages/@dynamic-learner/answer-matching/src/index.ts';
import type { CheckModeId } from './check-types.ts';
import { defaultSetOptions, type QuestionOrder, type QuestionPresentation, type SetOptions } from './set-options.ts';
import { cloneQuestion, type Question } from './question-model.ts';

export interface SessionSettings {
  order: QuestionOrder;
  presentation: QuestionPresentation;
  allowBack: boolean;
  questionLimit: number | null;
  shuffleChoices: boolean;
  shortAnswerStrictness: AnswerStrictness;
  fillBlankAnswerStrictness: AnswerStrictness;
  quizAttempts: number;
  timeLimitMinutes: number | null;
  showTestAnswers: boolean;
}

export function answerStrictnessForQuestion(
  settings: Pick<SessionSettings, 'shortAnswerStrictness' | 'fillBlankAnswerStrictness'>,
  type: Question['type'],
): AnswerStrictness {
  return type === 'fill-in-the-blanks' ? settings.fillBlankAnswerStrictness : settings.shortAnswerStrictness;
}

export const QUESTION_ORDER_LABELS: Record<QuestionOrder, string> = {
  forward: 'In order',
  backward: 'Reverse order',
  shuffle: 'Shuffled',
};

export function settingsForMode(options: SetOptions | undefined, mode: CheckModeId): SessionSettings {
  const saved = { ...defaultSetOptions(), ...options };
  if (mode === 'study') {
    return {
      order: 'forward',
      presentation: 'scroll',
      allowBack: true,
      questionLimit: saved.assessmentQuestionLimit,
      shuffleChoices: false,
      shortAnswerStrictness: saved.shortAnswerStrictness,
      fillBlankAnswerStrictness: saved.fillBlankAnswerStrictness,
      quizAttempts: saved.quizAttempts,
      timeLimitMinutes: null,
      showTestAnswers: true,
    };
  }
  return {
    order: saved.assessmentOrder,
    presentation: mode === 'quiz' ? saved.quizPresentation : saved.testPresentation,
    allowBack: mode === 'quiz' ? saved.quizAllowBack : saved.testAllowBack,
    questionLimit: saved.assessmentQuestionLimit,
    shuffleChoices: saved.shuffleChoices,
    shortAnswerStrictness: saved.shortAnswerStrictness,
    fillBlankAnswerStrictness: saved.fillBlankAnswerStrictness,
    quizAttempts: saved.quizAttempts,
    timeLimitMinutes: mode === 'test' ? saved.timeLimitMinutes : null,
    showTestAnswers: mode === 'test' ? saved.showTestAnswers : true,
  };
}

function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

/**
 * Select one question from each contiguous slice of the authored order.
 * For 60 questions and a cap of 25, this samples across 25 sections of
 * roughly 2–3 questions each without duplicates or front-loading the set.
 */
export function sampleStudyQuestions<T>(source: readonly T[], limit: number): T[] {
  if (limit >= source.length) return [...source];
  const chosen: T[] = [];
  for (let section = 0; section < limit; section += 1) {
    const start = Math.floor(section * source.length / limit);
    const end = Math.floor((section + 1) * source.length / limit);
    chosen.push(source[start + Math.floor(Math.random() * (end - start))]!);
  }
  return chosen;
}

export function prepareSessionQuestions(
  source: readonly Question[],
  settings: SessionSettings,
  evenlySampledStudy = false,
): Question[] {
  // Study samples the authored order before changing its display order so
  // Reverse and Shuffle still cover the whole source instead of one end.
  let questions = evenlySampledStudy && settings.questionLimit !== null && source.length > settings.questionLimit
    ? sampleStudyQuestions(source, settings.questionLimit)
    : [...source];
  if (settings.order === 'backward') questions.reverse();
  else if (settings.order === 'shuffle') questions = shuffled(questions);
  if (settings.questionLimit !== null) questions = questions.slice(0, settings.questionLimit);
  if (settings.shuffleChoices) {
    questions = questions.map((question) => question.type === 'multiple-choice' || question.type === 'dropdown'
      ? { ...cloneQuestion(question), choices: shuffled(question.choices) }
      : question);
  }
  return questions;
}

export function sessionQuestionCount(available: number, settings: SessionSettings): number {
  return settings.questionLimit === null ? available : Math.min(available, settings.questionLimit);
}
