import { createId, isValidId } from '../../core/ids.ts';
import { createTreeOperations, type TreeGroupOption, type TreeItemLocation, type TreeMovePosition } from '../../core/tree.ts';
import { isRecord } from '../../core/validation.ts';

export interface CrosswordItem { id: string; kind: 'crossword'; name: string }
export interface Group { id: string; kind: 'group'; name: string; children: LibraryItem[] }
export type LibraryItem = Group | CrosswordItem;
export interface Crossword { items: LibraryItem[] }
export type ItemLocation = TreeItemLocation<LibraryItem>;
export type MovePosition = TreeMovePosition;
export type GroupOption = TreeGroupOption;

export const MAX_ITEMS = 5000;
export const MAX_DEPTH = 32;
export const MAX_NAME_LENGTH = 120;
export const MAX_CROSSWORDS = 1000;

const libraryTree = createTreeOperations<LibraryItem>({
  children: (item) => item.kind === 'group' ? item.children : null,
  maxDepth: MAX_DEPTH,
});

export const findItem = libraryTree.findItem;
export const countItems = libraryTree.countItems;
export const deleteItem = libraryTree.deleteItem;
export const canMove = libraryTree.canMove;
export const moveItem = libraryTree.moveItem;
export const groupOptions = libraryTree.groupOptions;

export function createGroup(): Group {
  return { id: createId(), kind: 'group', name: 'New group', children: [] };
}

export function countCrosswords(items: LibraryItem[]): number {
  return items.reduce((count, item) => count +
    (item.kind === 'group' ? countCrosswords(item.children) : 1), 0);
}

export function validateCrossword(value: unknown): asserts value is Crossword {
  if (!isRecord(value) || !Array.isArray(value.items) ||
      Object.keys(value).some((key) => key !== 'items')) {
    throw new Error('The Crossword library is invalid.');
  }

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
        if (Object.keys(item).some((key) => !['id', 'kind', 'name'].includes(key))) {
          throw new Error('A crossword contains unsupported data.');
        }
        crosswordCount += 1;
        if (crosswordCount > MAX_CROSSWORDS) {
          throw new Error(`A workspace supports up to ${MAX_CROSSWORDS} crosswords.`);
        }
      }
    }
  }

  visit(value.items, 1);
}
