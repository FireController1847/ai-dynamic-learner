import { parseAiImportJson } from '../../core/ai-json.ts';
import { categoryScopedPrompt, type AiCardScope } from '../../core/ai-study-categories.ts';
import { isRecord } from '../../core/validation.ts';
import {
  GRID_SIZES, MAX_HINT_LENGTH, MAX_WORDS, MIN_WORDS, parseWords,
  validatePuzzle as validateWordSearch, type Puzzle as WordSearchPuzzle,
} from '../word-search/puzzle-model.ts';
import {
  MAX_CLUE_LENGTH, MAX_ENTRIES, MIN_ENTRIES,
  validatePuzzleForGeneration, type Puzzle as CrosswordPuzzle,
} from '../crossword/puzzle-model.ts';

export type PuzzleAiKind = 'word-search' | 'crossword';
export type PuzzleAiResult =
  | { kind: 'word-search'; title: string; puzzle: WordSearchPuzzle }
  | { kind: 'crossword'; title: string; puzzle: CrosswordPuzzle };

export const puzzleAiLimits = {
  'word-search': { initial: 12, min: MIN_WORDS, max: 24 },
  crossword: { initial: 10, min: MIN_ENTRIES, max: 20 },
} as const;

export function puzzleAiPrompt(kind: PuzzleAiKind, scope: AiCardScope, count: number): string {
  const format = kind === 'word-search' ? 'dynamic-learner-word-search' : 'dynamic-learner-crossword';
  const example = kind === 'word-search'
    ? '"words": [{ "word": "CONCEPT", "hint": "A short clue about the term" }]'
    : '"entries": [{ "answer": "CONCEPT", "clue": "A specific clue that does not use the answer" }]';
  const instructions = kind === 'word-search'
    ? `Choose ${count} DISTINCT, meaningful terms or short phrases, each 2–24 English letters after removing spaces, hyphens and apostrophes.
Provide one accurate, concise, non-spoiling hint for EACH word (at most ${MAX_HINT_LENGTH} characters).
Favor memorable category vocabulary over generic filler. Word Search uses hint-based play and builds the letter grid itself.`
    : `Choose ${count} DISTINCT, meaningful answers, each 2–21 English letters after removing spaces, hyphens, apostrophes and ampersands.
Provide a specific, accurate clue for EACH answer (at most ${MAX_CLUE_LENGTH} characters). Never include the answer itself in its clue.
VERY IMPORTANT: every answer must intersect with other answers through shared letters, directly or through a chain; avoid rare letter combinations and disconnected groups.
The Crossword generator determines its own grid, crossings, and clue numbering. DO NOT generate a grid, coordinates or Across/Down values.`;
  const body = `Using the source material I supplied immediately before this instruction, create ONE focused Dynamic Learner ${kind === 'word-search' ? 'Word Search' : 'Crossword'} puzzle.

${instructions}

Use only facts and terminology supported by the original source. If there are fewer useful terms than requested, output fewer rather than inventing unrelated terms; never go below ${puzzleAiLimits[kind].min} entries.
Avoid repeated answers, redundant clues, citations, URLs, attribution, markdown commentary and ChatGPT citation markers. No whole-subject puzzle: this JSON represents ONE selected category only.

Return ONLY one fenced JSON code block with this exact structure:
\`\`\`json
{
  "format": "${format}",
  "version": 1,
  "title": ${JSON.stringify(scope.category.title)},
  "categoryKey": ${JSON.stringify(scope.category.key)},
  ${example}
}
\`\`\`

The example is a STRUCTURAL TEMPLATE, not puzzle content. Output ${puzzleAiLimits[kind].min}–${count} unique entries, with no extra fields. Title must be 1–120 characters and use the selected category title. Include the exact selected category key. English letters A–Z only for answers, with optional spaces/hyphens/apostrophes; Crossword also allows ampersands. Hints and clues must be plain text, not answer reveals or source markers.`;
  return categoryScopedPrompt(body, scope, kind === 'word-search' ? 'word-search terms and hints' : 'crossword answers and clues');
}

export function parsePuzzleAiImport(json: string, kind: PuzzleAiKind, scope: AiCardScope, limit: number): PuzzleAiResult {
  const value = parseAiImportJson(json);
  const format = kind === 'word-search' ? 'dynamic-learner-word-search' : 'dynamic-learner-crossword';
  const field = kind === 'word-search' ? 'words' : 'entries';
  if (!isRecord(value) || Object.keys(value).some(k => !['format', 'version', 'title', 'categoryKey', field].includes(k)) ||
      value.format !== format || value.version !== 1 || value.categoryKey !== scope.category.key ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.length > 120 ||
      !Array.isArray(value[field]) || value[field].length < puzzleAiLimits[kind].min || value[field].length > Math.min(limit, kind === 'word-search' ? MAX_WORDS : MAX_ENTRIES)) {
    throw new Error('This JSON must contain one puzzle for the selected category, using the displayed format and entry limit.');
  }
  const items: unknown[] = value[field];
  const used = new Set<string>();
  if (kind === 'word-search') {
    const words: string[] = [];
    const hints: Record<string, string> = {};
    for (const [index, item] of items.entries()) {
      if (!isRecord(item) || Object.keys(item).some(k => !['word', 'hint'].includes(k)) ||
          typeof item.word !== 'string' || typeof item.hint !== 'string' ||
          !item.hint.trim() || item.hint.length > MAX_HINT_LENGTH) {
        throw new Error(`Word ${index + 1} needs an answer and a concise nonempty hint.`);
      }
      const parsed = parseWords(item.word);
      if (parsed.error || parsed.words.length !== 1) throw new Error(`Word ${index + 1} is invalid: ${parsed.error || 'Use one answer per item.'}`);
      const word = parsed.words[0];
      if (used.has(word)) throw new Error(`The answer ${word} is repeated.`);
      used.add(word); words.push(word); hints[word] = item.hint.trim();
    }
    const longest = Math.max(...words.map(word => word.length));
    const desiredSize = words.length <= 10 ? 15 : words.length <= 18 ? 20 : 24;
    const size = GRID_SIZES.find(n => n >= Math.max(longest, desiredSize)) ?? 24;
    const puzzle = { words, hints, studyMode: 'hints' as const, difficulty: 'medium' as const,
      size: size as WordSearchPuzzle['size'], instructions: `Find the terms from ${scope.category.title}.` };
    validateWordSearch(puzzle);
    return { kind, title: value.title.trim(), puzzle };
  }

  const entries: CrosswordPuzzle['entries'] = [];
  for (const [index, item] of items.entries()) {
    if (!isRecord(item) || Object.keys(item).some(k => !['answer', 'clue'].includes(k)) ||
        typeof item.answer !== 'string' || typeof item.clue !== 'string' || !item.clue.trim() ||
        item.clue.length > MAX_CLUE_LENGTH) {
      throw new Error(`Answer ${index + 1} needs a valid word and a nonempty clue.`);
    }
    const answer = item.answer.replace(/[\s'’\-&]/g, '').toUpperCase();
    if (!/^[a-zA-Z\s'’\-&]+$/.test(item.answer) || !/^[A-Z]{2,21}$/.test(answer))
      throw new Error(`Answer ${index + 1} must contain 2–21 English letters.`);
    if (used.has(answer)) throw new Error(`The answer ${answer} is repeated.`);
    used.add(answer); entries.push({ answer, clue: item.clue.trim() });
  }
  const puzzle = { entries, instructions: `Solve the clues from ${scope.category.title}.` };
  validatePuzzleForGeneration(puzzle);
  return { kind, title: value.title.trim(), puzzle };
}
