import { isRecord } from '../../../core/validation.ts';
import type { QuestionType } from '../question-model.ts';

export const PUBLICATION_FONTS = [
  { id: 'times', label: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { id: 'georgia', label: 'Georgia', css: 'Georgia, "Times New Roman", serif' },
  { id: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { id: 'calibri', label: 'Calibri', css: 'Calibri, Carlito, Arial, sans-serif' },
  { id: 'verdana', label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
] as const;
export type PublicationFont = typeof PUBLICATION_FONTS[number]['id'];

/** Document layouts are independent of delivery formats (print, PDF, HTML, etc.). */
export const PUBLICATION_LAYOUTS = [
  { id: 'bubble', label: 'Bubble', icon: 'checklist', available: false,
    description: 'A question sheet with A–D choices, a name field, and a bubble answer sheet on the last page.' },
  { id: 'gap', label: 'Gap', icon: 'pencil', available: false,
    description: 'Two or three questions per page with generous space for written answers.' },
  { id: 'study', label: 'Study', icon: 'document', available: true,
    description: 'A printable one- or two-column sheet with lettered choices to circle.' },
] as const;
export type PublicationLayout = typeof PUBLICATION_LAYOUTS[number]['id'];
export interface PublicationSettings {
  layout: PublicationLayout;
  paper: 'letter' | 'a4';
  orientation: 'portrait' | 'landscape';
  margin: 'standard' | 'compact';
  columns: 1 | 2;
  alignColumns: boolean;
  titleLayout: 'cover' | 'comfortable' | 'compact';
  font: PublicationFont;
  fontSize: number;
  /** Same content and seed produce the same generated questions and choice pools. */
  seed: string;
}

export function validatePublicationSettings(value: unknown): asserts value is PublicationSettings {
  if (!isRecord(value) || Object.keys(value).some(key =>
    !['layout', 'paper', 'orientation', 'margin', 'columns', 'alignColumns', 'titleLayout', 'font', 'fontSize', 'seed'].includes(key)) ||
    !PUBLICATION_LAYOUTS.some(layout => layout.id === value.layout) ||
    (value.paper !== 'letter' && value.paper !== 'a4') ||
    (value.orientation !== 'portrait' && value.orientation !== 'landscape') ||
    (value.margin !== 'standard' && value.margin !== 'compact') ||
    (value.columns !== 1 && value.columns !== 2) ||
    typeof value.alignColumns !== 'boolean' ||
    (value.titleLayout !== 'cover' && value.titleLayout !== 'comfortable' && value.titleLayout !== 'compact') ||
    !PUBLICATION_FONTS.some(font => font.id === value.font) ||
    typeof value.fontSize !== 'number' || !Number.isFinite(value.fontSize) || value.fontSize < 8 ||
    value.fontSize > 32 || !Number.isInteger(value.fontSize * 2) ||
    typeof value.seed !== 'string' || !value.seed.trim() || value.seed.length > 128) {
    throw new Error('Choose valid publication settings and a seed of 1–128 characters.');
  }
}

/** Explicit millimetre dimensions avoid Paged.js's case-sensitive paper-name lookup. */
export function publicationPaperDimensions(settings: Pick<PublicationSettings, 'paper' | 'orientation'>) {
  const [short, long] = settings.paper === 'letter' ? [215.9, 279.4] : [210, 297];
  return settings.orientation === 'landscape' ? { width: long, height: short } : { width: short, height: long };
}

export interface PublicationAnswer { readonly label: string; readonly text: string }
export interface PublicationQuestion {
  readonly id: string;
  readonly number: number;
  readonly sourceType: QuestionType;
  readonly kind: 'choice' | 'response' | 'blanks' | 'matching' | 'statement';
  readonly prompt: string;
  /** Markdown source; render only through the shared sanitized Markdown renderer. */
  readonly context: string;
  readonly choices: readonly string[];
  readonly selection: 'single' | 'multiple' | null;
  readonly responseLabels: readonly string[];
  readonly answers: readonly PublicationAnswer[];
  readonly explanation: string;
}

/** Internal, detached snapshot. Contains answers; it is NOT a learner-facing export. */
export interface PreparedPublication {
  readonly version: 1;
  readonly sourceId: string;
  readonly title: string;
  readonly description: string;
  readonly seed: string;
  readonly questions: readonly PublicationQuestion[];
}
export interface PublicationView {
  readonly title: string;
  readonly description: string;
  readonly settings: Readonly<PublicationSettings>;
  readonly questions: readonly PublicationQuestion[];
}

/** Renderers consume this projection, never the answer-bearing source snapshot. */
export function publicationView(source: PreparedPublication, settings: PublicationSettings): PublicationView {
  validatePublicationSettings(settings);
  if (source.seed !== settings.seed) throw new Error('Prepare content again after changing the seed.');
  return {
    title: source.title, description: source.description, settings: { ...settings },
    questions: source.questions.map(question => ({
      ...question,
      choices: [...question.choices], responseLabels: [...question.responseLabels],
      answers: [],
      explanation: '',
    })),
  };
}
