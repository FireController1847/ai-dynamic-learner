import { isRecord } from '../../core/validation.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type StudyMode = 'words' | 'hints';
export type GridSize = 10 | 15 | 20 | 24;
export interface Puzzle {
  words: string[];
  size: GridSize;
  difficulty: Difficulty;
  instructions: string;
  // Existing imports treat null like an omitted mode; keep that compatibility.
  studyMode?: StudyMode | null;
  hints?: Record<string, string>;
}

export const MIN_WORDS = 3;
export const MAX_WORDS = 40;
export const MAX_WORD_LENGTH = 24;
export const MAX_HINT_LENGTH = 240;
export const MAX_INSTRUCTIONS_LENGTH = 500;
export const MAX_WORD_INPUT_LENGTH = 4000;
// TODO: Support custom grid dimensions, including rectangular puzzles.
export const GRID_SIZES = [10, 15, 20, 24];
export const DIFFICULTIES: { value: Difficulty; label: string; description: string }[] = [
  { value: 'easy', label: 'Easy', description: 'Across and down, reading forward.' },
  { value: 'medium', label: 'Medium', description: 'Adds diagonal words, reading forward.' },
  { value: 'hard', label: 'Hard', description: 'All eight directions, including backward.' },
];
export const STUDY_MODES: { value: StudyMode; label: string; description: string }[] = [
  { value: 'words', label: 'Show word list', description: 'Show each answer in the sidebar while you search.' },
  { value: 'hints', label: 'Show descriptive hints', description: 'Hide the answers behind clue-style hints with an optional reveal button.' },
];

export function parseWords(text: string): { words: string[]; duplicates: number; error: string } {
  const entries = text.split(/[\n,;]/).map((word) => word.trim()).filter(Boolean);
  const words: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let error = '';
  for (const entry of entries) {
    if (!/^[a-zA-Z\s'’\-]+$/.test(entry)) {
      error ||= 'Use English letters A–Z, spaces, apostrophes, or hyphens in each word.';
      continue;
    }
    const word = entry.replace(/[\s'’\-]/g, '').toUpperCase();
    if (word.length < 2 || word.length > MAX_WORD_LENGTH) {
      error ||= `Each word needs 2–${MAX_WORD_LENGTH} letters.`;
      continue;
    }
    if (seen.has(word)) { duplicates += 1; continue; }
    seen.add(word);
    words.push(word);
  }
  return { words, duplicates, error };
}

export function validatePuzzle(puzzle: unknown): asserts puzzle is Puzzle {
  if (!isRecord(puzzle) ||
      Object.keys(puzzle).some((key) => !['words', 'size', 'difficulty', 'instructions', 'studyMode', 'hints'].includes(key)) ||
      typeof puzzle.size !== 'number' || !GRID_SIZES.includes(puzzle.size) ||
      !DIFFICULTIES.some(({ value }) => value === puzzle.difficulty) ||
      typeof puzzle.instructions !== 'string' || puzzle.instructions.length > MAX_INSTRUCTIONS_LENGTH) {
    throw new Error('The word search settings are invalid.');
  }
  if (!Array.isArray(puzzle.words) || puzzle.words.length < MIN_WORDS || puzzle.words.length > MAX_WORDS ||
      puzzle.words.some((word) => typeof word !== 'string' || !/^[A-Z]{2,24}$/.test(word)) ||
      new Set(puzzle.words).size !== puzzle.words.length) {
    throw new Error(`Add ${MIN_WORDS}–${MAX_WORDS} unique words, with 2–${MAX_WORD_LENGTH} English letters each.`);
  }
  // The checks above establish the element type without trusting imported JSON.
  const words = puzzle.words as string[];
  const longest = Math.max(...words.map((word) => word.length));
  if (longest > puzzle.size) {
    throw new Error(`Your longest word has ${longest} letters. Choose a larger grid or shorten the word.`);
  }
  const studyMode = puzzle.studyMode ?? 'words';
  if (!STUDY_MODES.some(({ value }) => value === studyMode)) {
    throw new Error('The word search study display is invalid.');
  }
  if (Object.hasOwn(puzzle, 'hints')) {
    if (!isRecord(puzzle.hints) ||
        Object.keys(puzzle.hints).some((word) => !words.includes(word)) ||
        Object.values(puzzle.hints).some((hint) => typeof hint !== 'string' || hint.length > MAX_HINT_LENGTH)) {
      throw new Error('The word search hints are invalid.');
    }
  }
  const hints = puzzle.hints as Record<string, string> | undefined;
  if (studyMode === 'hints' && words.some((word) => !hints?.[word]?.trim())) {
    throw new Error('Add a descriptive hint for every word when hint study mode is enabled.');
  }
}
