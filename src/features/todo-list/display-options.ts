import { isRecord } from '../../core/validation.ts';
import { choiceStyle, type DisplayField } from '../../core/display-fields.ts';

export interface TodoDisplay {
  paper: 'white' | 'cream'; font: 'serif' | 'sans' | 'mono'; ink: 'pencil' | 'dark' | 'blue';
  textSize: number; baseline: number; rowSpacing: number; inset: number; margin: number; prioritySize: number;
}
export const DISPLAY_FIELDS: DisplayField<TodoDisplay>[] = [
  { key: 'paper', label: 'Paper', default: 'white', choices: [
    { value: 'white', label: 'White', css: '#fff' }, { value: 'cream', label: 'Cream', css: 'var(--paper)' },
  ] },
  { key: 'font', label: 'Font', default: 'serif', choices: [
    { value: 'serif', label: 'Serif', css: "'Times New Roman', Times, serif" },
    { value: 'sans', label: 'Sans', css: "'Segoe UI', Arial, sans-serif" },
    { value: 'mono', label: 'Monospace', css: 'ui-monospace, Consolas, monospace' },
  ] },
  { key: 'ink', label: 'Ink', default: 'pencil', choices: [
    { value: 'pencil', label: 'Pencil', css: '#3d3d3d' }, { value: 'dark', label: 'Black', css: '#242424' },
    { value: 'blue', label: 'Blue', css: '#174a7e' },
  ] },
  { key: 'textSize', label: 'Text size', default: 100, min: 80, max: 130, step: 5, unit: '%' },
  { key: 'baseline', label: 'Text vertical offset', default: 0, min: -8, max: 8, step: 1, unit: 'px' },
  { key: 'rowSpacing', label: 'Line spacing', default: 36, min: 28, max: 48, step: 2, unit: 'px' },
  { key: 'inset', label: 'Text inset from margin', default: 12, min: 4, max: 32, step: 2, unit: 'px' },
  { key: 'margin', label: 'Left margin width', default: 116, min: 90, max: 180, step: 2, unit: 'px' },
  { key: 'prioritySize', label: 'Priority marker size', default: 100, min: 80, max: 140, step: 10, unit: '%' },
];
export function defaultTodoDisplay(): TodoDisplay {
  return Object.fromEntries(DISPLAY_FIELDS.map(field => [field.key, field.default])) as unknown as TodoDisplay;
}
export function validateTodoDisplay(value: unknown): asserts value is TodoDisplay {
  if (!isRecord(value) || Object.keys(value).some(key => !DISPLAY_FIELDS.some(field => field.key === key))) {
    throw new Error('Todo List display settings are invalid.');
  }
  for (const field of DISPLAY_FIELDS) {
    const setting = value[field.key];
    const valid = field.choices ? field.choices.some(choice => choice.value === setting)
      : typeof setting === 'number' && Number.isInteger(setting) && setting >= field.min && setting <= field.max &&
        (setting - field.min) % field.step === 0;
    if (!valid) throw new Error(`Todo List display setting “${field.label}” is invalid.`);
  }
}
export function todoDisplayStyles(options: TodoDisplay) {
  return {
    '--todo-font': choiceStyle(DISPLAY_FIELDS, 'font', options.font),
    '--todo-ink': choiceStyle(DISPLAY_FIELDS, 'ink', options.ink),
    '--todo-paper': choiceStyle(DISPLAY_FIELDS, 'paper', options.paper),
    '--todo-text-scale': options.textSize / 100,
    '--todo-row-height': `${options.rowSpacing}px`,
    '--todo-baseline': `${options.baseline}px`,
    '--todo-inset': `${options.inset}px`,
    '--todo-margin': `${options.margin}px`,
    '--todo-priority-scale': options.prioritySize / 100,
  };
}
