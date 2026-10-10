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

test('numeric blanks compare values exactly without fuzzy or linguistic matching', () => {
  const template = parseFillBlankTemplate('{{25,000,000}}');
  for (const strictness of [1, 2, 3, 4] as const) {
    assert.deepEqual(fillBlankCorrectness(template, ['1000000'], matcher(strictness)), [false]);
    assert.deepEqual(fillBlankCorrectness(template, ['25,000,000'], matcher(strictness)), [true]);
    assert.deepEqual(fillBlankCorrectness(template, ['25000000'], matcher(strictness)), [true]);
    assert.deepEqual(fillBlankCorrectness(template, ['25,000,000.0'], matcher(strictness)), [true]);
    assert.deepEqual(fillBlankCorrectness(template, ['25000000.1'], matcher(strictness)), [false]);
    assert.deepEqual(fillBlankCorrectness(template, ['25000000 people'], matcher(strictness)), [false]);
  }
});

test('decimal, signed, and exponential numeric blanks compare by exact value', () => {
  const template = parseFillBlankTemplate('{{-0.25}} {{1e3}} {{.75}} {{0}}');
  assert.deepEqual(fillBlankCorrectness(template, ['-.2500', '1,000', '0.750', '-0']), [true, true, true, true]);
  assert.deepEqual(fillBlankCorrectness(template, ['-.2501', '999', '0.76', '1']), [false, false, false, false]);
});

test('large integers never become equal through floating-point rounding', () => {
  assert.deepEqual(
    fillBlankCorrectness(parseFillBlankTemplate('{{9,007,199,254,740,992}}'), ['9007199254740993'], matcher(4)),
    [false],
  );
});

test('non-numeric blanks retain configured text matching and swapped order', () => {
  assert.deepEqual(fillBlankCorrectness(parseFillBlankTemplate('{{running}} and {{25,000}}'), ['25000', 'runing'], matcher(4)), [true, true]);
  assert.deepEqual(fillBlankCorrectness(parseFillBlankTemplate('{{running}}'), ['runing'], matcher(1)), [false]);
  assert.deepEqual(fillBlankCorrectness(parseFillBlankTemplate('{{running}}'), ['runing'], matcher(4)), [true]);
});
