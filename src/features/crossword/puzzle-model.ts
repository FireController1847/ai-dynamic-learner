import { isRecord } from '../../core/validation.ts';

export type GridSize = 11 | 13 | 15 | 17 | 21;
export interface CrosswordEntry { answer: string; clue: string }
export interface Puzzle {
  entries: CrosswordEntry[];
  size: GridSize;
  instructions: string;
}

export const MIN_ENTRIES = 3;
export const MAX_ENTRIES = 30;
export const MAX_ANSWER_LENGTH = 21;
export const MAX_CLUE_LENGTH = 300;
export const MAX_INSTRUCTIONS_LENGTH = 500;
export const MAX_ANSWER_INPUT_LENGTH = 3000;
export const GRID_SIZES: GridSize[] = [11, 13, 15, 17, 21];

export function parseAnswers(text: string): { answers: string[]; duplicates: number; error: string } {
  const raw = text.split(/[\n,;]/).map((answer) => answer.trim()).filter(Boolean);
  const answers: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let error = '';

  for (const entry of raw) {
    if (!/^[a-zA-Z\s'’\-&]+$/.test(entry)) {
      error ||= 'Use English letters A–Z, spaces, apostrophes, hyphens, or ampersands in each answer.';
      continue;
    }
    const answer = entry.replace(/[\s'’\-&]/g, '').toUpperCase();
    if (answer.length < 2 || answer.length > MAX_ANSWER_LENGTH) {
      error ||= `Each answer needs 2–${MAX_ANSWER_LENGTH} letters after spaces and punctuation are removed.`;
      continue;
    }
    if (seen.has(answer)) { duplicates += 1; continue; }
    seen.add(answer);
    answers.push(answer);
  }

  return { answers, duplicates, error };
}

export function validatePuzzle(value: unknown): asserts value is Puzzle {
  if (!isRecord(value) ||
      Object.keys(value).some((key) => !['entries', 'size', 'instructions'].includes(key)) ||
      typeof value.size !== 'number' || !GRID_SIZES.includes(value.size as GridSize) ||
      typeof value.instructions !== 'string' || value.instructions.length > MAX_INSTRUCTIONS_LENGTH ||
      !Array.isArray(value.entries) || value.entries.length < MIN_ENTRIES || value.entries.length > MAX_ENTRIES) {
    throw new Error('The crossword settings are invalid.');
  }

  const answers = new Set<string>();
  for (const entry of value.entries) {
    if (!isRecord(entry) || Object.keys(entry).some((key) => !['answer', 'clue'].includes(key)) ||
        typeof entry.answer !== 'string' || !/^[A-Z]{2,21}$/.test(entry.answer) ||
        entry.answer.length > value.size ||
        typeof entry.clue !== 'string' || !entry.clue.trim() || entry.clue.length > MAX_CLUE_LENGTH ||
        answers.has(entry.answer)) {
      throw new Error(`Add ${MIN_ENTRIES}–${MAX_ENTRIES} unique answers with a clue for each one. Answers must fit the selected grid.`);
    }
    answers.add(entry.answer);
  }
}
