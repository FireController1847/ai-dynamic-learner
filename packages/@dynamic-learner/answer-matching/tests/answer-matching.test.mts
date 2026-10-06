import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ANSWER_STRICTNESS,
  evaluateAnswer,
  isAnswerCorrect,
} from '../src/index.ts';

test('level 1 accepts only normalized exact answers', () => {
  assert.equal(DEFAULT_ANSWER_STRICTNESS, 4);
  assert.equal(isAnswerCorrect(' Union ', 'union', { strictness: 1 }), true);
  assert.equal(isAnswerCorrect('union', 'unioned', { strictness: 1 }), false);
  assert.equal(isAnswerCorrect('union', 'unon', { strictness: 1 }), false);
});

test('level 2 adds the existing bounded fuzzy behavior', () => {
  assert.equal(isAnswerCorrect('union', 'unon', { strictness: 2 }), true);
  assert.equal(isAnswerCorrect('cat', 'cut', { strictness: 2 }), false);
  assert.equal(evaluateAnswer('union', 'unon', { strictness: 2 }).reason, 'fuzzy');
});

test('level 3 adds grammatical and morphological equivalents', () => {
  assert.equal(isAnswerCorrect('union', 'unioned', { strictness: 3 }), true);
  assert.equal(isAnswerCorrect('child', 'children', { strictness: 3 }), true);
  assert.equal(isAnswerCorrect('union', 'joined', { strictness: 3 }), false);
  assert.equal(evaluateAnswer('union', 'unioned', { strictness: 3 }).reason, 'linguistic');
});

test('level 4 adds conservative semantic equivalents', () => {
  assert.equal(isAnswerCorrect('union', 'joined', { strictness: 4 }), true);
  assert.equal(isAnswerCorrect('union', 'combined', { strictness: 4 }), true);
  assert.equal(isAnswerCorrect('for example', 'for instance', { strictness: 4 }), true);
  assert.equal(evaluateAnswer('union', 'combined', { strictness: 4 }).reason, 'semantic');
});

test('semantic matching rejects related, opposing, or merely nearby concepts', () => {
  assert.equal(isAnswerCorrect('union', 'intersection', { strictness: 4 }), false);
  assert.equal(isAnswerCorrect('merge', 'split', { strictness: 4 }), false);
  assert.equal(isAnswerCorrect('begin', 'finish', { strictness: 4 }), false);
  assert.equal(isAnswerCorrect('large', 'small', { strictness: 4 }), false);
});

test('higher levels include all lower-level behavior', () => {
  for (const strictness of [2, 3, 4] as const) {
    assert.equal(isAnswerCorrect('answer', 'anser', { strictness }), true);
  }
  for (const strictness of [3, 4] as const) {
    assert.equal(isAnswerCorrect('person', 'people', { strictness }), true);
  }
});
