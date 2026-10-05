import { isRecord } from '../../core/validation.ts';
import { createId, isValidId } from '../../core/ids.ts';
import { createTreeOperations, type TreeMovePosition } from '../../core/tree.ts';
import { getCheckType, isCheckType, normalizeCheckType, type CheckTypeId } from './check-types.ts';

export interface CheckItem { id: string; kind: 'check'; name: string; type: CheckTypeId }
export interface Group { id: string; kind: 'group'; name: string; children: LibraryItem[] }
export type LibraryItem = Group | CheckItem;
export interface KnowledgeCheck { items: LibraryItem[] }
export interface CheckTarget { parentId: string | null; parentName: string; selectedId?: string | null }
export type MovePosition = TreeMovePosition;

export const MAX_ITEMS = 5000;
export const MAX_DEPTH = 32;
export const MAX_NAME_LENGTH = 120;

const tree = createTreeOperations<LibraryItem>({
  children: (item) => item.kind === 'group' ? item.children : null,
  maxDepth: MAX_DEPTH,
});
export const { findItem, firstEntry, countItems, deleteItem, canMove, moveItem, groupOptions } = tree;

export function createGroup(): Group {
  return { id: createId(), kind: 'group', name: 'New group', children: [] };
}

export function insertCheck(items: LibraryItem[], target: CheckTarget, type: CheckTypeId): CheckItem {
  if (!isCheckType(type)) throw new Error('Choose a supported check type.');
  if (countItems(items) >= MAX_ITEMS) throw new Error(`The Knowledge Check library supports ${MAX_ITEMS} items.`);
  const parent = target.parentId ? findItem(items, target.parentId) : null;
  if (target.parentId && (!parent || parent.item.kind !== 'group')) {
    throw new Error('The destination group no longer exists. Cancel and choose a new destination.');
  }
  if (parent && parent.depth >= MAX_DEPTH) throw new Error(`Groups can be at most ${MAX_DEPTH} levels deep.`);
  const item: CheckItem = { id: createId(), kind: 'check', name: `New ${getCheckType(type).label.toLowerCase()} check`, type };
  const selected = target.selectedId ? findItem(items, target.selectedId) : null;
  if (selected?.item.kind === 'check' && selected.parentId === target.parentId) {
    selected.siblings.splice(selected.index + 1, 0, item);
  } else {
    (parent?.item.kind === 'group' ? parent.item.children : items).unshift(item);
  }
  return item;
}

export function countChecks(items: LibraryItem[]): number {
  return items.reduce((count, item) => count + (item.kind === 'group' ? countChecks(item.children) : 1), 0);
}

export function validateKnowledgeCheck(value: unknown): asserts value is KnowledgeCheck {
  if (!isRecord(value) || !Array.isArray(value.items) || Object.keys(value).some((key) => key !== 'items')) {
    throw new Error('The Knowledge Check library is invalid.');
  }
  const ids = new Set<string>();
  let count = 0;
  function visit(items: unknown[], depth: number): void {
    if (items.length && depth > MAX_DEPTH) throw new Error(`Knowledge Check groups can be at most ${MAX_DEPTH} levels deep.`);
    for (const item of items) {
      if (!isRecord(item) || !isValidId(item.id) || ids.has(item.id) ||
          typeof item.name !== 'string' || !item.name.trim() || item.name.length > MAX_NAME_LENGTH) {
        throw new Error('A Knowledge Check item has an invalid name or duplicate ID.');
      }
      ids.add(item.id);
      if (++count > MAX_ITEMS) throw new Error(`The Knowledge Check library supports ${MAX_ITEMS} items.`);
      if (item.kind === 'group') {
        if (!Array.isArray(item.children) || Object.keys(item).some((key) => !['id', 'kind', 'name', 'children'].includes(key))) {
          throw new Error('A Knowledge Check group contains unsupported data.');
        }
        visit(item.children, depth + 1);
      } else {
        // Earlier scaffold entries have no question data; retain them under the new modes.
        item.type = normalizeCheckType(item.type);
        if (item.kind !== 'check' || !isCheckType(item.type) ||
          Object.keys(item).some((key) => !['id', 'kind', 'name', 'type'].includes(key))) {
          throw new Error('A knowledge check contains unsupported data.');
        }
      }
    }
  }
  visit(value.items, 1);
}
