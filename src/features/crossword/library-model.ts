import { isRecord } from '../../core/validation.ts';
import { createTreeOperations, type TreeGroupOption, type TreeItemLocation, type TreeMovePosition } from '../../core/tree.ts';
import type { Puzzle } from './puzzle-model.ts';
import type { Game } from './game-model.ts';
import type { DisplayOptions } from './display-options.ts';

export interface CrosswordItem { id: string; kind: 'crossword'; name: string; puzzle?: Puzzle; game?: Game }
export interface Group { id: string; kind: 'group'; name: string; children: LibraryItem[] }
export type LibraryItem = Group | CrosswordItem;
export interface Crossword { items: LibraryItem[]; display?: DisplayOptions }
export interface PuzzleTarget { itemId?: string | null; parentId?: string | null }
export type ItemLocation = TreeItemLocation<LibraryItem>;
export type MovePosition = TreeMovePosition;
export type GroupOption = TreeGroupOption;

import { createId, isValidId } from '../../core/ids.ts';
import { validatePuzzle, validatePuzzleForGeneration } from './puzzle-model.ts';
import { validateGame } from './game-model.ts';
import { validateDisplayOptions } from './display-options.ts';

export const MAX_ITEMS = 5000;
export const MAX_DEPTH = 32;
export const MAX_NAME_LENGTH = 120;
export const MAX_CROSSWORDS = 1000;

const libraryTree = createTreeOperations<LibraryItem>({
  children: (item) => item.kind === 'group' ? item.children : null,
  maxDepth: MAX_DEPTH,
});

export const findItem = libraryTree.findItem;
export const firstEntry = libraryTree.firstEntry;
export const countItems = libraryTree.countItems;
export const deleteItem = libraryTree.deleteItem;
export const canMove = libraryTree.canMove;
export const moveItem = libraryTree.moveItem;
export const groupOptions = libraryTree.groupOptions;

export function createGroup(): Group {
  return { id: createId(), kind: 'group', name: 'New group', children: [] };
}

export function saveCrossword(items: LibraryItem[], target: PuzzleTarget, name: string, puzzle: unknown): CrosswordItem {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) {
    throw new Error(`Enter a title of 1–${MAX_NAME_LENGTH} characters.`);
  }
  validatePuzzleForGeneration(puzzle);

  if (target.itemId) {
    const found = findItem(items, target.itemId);
    if (!found || found.item.kind !== 'crossword') throw new Error('This crossword no longer exists.');
    const previous = found.item.puzzle;
    const previousAnswers = previous?.entries.map(({ answer }) => answer).sort() ?? [];
    const nextAnswers = puzzle.entries.map(({ answer }) => answer).sort();
    const answersChanged = !previous ||
      JSON.stringify(previousAnswers) !== JSON.stringify(nextAnswers);
    if (answersChanged) delete found.item.game;
    Object.assign(found.item, { name: trimmedName, puzzle });
    return found.item;
  }

  if (countItems(items) >= MAX_ITEMS || countCrosswords(items) >= MAX_CROSSWORDS) {
    throw new Error(`The library supports ${MAX_ITEMS} items and ${MAX_CROSSWORDS} crosswords.`);
  }
  const parent = target.parentId ? findItem(items, target.parentId) : null;
  if (target.parentId && (!parent || parent.item.kind !== 'group')) {
    throw new Error('The destination group no longer exists. Cancel and choose a new destination.');
  }
  if (parent && parent.depth >= MAX_DEPTH) throw new Error(`Groups can be at most ${MAX_DEPTH} levels deep.`);

  const item: CrosswordItem = { id: createId(), kind: 'crossword', name: trimmedName, puzzle };
  (parent?.item.kind === 'group' ? parent.item.children : items).push(item);
  return item;
}

export function countCrosswords(items: LibraryItem[]): number {
  return items.reduce((count, item) => count +
    (item.kind === 'group' ? countCrosswords(item.children) : 1), 0);
}

export function validateCrossword(value: unknown): asserts value is Crossword {
  if (!isRecord(value) || !Array.isArray(value.items) ||
      Object.keys(value).some((key) => !['items', 'display'].includes(key))) {
    throw new Error('The Crossword library is invalid.');
  }
  if (Object.hasOwn(value, 'display')) validateDisplayOptions(value.display);

  const ids = new Set<string>();
  let itemCount = 0;
  let crosswordCount = 0;

  function visit(items: unknown[], depth: number): void {
    if (items.length && depth > MAX_DEPTH) {
      throw new Error(`Crossword groups can be at most ${MAX_DEPTH} levels deep.`);
    }

    for (const item of items) {
      if (!isRecord(item) ||
          (item.kind !== 'group' && item.kind !== 'crossword') ||
          !isValidId(item.id) || ids.has(item.id) ||
          typeof item.name !== 'string' || !item.name.trim() ||
          item.name.length > MAX_NAME_LENGTH) {
        throw new Error('A Crossword library item has an invalid name, type, or duplicate ID.');
      }

      ids.add(item.id);
      itemCount += 1;
      if (itemCount > MAX_ITEMS) {
        throw new Error(`A Crossword library can contain up to ${MAX_ITEMS} items.`);
      }

      if (item.kind === 'group') {
        if (Object.keys(item).some((key) => !['id', 'kind', 'name', 'children'].includes(key)) ||
            !Array.isArray(item.children)) {
          throw new Error('A Crossword group contains unsupported data.');
        }
        visit(item.children, depth + 1);
      } else {
        if (Object.keys(item).some((key) => !['id', 'kind', 'name', 'puzzle', 'game'].includes(key))) {
          throw new Error('A crossword contains unsupported data.');
        }
        if (Object.hasOwn(item, 'puzzle')) validatePuzzle(item.puzzle);
        if (Object.hasOwn(item, 'game')) validateGame(item.puzzle, item.game);
        crosswordCount += 1;
        if (crosswordCount > MAX_CROSSWORDS) {
          throw new Error(`A workspace supports up to ${MAX_CROSSWORDS} crosswords.`);
        }
      }
    }
  }

  visit(value.items, 1);
}

export type ConfiguredCrossword = CrosswordItem & { puzzle: Puzzle };
export function hasPuzzle(item: CrosswordItem): item is ConfiguredCrossword {
  return item.puzzle !== undefined;
}
