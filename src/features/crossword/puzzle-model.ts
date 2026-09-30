import { isRecord } from '../../core/validation.ts';

export type LegacyGridSize = 11 | 13 | 15 | 17 | 21;
export interface CrosswordEntry { answer: string; clue: string }
export interface Puzzle {
  entries: CrosswordEntry[];
  instructions: string;
  // Kept only so Crossword records created by the first release continue to load.
  // New puzzles omit this field; generated grid dimensions now come from the answer set.
  size?: LegacyGridSize;
}

export interface ParsedAnswers {
  answers: string[];
  duplicates: number;
  errors: string[];
  components: string[][];
}

export const MIN_ENTRIES = 2;
export const MAX_ENTRIES = 30;
export const MAX_ANSWER_LENGTH = 21;
export const MAX_CLUE_LENGTH = 300;
export const MAX_INSTRUCTIONS_LENGTH = 500;
export const MAX_ANSWER_INPUT_LENGTH = 3000;
export const LEGACY_GRID_SIZES: LegacyGridSize[] = [11, 13, 15, 17, 21];

function formatAnswers(answers: readonly string[]): string {
  return answers.map((answer) => `“${answer}”`).join(', ');
}

function sharesLetter(left: string, right: string): boolean {
  const letters = new Set(left);
  return [...right].some((letter) => letters.has(letter));
}

export function answerComponents(answers: readonly string[]): string[][] {
  const remaining = new Set(answers);
  const components: string[][] = [];

  while (remaining.size) {
    const first = remaining.values().next().value as string;
    const component: string[] = [];
    const queue = [first];
    remaining.delete(first);

    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      for (const candidate of [...remaining]) {
        if (sharesLetter(current, candidate)) {
          remaining.delete(candidate);
          queue.push(candidate);
        }
      }
    }

    components.push(component);
  }

  return components;
}

export function compatibilityErrors(answers: readonly string[]): string[] {
  if (answers.length < MIN_ENTRIES) return [];
  const components = answerComponents(answers);
  if (components.length <= 1) return [];

  const isolated = components.filter((component) => component.length === 1).flat();
  if (isolated.length === 1) {
    return [
      `${formatAnswers(isolated)} cannot cross any other answer because it shares no letters with them. Add or replace an answer so every answer connects into the same crossword.`,
    ];
  }
  if (isolated.length > 1) {
    return [
      `${formatAnswers(isolated)} cannot connect to the rest of the crossword because they do not share usable letters with the other answers.`,
    ];
  }

  const groups = components.map((component) => `[${component.join(', ')}]`).join(' and ');
  return [
    `These answers split into separate groups that cannot connect: ${groups}. Add or replace an answer so the groups share at least one letter.`,
  ];
}

export function parseAnswers(text: string): ParsedAnswers {
  const raw = text.split(/[\n,;]/).map((answer) => answer.trim()).filter(Boolean);
  const answers: string[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  let duplicates = 0;

  for (const entry of raw) {
    if (!/^[a-zA-Z\s'’\-&]+$/.test(entry)) {
      errors.push(`“${entry}” contains unsupported characters. Use English letters A–Z, spaces, apostrophes, hyphens, or ampersands.`);
      continue;
    }

    const answer = entry.replace(/[\s'’\-&]/g, '').toUpperCase();
    if (answer.length < 2) {
      errors.push(`“${entry}” is too short. Answers need at least 2 letters after spaces and punctuation are removed.`);
      continue;
    }
    if (answer.length > MAX_ANSWER_LENGTH) {
      errors.push(`“${entry}” is ${answer.length} letters long. Crossword answers can be at most ${MAX_ANSWER_LENGTH} letters.`);
      continue;
    }
    if (seen.has(answer)) {
      duplicates += 1;
      continue;
    }

    seen.add(answer);
    answers.push(answer);
  }

  if (answers.length < MIN_ENTRIES) {
    errors.push(`Add at least ${MIN_ENTRIES} unique answers. You currently have ${answers.length}.`);
  } else if (answers.length > MAX_ENTRIES) {
    errors.push(`Use at most ${MAX_ENTRIES} unique answers. You currently have ${answers.length}.`);
  } else {
    errors.push(...compatibilityErrors(answers));
  }

  return {
    answers,
    duplicates,
    errors,
    components: answerComponents(answers),
  };
}

export function validatePuzzle(value: unknown): asserts value is Puzzle {
  if (!isRecord(value)) throw new Error('The crossword puzzle data is invalid.');

  const allowedKeys = ['entries', 'instructions', 'size'];
  if (Object.keys(value).some((key) => !allowedKeys.includes(key))) {
    throw new Error('The crossword puzzle contains unsupported data.');
  }
  if (typeof value.instructions !== 'string' || value.instructions.length > MAX_INSTRUCTIONS_LENGTH) {
    throw new Error(`Crossword instructions must be plain text up to ${MAX_INSTRUCTIONS_LENGTH} characters.`);
  }
  if (Object.hasOwn(value, 'size') &&
      (typeof value.size !== 'number' || !LEGACY_GRID_SIZES.includes(value.size as LegacyGridSize))) {
    throw new Error('The saved legacy crossword grid size is invalid.');
  }
  if (!Array.isArray(value.entries)) {
    throw new Error('The crossword answer list is missing.');
  }
  if (value.entries.length < MIN_ENTRIES) {
    throw new Error(`A crossword needs at least ${MIN_ENTRIES} unique answers; this one has ${value.entries.length}.`);
  }
  if (value.entries.length > MAX_ENTRIES) {
    throw new Error(`A crossword can contain at most ${MAX_ENTRIES} answers; this one has ${value.entries.length}.`);
  }

  const answers = new Set<string>();
  for (const entry of value.entries) {
    if (!isRecord(entry) || Object.keys(entry).some((key) => !['answer', 'clue'].includes(key))) {
      throw new Error('A crossword answer contains unsupported data.');
    }
    if (typeof entry.answer !== 'string' || !/^[A-Z]+$/.test(entry.answer)) {
      throw new Error('Crossword answers must contain only uppercase English letters A–Z.');
    }
    if (entry.answer.length < 2 || entry.answer.length > MAX_ANSWER_LENGTH) {
      throw new Error(`Crossword answers must contain 2–${MAX_ANSWER_LENGTH} letters.`);
    }
    if (answers.has(entry.answer)) {
      throw new Error(`The crossword contains the duplicate answer “${entry.answer}”.`);
    }
    if (typeof entry.clue !== 'string' || !entry.clue.trim()) {
      throw new Error(`“${entry.answer}” needs a clue.`);
    }
    if (entry.clue.length > MAX_CLUE_LENGTH) {
      throw new Error(`The clue for “${entry.answer}” is too long. Keep clues to ${MAX_CLUE_LENGTH} characters or fewer.`);
    }
    answers.add(entry.answer);
  }
}

export function validatePuzzleForGeneration(value: unknown): asserts value is Puzzle {
  validatePuzzle(value);
  const issues = compatibilityErrors(value.entries.map(({ answer }) => answer));
  if (issues.length) throw new Error(issues[0]);
}
