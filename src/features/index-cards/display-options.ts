import { isRecord } from '../../core/validation.ts';
import { choiceStyle } from '../../core/display-fields.ts';
import type { DisplayField } from '../../core/display-fields.ts';
import type { SetModeId } from './set-modes.ts';

export interface CardDisplayOptions {
  paper: 'cream' | 'white';
  font: 'serif' | 'sans';
  ink: 'pencil' | 'dark' | 'black';
  textSize: number;
  baseline: number;
  cardSize: number;
  blankLength: 'short' | 'medium' | 'long';
}

export interface DisplayOptions {
  flashCards: CardDisplayOptions;
  fillInTheBlanks: CardDisplayOptions;
}

export const DISPLAY_FIELDS: DisplayField<CardDisplayOptions>[] = [
  { key: 'paper', label: 'Paper', default: 'white', choices: [
    { value: 'white', label: 'White', css: 'var(--paper-white)' },
    { value: 'cream', label: 'Cream', css: 'var(--paper-cream)' },
  ] },
  { key: 'font', label: 'Font', default: 'serif', choices: [
    { value: 'serif', label: 'Serif', css: "Georgia, 'Times New Roman', serif" },
    { value: 'sans', label: 'Sans', css: "'Segoe UI', Arial, sans-serif" },
  ] },
  { key: 'ink', label: 'Ink', default: 'pencil', choices: [
    { value: 'pencil', label: 'Pencil', css: 'var(--paper-ink-pencil)' },
    { value: 'dark', label: 'Dark graphite', css: 'var(--paper-ink-dark)' },
    { value: 'black', label: 'Black', css: 'var(--paper-ink-black)' },
  ] },
  { key: 'textSize', label: 'Text size', default: 100, min: 80, max: 130, step: 5, unit: '%' },
  { key: 'baseline', label: 'Text vertical offset', default: 1, min: -4, max: 6, step: 1, unit: 'px' },
  { key: 'blankLength', label: 'Blank length', default: 'short', choices: [
    { value: 'short', label: 'Short' },
    { value: 'medium', label: 'Medium' },
    { value: 'long', label: 'Long' },
  ] },
  { key: 'cardSize', label: 'Card size', default: 100, min: 75, max: 125, step: 5, unit: '%' },
];

export function defaultCardDisplayOptions(): CardDisplayOptions {
  return Object.fromEntries(DISPLAY_FIELDS.map((field) => [field.key, field.default])) as unknown as CardDisplayOptions;
}

export function defaultDisplayOptions(): DisplayOptions {
  return {
    flashCards: defaultCardDisplayOptions(),
    fillInTheBlanks: defaultCardDisplayOptions(),
  };
}

export function resolvedDisplayOptions(options?: DisplayOptions): DisplayOptions {
  return options ?? defaultDisplayOptions();
}

export function displayForMode(options: DisplayOptions, mode: SetModeId | undefined): CardDisplayOptions {
  return mode === 'fill-in-the-blanks' ? options.fillInTheBlanks : options.flashCards;
}

function validateCardDisplayOptions(value: unknown): asserts value is CardDisplayOptions {
  if (!isRecord(value) ||
      Object.keys(value).some((key) => !DISPLAY_FIELDS.some((field) => field.key === key))) {
    throw new Error('Index Cards display settings are invalid.');
  }

  if (!Object.hasOwn(value, 'paper')) value.paper = 'white';
  if (!Object.hasOwn(value, 'blankLength')) value.blankLength = 'short';

  for (const field of DISPLAY_FIELDS) {
    const setting = value[field.key];
    const valid = field.choices ? field.choices.some((choice) => choice.value === setting)
      : typeof setting === 'number' && Number.isInteger(setting) && setting >= field.min && setting <= field.max &&
        (setting - field.min) % field.step === 0;
    if (!valid) throw new Error(`Index Cards display setting “${field.label}” is invalid.`);
  }
}

export function validateDisplayOptions(value: unknown): asserts value is DisplayOptions {
  if (!isRecord(value)) throw new Error('Index Cards display settings are invalid.');

  const legacyKeys = DISPLAY_FIELDS.map((field) => String(field.key));
  const looksLegacy = !Object.hasOwn(value, 'flashCards') &&
    Object.keys(value).every((key) => legacyKeys.includes(key));

  if (looksLegacy) {
    validateCardDisplayOptions(value);
    const legacy = { ...value } as unknown as CardDisplayOptions;
    for (const key of legacyKeys) delete value[key];
    value.flashCards = legacy;
    value.fillInTheBlanks = { ...legacy };
  }

  if (Object.keys(value).some((key) => !['flashCards', 'fillInTheBlanks'].includes(key)) ||
      !Object.hasOwn(value, 'flashCards')) {
    throw new Error('Index Cards display settings are invalid.');
  }

  validateCardDisplayOptions(value.flashCards);
  if (!Object.hasOwn(value, 'fillInTheBlanks')) {
    value.fillInTheBlanks = { ...value.flashCards };
  }
  validateCardDisplayOptions(value.fillInTheBlanks);
}

export function displayStyles(options: CardDisplayOptions) {
  const choice = (key: keyof CardDisplayOptions) => choiceStyle(DISPLAY_FIELDS, key, options[key]);
  return {
    '--blank-sizing-width': options.blankLength === 'medium' ? 'max-content'
      : options.blankLength === 'long' ? 'initial' : '4ch',
    '--blank-input-padding': options.blankLength === 'long' ? '0.18em' : '0px',
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
