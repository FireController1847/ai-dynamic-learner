import { isRecord } from '../../core/validation.ts';
import { createTreeOperations, type TreeGroupOption, type TreeItemLocation, type TreeMovePosition } from '../../core/tree.ts';
import type { NotebookDocument, DocumentTypeId } from './document-types.ts';
import { validateNotebookDisplay, type NotebookDisplay } from './display-options.ts';
export interface Group { id: string; kind: 'group'; name: string; children: LibraryItem[] }
export type LibraryItem = Group | NotebookDocument;
export interface Notebook { items: LibraryItem[]; lastSelectedDocumentId?: string | null; display?: NotebookDisplay }
export interface DocumentTarget { selectedId?: string | null }
export type ItemLocation = TreeItemLocation<LibraryItem>;
export type MovePosition = TreeMovePosition;
export type GroupOption = TreeGroupOption;

import { createId, isValidId } from '../../core/ids.ts';
import { DEFAULT_DOCUMENT_TYPE, createDocumentData, isDocumentType, validateDocumentData } from './document-types.ts';

export const MAX_ITEMS = 5000;
export const MAX_DEPTH = 32;
export const MAX_NAME_LENGTH = 120;
export const MAX_DOCUMENTS = 2000;

const libraryTree = createTreeOperations<LibraryItem>({
  children: (item) => item.kind === 'group' ? item.children : null,
  maxDepth: MAX_DEPTH,
});
export const findItem = libraryTree.findItem;
export const firstEntry = libraryTree.firstEntry;
export const countItems = libraryTree.countItems;
export const deleteItem = libraryTree.deleteItem;
export const canMove = libraryTree.canMove;
export const moveItem = libraryTree.moveItem;
export const groupOptions = libraryTree.groupOptions;

export function createItem(kind: 'group', documentType?: DocumentTypeId): Group;
export function createItem(kind: 'document', documentType?: DocumentTypeId): NotebookDocument;
export function createItem(kind: 'group' | 'document', documentType?: DocumentTypeId): LibraryItem;
export function createItem(kind: 'group' | 'document', documentType: DocumentTypeId = DEFAULT_DOCUMENT_TYPE): LibraryItem {
  const id = createId();
  if (kind === 'group') return { id, kind, name: 'New group', children: [] };
  const base = { id, kind: 'document' as const, name: 'New document' };
  switch (documentType) {
    case 'markdown': return { ...base, type: documentType, data: createDocumentData(documentType) };
    case 'lined': return { ...base, type: documentType, data: createDocumentData(documentType) };
    case 'graph': return { ...base, type: documentType, data: createDocumentData(documentType) };
  }
}

export function countDocuments(items: LibraryItem[]): number {
  return items.reduce((count, item) => count +
    (item.kind === 'group' ? countDocuments(item.children) : 1), 0);
}

export function insertDocument(items: LibraryItem[], target: DocumentTarget | null, documentType: DocumentTypeId): NotebookDocument {
  if (countItems(items) >= MAX_ITEMS || countDocuments(items) >= MAX_DOCUMENTS) {
    throw new Error(`The Notebook supports ${MAX_ITEMS} library items and ${MAX_DOCUMENTS} documents.`);
  }
  const selected = target?.selectedId ? findItem(items, target.selectedId) : null;
  if (target?.selectedId && !selected) throw new Error('The selected destination no longer exists. Choose another location.');
  if (selected?.item.kind === 'group' && selected.depth >= MAX_DEPTH) {
    throw new Error(`Notebook entries can be at most ${MAX_DEPTH} levels deep.`);
  }
  const item = createItem('document', documentType);

  if (selected?.item.kind === 'group') selected.item.children.unshift(item);
  else if (selected) selected.siblings.splice(selected.index + 1, 0, item);
  else items.unshift(item);

  return item;
}

export function validateNotebook(value: unknown): asserts value is Notebook {
  if (!isRecord(value) || !Array.isArray(value.items) ||
      Object.keys(value).some((key) => !['items', 'lastSelectedDocumentId', 'display'].includes(key))) {
    throw new Error('The Notebook library is invalid.');
  }
  if (Object.hasOwn(value, 'display')) validateNotebookDisplay(value.display);

  if (Object.hasOwn(value, 'lastSelectedDocumentId') && value.lastSelectedDocumentId !== null &&
      !isValidId(value.lastSelectedDocumentId)) {
    throw new Error('The remembered Notebook document ID is invalid.');
  }

  const ids = new Set<string>();
  let itemCount = 0;
  let documentCount = 0;

  function visit(items: unknown[], depth: number): void {
    if (items.length && depth > MAX_DEPTH) {
      throw new Error(`Notebook groups can be at most ${MAX_DEPTH} levels deep.`);
    }

    for (const item of items) {
      if (!isRecord(item) ||
          (item.kind !== 'group' && item.kind !== 'document') ||
          !isValidId(item.id) || ids.has(item.id) ||
          typeof item.name !== 'string' || !item.name.trim() ||
          item.name.length > MAX_NAME_LENGTH) {
        throw new Error('A Notebook library item has an invalid name, type, or duplicate ID.');
      }

      ids.add(item.id);
      itemCount += 1;
      if (itemCount > MAX_ITEMS) throw new Error(`A Notebook library can contain up to ${MAX_ITEMS} items.`);

      if (item.kind === 'group') {
        if (Object.keys(item).some((key) => !['id', 'kind', 'name', 'children'].includes(key)) ||
            !Array.isArray(item.children)) {
          throw new Error('A Notebook group contains unsupported data.');
        }
        visit(item.children, depth + 1);
      } else {
        // Version-1 Notebook documents originally stored Markdown directly on the record.
        // Normalize them in memory so older local data and backups continue to load.
        if (!Object.hasOwn(item, 'type') && !Object.hasOwn(item, 'data') &&
            Object.keys(item).every((key) => ['id', 'kind', 'name', 'markdown'].includes(key)) &&
            typeof item.markdown === 'string') {
          item.type = DEFAULT_DOCUMENT_TYPE;
          item.data = { markdown: item.markdown };
          delete item.markdown;
        }

        if (item.type === 'grid' && item.data && typeof item.data === 'object' &&
            !Array.isArray(item.data) && Object.keys(item.data).length === 0) {
          item.type = 'graph';
        }

        if (Object.keys(item).some((key) => !['id', 'kind', 'name', 'type', 'data'].includes(key)) ||
            !isDocumentType(item.type)) {
          throw new Error('A Notebook document contains unsupported data.');
        }
        // Lined Paper existed as an empty placeholder in version-1 workspaces.
        if (item.type === 'lined' && isRecord(item.data) && Object.keys(item.data).length === 0) {
          item.data = createDocumentData('lined');
        }
        // Graph Paper also existed as an empty version-1 placeholder.
        if (item.type === 'graph' && isRecord(item.data) && Object.keys(item.data).length === 0) {
          item.data = createDocumentData('graph');
        }
        if (item.type === 'lined') {
          // Validate the specific type before accessing its optional editor fields.
          validateDocumentData('lined', item.data);
          // Preserve the formerly displayed filename as an independent title on load.
          if (!Object.hasOwn(item.data, 'title')) item.data.title = item.name;
          if (!Object.hasOwn(item.data, 'marginText')) item.data.marginText = '';
        } else {
          validateDocumentData(item.type, item.data);
        }
        documentCount += 1;
        if (documentCount > MAX_DOCUMENTS) {
          throw new Error(`A workspace supports up to ${MAX_DOCUMENTS} Notebook documents.`);
        }
      }
    }
  }

  visit(value.items, 1);

  if (value.lastSelectedDocumentId != null) {
    const remembered = findItem(value.items as LibraryItem[], value.lastSelectedDocumentId as string);
    if (!remembered || remembered.item.kind !== 'document') {
      throw new Error('The remembered Notebook document does not exist.');
    }
  }
}
