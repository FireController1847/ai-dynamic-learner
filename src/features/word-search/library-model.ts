import { isRecord } from '../../core/validation.ts';
import type { Puzzle } from './puzzle-model.ts';
import type { Game } from './game-model.ts';
import type { StoredDisplayOptions } from './display-options.ts';
export type BoardRotation = 0 | 90 | 180 | 270;
export interface WordSearchItem { id: string; kind: 'word-search'; name: string; puzzle?: Puzzle; game?: Game; boardRotation?: BoardRotation }
export interface Group { id: string; kind: 'group'; name: string; children: LibraryItem[] }
export type LibraryItem = Group | WordSearchItem;
export interface WordSearch { items: LibraryItem[]; display?: StoredDisplayOptions }
export interface PuzzleTarget { itemId?: string | null; parentId?: string | null }
export interface ItemLocation { item: LibraryItem; siblings: LibraryItem[]; index: number; parentId: string | null; depth: number }
export type MovePosition = 'before' | 'after' | 'inside';
export interface GroupOption { id: string; label: string }

import { createId, isValidId } from '../../core/ids.ts';
import { validatePuzzle } from './puzzle-model.ts';
import { validateGame } from './game-model.ts';
import { validateDisplayOptions } from './display-options.ts';

export const MAX_ITEMS = 5000;
export const MAX_DEPTH = 32;
export const MAX_NAME_LENGTH = 120;
export const MAX_WORD_SEARCHES = 1000;

export function createGroup(): Group {
  return { id: createId(), kind: 'group', name: 'New group', children: [] };
}

export function saveWordSearch(items: LibraryItem[], target: PuzzleTarget, name: string, puzzle: unknown): WordSearchItem {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) {
    throw new Error(`Enter a title of 1–${MAX_NAME_LENGTH} characters.`);
  }
  validatePuzzle(puzzle);
  if (target.itemId) {
    const found = findItem(items, target.itemId);
    if (!found || found.item.kind !== 'word-search') throw new Error('This word search no longer exists.');
    const previous = found.item.puzzle;
    if (!previous || previous.size !== puzzle.size || previous.difficulty !== puzzle.difficulty ||
        JSON.stringify(previous.words) !== JSON.stringify(puzzle.words)) delete found.item.game;
    Object.assign(found.item, { name: trimmedName, puzzle });
    return found.item;
  }
  if (countItems(items) >= MAX_ITEMS || countWordSearches(items) >= MAX_WORD_SEARCHES) {
    throw new Error(`The library supports ${MAX_ITEMS} items and ${MAX_WORD_SEARCHES} word searches.`);
  }
  const parent = target.parentId ? findItem(items, target.parentId) : null;
  if (target.parentId && (!parent || parent.item.kind !== 'group')) {
    throw new Error('The destination group no longer exists. Cancel and choose a new destination.');
  }
  if (parent && parent.depth >= MAX_DEPTH) throw new Error(`Groups can be at most ${MAX_DEPTH} levels deep.`);
  const item: WordSearchItem = { id: createId(), kind: 'word-search', name: trimmedName, puzzle };
  (parent?.item.kind === 'group' ? parent.item.children : items).push(item);
  return item;
}

export function findItem(items: LibraryItem[], id: string | null | undefined, parentId: string | null = null, depth = 1): ItemLocation | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.id === id) return { item, siblings: items, index, parentId, depth };
    if (item.kind === 'group') {
      const found = findItem(item.children, id, item.id, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function countItems(items: LibraryItem[]): number {
  return items.reduce((count, item) => count + 1 +
    (item.kind === 'group' ? countItems(item.children) : 0), 0);
}

export function countWordSearches(items: LibraryItem[]): number {
  return items.reduce((count, item) => count +
    (item.kind === 'group' ? countWordSearches(item.children) : 1), 0);
}

export function deleteItem(items: LibraryItem[], id: string): LibraryItem | null {
  const found = findItem(items, id);
  if (!found) return null;
  return found.siblings.splice(found.index, 1)[0];
}

function subtreeDepth(item: LibraryItem): number {
  return item.kind === 'group' && item.children.length
    ? 1 + Math.max(...item.children.map(subtreeDepth)) : 1;
}

function planMove(items: LibraryItem[], sourceId: string, targetId: string | null, position: MovePosition) {
  const source = findItem(items, sourceId);
  const target = targetId ? findItem(items, targetId) : null;
  if (!source || (targetId && !target) || sourceId === targetId) return null;
  if (!['before', 'after', 'inside'].includes(position)) return null;
  if (target && position === 'inside' && target.item.kind !== 'group') return null;

  const parentId = target ? (position === 'inside' ? targetId : target.parentId) : null;
  if (parentId === sourceId || (source.item.kind === 'group' &&
      findItem(source.item.children, parentId))) return null;

  const depth = target ? target.depth + (position === 'inside' ? 1 : 0) : 1;
  if (depth + subtreeDepth(source.item) - 1 > MAX_DEPTH) return null;

  const destination = !target ? items
    : position === 'inside' && target.item.kind === 'group' ? target.item.children : target.siblings;
  const index = !target ? (position === 'before' ? 0 : items.length)
    : position === 'inside' ? destination.length
      : target.index + (position === 'after' ? 1 : 0);
  return { source, destination, index };
}

export function canMove(items: LibraryItem[], sourceId: string, targetId: string | null, position: MovePosition) {
  return Boolean(planMove(items, sourceId, targetId, position));
}

export function moveItem(items: LibraryItem[], sourceId: string, targetId: string | null, position: MovePosition) {
  const plan = planMove(items, sourceId, targetId, position);
  if (!plan) return false;
  let { source, destination, index } = plan;
  if (source.siblings === destination && source.index < index) index -= 1;
  source.siblings.splice(source.index, 1);
  destination.splice(index, 0, source.item);
  return true;
}

export function groupOptions(items: LibraryItem[], excludedId: string | null, trail: string[] = []): GroupOption[] {
  return items.flatMap((item) => {
    if (item.kind !== 'group' || item.id === excludedId) return [];
    const path = [...trail, item.name];
    return [{ id: item.id, label: path.join(' / ') },
      ...groupOptions(item.children, excludedId, path)];
  });
}

export function validateWordSearch(value: unknown): asserts value is WordSearch {
  if (!isRecord(value) || !Array.isArray(value.items) ||
      Object.keys(value).some((key) => !['items', 'display'].includes(key))) {
    throw new Error('The Word Search library is invalid.');
  }

  if (Object.hasOwn(value, 'display')) validateDisplayOptions(value.display);

  const ids = new Set<string>();
  let itemCount = 0;
  let searchCount = 0;

  function visit(items: unknown[], depth: number): void {
    if (items.length && depth > MAX_DEPTH) {
      throw new Error(`Word Search groups can be at most ${MAX_DEPTH} levels deep.`);
    }
    for (const item of items) {
      if (!isRecord(item) ||
          (item.kind !== 'group' && item.kind !== 'word-search') ||
          !isValidId(item.id) || ids.has(item.id) ||
          typeof item.name !== 'string' || !item.name.trim() ||
          item.name.length > MAX_NAME_LENGTH) {
        throw new Error('A Word Search library item has an invalid name, type, or duplicate ID.');
      }
      ids.add(item.id);
      itemCount += 1;
      if (itemCount > MAX_ITEMS) {
        throw new Error(`A Word Search library can contain up to ${MAX_ITEMS} items.`);
      }

      if (item.kind === 'group') {
        if (Object.keys(item).some((key) => !['id', 'kind', 'name', 'children'].includes(key)) ||
            !Array.isArray(item.children)) {
          throw new Error('A Word Search group contains unsupported data.');
        }
        visit(item.children, depth + 1);
      } else {
        if (Object.keys(item).some((key) => !['id', 'kind', 'name', 'puzzle', 'game', 'boardRotation'].includes(key))) {
          throw new Error('A word search contains unsupported data.');
        }
        if (Object.hasOwn(item, 'boardRotation') &&
            (typeof item.boardRotation !== 'number' || ![0, 90, 180, 270].includes(item.boardRotation))) {
          throw new Error('A word search contains an invalid board rotation.');
        }
        if (Object.hasOwn(item, 'puzzle')) validatePuzzle(item.puzzle);
        if (Object.hasOwn(item, 'game')) validateGame(item.puzzle, item.game);
        searchCount += 1;
        if (searchCount > MAX_WORD_SEARCHES) {
          throw new Error(`A workspace supports up to ${MAX_WORD_SEARCHES} word searches.`);
        }
      }
    }
  }

  visit(value.items, 1);
}

export type ConfiguredWordSearch = WordSearchItem & { puzzle: Puzzle };
export function hasPuzzle(item: WordSearchItem): item is ConfiguredWordSearch {
  return item.puzzle !== undefined;
}
