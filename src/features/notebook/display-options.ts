import { isRecord } from '../../core/validation.ts';
import { choiceStyle, type DisplayField } from '../../core/display-fields.ts';

export interface LinedDisplay {
  paper: 'cream' | 'white'; font: 'serif' | 'sans' | 'mono'; ink: 'pencil' | 'dark' | 'blue';
  textSize: number; baseline: number; ruling: 'college' | 'wide'; size: 'letter' | 'a4';
  holes: 'show' | 'hide';
}
export interface MarkdownDisplay { font: 'sans' | 'serif'; textSize: number; sourceSize: number; lineHeight: number }
export interface GraphDisplay {
  paper: 'white' | 'cream'; size: 'letter' | 'a4'; grid: 'quarter' | 'fifth' | 'metric';
  emphasis: 'plain' | 'fifths'; axes: 'show' | 'hide'; numbers: 'show' | 'hide';
}
export interface NotebookDisplay { lined: LinedDisplay; markdown: MarkdownDisplay; graph?: GraphDisplay }

export const LINED_FIELDS: DisplayField<LinedDisplay>[] = [
  { key: 'paper', label: 'Paper', default: 'white', choices: [
    { value: 'white', label: 'White', css: 'var(--paper-white)' }, { value: 'cream', label: 'Cream', css: 'var(--paper-cream)' },
  ] },
  { key: 'font', label: 'Font', default: 'serif', choices: [
    { value: 'serif', label: 'Serif', css: "Georgia, 'Times New Roman', serif" },
    { value: 'sans', label: 'Sans', css: 'var(--font-family)' },
    { value: 'mono', label: 'Monospace', css: 'ui-monospace, Consolas, monospace' },
  ] },
  { key: 'ink', label: 'Ink', default: 'pencil', choices: [
    { value: 'pencil', label: 'Pencil', css: 'var(--paper-ink-pencil)' }, { value: 'dark', label: 'Black', css: 'var(--paper-ink-dark)' },
    { value: 'blue', label: 'Blue', css: 'var(--paper-ink-blue)' },
  ] },
  { key: 'textSize', label: 'Text size', default: 100, min: 80, max: 130, step: 5, unit: '%' },
  { key: 'baseline', label: 'Text vertical offset', default: 0, min: -4, max: 4, step: 1, unit: 'px' },
  { key: 'ruling', label: 'Ruling', default: 'college', choices: [
    { value: 'college', label: 'College ruled' }, { value: 'wide', label: 'Wide ruled' },
  ] },
  { key: 'size', label: 'Paper size', default: 'letter', choices: [
    { value: 'letter', label: 'US Letter' }, { value: 'a4', label: 'A4' },
  ] },
  { key: 'holes', label: 'Punch holes', default: 'show', choices: [
    { value: 'show', label: 'Show' }, { value: 'hide', label: 'Hide' },
  ] },
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
export const GRAPH_FIELDS: DisplayField<GraphDisplay>[] = [
  { key: 'paper', label: 'Paper', default: 'white', choices: [
    { value: 'white', label: 'White' }, { value: 'cream', label: 'Cream' },
  ] },
  { key: 'size', label: 'Paper size', default: 'letter', choices: [
    { value: 'letter', label: 'US Letter · 8.5 × 11 in' }, { value: 'a4', label: 'A4 · 210 × 297 mm' },
  ] },
  { key: 'grid', label: 'Square size', default: 'quarter', choices: [
    { value: 'quarter', label: '¼ inch · 4 squares per inch' },
    { value: 'fifth', label: '⅕ inch · 5 squares per inch' }, { value: 'metric', label: '5 mm' },
  ] },
  { key: 'emphasis', label: 'Grid lines', default: 'plain', choices: [
    { value: 'plain', label: 'Uniform' }, { value: 'fifths', label: 'Emphasize every fifth line' },
  ] },
  { key: 'axes', label: 'Coordinate axes', default: 'show', choices: [
    { value: 'show', label: 'Show' }, { value: 'hide', label: 'Hide' },
  ] },
  { key: 'numbers', label: 'Coordinate labels', default: 'show', choices: [
    { value: 'show', label: 'Show' }, { value: 'hide', label: 'Hide' },
  ] },
];

export function defaultLinedDisplay(): LinedDisplay {
  return Object.fromEntries(LINED_FIELDS.map(field => [field.key, field.default])) as unknown as LinedDisplay;
}
export function defaultMarkdownDisplay(): MarkdownDisplay {
  return Object.fromEntries(MARKDOWN_FIELDS.map(field => [field.key, field.default])) as unknown as MarkdownDisplay;
}
export function defaultGraphDisplay(): GraphDisplay {
  return Object.fromEntries(GRAPH_FIELDS.map(field => [field.key, field.default])) as unknown as GraphDisplay;
}
export function defaultNotebookDisplay(): NotebookDisplay {
  return { lined: defaultLinedDisplay(), markdown: defaultMarkdownDisplay(), graph: defaultGraphDisplay() };
}
export function resolvedNotebookDisplay(options?: NotebookDisplay): NotebookDisplay & { graph: GraphDisplay } {
  const value = options ?? defaultNotebookDisplay();
  return { ...value, graph: value.graph ?? defaultGraphDisplay() };
}

function validateFields(value: unknown, fields: (DisplayField<LinedDisplay> | DisplayField<MarkdownDisplay> | DisplayField<GraphDisplay>)[]): void {
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
  if (!isRecord(value) || Object.keys(value).some(key => !['lined', 'markdown', 'graph'].includes(key))) {
    throw new Error('Notebook display settings are invalid.');
  }
  validateFields(value.lined, LINED_FIELDS);
  validateFields(value.markdown, MARKDOWN_FIELDS);
  if (Object.hasOwn(value, 'graph')) validateFields(value.graph, GRAPH_FIELDS);
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
