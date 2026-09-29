import { isRecord } from '../../core/validation.ts';
import type { Card } from './card-model.ts';
import type { DisplayOptions } from './display-options.ts';
export interface CardSet { id: string; kind: 'set'; name: string; cards: Card[] }
export interface Group { id: string; kind: 'group'; name: string; children: LibraryItem[] }
export type LibraryItem = Group | CardSet;
export interface IndexCards { items: LibraryItem[]; display?: DisplayOptions; lastSelectedSetId?: string | null }
export interface ItemLocation { item: LibraryItem; siblings: LibraryItem[]; index: number; parentId: string | null; depth: number }
export type MovePosition = 'before' | 'after' | 'inside';
export interface GroupOption { id: string; label: string }

export const MAX_ITEMS = 5000;
export const MAX_DEPTH = 32;
export const MAX_NAME_LENGTH = 120;

export function createItem(kind: 'group'): Group;
export function createItem(kind: 'set'): CardSet;
export function createItem(kind: 'group' | 'set'): LibraryItem;
export function createItem(kind: 'group' | 'set'): LibraryItem {
  const id = createId();
  return kind === 'group'
    ? { id, kind, name: 'New group', children: [] }
    : { id, kind: 'set', name: 'New set', cards: [] };
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

export function deleteItem(items: LibraryItem[], id: string): LibraryItem | null {
  const found = findItem(items, id);
  if (!found) return null;
  return found.siblings.splice(found.index, 1)[0];
}

export function countCards(items: LibraryItem[]): number {
  return items.reduce((count, item) => count +
    (item.kind === 'group' ? countCards(item.children) : item.cards.length), 0);
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

export function validateIndexCards(value: unknown): asserts value is IndexCards {
  if (!isRecord(value) || !Array.isArray(value.items) ||
      Object.keys(value).some((key) => !['items', 'display', 'lastSelectedSetId'].includes(key))) {
    throw new Error('The Index Cards directory is invalid.');
  }
  if (Object.hasOwn(value, 'display')) validateDisplayOptions(value.display);
  if (Object.hasOwn(value, 'lastSelectedSetId') && value.lastSelectedSetId !== null &&
      !isValidId(value.lastSelectedSetId)) {
    throw new Error('The remembered Index Cards set ID is invalid.');
  }
  const ids = new Set<string>();
  let itemCount = 0;
  let cardCount = 0;
  function visit(items: unknown[], depth: number): void {
    if (items.length && depth > MAX_DEPTH) throw new Error(`Groups can be at most ${MAX_DEPTH} levels deep.`);
    for (const item of items) {
      if (!isRecord(item) || (item.kind !== 'group' && item.kind !== 'set') ||
          !isValidId(item.id) || ids.has(item.id) ||
          typeof item.name !== 'string' || !item.name.trim() || item.name.length > MAX_NAME_LENGTH) {
        throw new Error('A group or set has an invalid name, type, or duplicate ID.');
      }
      ids.add(item.id);
      itemCount += 1;
      if (itemCount > MAX_ITEMS) throw new Error(`A workspace can contain up to ${MAX_ITEMS} groups and sets.`);
      const collectionKey = item.kind === 'group' ? 'children' : 'cards';
      if (Object.keys(item).some((key) => !['id', 'kind', 'name', collectionKey].includes(key)) ||
          !Array.isArray(item[collectionKey])) {
        throw new Error('A group or set contains unsupported data.');
      }
      if (item.kind === 'group') visit(item.children as unknown[], depth + 1);
      else {
        validateCards(item.cards, ids);
        cardCount += item.cards.length;
        if (cardCount > MAX_CARDS) throw new Error(`A workspace supports up to ${MAX_CARDS} cards.`);
      }
    }
  }
  visit(value.items, 1);
}
import { createId, isValidId } from '../../core/ids.ts';
import { MAX_CARDS, validateCards } from './card-model.ts';
import { validateDisplayOptions } from './display-options.ts';
