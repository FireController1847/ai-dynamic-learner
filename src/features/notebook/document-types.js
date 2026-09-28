export const DEFAULT_DOCUMENT_TYPE = 'markdown';

export const DOCUMENT_TYPES = Object.freeze([
  Object.freeze({
    id: 'markdown',
    label: 'Markdown Paper',
    description: 'A rich text document backed by Markdown source.',
  }),
  Object.freeze({
    id: 'lined',
    label: 'Lined Paper',
    description: 'A ruled note page for free-form notes.',
  }),
  Object.freeze({
    id: 'graph',
    label: 'Graph Paper',
    description: 'A square-grid page for diagrams, plots, equations, and spatial notes.',
  }),
]);

const TYPE_IDS = new Set(DOCUMENT_TYPES.map((type) => type.id));

export function isDocumentType(value) {
  return TYPE_IDS.has(value);
}

export function getDocumentType(value) {
  return DOCUMENT_TYPES.find((type) => type.id === value) ?? null;
}

export function createDocumentData(type = DEFAULT_DOCUMENT_TYPE) {
  if (!isDocumentType(type)) throw new Error(`Unsupported Notebook document type: ${type}`);
  return type === 'markdown' ? { markdown: '' } : {};
}

export function validateDocumentData(type, data) {
  if (!isDocumentType(type) || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('A Notebook document has invalid type data.');
  }

  if (type === 'markdown') {
    if (Object.keys(data).some((key) => key !== 'markdown') || typeof data.markdown !== 'string') {
      throw new Error('A Markdown Notebook document contains unsupported data.');
    }
    return;
  }

  if (Object.keys(data).length !== 0) {
    throw new Error(`A ${getDocumentType(type).label} document contains unsupported editor data.`);
  }
}
