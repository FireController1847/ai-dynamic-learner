import { createId, isValidId } from '../core/ids.js';
import {
  DEFAULT_DOCUMENT_TYPE,
  isDocumentType,
  validateDocumentData,
} from '../features/notebook/document-types.js';
import {
  MAX_DEPTH as MAX_NOTEBOOK_DEPTH,
  MAX_DOCUMENTS,
  MAX_ITEMS as MAX_NOTEBOOK_ITEMS,
} from '../features/notebook/library-model.js';
import {
  MAX_DEPTH as MAX_INDEX_DEPTH,
  MAX_ITEMS as MAX_INDEX_ITEMS,
} from '../features/index-cards/tree-model.js';
import { MAX_CARDS } from '../features/index-cards/card-model.js';
import {
  MAX_DEPTH as MAX_WORD_SEARCH_DEPTH,
  MAX_ITEMS as MAX_WORD_SEARCH_ITEMS,
  MAX_WORD_SEARCHES,
} from '../features/word-search/library-model.js';
import { validateDisplayOptions as validateIndexCardDisplay } from '../features/index-cards/display-options.js';
import { validateDisplayOptions as validateWordSearchDisplay } from '../features/word-search/display-options.js';
import { validatePuzzle } from '../features/word-search/puzzle-model.js';
import { validateGame } from '../features/word-search/game-model.js';

export const LEGACY_WORKSPACE_KEY = 'dynamic-learner.workspace.v1';

const GRID_SIZES = [10, 15, 20, 24];
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const STUDY_MODES = new Set(['words', 'hints']);

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function name(value, fallback, report) {
  if (typeof value === 'string' && value.trim() && value.length <= 120) return value;
  report.repaired += 1;
  return fallback;
}

function claimId(value, ids, report) {
  if (isValidId(value) && !ids.has(value)) {
    ids.add(value);
    return value;
  }
  let replacement;
  do replacement = createId();
  while (ids.has(replacement));
  ids.add(replacement);
  report.repaired += 1;
  return replacement;
}

function optionalDisplay(value, validate, report) {
  const candidate = object(value);
  if (!candidate) {
    report.skipped += 1;
    return null;
  }
  try {
    validate(candidate);
    return candidate;
  } catch {
    report.skipped += 1;
    return null;
  }
}

function migrateNotebook(raw, report) {
  const ids = new Set();
  const documentIdMap = new Map();
  let itemCount = 0;
  let documentCount = 0;

  function visit(list, depth = 1) {
    if (!Array.isArray(list)) return [];
    if (depth > MAX_NOTEBOOK_DEPTH) {
      report.skipped += list.length;
      return [];
    }
    return list.flatMap((source) => {
      source = object(source);
      if (!source) {
        report.skipped += 1;
        return [];
      }

      let kind = source.kind;
      if (!['group', 'document'].includes(kind)) {
        if (Array.isArray(source.children)) kind = 'group';
        else if (Object.hasOwn(source, 'markdown') || Object.hasOwn(source, 'data') || Object.hasOwn(source, 'type')) {
          kind = 'document';
        }
      }
      if (!['group', 'document'].includes(kind)) {
        report.skipped += 1;
        return [];
      }

      if (itemCount >= MAX_NOTEBOOK_ITEMS ||
          (kind === 'document' && documentCount >= MAX_DOCUMENTS)) {
        report.skipped += 1;
        return [];
      }
      itemCount += 1;
      if (kind === 'document') documentCount += 1;
      const id = claimId(source.id, ids, report);

      if (kind === 'group') {
        report.recovered += 1;
        return [{
          id,
          kind: 'group',
          name: name(source.name, 'Recovered group', report),
          children: visit(source.children, depth + 1),
        }];
      }

      let type = source.type;
      let data = object(source.data);
      if (!Object.hasOwn(source, 'type') && !Object.hasOwn(source, 'data') &&
          typeof source.markdown === 'string') {
        type = DEFAULT_DOCUMENT_TYPE;
        data = { markdown: source.markdown };
        report.repaired += 1;
      }
      if (type === 'grid' && data && !Object.keys(data).length) {
        type = 'graph';
        report.repaired += 1;
      }
      if (!isDocumentType(type)) {
        report.skipped += 1;
        return [];
      }
      try {
        validateDocumentData(type, data);
      } catch {
        report.skipped += 1;
        return [];
      }

      if (isValidId(source.id) && !documentIdMap.has(source.id)) documentIdMap.set(source.id, id);
      report.recovered += 1;
      return [{
        id,
        kind: 'document',
        name: name(source.name, 'Recovered document', report),
        type,
        data,
      }];
    });
  }

  raw = object(raw) ?? {};
  const result = { items: visit(raw.items) };
  if (Object.hasOwn(raw, 'lastSelectedDocumentId')) {
    result.lastSelectedDocumentId = documentIdMap.get(raw.lastSelectedDocumentId) ?? null;
    if (raw.lastSelectedDocumentId !== null && result.lastSelectedDocumentId === null) report.repaired += 1;
  }
  return result;
}

function migrateIndexCards(raw, report) {
  const ids = new Set();
  const setIdMap = new Map();
  let itemCount = 0;
  let cardCount = 0;

  function card(source) {
    if (cardCount >= MAX_CARDS) {
      report.skipped += 1;
      return null;
    }
    source = object(source);
    if (!source || typeof source.front !== 'string' || typeof source.back !== 'string' ||
        source.front.length > 2000 || source.back.length > 2000) {
      report.skipped += 1;
      return null;
    }
    const result = {
      id: claimId(source.id, ids, report),
      front: source.front,
      back: source.back,
    };
    for (const [key, target] of [['title', 'title'], ['backTitle', 'backTitle']]) {
      if (!Object.hasOwn(source, key)) continue;
      if (typeof source[key] === 'string' && source[key].length <= 120) result[target] = source[key];
      else report.repaired += 1;
    }
    cardCount += 1;
    report.recovered += 1;
    return result;
  }

  function visit(list, depth = 1) {
    if (!Array.isArray(list)) return [];
    if (depth > MAX_INDEX_DEPTH) {
      report.skipped += list.length;
      return [];
    }
    return list.flatMap((source) => {
      source = object(source);
      if (!source) {
        report.skipped += 1;
        return [];
      }
      let kind = source.kind;
      if (!['group', 'set'].includes(kind)) {
        if (Array.isArray(source.children)) kind = 'group';
        else if (Array.isArray(source.cards)) kind = 'set';
      }
      if (!['group', 'set'].includes(kind)) {
        report.skipped += 1;
        return [];
      }

      if (itemCount >= MAX_INDEX_ITEMS) {
        report.skipped += 1;
        return [];
      }
      itemCount += 1;
      const id = claimId(source.id, ids, report);
      report.recovered += 1;
      if (kind === 'group') {
        return [{
          id,
          kind: 'group',
          name: name(source.name, 'Recovered group', report),
          children: visit(source.children, depth + 1),
        }];
      }
      if (isValidId(source.id) && !setIdMap.has(source.id)) setIdMap.set(source.id, id);
      return [{
        id,
        kind: 'set',
        name: name(source.name, 'Recovered set', report),
        cards: Array.isArray(source.cards) ? source.cards.map(card).filter(Boolean) : [],
      }];
    });
  }

  raw = object(raw) ?? {};
  const result = { items: visit(raw.items) };
  if (Object.hasOwn(raw, 'display')) {
    const display = optionalDisplay(raw.display, validateIndexCardDisplay, report);
    if (display) result.display = display;
  }
  if (Object.hasOwn(raw, 'lastSelectedSetId')) {
    result.lastSelectedSetId = setIdMap.get(raw.lastSelectedSetId) ?? null;
    if (raw.lastSelectedSetId !== null && result.lastSelectedSetId === null) report.repaired += 1;
  }
  return result;
}

function migratePuzzle(value, report) {
  value = object(value);
  if (!value) return null;

  const sourceWords = Array.isArray(value.words) ? value.words : [];
  const canonicalWords = [];
  const seen = new Set();
  for (const entry of sourceWords) {
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

  let size = GRID_SIZES.includes(value.size) ? value.size : null;
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
    difficulty: DIFFICULTIES.has(value.difficulty) ? value.difficulty : 'easy',
    instructions: typeof value.instructions === 'string' ? value.instructions.slice(0, 500) : '',
  };
  if (puzzle.difficulty !== value.difficulty || puzzle.instructions !== value.instructions) report.repaired += 1;

  if (Object.hasOwn(value, 'studyMode')) {
    puzzle.studyMode = STUDY_MODES.has(value.studyMode) ? value.studyMode : 'words';
    if (puzzle.studyMode !== value.studyMode) report.repaired += 1;
  }

  if (Object.hasOwn(value, 'hints')) {
    puzzle.hints = {};
    const hints = object(value.hints) ?? {};
    for (const word of puzzle.words) {
      if (!Object.hasOwn(hints, word)) continue;
      if (typeof hints[word] === 'string') {
        puzzle.hints[word] = hints[word].slice(0, 240);
        if (puzzle.hints[word] !== hints[word]) report.repaired += 1;
      } else report.skipped += 1;
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

function migrateWordSearch(raw, report) {
  const ids = new Set();
  let itemCount = 0;
  let searchCount = 0;

  function visit(list, depth = 1) {
    if (!Array.isArray(list)) return [];
    if (depth > MAX_WORD_SEARCH_DEPTH) {
      report.skipped += list.length;
      return [];
    }
    return list.flatMap((source) => {
      source = object(source);
      if (!source) {
        report.skipped += 1;
        return [];
      }
      let kind = source.kind;
      if (!['group', 'word-search'].includes(kind)) {
        if (Array.isArray(source.children)) kind = 'group';
        else if (Object.hasOwn(source, 'puzzle') || Object.hasOwn(source, 'game')) kind = 'word-search';
      }
      if (!['group', 'word-search'].includes(kind)) {
        report.skipped += 1;
        return [];
      }

      if (itemCount >= MAX_WORD_SEARCH_ITEMS ||
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
          name: name(source.name, 'Recovered group', report),
          children: visit(source.children, depth + 1),
        }];
      }

      const item = {
        id,
        kind: 'word-search',
        name: name(source.name, 'Recovered word search', report),
      };
      if (Object.hasOwn(source, 'boardRotation')) {
        if ([0, 90, 180, 270].includes(source.boardRotation)) item.boardRotation = source.boardRotation;
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

  raw = object(raw) ?? {};
  const result = { items: visit(raw.items) };
  if (Object.hasOwn(raw, 'display')) {
    const display = optionalDisplay(raw.display, validateWordSearchDisplay, report);
    if (display) result.display = display;
  }
  return result;
}

export function readLegacyWorkspace() {
  let text;
  try {
    text = localStorage.getItem(LEGACY_WORKSPACE_KEY);
  } catch (problem) {
    return { status: 'unreadable', error: problem?.message || 'Legacy browser storage is unavailable.' };
  }
  if (text === null) return { status: 'none' };

  let source;
  try {
    source = JSON.parse(text);
  } catch {
    return {
      status: 'unreadable',
      error: 'The legacy workspace exists but is not valid JSON. It has been left untouched.',
    };
  }

  const features = object(source)?.features;
  if (!object(features)) {
    return {
      status: 'unreadable',
      error: 'The legacy workspace does not contain a recognizable feature collection. It has been left untouched.',
    };
  }

  const report = { recovered: 0, repaired: 0, skipped: 0 };
  const workspace = {
    format: 'dynamic-learner',
    version: 1,
    features: {
      notebook: migrateNotebook(features.notebook, report),
      'index-cards': migrateIndexCards(features['index-cards'], report),
      'word-search': migrateWordSearch(features['word-search'], report),
    },
  };
  return { status: 'ready', workspace, report };
}

export function clearLegacyWorkspace() {
  localStorage.removeItem(LEGACY_WORKSPACE_KEY);
}
