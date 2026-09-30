import { validatePuzzleForGeneration } from './puzzle-model.ts';
import type { Puzzle } from './puzzle-model.ts';
import { expectedNumbers, placementCells, validateGame, type Direction, type Game, type Placement } from './game-model.ts';

interface Candidate {
  row: number;
  column: number;
  direction: Direction;
  score: number;
  intersections: number;
}

interface EntryCandidates {
  answer: string;
  candidates: Candidate[];
}

const ACROSS = 1;
const DOWN = 2;
const MAX_WORK_GRID_SIZE = 45;
const MIN_FINAL_GRID_SIZE = 5;
const ATTEMPTS = 160;

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
    score: intersections * 24 - distance + Math.random() * 2,
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

function compactGame(placements: Placement[], workSize: number): Game {
  let minRow = workSize;
  let maxRow = 0;
  let minColumn = workSize;
  let maxColumn = 0;

  for (const placement of placements) {
    const endRow = placement.row + (placement.direction === 'down' ? placement.answer.length - 1 : 0);
    const endColumn = placement.column + (placement.direction === 'across' ? placement.answer.length - 1 : 0);
    minRow = Math.min(minRow, placement.row);
    maxRow = Math.max(maxRow, endRow);
    minColumn = Math.min(minColumn, placement.column);
    maxColumn = Math.max(maxColumn, endColumn);
  }

  const height = maxRow - minRow + 1;
  const width = maxColumn - minColumn + 1;
  const size = Math.max(MIN_FINAL_GRID_SIZE, height, width);
  const rowPadding = Math.floor((size - height) / 2);
  const columnPadding = Math.floor((size - width) / 2);
  const shifted = placements.map((placement) => ({
    ...placement,
    row: placement.row - minRow + rowPadding,
    column: placement.column - minColumn + columnPadding,
    number: 0,
  }));

  const letters = Array<string>(size * size).fill('');
  for (const placement of shifted) {
    placementCells(placement, placement.answer.length, size).forEach((cell, index) => {
      letters[cell] = placement.answer[index];
    });
  }

  const numbers = expectedNumbers(shifted, size);
  for (const placement of shifted) {
    placement.number = numbers.get(placement.row * size + placement.column) ?? 0;
  }
  shifted.sort((left, right) =>
    left.number - right.number || (left.direction === 'across' ? -1 : 1));

  const rows = Array.from({ length: size }, (_, row) =>
    letters.slice(row * size, (row + 1) * size).map((letter) => letter || '#').join(''));

  return {
    rows,
    placements: shifted,
    cells: Array<string>(size * size).fill(''),
  };
}

function workGridSize(puzzle: Puzzle): number {
  const longest = Math.max(...puzzle.entries.map(({ answer }) => answer.length));
  const letters = puzzle.entries.reduce((total, entry) => total + entry.answer.length, 0);
  const estimated = Math.ceil(Math.sqrt(letters) * 2.2);
  return Math.min(MAX_WORK_GRID_SIZE, Math.max(15, longest * 2 + 1, estimated));
}

function difficultAnswers(puzzle: Puzzle): string[] {
  const connectionCounts = puzzle.entries.map(({ answer }) => ({
    answer,
    connections: puzzle.entries.filter((entry) =>
      entry.answer !== answer && [...new Set(answer)].some((letter) => entry.answer.includes(letter))).length,
  }));
  return connectionCounts
    .sort((left, right) => left.connections - right.connections || right.answer.length - left.answer.length)
    .slice(0, Math.min(3, connectionCounts.length))
    .map(({ answer }) => answer);
}

export async function generatePuzzle(value: unknown, signal?: AbortSignal): Promise<Game | null> {
  validatePuzzleForGeneration(value);
  const puzzle = value as Puzzle;
  const size = workGridSize(puzzle);

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (signal?.aborted) return null;

    const letters = Array<string>(size * size).fill('');
    const usage = Array<number>(size * size).fill(0);
    const placements: Placement[] = [];
    const ordered = shuffled(puzzle.entries)
      .map((entry) => ({ ...entry, priority: entry.answer.length + Math.random() * 4 }))
      .sort((left, right) => right.priority - left.priority);
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
    const remaining = [...ordered];
    let failed = false;

    while (remaining.length) {
      const viable: EntryCandidates[] = remaining
        .map((entry) => ({
          answer: entry.answer,
          candidates: crossingCandidates(entry.answer, size, letters, usage),
        }))
        .filter(({ candidates }) => candidates.length > 0);

      if (!viable.length) {
        failed = true;
        break;
      }

      viable.sort((left, right) =>
        left.candidates.length - right.candidates.length ||
        right.answer.length - left.answer.length ||
        Math.random() - 0.5);
      const choice = viable[0];
      choice.candidates.sort((left, right) => right.score - left.score);
      const candidateWindow = choice.candidates.slice(0, Math.min(6, choice.candidates.length));
      const candidate = candidateWindow[Math.floor(Math.random() * candidateWindow.length)];
      placements.push(commit(choice.answer, candidate, size, letters, usage));

      const index = remaining.findIndex(({ answer }) => answer === choice.answer);
      remaining.splice(index, 1);
    }

    if (failed || placements.length !== puzzle.entries.length) continue;

    const game = compactGame(placements, size);
    validateGame(puzzle, game);
    return game;
  }

  const difficult = difficultAnswers(puzzle);
  throw new Error(
    `These answers share letters, but I couldn't arrange them into one clean connected crossword without collisions. ` +
    `Try replacing, shortening, or adding a bridging answer around ${difficult.map((answer) => `“${answer}”`).join(', ')}.`,
  );
}
