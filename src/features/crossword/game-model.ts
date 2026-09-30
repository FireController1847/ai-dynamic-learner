import { isRecord } from '../../core/validation.ts';
import { validatePuzzle, type Puzzle } from './puzzle-model.ts';

export type Direction = 'across' | 'down';
export interface Placement {
  answer: string;
  row: number;
  column: number;
  direction: Direction;
  number: number;
}
export interface Game {
  rows: string[];
  placements: Placement[];
  cells: string[];
}

function hasOnlyKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key));
}

export function placementCells(placement: Pick<Placement, 'row' | 'column' | 'direction'>, length: number, size: number): number[] {
  return Array.from({ length }, (_, index) => {
    const row = placement.row + (placement.direction === 'down' ? index : 0);
    const column = placement.column + (placement.direction === 'across' ? index : 0);
    return row * size + column;
  });
}

export function clueEntry(puzzle: Puzzle, answer: string) {
  return puzzle.entries.find((entry) => entry.answer === answer);
}

export function placementSolved(game: Game, placement: Placement): boolean {
  const size = game.rows.length;
  const cells = placementCells(placement, placement.answer.length, size);
  return cells.every((cell, index) => game.cells[cell] === placement.answer[index]);
}

export function gameComplete(game: Game): boolean {
  const size = game.rows.length;
  for (let cell = 0; cell < size * size; cell += 1) {
    const solution = game.rows[Math.floor(cell / size)][cell % size];
    if (solution !== '#' && game.cells[cell] !== solution) return false;
  }
  return true;
}

export function expectedNumbers(placements: readonly Pick<Placement, 'row' | 'column'>[], size: number): Map<number, number> {
  const starts = [...new Set(placements.map(({ row, column }) => row * size + column))].sort((a, b) => a - b);
  return new Map(starts.map((cell, index) => [cell, index + 1]));
}

export function validateGame(puzzleValue: unknown, gameValue: unknown): asserts gameValue is Game {
  validatePuzzle(puzzleValue);
  const puzzle = puzzleValue;

  if (!hasOnlyKeys(gameValue, ['rows', 'placements', 'cells']) ||
      !Array.isArray(gameValue.rows) || gameValue.rows.length < 2 || gameValue.rows.length > 45) {
    throw new Error('The saved crossword grid or progress is invalid.');
  }

  const size = gameValue.rows.length;
  if (gameValue.rows.some((row) => typeof row !== 'string' || row.length !== size || !/^[A-Z#]+$/.test(row)) ||
      !Array.isArray(gameValue.placements) || gameValue.placements.length !== puzzle.entries.length ||
      !Array.isArray(gameValue.cells) || gameValue.cells.length !== size * size ||
      gameValue.cells.some((cell) => typeof cell !== 'string' || (cell !== '' && !/^[A-Z]$/.test(cell)))) {
    throw new Error('The saved crossword grid or progress is invalid.');
  }

  const rows = gameValue.rows as string[];
  const cells = gameValue.cells as string[];
  const placements = gameValue.placements;
  const answers = new Set(puzzle.entries.map(({ answer }) => answer));
  const seen = new Set<string>();
  const used = new Set<number>();
  const orientation = Array<number>(size * size).fill(0);
  const numbers = expectedNumbers(placements.map((placement) => {
    if (!isRecord(placement)) return { row: -1, column: -1 };
    return { row: Number(placement.row), column: Number(placement.column) };
  }), size);

  for (const placement of placements) {
    if (!hasOnlyKeys(placement, ['answer', 'row', 'column', 'direction', 'number']) ||
        typeof placement.answer !== 'string' || !answers.has(placement.answer) || seen.has(placement.answer) ||
        typeof placement.row !== 'number' || !Number.isInteger(placement.row) ||
        typeof placement.column !== 'number' || !Number.isInteger(placement.column) ||
        (placement.direction !== 'across' && placement.direction !== 'down') ||
        typeof placement.number !== 'number' || !Number.isInteger(placement.number) || placement.number < 1) {
      throw new Error('A saved crossword contains an invalid or duplicate answer placement.');
    }

    const typedPlacement: Placement = {
      answer: placement.answer,
      row: placement.row,
      column: placement.column,
      direction: placement.direction,
      number: placement.number,
    };
    const endRow = typedPlacement.row + (typedPlacement.direction === 'down' ? typedPlacement.answer.length - 1 : 0);
    const endColumn = typedPlacement.column + (typedPlacement.direction === 'across' ? typedPlacement.answer.length - 1 : 0);
    const path = placementCells(typedPlacement, typedPlacement.answer.length, size);
    const bit = typedPlacement.direction === 'across' ? 1 : 2;
    const beforeRow = typedPlacement.row - (typedPlacement.direction === 'down' ? 1 : 0);
    const beforeColumn = typedPlacement.column - (typedPlacement.direction === 'across' ? 1 : 0);
    const afterRow = endRow + (typedPlacement.direction === 'down' ? 1 : 0);
    const afterColumn = endColumn + (typedPlacement.direction === 'across' ? 1 : 0);
    const openAt = (row: number, column: number) =>
      row >= 0 && column >= 0 && row < size && column < size && rows[row][column] !== '#';

    if (typedPlacement.row < 0 || typedPlacement.column < 0 || endRow >= size || endColumn >= size ||
        path.some((cell) => cell < 0 || cell >= size * size) ||
        path.some((cell, index) => rows[Math.floor(cell / size)][cell % size] !== typedPlacement.answer[index]) ||
        path.some((cell) => Boolean(orientation[cell] & bit)) ||
        openAt(beforeRow, beforeColumn) || openAt(afterRow, afterColumn)) {
      throw new Error('A saved crossword answer does not match the grid.');
    }

    const start = placement.row * size + placement.column;
    if (numbers.get(start) !== placement.number) {
      throw new Error('A saved crossword clue number does not match its grid position.');
    }
    path.forEach((cell) => { used.add(cell); orientation[cell] |= bit; });
    seen.add(placement.answer);
  }

  for (let cell = 0; cell < size * size; cell += 1) {
    const solution = rows[Math.floor(cell / size)][cell % size];
    if ((solution === '#') === used.has(cell)) {
      throw new Error('The saved crossword contains unsupported open or blocked cells.');
    }
    if (solution === '#' && cells[cell] !== '') {
      throw new Error('Blocked crossword cells cannot contain progress.');
    }
  }
}

export function clearGame(game: Game): void {
  game.cells.fill('');
}

export function answerForCell(game: Game, cell: number, direction: Direction): Placement | null {
  const size = game.rows.length;
  return game.placements.find((placement) =>
    placement.direction === direction &&
    placementCells(placement, placement.answer.length, size).includes(cell)) ?? null;
}
