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
export type PublicationQuestionStyle = 'regular' | 'bold' | 'italic' | 'bold-italic' | 'underline';
export type PublicationContent = 'questions' | 'both' | 'key';

/** Document layouts are independent of delivery formats (print, PDF, HTML, etc.). */
export const PUBLICATION_LAYOUTS = [
  { id: 'study', label: 'Study', icon: 'document', available: true,
    description: 'A printable one- or two-column sheet with lettered choices to circle.' },
  { id: 'gap', label: 'Gap', icon: 'pencil', available: true,
    description: 'Short Answer, Statement, and generated written-response questions with room to write.' },
  { id: 'bubble', label: 'Bubble', icon: 'checklist', available: true,
    description: 'Choice-based questions with a compact bubble answer sheet.' },
] as const;
export type PublicationLayout = typeof PUBLICATION_LAYOUTS[number]['id'];
export const PUBLICATION_METADATA_FIELDS = [
  { id: 'headerLeft', label: 'Header left (Dynamic Learner / Review)' },
  { id: 'headerRight', label: 'Header right (sheet type)' },
  { id: 'title', label: 'Knowledge-set title' },
  { id: 'name', label: 'Name field' },
  { id: 'date', label: 'Date field' },
  { id: 'class', label: 'Class field' },
  { id: 'notes', label: 'Header notes / instructions' },
  { id: 'questionCount', label: 'Question count on cover' },
] as const;
export type PublicationMetadata = Record<typeof PUBLICATION_METADATA_FIELDS[number]['id'], boolean>;
export function defaultPublicationMetadata(answerKey = false): PublicationMetadata {
  return { headerLeft: true, headerRight: true, title: true, name: !answerKey,
    date: false, class: false, notes: true, questionCount: !answerKey };
}
function validMetadata(value: unknown): value is PublicationMetadata {
  return isRecord(value) && Object.keys(value).length === PUBLICATION_METADATA_FIELDS.length &&
    PUBLICATION_METADATA_FIELDS.every(field => typeof value[field.id] === 'boolean');
}

export interface PublicationSettings {
  layout: PublicationLayout;
  paper: 'letter' | 'a4';
  orientation: 'portrait' | 'landscape';
  margin: 'standard' | 'compact';
  columns: 1 | 2;
  alignColumns: boolean;
  questionMetadata: PublicationMetadata;
  keyMetadata: PublicationMetadata;
  questionStyle: PublicationQuestionStyle;
  content: PublicationContent;
  titleLayout: 'cover' | 'comfortable' | 'compact';
  font: PublicationFont;
  fontSize: number;
  /** Same content and seed produce the same generated questions and choice pools. */
  seed: string;
}

export function validatePublicationSettings(value: unknown): asserts value is PublicationSettings {
  if (!isRecord(value) || Object.keys(value).some(key =>
    !['layout', 'paper', 'orientation', 'margin', 'columns', 'alignColumns', 'questionStyle', 'content', 'titleLayout', 'font', 'fontSize', 'seed', 'questionMetadata', 'keyMetadata'].includes(key)) ||
    !PUBLICATION_LAYOUTS.some(layout => layout.id === value.layout) ||
    (value.paper !== 'letter' && value.paper !== 'a4') ||
    (value.orientation !== 'portrait' && value.orientation !== 'landscape') ||
    (value.margin !== 'standard' && value.margin !== 'compact') ||
    (value.columns !== 1 && value.columns !== 2) ||
    typeof value.alignColumns !== 'boolean' || !validMetadata(value.questionMetadata) || !validMetadata(value.keyMetadata) ||
    !['regular', 'bold', 'italic', 'bold-italic', 'underline'].includes(value.questionStyle as string) ||
    (value.content !== 'questions' && value.content !== 'both' && value.content !== 'key') ||
    (value.titleLayout !== 'cover' && value.titleLayout !== 'comfortable' && value.titleLayout !== 'compact') ||
    !PUBLICATION_FONTS.some(font => font.id === value.font) ||
    typeof value.fontSize !== 'number' || !Number.isFinite(value.fontSize) || value.fontSize < 8 ||
    value.fontSize > 32 || !Number.isInteger(value.fontSize * 2) ||
    typeof value.seed !== 'string' || !value.seed.trim() || value.seed.length > 128) {
    throw new Error('Choose valid publication settings and a seed of 1–128 characters.');
  }
}

/** Detach nested transient settings before asynchronous preparation or view projection. */
export function copyPublicationSettings(settings: PublicationSettings): PublicationSettings {
  return { ...settings, questionMetadata: { ...settings.questionMetadata }, keyMetadata: { ...settings.keyMetadata } };
}
export function publicationHasCover(settings: PublicationSettings): boolean {
  const metadata = settings.questionMetadata;
  return settings.content !== 'key' && settings.titleLayout === 'cover' &&
    Object.values(metadata).some(Boolean);
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
export interface PublicationKeyLine { readonly label: string; readonly text: string }
export interface PublicationKeyEntry {
  readonly number: number;
  readonly lines: readonly PublicationKeyLine[];
}
/** Correct circle indexes for each Bubble question/Dropdown sub-question. */
export interface PublicationBubbleKeyEntry {
  readonly number: number;
  readonly rows: readonly (readonly number[])[];
}
export interface PublicationView {
  readonly title: string;
  readonly description: string;
  readonly settings: Readonly<PublicationSettings>;
  /** Question pages are always answer-free, even if a separate key was requested. */
  readonly questions: readonly PublicationQuestion[];
  /** Text-only Study key; empty for Bubble and Questions Only. */
  readonly answerKey: readonly PublicationKeyEntry[];
  /** Optical Bubble key; absent for Study and Questions Only. */
  readonly bubbleKey: readonly PublicationBubbleKeyEntry[];
}

/** Convert concrete, already randomized choice answers to the printed choice letters. */
function keyEntry(question: PublicationQuestion, layout: PublicationLayout): PublicationKeyEntry {
  if (question.kind === 'statement') {
    return { number: question.number, lines: [{ label: '', text: layout === 'gap'
      ? 'Open response — no fixed answer' : 'Information only — no answer required' }] };
  }
  const lines = question.answers.map((answer, i) => {
    if (question.sourceType === 'dropdown' && layout === 'bubble') {
      const choiceIndex = question.choices.indexOf(answer.text);
      const letter = choiceIndex < 0 ? '?' : String.fromCharCode(65 + choiceIndex);
      return { label: `${i + 1} (${answer.label})`, text: `${letter} — ${answer.text}` };
    }
    if (question.sourceType === 'multiple-choice') {
      const index = question.choices.indexOf(answer.text);
      return { label: index >= 0 && index < 26 ? String.fromCharCode(65 + index) : 'Answer', text: answer.text };
    }
    return { label: question.kind === 'matching' || question.kind === 'blanks' ||
        question.answers.length > 1 ? answer.label : '', text: answer.text };
  });
  return { number: question.number, lines };
}

/** Resolve the positions of correct choices after version-seeded materialization. */
function bubbleKeyEntry(question: PublicationQuestion): PublicationBubbleKeyEntry | null {
  if (question.kind !== 'choice' && question.kind !== 'matching') return null;
  const choiceIndex = (answer: PublicationAnswer): number => {
    const index = question.choices.indexOf(answer.text);
    if (index < 0) throw new Error(`Question ${question.number} has a correct answer missing from its printed choices.`);
    return index;
  };
  return {
    number: question.number,
    rows: question.kind === 'choice'
      ? [question.answers.map(choiceIndex)]
      : question.answers.map(answer => [choiceIndex(answer)]),
  };
}

/** Project detached sources according to the explicit print-content choice. */
export function publicationView(source: PreparedPublication, settings: PublicationSettings): PublicationView {
  validatePublicationSettings(settings);
  if (source.seed !== settings.seed) throw new Error('Prepare content again after changing the seed.');
  return {
    title: source.title, description: source.description, settings: copyPublicationSettings(settings),
    questions: source.questions.map(question => ({
      ...question,
      choices: [...question.choices], responseLabels: [...question.responseLabels],
      answers: [],
      explanation: '',
    })),
    answerKey: settings.layout === 'bubble' || settings.content === 'questions'
      ? [] : source.questions.map(q => keyEntry(q, settings.layout)),
    bubbleKey: settings.layout !== 'bubble' || settings.content === 'questions' ? []
      : source.questions.flatMap(question => {
        const entry = bubbleKeyEntry(question);
        return entry ? [entry] : [];
      }),
  };
}
