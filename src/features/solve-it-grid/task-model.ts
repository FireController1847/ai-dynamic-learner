import { isValidId } from '../../core/ids.ts';
import { isRecord } from '../../core/validation.ts';

export const TASK_CATEGORIES = [
  { id: 'fires', number: 1, label: 'Fires', description: "Urgent things that need attention soon because delaying them could have serious consequences.", examples: ["Deadline approaching", "Urgent bill", "Time-sensitive obligation", "Important commitment"], example: 'Work on today’s assignment for 30 minutes', position: 'top-left', icon: 'flame' },
  { id: 'passive-fun', number: 2, label: 'Passive Fun', description: "Enjoyable, relaxing activities that take little mental effort and are usually easy to pause.", examples: ["Watch a show", "Listen to music", "Casual reading"], example: 'Watch a show for 30 minutes', position: 'bottom-right', icon: 'coffee' },
  { id: 'shoulds-oughts', number: 3, label: 'Shoulds & Oughts', description: "Things you know need doing but have been actively putting off.", examples: ["Put clothes away", "Start studying", "Organize paperwork"], example: 'Spend 20 minutes putting clothes away', position: 'bottom-left', icon: 'checklist' },
  { id: 'stimulated-fun', number: 4, label: 'Stimulating Fun', description: "Enjoyable activities that engage your mind deeply and may feel difficult to interrupt.", examples: ["Concerts", "A date", "Vacation", "Creative projects"], example: 'Work on a hobby for 30 minutes', position: 'top-right', icon: 'lightbulb' },
] as const;
export type TaskCategory = typeof TASK_CATEGORIES[number]['id'];
export type CategoryValues<T> = Record<TaskCategory, T>;
export interface GridTask { id: string; text: string; completed?: true; repeat?: number; timesCompleted?: number }
/** A positive repeat count is the number of extra completions after the first. -1 means unlimited. */
export const REPEAT_OPTIONS = [-1, 1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 50, 100] as const;
export type TaskLists = CategoryValues<GridTask[]>;
export interface RoundSlot { taskId: string | null; skipped?: true; completed?: true }
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
export function taskAvailable(task: GridTask): boolean {
  return task.repeat === undefined ? !task.completed : task.repeat === -1 || (task.timesCompleted ?? 0) < task.repeat + 1;
}
export function remainingCount(lists: TaskLists): number {
  return TASK_CATEGORIES.reduce((count, category) => count + lists[category.id].filter(taskAvailable).length, 0);
}
/** Keep completion state on each round, so recurring items render and rewind correctly. */
export function markCompleted(task: GridTask, slot: RoundSlot): void {
  if (slot.completed) return;
  slot.completed = true;
  if (task.repeat === undefined) task.completed = true;
  else task.timesCompleted = (task.timesCompleted ?? 0) + 1;
}
export function undoCompleted(task: GridTask, slot: RoundSlot): void {
  if (!slot.completed && (task.repeat !== undefined || !task.completed || slot.skipped)) return;
  delete slot.completed;
  if (task.repeat === undefined) delete task.completed;
  else if ((task.timesCompleted ?? 0) <= 1) delete task.timesCompleted;
  else task.timesCompleted!--;
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
    const available = lists[category.id].filter(taskAvailable);
    return { taskId: available[Math.floor(Math.random() * available.length)]?.id ?? null };
  }) };
}
export function roundTask(lists: TaskLists, round: GridRound, category: TaskCategory): GridTask | null {
  return lists[category].find(task => task.id === round.slots[category].taskId) ?? null;
}
export function slotState(lists: TaskLists, round: GridRound, category: TaskCategory): 'ready' | 'done' | 'skipped' | 'empty' {
  const task = roundTask(lists, round, category);
  // A skip describes this round, even if that same task was completed in a later draw.
  return !task ? 'empty' : round.slots[category].skipped ? 'skipped' :
    round.slots[category].completed || (task.repeat === undefined && task.completed) ? 'done' : 'ready';
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
      if (!isRecord(task) || Object.keys(task).some(key => !['id', 'text', 'completed', 'repeat', 'timesCompleted'].includes(key)) ||
          !isValidId(task.id) || ids.has(task.id) || typeof task.text !== 'string' || !task.text.trim() ||
          task.text.length > MAX_TASK_TEXT_LENGTH || (Object.hasOwn(task, 'completed') && task.completed !== true) ||
          (Object.hasOwn(task, 'repeat') && !REPEAT_OPTIONS.some(option => option === task.repeat)) ||
          (Object.hasOwn(task, 'timesCompleted') && (typeof task.timesCompleted !== 'number' ||
            !Number.isSafeInteger(task.timesCompleted) || task.timesCompleted < 1 || !Object.hasOwn(task, 'repeat') ||
            (task.repeat !== -1 && task.timesCompleted > (task.repeat as number) + 1))) ||
          (Object.hasOwn(task, 'repeat') && Object.hasOwn(task, 'completed'))) {
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
    if (!isRecord(slot) || Object.keys(slot).some(key => !['taskId', 'skipped', 'completed'].includes(key)) ||
        (slot.taskId !== null && (!isValidId(slot.taskId) || !lists[category.id].some(task => task.id === slot.taskId))) ||
        (Object.hasOwn(slot, 'skipped') && (slot.skipped !== true || slot.taskId === null)) ||
        (Object.hasOwn(slot, 'completed') && (slot.completed !== true || slot.taskId === null || Object.hasOwn(slot, 'skipped')))) {
      throw new Error('A saved quadrant refers to an invalid task.');
    }
  }
}
