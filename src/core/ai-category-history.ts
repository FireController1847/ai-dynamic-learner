import { createId, isValidId } from './ids.ts';
import { isRecord } from './validation.ts';
import { categoryResponseJson, parseStudyCategories, type AiCardCategories } from './ai-study-categories.ts';

const KEY = 'dynamic-learner.ui.index-cards.category-history.v1';
const MAX_ENTRIES = 20;
export interface CategoryHistoryEntry { id: string; savedAt: string; categories: AiCardCategories }

export function readCategoryHistory(): CategoryHistoryEntry[] {
  try {
    const text = localStorage.getItem(KEY);
    if (!text || text.length > 1024 * 1024) return [];
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value) || value.length > MAX_ENTRIES) return [];
    const entries: unknown[] = value;
    const ids = new Set<string>();
    return entries.map(entry => {
      if (!isRecord(entry) || Object.keys(entry).some(key => !['id', 'savedAt', 'json'].includes(key)) ||
          !isValidId(entry.id) || ids.has(entry.id) || typeof entry.savedAt !== 'string' ||
          !Number.isFinite(Date.parse(entry.savedAt)) || typeof entry.json !== 'string') {
        throw new Error('Invalid category history.');
      }
      ids.add(entry.id);
      return { id: entry.id, savedAt: entry.savedAt, categories: parseStudyCategories(entry.json) };
    });
  } catch { return []; }
}

export function rememberCategories(entries: CategoryHistoryEntry[], categories: AiCardCategories): CategoryHistoryEntry[] {
  const json = categoryResponseJson(categories);
  const previous = entries.find(entry => categoryResponseJson(entry.categories) === json);
  return [{ id: previous?.id ?? createId(), savedAt: new Date().toISOString(), categories },
    ...entries.filter(entry => entry.id !== previous?.id)].slice(0, MAX_ENTRIES);
}

export function writeCategoryHistory(entries: CategoryHistoryEntry[]): boolean {
  try {
    if (!entries.length) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(entries.map(entry => ({
      id: entry.id, savedAt: entry.savedAt, json: categoryResponseJson(entry.categories),
    }))));
    return true;
  } catch { return false; }
}
