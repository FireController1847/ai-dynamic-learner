import assert from 'node:assert/strict';
import test from 'node:test';
import { createCard, validateCards, shuffledCardIds } from '../src/features/index-cards/card-model.ts';
import { createDocumentData, validateDocumentData } from '../src/features/notebook/document-types.ts';
import { parseWords, validatePuzzle } from '../src/features/word-search/puzzle-model.ts';
import type { Puzzle } from '../src/features/word-search/puzzle-model.ts';
import { lineCells, matchSelection, validateGame } from '../src/features/word-search/game-model.ts';
import type { Game } from '../src/features/word-search/game-model.ts';
import { generatePuzzle } from '../src/features/word-search/puzzle-generator.ts';
import { siteConfig } from '../build/site-config.mts';
import { pageTemplateData } from '../build/page-metadata.mts';

const puzzle: Puzzle = { words: ['CAT', 'DOG', 'OWL'], size: 10, difficulty: 'easy', instructions: '' };
const game: Game = {
  rows: ['CATXXXXXXX', 'DOGXXXXXXX', 'OWLXXXXXXX', ...Array<string>(7).fill('XXXXXXXXXX')],
  placements: [
    { word: 'CAT', start: 0, end: 2 },
    { word: 'DOG', start: 10, end: 12 },
    { word: 'OWL', start: 20, end: 22 },
  ],
  found: [],
};

test('card validation narrows legacy imports and rejects duplicates/unknown fields', () => {
  const input: unknown = [{ id: 'legacy', front: 'Question', back: 'Answer' }];
  validateCards(input, new Set());
  assert.equal(input[0].front, 'Question');
  const copy = createCard(input[0]);
  assert.equal(copy.title, '');
  assert.notEqual(copy.id, input[0].id);
  assert.deepEqual(new Set(shuffledCardIds([...input, copy])), new Set(['legacy', copy.id]));
  assert.throws(() => validateCards([...input, ...input], new Set()));
  assert.throws(() => validateCards([{ ...copy, extra: true }], new Set()));
  assert.throws(() => validateCards([{ ...copy, title: null }], new Set()));
});

test('document data keeps type-specific shapes and rejects incompatible editors', () => {
  const markdown = createDocumentData('markdown');
  markdown.markdown = '# Heading';
  validateDocumentData('markdown', markdown);
  assert.deepEqual(createDocumentData('graph'), {});
  assert.throws(() => validateDocumentData('lined', markdown));
  assert.throws(() => validateDocumentData('markdown', { markdown: 1 }));
  assert.throws(() => validateDocumentData('unknown', {}));
});

test('puzzle input normalizes words while saved data must already be canonical', () => {
  assert.deepEqual(parseWords('cat; CAT\ndog, owl'), { words: ['CAT', 'DOG', 'OWL'], duplicates: 1, error: '' });
  validatePuzzle(puzzle);
  validatePuzzle({ ...puzzle, studyMode: null });
  assert.throws(() => validatePuzzle({ ...puzzle, words: ['cat', 'DOG', 'OWL'] }));
  assert.throws(() => validatePuzzle({ ...puzzle, studyMode: 'hints', hints: { CAT: 'Animal' } }));
  assert.throws(() => validatePuzzle({ ...puzzle, size: 11 }));
});

test('saved games validate exact placements and support reversed player selections', () => {
  validateGame(puzzle, game);
  assert.deepEqual(matchSelection(puzzle, game, 2, 0), { word: 'CAT', start: 2, end: 0 });
  assert.deepEqual(lineCells(0, 12, 10), []);
  assert.throws(() => validateGame(puzzle, { ...game, placements: [...game.placements.slice(1), { word: 'CAT', start: 0, end: 3 }] }));
  assert.throws(() => validateGame(puzzle, { ...game, found: [{ word: 'CAT', start: '0', end: 2 }] }));
});

test('generator produces valid games in all difficulties and honors cancellation', async () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const settings = { ...puzzle, difficulty };
    const generated = await generatePuzzle(settings);
    assert(generated);
    validateGame(settings, generated);
    assert.equal(generated.placements.length, puzzle.words.length);
  }
  const controller = new AbortController();
  controller.abort();
  assert.equal(await generatePuzzle(puzzle, controller.signal), null);
});

test('Pages configuration preserves repository paths and canonical metadata', () => {
  const site = siteConfig({ PAGES_BASE_PATH: '/repo', PAGES_BASE_URL: 'https://example.com/repo/' });
  const page = pageTemplateData('/notebook/', site);
  assert.equal(page.basePath, '/repo/');
  assert(page.richMetadata.includes('https://example.com/repo/notebook/'));
  assert(page.richMetadata.includes('https://example.com/repo/assets/dynamic-learner-social-v2.jpg'));
  assert.throws(() => siteConfig({ PAGES_BASE_PATH: '/../escape' }));
  assert.throws(() => siteConfig({ PAGES_BASE_PATH: '/repo', PAGES_BASE_URL: 'https://example.com/other/' }));
});
