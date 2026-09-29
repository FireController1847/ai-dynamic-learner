import { validatePuzzle } from './puzzle-model.ts';
import type { Difficulty, Puzzle } from './puzzle-model.ts';
import { isRecord } from '../../core/validation.ts';

export type Direction = [row: number, column: number];
export interface WordPlacement { word: string; start: number; end: number }
export interface Game {
  rows: string[];
  placements: WordPlacement[];
  found: WordPlacement[];
}

export function directionsFor(difficulty: Difficulty): Direction[] {
  const forward: Direction[] = [[0, 1], [1, 0]];
  if (difficulty !== 'easy') forward.push([1, 1], [-1, 1]);
  return difficulty === 'hard' ? [...forward, ...forward.map(([r, c]): Direction => [-r, -c])] : forward;
}

export function lineCells(start: number, end: number, size: number): number[] {
  if (![start, end].every((cell) => Number.isInteger(cell) && cell >= 0 && cell < size * size)) return [];
  const row = Math.floor(start / size);
  const col = start % size;
  const dr = Math.floor(end / size) - row;
  const dc = end % size - col;
  if (dr && dc && Math.abs(dr) !== Math.abs(dc)) return [];
  const length = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  return Array.from({ length }, (_, index) =>
    (row + Math.sign(dr) * index) * size + col + Math.sign(dc) * index);
}

export function wordOnLine(rows: readonly string[], start: number, end: number): string {
  const size = rows.length;
  return lineCells(start, end, size).map((cell) => rows[Math.floor(cell / size)][cell % size]).join('');
}

function hasOnlyKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) &&
    Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}

// Validate stored boards directly so backup imports never have to regenerate puzzles.
export function validateGame(puzzle: unknown, game: unknown): asserts game is Game {
  validatePuzzle(puzzle);
  const { size, words, difficulty } = puzzle;
  if (!hasOnlyKeys(game, ['rows', 'placements', 'found']) ||
      !Array.isArray(game.rows) || game.rows.length !== size ||
      game.rows.some((row) => typeof row !== 'string' || row.length !== size || !/^[A-Z]+$/.test(row)) ||
      !Array.isArray(game.placements) || game.placements.length !== words.length ||
      !Array.isArray(game.found) || game.found.length > words.length) {
    throw new Error('The saved word search grid or progress is invalid.');
  }
  const rows = game.rows as string[];
  function checkLines(lines: unknown[], isSolution: boolean): void {
    const seen = new Set<string>();
    for (const line of lines) {
      if (!hasOnlyKeys(line, ['word', 'start', 'end']) || typeof line.word !== 'string' ||
          typeof line.start !== 'number' || typeof line.end !== 'number' ||
          !words.includes(line.word) || seen.has(line.word)) {
        throw new Error('The saved word search contains invalid or duplicate word locations.');
      }
      const text = wordOnLine(rows, line.start, line.end);
      if (text !== line.word && (isSolution || [...text].reverse().join('') !== line.word)) {
        throw new Error('A saved word location does not match the grid.');
      }
      if (isSolution) {
        const dr = Math.sign(Math.floor(line.end / size) - Math.floor(line.start / size));
        const dc = Math.sign(line.end % size - line.start % size);
        if (!directionsFor(difficulty).some(([r, c]) => dr === r && dc === c)) {
          throw new Error('A saved word direction does not match the difficulty.');
        }
      }
      seen.add(line.word);
    }
  }
  checkLines(game.placements, true);
  checkLines(game.found, false);
}

export function matchSelection(puzzle: Puzzle, game: Game, start: number, end: number): WordPlacement | null {
  const text = wordOnLine(game.rows, start, end);
  const reversed = [...text].reverse().join('');
  const matches = puzzle.words.filter((entry) => entry === text || entry === reversed);
  const word = matches.find((entry) => !game.found.some((found) => found.word === entry)) ?? matches[0];
  return word ? { word, start, end } : null;
}
