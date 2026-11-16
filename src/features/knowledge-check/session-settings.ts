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
      order: saved.assessmentOrder,
      presentation: 'scroll',
      allowBack: true,
      questionLimit: saved.quizQuestionLimit,
      shuffleChoices: saved.shuffleChoices,
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
    questionLimit: mode === 'test' ? saved.testQuestionLimit : saved.quizQuestionLimit,
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
 * Split the authored order into equal-sized (or nearly equal) contiguous
 * groups first, then choose uniformly among the least-shown questions in each.
 * Display ordering happens later, so all modes retain the same coverage policy.
 */
export function sampleStudyQuestions<T>(source: readonly T[], limit: number, shownCount: (entry: T) => number = () => 0): T[] {
  if (limit >= source.length) return [...source];
  const chosen: T[] = [];
  for (let section = 0; section < limit; section += 1) {
    const start = Math.floor(section * source.length / limit);
    const end = Math.floor((section + 1) * source.length / limit);
    let least = Infinity;
    let candidates: T[] = [];
    for (let index = start; index < end; index += 1) {
      const entry = source[index]!;
      const count = shownCount(entry);
      if (count < least) { least = count; candidates = [entry]; }
      else if (count === least) candidates.push(entry);
    }
    chosen.push(candidates[Math.floor(Math.random() * candidates.length)]!);
  }
  return chosen;
}

export function prepareSessionQuestions(
  source: readonly Question[],
  settings: SessionSettings,
): Question[] {
  // All modes sample the authored order before applying the display order.
  let questions = settings.questionLimit !== null && source.length > settings.questionLimit
    ? sampleStudyQuestions(source, settings.questionLimit, question => question.shownCount ?? 0)
    : [...source];
  if (settings.order === 'backward') questions.reverse();
  else if (settings.order === 'shuffle') questions = shuffled(questions);
  if (settings.questionLimit !== null) questions = questions.slice(0, settings.questionLimit);
  // Dropdown options are randomized once by sessionVariant using the saved
  // session seed. Do not pre-shuffle them here or the order cannot be
  // reconstructed independently from the authored question.
  if (settings.shuffleChoices) {
    questions = questions.map((question) => question.type === 'multiple-choice'
      ? { ...cloneQuestion(question), choices: shuffled(question.choices) }
      : question);
  }
  return questions;
}

export function sessionQuestionCount(available: number, settings: SessionSettings): number {
  return settings.questionLimit === null ? available : Math.min(available, settings.questionLimit);
}
