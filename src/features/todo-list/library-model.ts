import { archiveTime, validateLibrarySettings, type LibrarySettings } from '../../core/dated-library.ts';
export { ageProgress, archiveTime, defaultLibrarySettings, expiryLabel, expirySetting, isArchived, orderedDatedItems as orderedLists, validateLibrarySettings, type Expiry, type LibrarySettings } from '../../core/dated-library.ts';
import { validateTodoDisplay, type TodoDisplay } from './display-options.ts';
import { createId, isValidId } from '../../core/ids.ts';
import { validateSections, type TodoSection } from './task-model.ts';
import { isRecord } from '../../core/validation.ts';

export type SectionSort = 'custom' | 'name' | 'priority';
export interface TodoListRecord { id: string; name: string; createdAt: string; sections?: TodoSection[]; sectionSort?: SectionSort }
export interface TodoLists { items: TodoListRecord[]; lastSelectedListId?: string | null; settings?: LibrarySettings; display?: TodoDisplay }
export const MAX_LISTS = 2000;
export const MAX_NAME_LENGTH = 120;
export function createList(items: TodoListRecord[], now = Date.now()): TodoListRecord {
  if (items.length >= MAX_LISTS) throw new Error(`The Todo List limit is ${MAX_LISTS} lists.`);
  const item = { id: createId(), name: 'New todo list', createdAt: new Date(now).toISOString() };
  items.push(item);
  return item;
}

export function cloneList(items: TodoListRecord[], source: TodoListRecord, skipRemaining: boolean, now = Date.now()): TodoListRecord {
  if (items.length >= MAX_LISTS) throw new Error(`The Todo List limit is ${MAX_LISTS} lists.`);
  const suffix = ' (copy)';
  const item: TodoListRecord = {
    ...source, id: createId(), name: source.name.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd() + suffix,
    createdAt: new Date(now).toISOString(),
  };
  if (source.sections) item.sections = source.sections.map(section => ({
    ...section, id: createId(), tasks: section.tasks.map(task => ({ ...task, id: createId() })),
  }));
  items.push(item);
  if (skipRemaining) {
    for (const section of source.sections ?? []) {
      for (const task of section.tasks) {
        if (!task.done && !task.skipped && (task.text.trim() || task.priority?.trim())) task.skipped = true;
      }
    }
  }
  return item;
}

export function validateTodoLists(value: unknown): asserts value is TodoLists {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > MAX_LISTS ||
      Object.keys(value).some(key => !['items', 'settings', 'display', 'lastSelectedListId'].includes(key))) {
    throw new Error('The Todo List library is invalid.');
  }
  if (Object.hasOwn(value, 'display')) validateTodoDisplay(value.display);
  if (Object.hasOwn(value, 'settings')) validateLibrarySettings(value.settings);
  const ids = new Set<string>();
  for (const item of value.items) {
    if (!isRecord(item) || Object.keys(item).some(key => !['id', 'name', 'createdAt', 'sections', 'sectionSort'].includes(key)) ||
        !isValidId(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() ||
        item.name.length > MAX_NAME_LENGTH || typeof item.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(item.createdAt)) || new Date(item.createdAt).toISOString() !== item.createdAt ||
        (Object.hasOwn(item, 'sectionSort') && !['custom', 'name', 'priority'].includes(typeof item.sectionSort === 'string' ? item.sectionSort : ''))) {
      throw new Error('A Todo List has an invalid name, creation date, or ID.');
    }
    if (!Number.isFinite(archiveTime({ id: item.id, name: item.name, createdAt: item.createdAt }, { order: 'newest', dates: 'long', expiry: { amount: 365, unit: 'months' } }))) {
      throw new Error('A Todo List creation date is outside the supported range.');
    }
    if (Object.hasOwn(item, 'sections')) validateSections(item.sections);
    ids.add(item.id);
  }
  if (Object.hasOwn(value, 'lastSelectedListId') && value.lastSelectedListId !== null &&
      (!isValidId(value.lastSelectedListId) || !ids.has(value.lastSelectedListId))) {
    throw new Error('The remembered Todo List is invalid.');
  }
}
