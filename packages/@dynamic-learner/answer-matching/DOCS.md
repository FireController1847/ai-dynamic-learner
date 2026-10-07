# @dynamic-learner/answer-matching API

Reusable, browser-safe answer equivalency for short natural-language answers.

## Exports

```ts
type AnswerStrictness = 1 | 2 | 3 | 4;

interface AnswerMatchOptions {
  strictness?: AnswerStrictness;
}

interface AnswerMatchResult {
  correct: boolean;
  reason: 'exact' | 'fuzzy' | 'linguistic' | 'semantic' | 'incorrect';
  similarity: number;
  confidence: number;
}

const DEFAULT_ANSWER_STRICTNESS: AnswerStrictness; // 4

normalizeAnswer(value: string): string;
answerSimilarity(answer: string, response: string): number;
isAnswerStrictness(value: unknown): value is AnswerStrictness;
evaluateAnswer(answer: string, response: string, options?: AnswerMatchOptions): AnswerMatchResult;
isAnswerCorrect(answer: string, response: string, options?: AnswerMatchOptions): boolean;
```

Strictness is cumulative: level 1 is normalized exact matching; level 2 adds bounded character similarity; level 3 adds grammatical/morphological equivalence; level 4 adds conservative high-confidence synonym and phrase equivalence. Structural rules such as interchangeable Fill-in-the-Blanks positions are intentionally outside this package.

The semantic layer intentionally uses a small high-confidence equivalence lexicon rather than distributional word embeddings. This keeps the browser package small and avoids treating merely related or opposing domain terms as equivalent.
