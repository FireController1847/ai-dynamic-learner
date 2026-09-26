export const MAX_ITEMS = 5000;
export const MAX_DEPTH = 32;
export const MAX_NAME_LENGTH = 120;

export function createItem(kind) {
  const id = createId();
  return kind === 'group'
    ? { id, kind, name: 'New group', children: [] }
    : { id, kind: 'set', name: 'New set', cards: [] };
}

export function findItem(items, id, parentId = null, depth = 1) {
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

export function countItems(items) {
  return items.reduce((count, item) => count + 1 +
    (item.kind === 'group' ? countItems(item.children) : 0), 0);
}

export function deleteItem(items, id) {
  const found = findItem(items, id);
  if (!found) return null;
  return found.siblings.splice(found.index, 1)[0];
}

export function countCards(items) {
  return items.reduce((count, item) => count +
    (item.kind === 'group' ? countCards(item.children) : item.cards.length), 0);
}

function subtreeDepth(item) {
  return item.kind === 'group' && item.children.length
    ? 1 + Math.max(...item.children.map(subtreeDepth)) : 1;
}

function planMove(items, sourceId, targetId, position) {
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
    : position === 'inside' ? target.item.children : target.siblings;
  const index = !target ? (position === 'before' ? 0 : items.length)
    : position === 'inside' ? destination.length
      : target.index + (position === 'after' ? 1 : 0);
  return { source, destination, index };
}

export function canMove(items, sourceId, targetId, position) {
  return Boolean(planMove(items, sourceId, targetId, position));
}

export function moveItem(items, sourceId, targetId, position) {
  const plan = planMove(items, sourceId, targetId, position);
  if (!plan) return false;
  let { source, destination, index } = plan;
  if (source.siblings === destination && source.index < index) index -= 1;
  source.siblings.splice(source.index, 1);
  destination.splice(index, 0, source.item);
  return true;
}

export function groupOptions(items, excludedId, trail = []) {
  return items.flatMap((item) => {
    if (item.kind !== 'group' || item.id === excludedId) return [];
    const path = [...trail, item.name];
    return [{ id: item.id, label: path.join(' / ') },
      ...groupOptions(item.children, excludedId, path)];
  });
}

export function validateIndexCards(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.items) ||
      Object.keys(value).some((key) => !['items', 'display', 'lastSelectedSetId'].includes(key))) {
    throw new Error('The Index Cards directory is invalid.');
  }
  if (Object.hasOwn(value, 'display')) validateDisplayOptions(value.display);
  if (Object.hasOwn(value, 'lastSelectedSetId') && value.lastSelectedSetId !== null &&
      !isValidId(value.lastSelectedSetId)) {
    throw new Error('The remembered Index Cards set ID is invalid.');
  }
  const ids = new Set();
  let itemCount = 0;
  let cardCount = 0;
  function visit(items, depth) {
    if (items.length && depth > MAX_DEPTH) throw new Error(`Groups can be at most ${MAX_DEPTH} levels deep.`);
    for (const item of items) {
      if (!item || typeof item !== 'object' || !['group', 'set'].includes(item.kind) ||
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
      if (item.kind === 'group') visit(item.children, depth + 1);
      else {
        validateCards(item.cards, ids);
        cardCount += item.cards.length;
        if (cardCount > MAX_CARDS) throw new Error(`A workspace supports up to ${MAX_CARDS} cards.`);
      }
    }
  }
  visit(value.items, 1);
}
import { createId, isValidId } from '../../core/ids.js';
import { MAX_CARDS, validateCards } from './card-model.js';
import { validateDisplayOptions } from './display-options.js';
