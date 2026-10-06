import {
  answerSimilarity,
  evaluateAnswer as evaluatePackageAnswer,
  normalizeAnswer,
  type AnswerMatchResult as PackageAnswerMatchResult,
} from '../../packages/@dynamic-learner/answer-matching/src/index.ts';

export type AnswerMatchReason = 'exact' | 'inflection' | 'fuzzy' | 'incorrect';

export interface AnswerMatchResult {
  correct: boolean;
  reason: AnswerMatchReason;
  similarity: number;
}

export { answerSimilarity, normalizeAnswer };

export function answersMatchMorphology(answer: string, response: string): boolean {
  return evaluatePackageAnswer(answer, response, { strictness: 3 }).reason === 'linguistic';
}

export function evaluateAnswer(answer: string, response: string): AnswerMatchResult {
  const result: PackageAnswerMatchResult = evaluatePackageAnswer(answer, response, { strictness: 3 });
  return {
    correct: result.correct,
    reason: result.reason === 'linguistic' ? 'inflection'
      : result.reason === 'semantic' ? 'incorrect'
        : result.reason,
    similarity: result.similarity,
  };
}

export function isAnswerCorrect(answer: string, response: string): boolean {
  return evaluateAnswer(answer, response).correct;
}
