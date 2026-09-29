import {
  MAX_DEPTH,
  MAX_ITEMS,
  MAX_WORD_SEARCHES,
} from '../../features/word-search/library-model.js';
import { validateDisplayOptions } from '../../features/word-search/display-options.js';
import { validateGame } from '../../features/word-search/game-model.js';
import { validatePuzzle } from '../../features/word-search/puzzle-model.js';
import {
  asObject,
  claimId,
  optionalDisplay,
  recoverName,
} from './shared.js';

const GRID_SIZES = [10, 15, 20, 24];
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const STUDY_MODES = new Set(['words', 'hints']);
const BOARD_ROTATIONS = [0, 90, 180, 270];

function migratePuzzle(value, report) {
  const source = asObject(value);
  if (!source) return null;

  const canonicalWords = [];
  const seen = new Set();
  for (const entry of Array.isArray(source.words) ? source.words : []) {
    if (typeof entry !== 'string' || !/^[A-Za-z]{2,24}$/.test(entry)) {
      report.skipped += 1;
      continue;
    }
    const word = entry.toUpperCase();
    if (seen.has(word)) {
      report.repaired += 1;
      continue;
    }
    seen.add(word);
    canonicalWords.push(word);
  }

  let size = GRID_SIZES.includes(source.size) ? source.size : null;
  if (!size) {
    const longest = Math.max(0, ...canonicalWords.map((word) => word.length));
    size = GRID_SIZES.find((candidate) => candidate >= longest) ?? 24;
    report.repaired += 1;
  }
  const words = canonicalWords.filter((word) => {
    if (word.length <= size) return true;
    report.skipped += 1;
    return false;
  });
  if (words.length < 3) {
    report.skipped += 1;
    return null;
  }
  if (words.length > 40) report.repaired += 1;

  const puzzle = {
    words: words.slice(0, 40),
    size,
    difficulty: DIFFICULTIES.has(source.difficulty) ? source.difficulty : 'easy',
    instructions: typeof source.instructions === 'string' ? source.instructions.slice(0, 500) : '',
  };
  if (puzzle.difficulty !== source.difficulty || puzzle.instructions !== source.instructions) {
    report.repaired += 1;
  }

  if (Object.hasOwn(source, 'studyMode')) {
    puzzle.studyMode = STUDY_MODES.has(source.studyMode) ? source.studyMode : 'words';
    if (puzzle.studyMode !== source.studyMode) report.repaired += 1;
  }

  if (Object.hasOwn(source, 'hints')) {
    puzzle.hints = {};
    const hints = asObject(source.hints) ?? {};
    for (const word of puzzle.words) {
      if (!Object.hasOwn(hints, word)) continue;
      if (typeof hints[word] === 'string') {
        puzzle.hints[word] = hints[word].slice(0, 240);
        if (puzzle.hints[word] !== hints[word]) report.repaired += 1;
      } else {
        report.skipped += 1;
      }
    }
  }

  if ((puzzle.studyMode ?? 'words') === 'hints' &&
      puzzle.words.some((word) => !puzzle.hints?.[word]?.trim())) {
    puzzle.studyMode = 'words';
    report.repaired += 1;
  }

  try {
    validatePuzzle(puzzle);
    return puzzle;
  } catch {
    report.skipped += 1;
    return null;
  }
}

export function migrateLegacyWordSearch(raw, report) {
  const ids = new Set();
  let itemCount = 0;
  let searchCount = 0;

  function visit(list, depth = 1) {
    if (!Array.isArray(list)) return [];
    if (depth > MAX_DEPTH) {
      report.skipped += list.length;
      return [];
    }

    return list.flatMap((entry) => {
      const source = asObject(entry);
      if (!source) {
        report.skipped += 1;
        return [];
      }

      let kind = source.kind;
      if (!['group', 'word-search'].includes(kind)) {
        if (Array.isArray(source.children)) kind = 'group';
        else if (Object.hasOwn(source, 'puzzle') || Object.hasOwn(source, 'game') ||
            Object.hasOwn(source, 'boardRotation')) kind = 'word-search';
      }
      if (!['group', 'word-search'].includes(kind) ||
          itemCount >= MAX_ITEMS ||
          (kind === 'word-search' && searchCount >= MAX_WORD_SEARCHES)) {
        report.skipped += 1;
        return [];
      }

      itemCount += 1;
      if (kind === 'word-search') searchCount += 1;
      const id = claimId(source.id, ids, report);
      report.recovered += 1;

      if (kind === 'group') {
        return [{
          id,
          kind: 'group',
          name: recoverName(source.name, 'Recovered group', report),
          children: visit(source.children, depth + 1),
        }];
      }

      const item = {
        id,
        kind: 'word-search',
        name: recoverName(source.name, 'Recovered word search', report),
      };
      if (Object.hasOwn(source, 'boardRotation')) {
        if (BOARD_ROTATIONS.includes(source.boardRotation)) item.boardRotation = source.boardRotation;
        else report.repaired += 1;
      }
      if (Object.hasOwn(source, 'puzzle')) {
        const puzzle = migratePuzzle(source.puzzle, report);
        if (puzzle) {
          item.puzzle = puzzle;
          if (Object.hasOwn(source, 'game')) {
            try {
              validateGame(puzzle, source.game);
              item.game = source.game;
            } catch {
              report.skipped += 1;
            }
          }
        }
      }
      return [item];
    });
  }

  raw = asObject(raw) ?? {};
  const result = { items: visit(raw.items) };
  if (Object.hasOwn(raw, 'display')) {
    const display = optionalDisplay(raw.display, validateDisplayOptions, report);
    if (display) result.display = display;
  }
  return result;
}
