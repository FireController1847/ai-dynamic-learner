import { isRecord } from '../../core/validation.ts';
import { choiceStyle } from '../../core/display-fields.ts';
import type { DisplayField } from '../../core/display-fields.ts';

export interface DisplayOptions {
  paper: 'cream' | 'white';
  font: 'serif' | 'sans';
  textSize: number;
  cardSize: number;
  ink: 'pencil' | 'dark' | 'black';
  baseline: number;
}
// Canonical display choices, defaults, and bounds; no Vue or DOM dependencies.
export const DISPLAY_FIELDS: DisplayField<DisplayOptions>[] = [
  { key: 'paper', label: 'Paper color', default: 'cream', choices: [
    { value: 'cream', label: 'Cream', css: '#fffefa' },
    { value: 'white', label: 'White', css: '#ffffff' },
  ] },
  { key: 'font', label: 'Font', default: 'serif', choices: [
    { value: 'serif', label: 'Serif', css: "Georgia, 'Times New Roman', serif" },
    { value: 'sans', label: 'Sans', css: "'Segoe UI', Arial, sans-serif" },
  ] },
  { key: 'textSize', label: 'Text size', default: 100, min: 80, max: 130, step: 5, unit: '%' },
  { key: 'cardSize', label: 'Card size', default: 100, min: 75, max: 125, step: 5, unit: '%' },
  { key: 'ink', label: 'Ink', default: 'pencil', choices: [
    { value: 'pencil', label: 'Pencil', css: '#3d3d3d' },
    { value: 'dark', label: 'Dark graphite', css: '#292929' },
    { value: 'black', label: 'Black', css: '#000000' },
  ] },
  { key: 'baseline', label: 'Text vertical offset', default: 1, min: -4, max: 6, step: 1, unit: 'px' },
];

export function defaultDisplayOptions(): DisplayOptions {
  return Object.fromEntries(DISPLAY_FIELDS.map((field) => [field.key, field.default])) as unknown as DisplayOptions;
}

export function validateDisplayOptions(value: unknown): asserts value is DisplayOptions {
  if (!isRecord(value)) throw new Error('Index Cards display settings are invalid.');

  // Display settings saved before paper color existed used the cream paper implicitly.
  if (!Object.hasOwn(value, 'paper')) value.paper = 'cream';

  if (Object.keys(value).some((key) => !DISPLAY_FIELDS.some((field) => field.key === key))) {
    throw new Error('Index Cards display settings are invalid.');
  }
  for (const field of DISPLAY_FIELDS) {
    const setting = value[field.key];
    const valid = field.choices ? field.choices.some((choice) => choice.value === setting)
      : typeof setting === 'number' && Number.isInteger(setting) && setting >= field.min && setting <= field.max &&
        (setting - field.min) % field.step === 0;
    if (!valid) throw new Error(`Index Cards display setting “${field.label}” is invalid.`);
  }
}

export function displayStyles(options: DisplayOptions) {
  const choice = (key: keyof DisplayOptions) => choiceStyle(DISPLAY_FIELDS, key, options[key]);
  return {
    '--paper': choice('paper'),
    '--paper-font': choice('font'),
    '--paper-ink': choice('ink'),
    '--card-text-size': `${3.1 * options.textSize / 100}cqw`,
    '--card-title-size': `${3.2 * options.textSize / 100}cqw`,
    '--card-baseline': `${options.baseline}px`,
    '--card-max-width': `${680 * options.cardSize / 100}px`,
    '--card-min-width': `${340 * options.cardSize / 100}px`,
    '--card-viewport-width': `${80 * options.cardSize / 100}dvh`,
    '--card-preview-width': `${360 * options.cardSize / 100}px`,
  };
}
