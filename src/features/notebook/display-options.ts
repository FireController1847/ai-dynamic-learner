import { isRecord } from '../../core/validation.ts';
import { choiceStyle, type DisplayField } from '../../core/display-fields.ts';

export interface LinedDisplay {
  font: 'serif' | 'sans' | 'mono'; textSize: number; ink: 'pencil' | 'dark' | 'blue';
  paper: 'cream' | 'white'; ruling: 'college' | 'wide'; size: 'letter' | 'a4';
  holes: 'show' | 'hide'; baseline: number;
}
export interface MarkdownDisplay { font: 'sans' | 'serif'; textSize: number; sourceSize: number; lineHeight: number }
export interface NotebookDisplay { lined: LinedDisplay; markdown: MarkdownDisplay }

export const LINED_FIELDS: DisplayField<LinedDisplay>[] = [
  { key: 'font', label: 'Font', default: 'serif', choices: [
    { value: 'serif', label: 'Serif', css: "Georgia, 'Times New Roman', serif" },
    { value: 'sans', label: 'Sans', css: 'var(--font-family)' },
    { value: 'mono', label: 'Monospace', css: 'ui-monospace, Consolas, monospace' },
  ] },
  { key: 'textSize', label: 'Text size', default: 100, min: 80, max: 130, step: 5, unit: '%' },
  { key: 'ink', label: 'Ink', default: 'pencil', choices: [
    { value: 'pencil', label: 'Pencil', css: '#3d3d3d' }, { value: 'dark', label: 'Black', css: '#242424' },
    { value: 'blue', label: 'Blue', css: '#174a7e' },
  ] },
  { key: 'paper', label: 'Paper', default: 'white', choices: [
    { value: 'cream', label: 'Cream', css: 'var(--paper)' }, { value: 'white', label: 'White', css: '#fff' },
  ] },
  { key: 'ruling', label: 'Ruling', default: 'college', choices: [
    { value: 'college', label: 'College ruled' }, { value: 'wide', label: 'Wide ruled' },
  ] },
  { key: 'size', label: 'Paper size', default: 'letter', choices: [
    { value: 'letter', label: 'US Letter' }, { value: 'a4', label: 'A4' },
  ] },
  { key: 'holes', label: 'Punch holes', default: 'show', choices: [
    { value: 'show', label: 'Show' }, { value: 'hide', label: 'Hide' },
  ] },
  { key: 'baseline', label: 'Text vertical offset', default: 0, min: -4, max: 4, step: 1, unit: 'px' },
];
export const MARKDOWN_FIELDS: DisplayField<MarkdownDisplay>[] = [
  { key: 'font', label: 'Preview font', default: 'sans', choices: [
    { value: 'sans', label: 'Sans', css: 'var(--font-family)' },
    { value: 'serif', label: 'Serif', css: "Georgia, 'Times New Roman', serif" },
  ] },
  { key: 'textSize', label: 'Preview text size', default: 16, min: 12, max: 24, step: 1, unit: 'px' },
  { key: 'sourceSize', label: 'Source text size', default: 14, min: 12, max: 22, step: 1, unit: 'px' },
  { key: 'lineHeight', label: 'Preview line spacing', default: 170, min: 130, max: 220, step: 10, unit: '%' },
];

export function defaultLinedDisplay(): LinedDisplay {
  return Object.fromEntries(LINED_FIELDS.map(field => [field.key, field.default])) as unknown as LinedDisplay;
}
export function defaultMarkdownDisplay(): MarkdownDisplay {
  return Object.fromEntries(MARKDOWN_FIELDS.map(field => [field.key, field.default])) as unknown as MarkdownDisplay;
}
export function defaultNotebookDisplay(): NotebookDisplay {
  return { lined: defaultLinedDisplay(), markdown: defaultMarkdownDisplay() };
}

function validateFields(value: unknown, fields: (DisplayField<LinedDisplay> | DisplayField<MarkdownDisplay>)[]): void {
  if (!isRecord(value) || Object.keys(value).some(key => !fields.some(field => field.key === key))) {
    throw new Error('Notebook display settings contain unsupported data.');
  }
  for (const field of fields) {
    const setting = value[String(field.key)];
    const valid = field.choices ? field.choices.some(choice => choice.value === setting)
      : typeof setting === 'number' && Number.isInteger(setting) && setting >= field.min && setting <= field.max &&
        (setting - field.min) % field.step === 0;
    if (!valid) throw new Error(`Notebook display setting “${field.label}” is invalid.`);
  }
}
export function validateNotebookDisplay(value: unknown): asserts value is NotebookDisplay {
  if (!isRecord(value) || Object.keys(value).some(key => !['lined', 'markdown'].includes(key))) {
    throw new Error('Notebook display settings are invalid.');
  }
  validateFields(value.lined, LINED_FIELDS);
  validateFields(value.markdown, MARKDOWN_FIELDS);
}

export function notebookDisplayStyles(options: NotebookDisplay) {
  const lined = options.lined;
  const width = lined.size === 'letter' ? 8.5 : 210 / 25.4;
  return {
    '--lined-font': choiceStyle(LINED_FIELDS, 'font', lined.font),
    '--lined-ink': choiceStyle(LINED_FIELDS, 'ink', lined.ink),
    '--lined-paper-color': choiceStyle(LINED_FIELDS, 'paper', lined.paper),
    '--lined-text-scale': lined.textSize / 100,
    '--lined-baseline': `${lined.baseline}px`,
    '--lined-rule': `${100 * (lined.ruling === 'college' ? 9 / 32 : 11 / 32) / width}cqw`,
    '--lined-aspect': lined.size === 'letter' ? '17 / 22' : '210 / 297',
    '--lined-max-width': lined.size === 'letter' ? '816px' : '794px',
    '--lined-hole-display': lined.holes === 'show' ? 'block' : 'none',
    '--lined-hole-gutter': lined.holes === 'show' ? 'max(16px, 6cqw)' : '4px',
    '--notebook-preview-font': choiceStyle(MARKDOWN_FIELDS, 'font', options.markdown.font),
    '--notebook-preview-size': `${options.markdown.textSize}px`,
    '--notebook-source-size': `${options.markdown.sourceSize}px`,
    '--notebook-preview-leading': options.markdown.lineHeight / 100,
  };
}
