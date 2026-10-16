import { seededRandom } from '../../core/parameterized/random.ts';
import { cloneQuestion, type Question } from './question-model.ts';

/**
 * Choose one deterministic option set per session/seed, rather than per render.
 * The selected question no longer contains the pool: historical reviews only
 * retain the exact choices shown to the learner.
 */
export function materializeChoicePool(question: Question, seed: string): Question {
  if (question.type !== 'multiple-choice' || !question.choicePool) return question;
  const result = cloneQuestion(question);
  const choicePool = result.choicePool!;
  const correct = result.correctAnswers ?? [result.answer];
  const correctSet = new Set(correct);
  const wrong = [...result.choices.filter(choice => !correctSet.has(choice)),
    ...choicePool.distractors];
  const random = seededRandom(seed + ':distractor-pool');
  function shuffle<T>(items: T[]): void {
    for (let index = items.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [items[index], items[other]] = [items[other]!, items[index]!];
    }
  }
  shuffle(wrong);
  const count = choicePool.displayCount - correct.length;
  result.choices = [...correct, ...wrong.slice(0, count)];
  // Even with answer-choice shuffling disabled, the location of the correct
  // answer must not become predictable when a distractor pool is used.
  shuffle(result.choices);
  delete result.choicePool;
  return result;
}
