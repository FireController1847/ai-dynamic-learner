import { validateTodoDisplay, type TodoDisplay } from './display-options.ts';
import { createId, isValidId } from '../../core/ids.ts';
import { validateSections, type TodoSection } from './task-model.ts';
import { isRecord } from '../../core/validation.ts';

export type SectionSort = 'custom' | 'name' | 'priority';
export interface TodoListRecord { id: string; name: string; createdAt: string; sections?: TodoSection[]; sectionSort?: SectionSort }
export interface Expiry { amount: number; unit: 'days' | 'weeks' | 'months' }
export interface LibrarySettings { order: 'newest' | 'oldest'; dates: 'long' | 'short'; expiry?: Expiry | null }
export function expirySetting(settings: LibrarySettings): Expiry | null { return settings.expiry === undefined ? { amount: 1, unit: 'months' } : settings.expiry; }
export function expiryLabel(settings: LibrarySettings): string {
  const expiry = expirySetting(settings);
  return expiry ? `${expiry.amount} ${expiry.amount === 1 ? expiry.unit.slice(0, -1) : expiry.unit} before archive` : 'No automatic expiry';
}
export interface TodoLists { items: TodoListRecord[]; lastSelectedListId?: string | null; settings?: LibrarySettings; display?: TodoDisplay }
export const MAX_LISTS = 2000;
export const MAX_NAME_LENGTH = 120;
export function defaultLibrarySettings(): LibrarySettings { return { order: 'newest', dates: 'long', expiry: { amount: 1, unit: 'months' } }; }

export function createList(items: TodoListRecord[], now = Date.now()): TodoListRecord {
  if (items.length >= MAX_LISTS) throw new Error(`The Todo List limit is ${MAX_LISTS} lists.`);
  const item = { id: createId(), name: 'New todo list', createdAt: new Date(now).toISOString() };
  items.push(item);
  return item;
}

/** UTC expiry; calendar months clamp at month-end, and disabled expiry is infinite. */
export function archiveTime(item: TodoListRecord, settings = defaultLibrarySettings()): number {
  const expiry = expirySetting(settings);
  if (expiry === null) return Infinity;
  const created = new Date(item.createdAt);
  if (expiry.unit !== 'months') {
    created.setUTCDate(created.getUTCDate() + expiry.amount * (expiry.unit === 'weeks' ? 7 : 1));
    return created.getTime();
  }
  const month = created.getUTCMonth() + expiry.amount;
  const monthEnd = new Date(created);
  monthEnd.setUTCDate(1);
  monthEnd.setUTCMonth(month + 1);
  monthEnd.setUTCDate(0);
  const lastDay = monthEnd.getUTCDate();
  const result = new Date(created);
  result.setUTCDate(1);
  result.setUTCMonth(month);
  result.setUTCDate(Math.min(created.getUTCDate(), lastDay));
  return result.getTime();
}
export function isArchived(item: TodoListRecord, now: number, settings = defaultLibrarySettings()): boolean { return now >= archiveTime(item, settings); }
export function ageProgress(item: TodoListRecord, now: number, settings = defaultLibrarySettings()): number {
  const start = Date.parse(item.createdAt);
  return Math.min(1, Math.max(0, (now - start) / (archiveTime(item, settings) - start)));
}
export function orderedLists(items: TodoListRecord[], settings: LibrarySettings): TodoListRecord[] {
  return [...items].sort((a, b) => {
    const order = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return (settings.order === 'newest' ? -order : order) || a.id.localeCompare(b.id);
  });
}
export function validateLibrarySettings(value: unknown): asserts value is LibrarySettings {
  if (!isRecord(value) || Object.keys(value).some(key => !['order', 'dates', 'expiry'].includes(key)) ||
      (value.order !== 'newest' && value.order !== 'oldest') || (value.dates !== 'long' && value.dates !== 'short')) {
    throw new Error('Todo List library settings are invalid.');
  }
  if (Object.hasOwn(value, 'expiry') && value.expiry !== null) {
    const expiry = value.expiry;
    if (!isRecord(expiry) || Object.keys(expiry).some(key => !['amount', 'unit'].includes(key)) ||
        typeof expiry.amount !== 'number' || !Number.isInteger(expiry.amount) || expiry.amount < 1 || expiry.amount > 365 ||
        !['days', 'weeks', 'months'].includes(typeof expiry.unit === 'string' ? expiry.unit : '')) {
      throw new Error('Todo List expiry must be 1–365 days, weeks, or months, or disabled.');
    }
  }
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
