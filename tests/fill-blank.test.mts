import assert from 'node:assert/strict';
import test from 'node:test';
import { isAnswerCorrect } from '../packages/@dynamic-learner/answer-matching/src/index.ts';
import { fillBlankCorrectness, parseFillBlankTemplate } from '../src/core/fill-blank.ts';

const matcher = (strictness: 1 | 2 | 3 | 4) =>
  (answer: string, response: string) => isAnswerCorrect(answer, response, { strictness });

test('separate blanks joined by or accept reversed responses', () => {
  const template = parseFillBlankTemplate('{{alpha}} or {{beta}}');
  assert.deepEqual(fillBlankCorrectness(template, ['beta', 'alpha'], matcher(1)), [true, true]);
});

test('separate blanks joined by and accept reversed responses', () => {
  const template = parseFillBlankTemplate('{{alpha}} and {{beta}}');
  assert.deepEqual(fillBlankCorrectness(template, ['beta', 'alpha'], matcher(1)), [true, true]);
});

test('only literal and/or between adjacent blanks enables swapping', () => {
  const template = parseFillBlankTemplate('{{alpha}} then {{beta}}');
  assert.deepEqual(fillBlankCorrectness(template, ['beta', 'alpha'], matcher(4)), [false, false]);
});

test('a single blank answer containing and/or remains ordered', () => {
  assert.deepEqual(
    fillBlankCorrectness(parseFillBlankTemplate('{{alpha and beta}}'), ['beta and alpha'], matcher(4)),
    [false],
  );
  assert.deepEqual(
    fillBlankCorrectness(parseFillBlankTemplate('{{alpha or beta}}'), ['beta or alpha'], matcher(4)),
    [false],
  );
});

test('swapped blank pairs still use the configured answer strictness', () => {
  const template = parseFillBlankTemplate('{{union}} and {{begin}}');
  assert.deepEqual(fillBlankCorrectness(template, ['started', 'combined'], matcher(4)), [true, true]);
  assert.deepEqual(fillBlankCorrectness(template, ['started', 'combined'], matcher(3)), [false, false]);
});
