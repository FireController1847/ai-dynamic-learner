import { isRecord } from '../../core/validation.ts';
import { choiceStyle } from '../../core/display-fields.ts';
import type { DisplayField } from '../../core/display-fields.ts';

export interface DisplayOptions { font: 'mono' | 'sans' | 'serif'; weight: 'regular' | 'medium' | 'semibold' | 'bold'; textSize: number; cellSize: number; fit: 'screen' | 'preferred'; highlight: 'blue' | 'green' | 'purple'; motion: 'smooth' | 'none'; }
// Canonical appearance contract; independent of Vue and browser APIs.
export const MIN_CELL_SIZE = 30;
export const MAX_CELL_SIZE = 48;
export const DISPLAY_FIELDS: DisplayField<DisplayOptions>[] = [
  { key: 'font', label: 'Letter font', default: 'mono', choices: [
    { value: 'mono', label: 'Monospace', css: "ui-monospace, Consolas, monospace" },
    { value: 'sans', label: 'Sans', css: "'Segoe UI', Arial, sans-serif" },
    { value: 'serif', label: 'Serif', css: "Georgia, 'Times New Roman', serif" },
  ] },
  { key: 'weight', label: 'Font weight', default: 'regular', choices: [
    { value: 'regular', label: 'Regular', css: 400 },
    { value: 'medium', label: 'Medium', css: 500 },
    { value: 'semibold', label: 'Semibold', css: 600 },
    { value: 'bold', label: 'Bold', css: 700 },
  ] },
  { key: 'textSize', label: 'Letter size', default: 95, min: 85, max: 125, step: 5, unit: '%' },
  { key: 'cellSize', label: 'Preferred cell size', default: 36, min: MIN_CELL_SIZE, max: MAX_CELL_SIZE, step: 2, unit: 'px' },
  { key: 'fit', label: 'Grid sizing', default: 'screen', choices: [
    { value: 'screen', label: 'Fit available space' },
    { value: 'preferred', label: 'Use preferred cell size' },
  ] },
  { key: 'highlight', label: 'Highlight color', default: 'blue', choices: [
    { value: 'blue', label: 'Blue', css: '#0f6cbd' },
    { value: 'green', label: 'Green', css: '#167044' },
    { value: 'purple', label: 'Purple', css: '#7443a8' },
  ] },
  { key: 'motion', label: 'Highlight movement', default: 'none', choices: [
    { value: 'smooth', label: 'Smooth' }, { value: 'none', label: 'Instant' },
  ] },
];

export function defaultDisplayOptions(): DisplayOptions {
  return Object.fromEntries(DISPLAY_FIELDS.map((field) => [field.key, field.default])) as unknown as DisplayOptions;
}

export function resolvedDisplayOptions(options?: Partial<DisplayOptions>): DisplayOptions {
  const resolved = { ...defaultDisplayOptions(), ...options };
  resolved.cellSize = Math.max(MIN_CELL_SIZE, resolved.cellSize);
  return resolved;
}

export function validateDisplayOptions(options: unknown): asserts options is StoredDisplayOptions {
  if (!isRecord(options) ||
      Object.keys(options).some((key) => !DISPLAY_FIELDS.some((field) => field.key === key))) {
    throw new Error('Word Search display settings are invalid.');
  }
  for (const field of DISPLAY_FIELDS) {
    const value = options[field.key];
    // Preserve backups from before weight controls and the 30px minimum.
    if (field.key === 'weight' && !Object.hasOwn(options, 'weight')) continue;
    if (field.key === 'cellSize' && value === 28) continue;
    if (!(field.choices ? field.choices.some((choice) => choice.value === value)
      : typeof value === 'number' && Number.isInteger(value) && value >= field.min && value <= field.max && (value - field.min) % field.step === 0)) {
      throw new Error(`Word Search display setting “${field.label}” is invalid.`);
    }
  }
}

export function displayStyles(stored?: Partial<DisplayOptions>) {
  const options = resolvedDisplayOptions(stored);
  const choice = (key: keyof DisplayOptions) => choiceStyle(DISPLAY_FIELDS, key, options[key]);
  return {
    '--search-letter-font': choice('font'),
    '--search-letter-weight': choice('weight'),
    '--search-letter-size': `${16 * options.textSize / 100}px`,
    '--search-highlight': choice('highlight'),
  };
}

export type StoredDisplayOptions = Omit<DisplayOptions, 'weight'> & Partial<Pick<DisplayOptions, 'weight'>>;
