import { isRecord } from '../../core/validation.ts';

export type DocumentTypeId = 'markdown' | 'lined' | 'graph';
export interface MarkdownData { markdown: string }
export type EmptyDocumentData = Record<string, never>;
export interface DocumentDataByType {
  markdown: MarkdownData;
  lined: EmptyDocumentData;
  graph: EmptyDocumentData;
}
export interface DocumentType {
  readonly id: DocumentTypeId;
  readonly available: boolean;
  readonly label: string;
  readonly description: string;
}

/** Discriminated storage contract: type selects the corresponding editor data. */
export type NotebookDocument = {
  [Type in DocumentTypeId]: {
    id: string;
    kind: 'document';
    name: string;
    type: Type;
    data: DocumentDataByType[Type];
  }
}[DocumentTypeId];

export const DEFAULT_DOCUMENT_TYPE = 'markdown';

export const DOCUMENT_TYPES: readonly DocumentType[] = Object.freeze([
  Object.freeze({
    id: 'markdown',
    available: true,
    label: 'Markdown Paper',
    description: 'A rich text document backed by Markdown source.',
  }),
  Object.freeze({
    id: 'lined',
    available: false,
    label: 'Lined Paper',
    description: 'A ruled note page for free-form notes.',
  }),
  Object.freeze({
    id: 'graph',
    available: false,
    label: 'Graph Paper',
    description: 'A square-grid page for diagrams, plots, equations, and spatial notes.',
  }),
]);

const TYPE_IDS = new Set<string>(DOCUMENT_TYPES.map((type) => type.id));

export function isDocumentType(value: unknown): value is DocumentTypeId {
  return typeof value === 'string' && TYPE_IDS.has(value);
}

export function getDocumentType(value: unknown): DocumentType | null {
  return DOCUMENT_TYPES.find((type) => type.id === value) ?? null;
}

export function createDocumentData(type?: 'markdown'): MarkdownData;
export function createDocumentData(type: 'lined' | 'graph'): EmptyDocumentData;
export function createDocumentData(type: DocumentTypeId): DocumentDataByType[DocumentTypeId];
export function createDocumentData(type: DocumentTypeId = DEFAULT_DOCUMENT_TYPE): DocumentDataByType[DocumentTypeId] {
  if (!isDocumentType(type)) throw new Error(`Unsupported Notebook document type: ${type}`);
  return type === 'markdown' ? { markdown: '' } : {};
}

export function validateDocumentData<Type extends DocumentTypeId>(type: Type, data: unknown): asserts data is DocumentDataByType[Type];
export function validateDocumentData(type: unknown, data: unknown): void;
export function validateDocumentData(type: unknown, data: unknown): void {
  if (!isDocumentType(type) || !isRecord(data)) {
    throw new Error('A Notebook document has invalid type data.');
  }

  if (type === 'markdown') {
    if (Object.keys(data).some((key) => key !== 'markdown') || typeof data.markdown !== 'string') {
      throw new Error('A Markdown Notebook document contains unsupported data.');
    }
    return;
  }

  if (Object.keys(data).length !== 0) {
    throw new Error(`A ${getDocumentType(type)?.label} document contains unsupported editor data.`);
  }
}
