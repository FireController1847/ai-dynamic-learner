import { validateKnowledgeCheck, type KnowledgeCheck } from '../features/knowledge-check/library-model.ts';
import { validateGuide, type GuideModel } from '../features/guide/library-model.ts';
import { isRecord } from '../core/validation.ts';
import type { Notebook } from '../features/notebook/library-model.ts';
import type { IndexCards } from '../features/index-cards/tree-model.ts';
import type { WordSearch } from '../features/word-search/library-model.ts';
import type { Crossword } from '../features/crossword/library-model.ts';
import { validateTodoLists, type TodoLists } from '../features/todo-list/library-model.ts';
import { emptyStatistics, validateStatistics, type StatisticsData } from '../core/statistics.ts';

export interface Workspace {
  format: 'dynamic-learner';
  version: 1;
  statistics?: StatisticsData;
  features: { notebook: Notebook; 'todo-list': TodoLists; 'index-cards': IndexCards; 'word-search': WordSearch; crossword: Crossword; 'guide': GuideModel; 'knowledge-check': KnowledgeCheck };
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
    statistics: emptyStatistics(),
    features: {
      notebook: { items: [] },
      'todo-list': { items: [] },
      'index-cards': { items: [] },
      'word-search': { items: [] },
      crossword: { items: [] },
      'guide': { items: [] },
      'knowledge-check': { items: [] },
    },
  };
}

export function parseWorkspace(text: string): Workspace {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('Backups must be smaller than 32 MB.');
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new Error('This file is not valid JSON.'); }
  return validateWorkspaceValue(value);
}

/** Validate an in-memory IDB snapshot without imposing the legacy JSON file-size limit. */
export function validateWorkspaceValue(value: unknown): Workspace {
  if (!isRecord(value) || value.format !== 'dynamic-learner' || value.version !== 1 ||
      Object.keys(value).some((key) => !['format', 'version', 'features', 'statistics'].includes(key)) ||
      !isRecord(value.features) || !value.features['index-cards'] ||
      Object.keys(value.features).some((key) => !['notebook', 'todo-list', 'index-cards', 'word-search', 'crossword', 'guide', 'study-guide', 'knowledge-check'].includes(key))) {
    throw new Error('This is not a supported Dynamic Learner workspace backup (version 1).');
  }
  if (Object.hasOwn(value.features, 'guide') && Object.hasOwn(value.features, 'study-guide')) {
    throw new Error('A workspace cannot contain both the legacy and current Guide feature keys.');
  }
  const notebook = value.features.notebook || { items: [] };
  const indexCards = value.features['index-cards'];
  const wordSearch = value.features['word-search'] || { items: [] };
  const todoLists = Object.hasOwn(value.features, 'todo-list') ? value.features['todo-list'] : { items: [] };
  const crossword = value.features.crossword || { items: [] };
  const guide = Object.hasOwn(value.features, 'guide') ? value.features['guide']
    : Object.hasOwn(value.features, 'study-guide') ? value.features['study-guide'] : { items: [] };
  const knowledgeCheck = Object.hasOwn(value.features, 'knowledge-check') ? value.features['knowledge-check'] : { items: [] };
  validateGuide(guide);
  validateKnowledgeCheck(knowledgeCheck);
  validateNotebook(notebook);
  validateIndexCards(indexCards);
  validateWordSearch(wordSearch);
  validateTodoLists(todoLists);
  validateCrossword(crossword);
  const statistics = Object.hasOwn(value, 'statistics') ? value.statistics : emptyStatistics();
  validateStatistics(statistics);
  return { format: 'dynamic-learner', version: 1,
    statistics,
    features: { notebook, 'todo-list': todoLists, 'index-cards': indexCards, 'word-search': wordSearch, crossword, 'guide': guide, 'knowledge-check': knowledgeCheck } };

}
