import { createId, isValidId } from '../../core/ids.ts';
import { isRecord } from '../../core/validation.ts';

export interface TodoTask { id: string; text: string; done: boolean; skipped?: boolean; priority?: string }
export interface TodoSection { id: string; title: string; priority?: string; tasks: TodoTask[] }
export const MAX_SECTIONS = 100;
export const MAX_TASKS = 2000;
export const MAX_TASK_TEXT = 10000;
export function newTask(): TodoTask { return { id: createId(), text: '', done: false }; }
export function newSection(): TodoSection { return { id: createId(), title: '', priority: '', tasks: [newTask()] }; }
export function priorityNumber(value: string): string { return value.replace(/^\s*P\s*(?:#\s*|(?=\d))/i, '').trim(); }
export function formatPriority(value: string): string {
  const number = priorityNumber(value);
  return number ? `P#${number.slice(0, 10)}` : '';
}
export function sectionPriority(section: TodoSection): string {
  return section.priority ?? section.tasks.find(task => task.priority?.trim())?.priority ?? '';
}
export function orderedTasks(section: TodoSection): TodoTask[] {
  return [...section.tasks].sort((a, b) => Number(!!b.skipped) - Number(!!a.skipped));
}
export function validateSections(value: unknown): asserts value is TodoSection[] {
  if (!Array.isArray(value) || value.length > MAX_SECTIONS) throw new Error('Todo List sections are invalid.');
  const ids = new Set<string>();
  let count = 0;
  for (const section of value) {
    if (!isRecord(section) || Object.keys(section).some(key => !['id', 'title', 'priority', 'tasks'].includes(key)) ||
        !isValidId(section.id) || ids.has(section.id) || typeof section.title !== 'string' || section.title.length > 120 ||
        (Object.hasOwn(section, 'priority') && (typeof section.priority !== 'string' || section.priority.length > 12)) ||
        !Array.isArray(section.tasks)) throw new Error('A Todo List section is invalid.');
    ids.add(section.id);
    for (const task of section.tasks) {
      if (!isRecord(task) || Object.keys(task).some(key => !['id', 'text', 'done', 'skipped', 'priority'].includes(key)) ||
          !isValidId(task.id) || ids.has(task.id) || typeof task.text !== 'string' || task.text.length > MAX_TASK_TEXT ||
          (Object.hasOwn(task, 'skipped') && typeof task.skipped !== 'boolean') || (task.done === true && task.skipped === true) ||
          typeof task.done !== 'boolean' || (Object.hasOwn(task, 'priority') && (typeof task.priority !== 'string' || task.priority.length > 12))) {
        throw new Error('A Todo List task is invalid.');
      }
      ids.add(task.id); count += 1;
      if (count > MAX_TASKS) throw new Error('This Todo List has too many tasks.');
    }
  }
}
