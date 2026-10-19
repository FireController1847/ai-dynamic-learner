import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTexts } from '../src/core/parameterized/template.ts';
import { parseReviewAiImport, type ReviewAiPreferences } from '../src/features/knowledge-check/ai-import-format.ts';
import { DEFAULT_AI_WEIGHTS } from '../src/features/knowledge-check/ai-question-mix.ts';

const fiberContext = "$$\\text{Fiber target (g)}=\\frac{14\\times\\text{daily Calories}}{1000}$$";
const preferences: ReviewAiPreferences = {
  count: 1, coverage: 'balanced', mixMode: 'ai', weights: { ...DEFAULT_AI_WEIGHTS },
};
const envelope = (question: object) => JSON.stringify({
  format: 'dynamic-learner-review', version: 1, title: 'Fiber and Carbohydrate Metabolism',
  description: 'Fiber intake', questions: [question],
});
const fiberQuestion = (context: string) => ({
  type: 'parameterized',
  prompt: 'Calculate the fiber target for {{calories}} Calories.',
  context,
  parameters: {
    presentation: 'fields',
    rules: {
      version: 1,
      variables: [{ name: 'calories', kind: 'integer', min: 1500, max: 3200 }],
      constraints: [],
      answers: [{
        key: 'fiberTarget', label: 'Fiber target (grams)', matching: 'numeric',
        expression: 'calories * 14 / 1000', precision: 2, rounding: 'round',
        absoluteTolerance: 0.01,
      }],
    },
  },
});

test('nested KaTeX closing braces do not look like malformed variables', () => {
  assert.doesNotThrow(() => validateTexts({ context: fiberContext }, []));
  assert.doesNotThrow(() => validateTexts({
    context: "$$\\frac{14\\times{{calories}}}{1000}$$",
  }, ['calories']));
});

test('unmatched and unknown placeholders still fail validation', () => {
  assert.throws(() => validateTexts({ context: 'Value: }}' }, []), /Malformed variable placeholder/);
  assert.throws(() => validateTexts({ context: 'Value: {unit}}' }, []), /Malformed variable placeholder/);
  assert.throws(() => validateTexts({ context: 'Value: {{calories' }, ['calories']), /Malformed variable placeholder/);
  assert.throws(() => validateTexts({ context: 'Value: {{missing}}' }, ['calories']), /Unresolved placeholder: missing/);
});

test('AI import accepts the parameterized fiber calculation with nested KaTeX', () => {
  const imported = parseReviewAiImport(envelope(fiberQuestion(fiberContext)), preferences);
  assert.equal(imported.questions.length, 1);
  assert.equal(imported.questions[0]?.type, 'parameterized');
});

test('AI import shows the parameter error rather than an unrelated choices error', () => {
  assert.throws(
    () => parseReviewAiImport(envelope(fiberQuestion('Value: {{missing}}')), preferences),
    /Item 1: Unresolved placeholder: missing/,
  );
});

test('fixed multiple choice with a matching correct answer is accepted', () => {
  const imported = parseReviewAiImport(envelope({
    type: 'multiple-choice',
    prompt: 'What is the daily fiber target for 2,000 Calories at 14 grams per 1,000 Calories?',
    choices: ['14 grams', '25 grams', '28 grams', '38 grams'],
    answer: '28 grams',
  }), preferences);
  assert.equal(imported.questions[0]?.answer, '28 grams');
});
