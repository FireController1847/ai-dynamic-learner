export const MIN_WORDS = 3;
export const MAX_WORDS = 40;
export const MAX_WORD_LENGTH = 24;
export const MAX_INSTRUCTIONS_LENGTH = 500;
export const MAX_WORD_INPUT_LENGTH = 4000;
// TODO: Support custom grid dimensions, including rectangular puzzles.
export const GRID_SIZES = [10, 15, 20, 24];
export const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', description: 'Across and down, reading forward.' },
  { value: 'medium', label: 'Medium', description: 'Adds diagonal words, reading forward.' },
  { value: 'hard', label: 'Hard', description: 'All eight directions, including backward.' },
];

export function parseWords(text) {
  const entries = text.split(/[\n,;]/).map((word) => word.trim()).filter(Boolean);
  const words = [];
  const seen = new Set();
  let duplicates = 0;
  let error = '';
  for (const entry of entries) {
    // Keep normalization explicit: punctuation within a phrase is not a grid cell.
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

export function validatePuzzle(puzzle) {
  if (!puzzle || typeof puzzle !== 'object' || Array.isArray(puzzle) ||
      Object.keys(puzzle).some((key) => !['words', 'size', 'difficulty', 'instructions'].includes(key)) ||
      !GRID_SIZES.includes(puzzle.size) ||
      !DIFFICULTIES.some(({ value }) => value === puzzle.difficulty) ||
      typeof puzzle.instructions !== 'string' || puzzle.instructions.length > MAX_INSTRUCTIONS_LENGTH) {
    throw new Error('The word search settings are invalid.');
  }
  if (!Array.isArray(puzzle.words) || puzzle.words.length < MIN_WORDS || puzzle.words.length > MAX_WORDS ||
      puzzle.words.some((word) => typeof word !== 'string' || !/^[A-Z]{2,24}$/.test(word)) ||
      new Set(puzzle.words).size !== puzzle.words.length) {
    throw new Error(`Add ${MIN_WORDS}–${MAX_WORDS} unique words, with 2–${MAX_WORD_LENGTH} English letters each.`);
  }
  const longest = Math.max(...puzzle.words.map((word) => word.length));
  if (longest > puzzle.size) {
    throw new Error(`Your longest word has ${longest} letters. Choose a larger grid or shorten the word.`);
  }
}
