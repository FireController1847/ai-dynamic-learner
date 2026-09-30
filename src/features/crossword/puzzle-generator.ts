import { validatePuzzle } from './puzzle-model.ts';
import type { Puzzle } from './puzzle-model.ts';
import { expectedNumbers, placementCells, validateGame, type Direction, type Game, type Placement } from './game-model.ts';

interface Candidate {
  row: number;
  column: number;
  direction: Direction;
  score: number;
  intersections: number;
}

const ACROSS = 1;
const DOWN = 2;

function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function evaluate(
  answer: string,
  row: number,
  column: number,
  direction: Direction,
  size: number,
  letters: readonly string[],
  usage: readonly number[],
): Candidate | null {
  const endRow = row + (direction === 'down' ? answer.length - 1 : 0);
  const endColumn = column + (direction === 'across' ? answer.length - 1 : 0);
  if (row < 0 || column < 0 || endRow >= size || endColumn >= size) return null;

  const bit = direction === 'across' ? ACROSS : DOWN;
  const beforeRow = row - (direction === 'down' ? 1 : 0);
  const beforeColumn = column - (direction === 'across' ? 1 : 0);
  const afterRow = endRow + (direction === 'down' ? 1 : 0);
  const afterColumn = endColumn + (direction === 'across' ? 1 : 0);
  const occupied = (r: number, c: number) => r >= 0 && c >= 0 && r < size && c < size && Boolean(letters[r * size + c]);
  if (occupied(beforeRow, beforeColumn) || occupied(afterRow, afterColumn)) return null;

  let intersections = 0;
  for (let index = 0; index < answer.length; index += 1) {
    const r = row + (direction === 'down' ? index : 0);
    const c = column + (direction === 'across' ? index : 0);
    const cell = r * size + c;
    const existing = letters[cell];

    if (usage[cell] & bit) return null;
    if (existing && existing !== answer[index]) return null;

    if (existing) {
      intersections += 1;
    } else if (direction === 'across') {
      if (occupied(r - 1, c) || occupied(r + 1, c)) return null;
    } else if (occupied(r, c - 1) || occupied(r, c + 1)) {
      return null;
    }
  }

  const center = (size - 1) / 2;
  const midpointRow = (row + endRow) / 2;
  const midpointColumn = (column + endColumn) / 2;
  const distance = Math.abs(midpointRow - center) + Math.abs(midpointColumn - center);
  return {
    row,
    column,
    direction,
    intersections,
    score: intersections * 20 - distance + Math.random() * 2,
  };
}

function crossingCandidates(
  answer: string,
  size: number,
  letters: readonly string[],
  usage: readonly number[],
): Candidate[] {
  const result: Candidate[] = [];
  for (let cell = 0; cell < letters.length; cell += 1) {
    const letter = letters[cell];
    if (!letter) continue;
    const row = Math.floor(cell / size);
    const column = cell % size;
    for (let index = 0; index < answer.length; index += 1) {
      if (answer[index] !== letter) continue;
      for (const direction of ['across', 'down'] as const) {
        const candidate = evaluate(
          answer,
          row - (direction === 'down' ? index : 0),
          column - (direction === 'across' ? index : 0),
          direction,
          size,
          letters,
          usage,
        );
        if (candidate?.intersections) result.push(candidate);
      }
    }
  }
  return result;
}

function openCandidates(
  answer: string,
  size: number,
  letters: readonly string[],
  usage: readonly number[],
): Candidate[] {
  const result: Candidate[] = [];
  for (const direction of ['across', 'down'] as const) {
    const rows = direction === 'across' ? size : size - answer.length + 1;
    const columns = direction === 'down' ? size : size - answer.length + 1;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const candidate = evaluate(answer, row, column, direction, size, letters, usage);
        if (candidate) result.push(candidate);
      }
    }
  }
  return result;
}

function commit(answer: string, candidate: Candidate, size: number, letters: string[], usage: number[]): Placement {
  const bit = candidate.direction === 'across' ? ACROSS : DOWN;
  const placement: Placement = {
    answer,
    row: candidate.row,
    column: candidate.column,
    direction: candidate.direction,
    number: 0,
  };
  placementCells(placement, answer.length, size).forEach((cell, index) => {
    letters[cell] = answer[index];
    usage[cell] |= bit;
  });
  return placement;
}

export async function generatePuzzle(value: unknown, signal?: AbortSignal): Promise<Game | null> {
  validatePuzzle(value);
  const puzzle = value as Puzzle;
  const size = puzzle.size;

  for (let attempt = 0; attempt < 72; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (signal?.aborted) return null;

    const letters = Array<string>(size * size).fill('');
    const usage = Array<number>(size * size).fill(0);
    const placements: Placement[] = [];
    const ordered = shuffled(puzzle.entries)
      .map((entry) => ({ ...entry, priority: entry.answer.length + Math.random() * 2 }))
      .sort((a, b) => b.priority - a.priority);

    const first = ordered.shift();
    if (!first) break;
    const firstDirection: Direction = attempt % 2 ? 'down' : 'across';
    const firstCandidate = evaluate(
      first.answer,
      firstDirection === 'down' ? Math.floor((size - first.answer.length) / 2) : Math.floor(size / 2),
      firstDirection === 'across' ? Math.floor((size - first.answer.length) / 2) : Math.floor(size / 2),
      firstDirection,
      size,
      letters,
      usage,
    );
    if (!firstCandidate) continue;
    placements.push(commit(first.answer, firstCandidate, size, letters, usage));

    let failed = false;
    for (const entry of ordered) {
      const crossings = crossingCandidates(entry.answer, size, letters, usage);
      const candidates = crossings.length ? crossings : openCandidates(entry.answer, size, letters, usage);
      if (!candidates.length) { failed = true; break; }
      candidates.sort((a, b) => b.score - a.score);
      const window = candidates.slice(0, Math.min(8, candidates.length));
      placements.push(commit(entry.answer, window[Math.floor(Math.random() * window.length)], size, letters, usage));
    }
    if (failed || placements.length !== puzzle.entries.length) continue;

    const numbers = expectedNumbers(placements, size);
    for (const placement of placements) {
      placement.number = numbers.get(placement.row * size + placement.column) ?? 0;
    }
    placements.sort((a, b) => a.number - b.number || (a.direction === 'across' ? -1 : 1));

    const rows = Array.from({ length: size }, (_, row) =>
      letters.slice(row * size, (row + 1) * size).map((letter) => letter || '#').join(''));
    const game: Game = { rows, placements, cells: Array<string>(size * size).fill('') };
    validateGame(puzzle, game);
    return game;
  }

  throw new Error('These answers could not fit cleanly in this grid. Try a larger grid, fewer answers, or shorter answers.');
}
