import { isRecord } from '../core/validation.ts';
import type { Notebook } from '../features/notebook/library-model.ts';
import type { IndexCards } from '../features/index-cards/tree-model.ts';
import type { WordSearch } from '../features/word-search/library-model.ts';
import type { Crossword } from '../features/crossword/library-model.ts';
import { validateTodoLists, type TodoLists } from '../features/todo-list/library-model.ts';

export interface Workspace {
  format: 'dynamic-learner';
  version: 1;
  features: { notebook: Notebook; 'todo-list': TodoLists; 'index-cards': IndexCards; 'word-search': WordSearch; crossword: Crossword };
}

import { validateNotebook } from '../features/notebook/library-model.ts';
import { validateIndexCards } from '../features/index-cards/tree-model.ts';
import { validateWordSearch } from '../features/word-search/library-model.ts';
import { validateCrossword } from '../features/crossword/library-model.ts';

export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

export function emptyWorkspace(): Workspace {
  return {
    format: 'dynamic-learner',
    version: 1,
    features: {
      notebook: { items: [] },
      'todo-list': { items: [] },
      'index-cards': { items: [] },
      'word-search': { items: [] },
      crossword: { items: [] },
    },
  };
}

export function parseWorkspace(text: string): Workspace {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('Backups must be smaller than 32 MB.');
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new Error('This file is not valid JSON.'); }
  if (!isRecord(value) || value.format !== 'dynamic-learner' || value.version !== 1 ||
      Object.keys(value).some((key) => !['format', 'version', 'features'].includes(key)) ||
      !isRecord(value.features) || !value.features['index-cards'] ||
      Object.keys(value.features).some((key) => !['notebook', 'todo-list', 'index-cards', 'word-search', 'crossword'].includes(key))) {
    throw new Error('This is not a supported Dynamic Learner workspace backup (version 1).');
  }
  const notebook = value.features.notebook || { items: [] };
  const indexCards = value.features['index-cards'];
  const wordSearch = value.features['word-search'] || { items: [] };
  const todoLists = Object.hasOwn(value.features, 'todo-list') ? value.features['todo-list'] : { items: [] };
  const crossword = value.features.crossword || { items: [] };
  validateNotebook(notebook);
  validateIndexCards(indexCards);
  validateWordSearch(wordSearch);
  validateTodoLists(todoLists);
  validateCrossword(crossword);
  return { format: 'dynamic-learner', version: 1,
    features: { notebook, 'todo-list': todoLists, 'index-cards': indexCards, 'word-search': wordSearch, crossword } };

}
