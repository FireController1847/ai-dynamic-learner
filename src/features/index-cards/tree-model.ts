import {
  DEFAULT_ANSWER_STRICTNESS,
  isAnswerStrictness,
  type AnswerStrictness,
} from '../../../packages/@dynamic-learner/answer-matching/src/index.ts';
import { isRecord } from '../../core/validation.ts';
import { createTreeOperations, type TreeGroupOption, type TreeItemLocation, type TreeMovePosition } from '../../core/tree.ts';
import type { Card } from './card-model.ts';
import type { DisplayOptions } from './display-options.ts';
import { DEFAULT_SET_MODE, isSetMode, type SetModeId } from './set-modes.ts';

export interface IndexCardSettings {
  answerStrictness: AnswerStrictness;
}

export interface CardSet {
  id: string;
  kind: 'set';
  name: string;
  mode?: SetModeId;
  cards: Card[];
}

export interface Group { id: string; kind: 'group'; name: string; children: LibraryItem[] }
export type LibraryItem = Group | CardSet;
export interface IndexCards {
  items: LibraryItem[];
  display?: DisplayOptions;
  settings?: IndexCardSettings;
  lastSelectedSetId?: string | null;
}
export interface SetTarget { selectedId?: string | null }
export type ItemLocation = TreeItemLocation<LibraryItem>;
export type MovePosition = TreeMovePosition;
export type GroupOption = TreeGroupOption;

export const MAX_ITEMS = 5000;
export const MAX_DEPTH = 32;
export const MAX_NAME_LENGTH = 120;

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

export function resolvedIndexCardSettings(settings?: IndexCardSettings): IndexCardSettings {
  return settings ?? { answerStrictness: DEFAULT_ANSWER_STRICTNESS };
}

function validateIndexCardSettings(value: unknown): asserts value is IndexCardSettings {
  if (!isRecord(value) ||
      Object.keys(value).some((key) => key !== 'answerStrictness') ||
      !isAnswerStrictness(value.answerStrictness)) {
    throw new Error('Index Cards answer strictness must be a level from 1 through 4.');
  }
}

export function createItem(kind: 'group', mode?: SetModeId): Group;
export function createItem(kind: 'set', mode?: SetModeId): CardSet;
export function createItem(kind: 'group' | 'set', mode?: SetModeId): LibraryItem;
export function createItem(kind: 'group' | 'set', mode: SetModeId = DEFAULT_SET_MODE): LibraryItem {
  const id = createId();
  if (kind === 'group') return { id, kind, name: 'New group', children: [] };

  return { id, kind: 'set', name: 'New set', mode, cards: [] };
}

export function insertSet(items: LibraryItem[], target: SetTarget | null, mode: SetModeId): CardSet {
  if (countItems(items) >= MAX_ITEMS) {
    throw new Error(`The Index Cards library supports up to ${MAX_ITEMS} groups and sets.`);
  }
  const selected = target?.selectedId ? findItem(items, target.selectedId) : null;
  if (target?.selectedId && !selected) throw new Error('The selected destination no longer exists. Choose another location.');
  if (selected?.item.kind === 'group' && selected.depth >= MAX_DEPTH) {
    throw new Error(`Groups can be at most ${MAX_DEPTH} levels deep.`);
  }
  const item = createItem('set', mode);

  if (selected?.item.kind === 'group') selected.item.children.unshift(item);
  else if (selected) selected.siblings.splice(selected.index + 1, 0, item);
  else items.unshift(item);

  return item;
}

export function countCards(items: LibraryItem[]): number {
  return items.reduce((count, item) => count +
    (item.kind === 'group' ? countCards(item.children) : item.cards.length), 0);
}

export function validateIndexCards(value: unknown): asserts value is IndexCards {
  if (!isRecord(value) || !Array.isArray(value.items) ||
      Object.keys(value).some((key) => !['items', 'display', 'settings', 'lastSelectedSetId'].includes(key))) {
    throw new Error('The Index Cards directory is invalid.');
  }
  if (Object.hasOwn(value, 'display')) validateDisplayOptions(value.display);
  if (Object.hasOwn(value, 'settings')) validateIndexCardSettings(value.settings);
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
      if (item.kind === 'set' && !Object.hasOwn(item, 'mode')) item.mode = DEFAULT_SET_MODE;
      const supportedKeys = item.kind === 'group'
        ? ['id', 'kind', 'name', 'children']
        : ['id', 'kind', 'name', 'mode', 'cards'];
      if (Object.keys(item).some((key) => !supportedKeys.includes(key)) ||
          !Array.isArray(item[collectionKey])) {
        throw new Error('A group or set contains unsupported data.');
      }
      if (item.kind === 'group') {
        visit(item.children as unknown[], depth + 1);
      } else {
        if (!isSetMode(item.mode)) throw new Error('An Index Cards set has an unsupported study mode.');

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
