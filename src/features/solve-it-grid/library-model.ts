import { archiveTime, validateLibrarySettings, type DatedLibraryRecord, type LibrarySettings } from '../../core/dated-library.ts';
import { createId, isValidId } from '../../core/ids.ts';
import { isRecord } from '../../core/validation.ts';
import { TASK_CATEGORIES, validateRound, validateTaskLists, type GridRound, type TaskLists, type TaskCategory } from './task-model.ts';

export type CheckInMode = 'time' | 'completion' | 'both';
export const CHECK_IN_MINUTES = [15, 25, 45, 60, 90, 120] as const;
export interface ActiveCheckIn {
  taskId: string;
  category: TaskCategory;
  roundNumber: number;
  mode: CheckInMode;
  minutes: number;
  startedAt: number;
  remindAt: number;
}
export interface TaskSet extends DatedLibraryRecord { lists?: TaskLists; round?: GridRound; history?: GridRound[]; checkIn?: ActiveCheckIn }
export interface SolveItGridModel {
  items: TaskSet[];
  settings?: LibrarySettings;
  lastSelectedTaskSetId?: string | null;
}
export const MAX_TASK_SETS = 2000;
export const MAX_NAME_LENGTH = 120;
export const MAX_ROUND_HISTORY = 100;

export function createTaskSet(items: TaskSet[], name: string, lists: TaskLists, now = Date.now()): TaskSet {
  if (items.length >= MAX_TASK_SETS) throw new Error(`The Solve-It Grid limit is ${MAX_TASK_SETS} task sets.`);
  const item = { id: createId(), name, createdAt: new Date(now).toISOString(), lists };
  items.push(item);
  return item;
}

export function validateSolveItGrid(value: unknown): asserts value is SolveItGridModel {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > MAX_TASK_SETS ||
      Object.keys(value).some(key => !['items', 'settings', 'lastSelectedTaskSetId'].includes(key))) {
    throw new Error('The Solve-It Grid library is invalid.');
  }
  if (Object.hasOwn(value, 'settings')) validateLibrarySettings(value.settings);
  const ids = new Set<string>();
  for (const item of value.items) {
    if (!isRecord(item) || Object.keys(item).some(key => !['id', 'name', 'createdAt', 'lists', 'round', 'history', 'checkIn'].includes(key)) ||
        !isValidId(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() ||
        item.name.length > MAX_NAME_LENGTH || typeof item.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(item.createdAt)) || new Date(item.createdAt).toISOString() !== item.createdAt) {
      throw new Error('A task set has an invalid name, creation date, or ID.');
    }
    if (Object.hasOwn(item, 'lists')) validateTaskLists(item.lists);
    if (Object.hasOwn(item, 'round')) {
      if (!Object.hasOwn(item, 'lists')) throw new Error('A saved grid round requires task lists.');
      validateTaskLists(item.lists);
      validateRound(item.round, item.lists);
    }
    if (Object.hasOwn(item, 'history')) {
      if (!Object.hasOwn(item, 'round') || !Object.hasOwn(item, 'lists') ||
          !Array.isArray(item.history) || item.history.length > MAX_ROUND_HISTORY) {
        throw new Error('The saved Solve-It Grid history is invalid.');
      }
      validateTaskLists(item.lists);
      validateRound(item.round, item.lists);
      let lastNumber = 0;
      for (const previous of item.history) {
        validateRound(previous, item.lists);
        if (previous.number <= lastNumber || previous.number >= item.round.number) {
          throw new Error('Saved Solve-It Grid rounds must be in chronological order.');
        }
        lastNumber = previous.number;
      }
    }
    if (Object.hasOwn(item, 'checkIn')) {
      const focus = item.checkIn;
      if (!isRecord(focus) || Object.keys(focus).some(key => !['taskId', 'category', 'roundNumber', 'mode', 'minutes', 'startedAt', 'remindAt'].includes(key)) ||
          !TASK_CATEGORIES.some(category => category.id === focus.category) ||
          !isValidId(focus.taskId) || (typeof focus.roundNumber !== 'number' || !Number.isSafeInteger(focus.roundNumber)) || (focus.roundNumber as number) < 1 ||
          !['time', 'completion', 'both'].includes(String(focus.mode)) ||
          !CHECK_IN_MINUTES.some(minutes => minutes === focus.minutes) ||
          (typeof focus.startedAt !== 'number' || !Number.isSafeInteger(focus.startedAt)) || (typeof focus.remindAt !== 'number' || !Number.isSafeInteger(focus.remindAt)) ||
          (focus.startedAt as number) < 0 || (focus.remindAt as number) < (focus.startedAt as number) ||
          !item.round || item.round.number !== focus.roundNumber ||
          !item.lists || !TASK_CATEGORIES.some(category => category.id === focus.category &&
            item.round?.slots[category.id].taskId === focus.taskId &&
            item.lists?.[category.id].some(task => task.id === focus.taskId))) {
        throw new Error('The saved check-in is invalid.');
      }
    }
    if (!Number.isFinite(archiveTime({ id: item.id, name: item.name, createdAt: item.createdAt },
      { order: 'newest', dates: 'long', expiry: { amount: 365, unit: 'months' } }))) {
      throw new Error('A task set creation date is outside the supported range.');
    }
    ids.add(item.id);
  }
  if (Object.hasOwn(value, 'lastSelectedTaskSetId') && value.lastSelectedTaskSetId !== null &&
      (!isValidId(value.lastSelectedTaskSetId) || !ids.has(value.lastSelectedTaskSetId))) {
    throw new Error('The remembered task set is invalid.');
  }
}
