import { isValidId } from '../../core/ids.ts';
import { isRecord } from '../../core/validation.ts';

export const TASK_CATEGORIES = [
  { id: 'fires', number: 1, label: 'Fires', description: "Things which need to get done today.", examples: ["Due assignment", "Take exam", "Overdue bills", "Important priorities"], example: 'Send the project update before 4 pm', position: 'top-left', icon: 'flame' },
  { id: 'passive-fun', number: 2, label: 'Passive Fun', description: "Things which don't require constant attention, such as scrolling.", examples: ["Short-form media", "TV and shows", "Calling a friend"], example: 'Watch one episode, then stop', position: 'bottom-right', icon: 'coffee' },
  { id: 'shoulds-oughts', number: 3, label: 'Shoulds & Oughts', description: "Things you've said you need to get done, but haven't.", examples: ["Clothes away", "Ahead in class", "Study for exam"], example: 'Fold one basket of laundry', position: 'bottom-left', icon: 'checklist' },
  { id: 'stimulated-fun', number: 4, label: 'Stimulated Fun', description: "Things you procrastinate with, procrastiwork with, or personally enjoy doing, e.g. hobbies.", examples: ["Video games", "Hobbies", "Side projects"], example: 'Work on the game project for 25 minutes', position: 'top-right', icon: 'lightbulb' },
] as const;
export type TaskCategory = typeof TASK_CATEGORIES[number]['id'];
export type CategoryValues<T> = Record<TaskCategory, T>;
export interface GridTask { id: string; text: string; completed?: true }
export type TaskLists = CategoryValues<GridTask[]>;
export interface RoundSlot { taskId: string | null; skipped?: true }
export interface GridRound { number: number; slots: CategoryValues<RoundSlot> }
export const MAX_TASK_TEXT_LENGTH = 10000;

export function categoryValues<T>(create: (category: typeof TASK_CATEGORIES[number]) => T): CategoryValues<T> {
  return Object.fromEntries(TASK_CATEGORIES.map(category => [category.id, create(category)])) as CategoryValues<T>;
}
export function emptyTaskLists(): TaskLists { return categoryValues(() => []); }
export function listCounts(lists: TaskLists): CategoryValues<number> {
  return categoryValues(category => lists[category.id].filter(task => task.text.trim()).length);
}
export function taskCount(lists: TaskLists): number {
  return TASK_CATEGORIES.reduce((count, category) => count + lists[category.id].length, 0);
}
export function remainingCount(lists: TaskLists): number {
  return TASK_CATEGORIES.reduce((count, category) => count + lists[category.id].filter(task => !task.completed).length, 0);
}
/** Item-count balance only; 100 means equal counts, 0 means one occupied list. */
export function balanceScore(counts: CategoryValues<number>): number | null {
  const values = Object.values(counts), total = values.reduce((sum, count) => sum + count, 0);
  if (!total) return null;
  const distance = values.reduce((sum, count) => sum + Math.abs(count - total / 4), 0);
  return Math.round(Math.max(0, Math.min(100, 100 * (1 - distance / (1.5 * total)))));
}
export function createRound(lists: TaskLists, number = 1): GridRound {
  return { number, slots: categoryValues(category => {
    const available = lists[category.id].filter(task => !task.completed);
    return { taskId: available[Math.floor(Math.random() * available.length)]?.id ?? null };
  }) };
}
export function roundTask(lists: TaskLists, round: GridRound, category: TaskCategory): GridTask | null {
  return lists[category].find(task => task.id === round.slots[category].taskId) ?? null;
}
export function slotState(lists: TaskLists, round: GridRound, category: TaskCategory): 'ready' | 'done' | 'skipped' | 'empty' {
  const task = roundTask(lists, round, category);
  // A skip describes this round, even if that same task was completed in a later draw.
  return !task ? 'empty' : round.slots[category].skipped ? 'skipped' : task.completed ? 'done' : 'ready';
}
export function nextCategory(lists: TaskLists, round: GridRound): TaskCategory | null {
  return TASK_CATEGORIES.find(category => slotState(lists, round, category.id) === 'ready')?.id ?? null;
}
export function validateTaskLists(value: unknown): asserts value is TaskLists {
  if (!isRecord(value) || Object.keys(value).length !== TASK_CATEGORIES.length ||
      Object.keys(value).some(key => !TASK_CATEGORIES.some(category => category.id === key))) {
    throw new Error('A task set must contain the four supported lists.');
  }
  const ids = new Set<string>();
  for (const category of TASK_CATEGORIES) {
    const tasks = value[category.id];
    if (!Array.isArray(tasks)) throw new Error('Each task list must be an array.');
    for (const task of tasks) {
      if (!isRecord(task) || Object.keys(task).some(key => !['id', 'text', 'completed'].includes(key)) ||
          !isValidId(task.id) || ids.has(task.id) || typeof task.text !== 'string' || !task.text.trim() ||
          task.text.length > MAX_TASK_TEXT_LENGTH || (Object.hasOwn(task, 'completed') && task.completed !== true)) {
        throw new Error('A task has invalid text, completion state, or a duplicate ID.');
      }
      ids.add(task.id);
    }
  }
}
export function validateRound(value: unknown, lists: TaskLists): asserts value is GridRound {
  if (!isRecord(value) || Object.keys(value).some(key => !['number', 'slots'].includes(key)) ||
      typeof value.number !== 'number' || !Number.isSafeInteger(value.number) || value.number < 1 ||
      !isRecord(value.slots) || Object.keys(value.slots).length !== 4 ||
      Object.keys(value.slots).some(key => !TASK_CATEGORIES.some(category => category.id === key))) {
    throw new Error('The saved Solve-It Grid round is invalid.');
  }
  for (const category of TASK_CATEGORIES) {
    const slot = value.slots[category.id];
    if (!isRecord(slot) || Object.keys(slot).some(key => !['taskId', 'skipped'].includes(key)) ||
        (slot.taskId !== null && (!isValidId(slot.taskId) || !lists[category.id].some(task => task.id === slot.taskId))) ||
        (Object.hasOwn(slot, 'skipped') && (slot.skipped !== true || slot.taskId === null))) {
      throw new Error('A saved quadrant refers to an invalid task.');
    }
  }
}
