import { isRecord } from '../../core/validation.ts';
import { choiceStyle, type DisplayField } from '../../core/display-fields.ts';

export interface DisplayOptions {
  font: 'mono' | 'sans' | 'serif';
  weight: 'regular' | 'medium' | 'semibold' | 'bold';
  textSize: number;
  cellSize: number;
  fit: 'screen' | 'preferred';
  highlight: 'blue' | 'green' | 'purple';
  blocks: 'light' | 'soft' | 'black';
}

export const MIN_CELL_SIZE = 30;
export const MAX_CELL_SIZE = 52;
export const DISPLAY_FIELDS: DisplayField<DisplayOptions>[] = [
  { key: 'font', label: 'Letter font', default: 'sans', choices: [
    { value: 'mono', label: 'Monospace', css: 'ui-monospace, Consolas, monospace' },
    { value: 'sans', label: 'Sans', css: "'Segoe UI', Arial, sans-serif" },
    { value: 'serif', label: 'Serif', css: "Georgia, 'Times New Roman', serif" },
  ] },
  { key: 'weight', label: 'Font weight', default: 'semibold', choices: [
    { value: 'regular', label: 'Regular', css: 400 },
    { value: 'medium', label: 'Medium', css: 500 },
    { value: 'semibold', label: 'Semibold', css: 600 },
    { value: 'bold', label: 'Bold', css: 700 },
  ] },
  { key: 'textSize', label: 'Letter size', default: 100, min: 85, max: 125, step: 5, unit: '%' },
  { key: 'cellSize', label: 'Preferred cell size', default: 38, min: MIN_CELL_SIZE, max: MAX_CELL_SIZE, step: 2, unit: 'px' },
  { key: 'fit', label: 'Grid sizing', default: 'screen', choices: [
    { value: 'screen', label: 'Fit available space' },
    { value: 'preferred', label: 'Use preferred cell size' },
  ] },
  { key: 'highlight', label: 'Selection color', default: 'blue', choices: [
    { value: 'blue', label: 'Blue', css: 'var(--crossword-highlight-blue)' },
    { value: 'green', label: 'Green', css: 'var(--crossword-highlight-green)' },
    { value: 'purple', label: 'Purple', css: 'var(--crossword-highlight-purple)' },
  ] },
  { key: 'blocks', label: 'Blocked cells', default: 'light', choices: [
    { value: 'light', label: 'Light gray', css: 'var(--crossword-block-light)' },
    { value: 'soft', label: 'Medium gray', css: 'var(--crossword-block-soft)' },
    { value: 'black', label: 'Black', css: 'var(--crossword-block-black)' },
  ] },
];

export function defaultDisplayOptions(): DisplayOptions {
  return Object.fromEntries(DISPLAY_FIELDS.map((field) => [field.key, field.default])) as unknown as DisplayOptions;
}

export function resolvedDisplayOptions(options?: Partial<DisplayOptions>): DisplayOptions {
  return { ...defaultDisplayOptions(), ...options };
}

export function validateDisplayOptions(value: unknown): asserts value is DisplayOptions {
  if (!isRecord(value) || Object.keys(value).some((key) => !DISPLAY_FIELDS.some((field) => field.key === key))) {
    throw new Error('Crossword display settings are invalid.');
  }
  for (const field of DISPLAY_FIELDS) {
    const current = value[field.key];
    if (!(field.choices
      ? field.choices.some((choice) => choice.value === current)
      : typeof current === 'number' && Number.isInteger(current) && current >= field.min &&
        current <= field.max && (current - field.min) % field.step === 0)) {
      throw new Error(`Crossword display setting “${field.label}” is invalid.`);
    }
  }
}

export function displayStyles(stored?: Partial<DisplayOptions>) {
  const options = resolvedDisplayOptions(stored);
  const choice = (key: keyof DisplayOptions) => choiceStyle(DISPLAY_FIELDS, key, options[key]);
  return {
    '--crossword-letter-font': choice('font'),
    '--crossword-letter-weight': choice('weight'),
    '--crossword-letter-size': `${18 * options.textSize / 100}px`,
    '--crossword-highlight': choice('highlight'),
    '--crossword-block': choice('blocks'),
  };
}
