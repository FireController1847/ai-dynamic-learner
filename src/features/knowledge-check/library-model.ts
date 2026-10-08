import { validateSetOptions, type SetOptions } from './set-options.ts';
import { isRecord } from '../../core/validation.ts';
import { createId, isValidId } from '../../core/ids.ts';
import { createTreeOperations, type TreeMovePosition } from '../../core/tree.ts';
import { isCheckMode, type CheckModeId } from './check-types.ts';
import { validateQuestions, type Question } from './question-model.ts';

export interface CheckItem { id: string; kind: 'set'; name: string; questions: Question[]; mode?: CheckModeId; options?: SetOptions }
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

export function insertCheck(items: LibraryItem[], target: CheckTarget, name: string, questions: unknown, options?: SetOptions): CheckItem {
  validateQuestions(questions);
  if (options) validateSetOptions(options);
  if (!name.trim() || name.trim().length > MAX_NAME_LENGTH) throw new Error('Enter a name of 1–120 characters.');
  if (countItems(items) >= MAX_ITEMS) throw new Error(`The Review library supports ${MAX_ITEMS} items.`);
  const parent = target.parentId ? findItem(items, target.parentId) : null;
  if (target.parentId && (!parent || parent.item.kind !== 'group')) {
    throw new Error('The destination group no longer exists. Cancel and choose a new destination.');
  }
  if (parent && parent.depth >= MAX_DEPTH) throw new Error(`Groups can be at most ${MAX_DEPTH} levels deep.`);
  const item: CheckItem = { id: createId(), kind: 'set', name: name.trim(), questions };
  if (options) item.options = { ...options };
  const selected = target.selectedId ? findItem(items, target.selectedId) : null;
  if (selected?.item.kind === 'set' && selected.parentId === target.parentId) {
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
    throw new Error('The Review library is invalid.');
  }
  const ids = new Set<string>();
  let count = 0;
  function visit(items: unknown[], depth: number): void {
    if (items.length && depth > MAX_DEPTH) throw new Error(`Review groups can be at most ${MAX_DEPTH} levels deep.`);
    for (const item of items) {
      if (!isRecord(item) || !isValidId(item.id) || ids.has(item.id) ||
          typeof item.name !== 'string' || !item.name.trim() || item.name.length > MAX_NAME_LENGTH) {
        throw new Error('A Review item has an invalid name or duplicate ID.');
      }
      ids.add(item.id);
      if (++count > MAX_ITEMS) throw new Error(`The Review library supports ${MAX_ITEMS} items.`);
      if (item.kind === 'group') {
        if (!Array.isArray(item.children) || Object.keys(item).some((key) => !['id', 'kind', 'name', 'children'].includes(key))) {
          throw new Error('A Review group contains unsupported data.');
        }
        visit(item.children, depth + 1);
      } else {
        if (item.kind === 'check' && ['study', 'quiz', 'test', 'multiple-choice', 'true-false', 'short-answer'].includes(String(item.type)) &&
            Object.keys(item).every((key) => ['id', 'kind', 'name', 'type'].includes(key))) {
          item.kind = 'set';
          item.questions = [];
          delete item.type;
        }
        if (item.kind !== 'set' || Object.keys(item).some((key) => !['id', 'kind', 'name', 'questions', 'mode', 'options'].includes(key))) {
          throw new Error('A knowledge set contains unsupported data.');
        }
        if (Object.hasOwn(item, 'mode') && !isCheckMode(item.mode)) throw new Error('The knowledge set mode is invalid.');
        validateQuestions(item.questions);
        if (Object.hasOwn(item, 'options')) validateSetOptions(item.options);
      }
    }
  }
  visit(value.items, 1);
}
