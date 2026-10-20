import { parseAiImportJson } from '../../core/ai-json.ts';
import { categoryScopedPrompt, type AiCardScope } from '../../core/ai-study-categories.ts';
import { isRecord } from '../../core/validation.ts';
import { AI_PLAIN_TEXT_ONLY_GUIDANCE } from '../../core/ai-formatting-guidance.ts';
import {
  MAX_HINT_LENGTH, MAX_WORD_LENGTH, DEFAULT_LAYOUT_MIN_WORDS, DEFAULT_LAYOUT_MAX_WORDS, MIN_WORDS,
  validatePuzzle as validateWordSearch, type Difficulty, type GridSize, type Puzzle as WordSearchPuzzle, type StudyMode,
} from '../word-search/puzzle-model.ts';
import {
  MAX_ANSWER_LENGTH, MAX_CLUE_LENGTH, MAX_ENTRIES, MIN_ENTRIES,
  validatePuzzleForGeneration, type Puzzle as CrosswordPuzzle,
} from '../crossword/puzzle-model.ts';

export type PuzzleAiKind = 'word-search' | 'crossword';
export type PuzzleAiResult =
  | { kind: 'word-search'; title: string; puzzle: WordSearchPuzzle }
  | { kind: 'crossword'; title: string; puzzle: CrosswordPuzzle };

export const puzzleAiLimits = {
  'word-search': { initial: 40, min: MIN_WORDS, max: 200 },
  crossword: { initial: 10, min: MIN_ENTRIES, max: MAX_ENTRIES },
} as const;

export interface PuzzleAiOptions {
  count: number;
  size: GridSize;
  difficulty: Difficulty;
  studyMode: StudyMode;
  clueDifficulty: Difficulty;
  instructions: string;
  selectionMode: 'all' | 'random';
  layoutMin: number;
  layoutMax: number;
}

export function defaultPuzzleAiOptions(kind: PuzzleAiKind): PuzzleAiOptions {
  return {
    count: puzzleAiLimits[kind].initial,
    size: 15,
    difficulty: 'medium',
    studyMode: 'hints',
    clueDifficulty: 'medium',
    instructions: '',
    selectionMode: kind === 'word-search' ? 'random' : 'all',
    layoutMin: DEFAULT_LAYOUT_MIN_WORDS,
    layoutMax: DEFAULT_LAYOUT_MAX_WORDS,
  };
}

const CLUE_DIFFICULTY: Record<Difficulty, string> = {
  easy: 'Use direct, approachable definitions without giving away the answer.',
  medium: 'Use specific but moderately challenging clues that reward recall.',
  hard: 'Use less direct but unambiguous clues that require more thought, without obscure trivia or misleading wordplay.',
};

// Puzzle creators intentionally support some phrases entered by hand. AI imports
// are narrower: rejecting separators here prevents silently merging multiple words.
function singleWord(value: string, label: string, maximum: number): string {
  const word = value.trim();
  if (!/^[A-Za-z]+$/.test(word)) {
    throw new Error(`${label} must be ONE word containing only English letters A–Z. Replace phrases with a single meaningful term; do not remove spaces to combine words.`);
  }
  if (word.length < 2 || word.length > maximum) {
    throw new Error(`${label} must contain 2–${maximum} letters.`);
  }
  return word.toUpperCase();
}

export function puzzleAiPrompt(kind: PuzzleAiKind, scope: AiCardScope | null, options: PuzzleAiOptions): string {
  const { count } = options;
  const randomPool = kind === 'word-search' && options.selectionMode === 'random';
  const minimumEntries = randomPool ? Math.max(MIN_WORDS, options.layoutMax) : puzzleAiLimits[kind].min;
  const format = kind === 'word-search' ? 'dynamic-learner-word-search' : 'dynamic-learner-crossword';
  const example = kind === 'word-search'
    ? options.studyMode === 'hints'
      ? '"words": [{ "word": "CONCEPT", "hint": "A short clue about the term" }]'
      : '"words": [{ "word": "CONCEPT" }]'
    : '"entries": [{ "answer": "CONCEPT", "clue": "A specific clue that does not use the answer" }]';
  const instructions = kind === 'word-search'
    ? `${randomPool
      ? `Generate a diverse pool of up to ${count} DISTINCT, meaningful SINGLE WORDS, ideally close to ${count}. The application selects ${options.layoutMin === options.layoutMax
        ? options.layoutMin : `${options.layoutMin}–${options.layoutMax}`} random words from this pool for each newly generated layout; do NOT restrict the output to a single layout's word count. Include enough words that layouts genuinely vary.`
      : `Generate ${MIN_WORDS}–${count} DISTINCT, meaningful SINGLE WORDS for a single fixed layout.`} Each word must be 2–${Math.min(MAX_WORD_LENGTH, options.size)} English letters A–Z. No word may exceed ${options.size} letters because the learner selected a ${options.size}×${options.size} grid. A phrase, multiword term or invented run-together word is NOT one word.
${options.studyMode === 'hints'
      ? `Provide one accurate, concise, non-spoiling "hint" for EACH word (at most ${MAX_HINT_LENGTH} characters). The puzzle will hide the answers behind hints.`
      : 'The learner selected Show word list. OMIT the "hint" field from every word; answers will be displayed directly in the sidebar.'}
Favor memorable standalone vocabulary over generic filler. Spread the pool across concepts within the selected scope; avoid repeated synonyms for the same concept. The application builds the letter grid with ${options.difficulty} difficulty; do not generate a grid.`
    : `Choose up to ${count} DISTINCT, meaningful SINGLE-WORD answers, each 2–${MAX_ANSWER_LENGTH} English letters A–Z. Never submit a phrase or run words together.
Clue difficulty: ${options.clueDifficulty}. ${CLUE_DIFFICULTY[options.clueDifficulty]}
Provide one accurate clue for EACH answer (at most ${MAX_CLUE_LENGTH} characters). Never include the answer itself in its clue.
VERY IMPORTANT: every answer must intersect with other answers through shared letters, directly or through a chain; avoid rare letter combinations and disconnected groups.
The Crossword generator determines its own grid, crossings, and clue numbering. DO NOT generate a grid, coordinates or Across/Down values.`;
  const body = `Using the source material I supplied immediately before this instruction, create ONE focused Dynamic Learner ${kind === 'word-search' ? 'Word Search' : 'Crossword'} puzzle.

${instructions}

The learner has already configured the puzzle settings in Dynamic Learner. Do not include settings in the JSON. ${kind === 'word-search'
    ? `Grid: ${options.size}×${options.size}; difficulty: ${options.difficulty}; study display: ${options.studyMode === 'hints' ? 'descriptive hints' : 'word list'}; ${randomPool ? `random pool of up to ${count} words, using ${options.layoutMin}–${options.layoutMax} per board` : 'use every imported word in each layout'}.`
    : `Grid: generated automatically; clue difficulty: ${options.clueDifficulty}.`}

STRICT SINGLE-WORD RULES FOR EVERY ANSWER:
- Each "word" or "answer" value must be ONE naturally occurring standalone word, written using only A–Z. No spaces, hyphens, apostrophes, ampersands, digits, or other punctuation.
- DO NOT concatenate multiple words to make them fit the grid. "AGEVERIFICATION", "COMMUNITYGUIDELINES", "CREDITCARDS", "FACESCAN", and "TEENACCOUNTS" are NOT valid single-word answers. Do not turn "age verification" into "AGEVERIFICATION" or "face scan" into "FACESCAN".
- Select a real single-word alternative that captures the concept, such as "VERIFICATION", "GUIDELINES", "EXPLOITATION", "INFERENCE", or "GROOMING". Established single-word terms such as "SEXTORTION" are valid.
- Apply this rule before generating JSON. Review every answer for disguised multiword phrases, even if it contains no spaces. If you cannot find enough useful single words, return fewer; do not pad the puzzle with irrelevant terms.
- Titles, category names, hints and clues may still contain multiple words; this restriction applies to the puzzle answer values only.

Use only facts and terminology supported by the original source. If there are fewer useful terms than requested, output fewer rather than inventing unrelated terms; never go below ${minimumEntries} entries.

${AI_PLAIN_TEXT_ONLY_GUIDANCE}

Avoid repeated answers, redundant clues, citations, URLs, attribution, markdown commentary and ChatGPT citation markers. ${scope ? 'This JSON represents ONE selected category only.' : 'Cover the overall subject, not a single category.'}

Return ONLY one fenced JSON code block with this exact structure:
\`\`\`json
{
  "format": "${format}",
  "version": 1,
  "title": ${JSON.stringify(scope?.category.title ?? "Subject word puzzle")},
  ${scope ? `"categoryKey": ${JSON.stringify(scope.category.key)},` : ''}
  ${example}
}
\`\`\`

The example is a STRUCTURAL TEMPLATE, not puzzle content. Output ${minimumEntries}–${count} unique entries, with no extra fields. Title must be 1–120 characters. ${scope ? 'Use the selected category title and include its exact category key.' : 'Use an appropriate subject title; omit categoryKey.'} Each puzzle answer must be one actual single English word, using only letters A–Z (prefer uppercase), never multiple words jammed together. Hints and clues must be plain text, not answer reveals or source markers.`;
  return scope ? categoryScopedPrompt(body, scope, kind === 'word-search' ? 'word-search terms and hints' : 'crossword answers and clues') : body;
}

export function parsePuzzleAiImport(json: string, kind: PuzzleAiKind, scope: AiCardScope | null, options: PuzzleAiOptions): PuzzleAiResult {
  const limit = options.count;
  const randomPool = kind === 'word-search' && options.selectionMode === 'random';
  const minEntries = randomPool ? Math.max(MIN_WORDS, options.layoutMax) : puzzleAiLimits[kind].min;
  const value = parseAiImportJson(json);
  const format = kind === 'word-search' ? 'dynamic-learner-word-search' : 'dynamic-learner-crossword';
  const field = kind === 'word-search' ? 'words' : 'entries';
  if (!isRecord(value) || Object.keys(value).some(k => !['format', 'version', 'title', 'categoryKey', field].includes(k)) ||
      value.format !== format || value.version !== 1 || (scope ? value.categoryKey !== scope.category.key : (value.categoryKey !== undefined && typeof value.categoryKey !== 'string')) ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.length > 120 ||
      !Array.isArray(value[field]) || value[field].length < minEntries || value[field].length > Math.min(limit, kind === 'word-search' ? puzzleAiLimits['word-search'].max : MAX_ENTRIES)) {
    throw new Error('This JSON must contain one valid puzzle using the selected format and entry limit.');
  }
  const items: unknown[] = value[field];
  const used = new Set<string>();
  if (kind === 'word-search') {
    const words: string[] = [];
    const hints: Record<string, string> = {};
    for (const [index, item] of items.entries()) {
      if (!isRecord(item) || Object.keys(item).some(k => !['word', 'hint'].includes(k)) ||
          typeof item.word !== 'string' ||
          (item.hint !== undefined && (typeof item.hint !== 'string' || item.hint.length > MAX_HINT_LENGTH))) {
        throw new Error(`Word ${index + 1} needs one valid word and, when supplied, a concise hint.`);
      }
      if (options.studyMode === 'hints' && (typeof item.hint !== 'string' || !item.hint.trim())) {
        throw new Error(`Word ${index + 1} needs a descriptive hint in hint study mode.`);
      }
      const word = singleWord(item.word, `Word ${index + 1}`, Math.min(MAX_WORD_LENGTH, options.size));
      if (used.has(word)) throw new Error(`The answer ${word} is repeated.`);
      used.add(word);
      words.push(word);
      if (typeof item.hint === 'string' && item.hint.trim()) hints[word] = item.hint.trim();
    }
    const puzzle: WordSearchPuzzle = {
      words, hints,
      studyMode: options.studyMode,
      difficulty: options.difficulty,
      size: options.size,
      instructions: options.instructions.trim(),
      ...(randomPool ? { selection: { min: options.layoutMin, max: options.layoutMax } } : {}),
    };
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
    const answer = singleWord(item.answer, `Crossword answer ${index + 1}`, MAX_ANSWER_LENGTH);
    if (used.has(answer)) throw new Error(`The answer ${answer} is repeated.`);
    used.add(answer); entries.push({ answer, clue: item.clue.trim() });
  }
  const puzzle: CrosswordPuzzle = { entries, instructions: options.instructions.trim() };
  validatePuzzleForGeneration(puzzle);
  return { kind, title: value.title.trim(), puzzle };
}
