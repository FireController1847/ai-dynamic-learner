import { isRecord } from '../../core/validation.ts';
import type { NotebookDocument, DocumentTypeId } from './document-types.ts';
export interface Group { id: string; kind: 'group'; name: string; children: LibraryItem[] }
export type LibraryItem = Group | NotebookDocument;
export interface Notebook { items: LibraryItem[]; lastSelectedDocumentId?: string | null }
export interface DocumentTarget { selectedId?: string | null }
export interface ItemLocation { item: LibraryItem; siblings: LibraryItem[]; index: number; parentId: string | null; depth: number }
export type MovePosition = 'before' | 'after' | 'inside';
export interface GroupOption { id: string; label: string }

import { createId, isValidId } from '../../core/ids.ts';
import { DEFAULT_DOCUMENT_TYPE, createDocumentData, isDocumentType, validateDocumentData } from './document-types.ts';

export const MAX_ITEMS = 5000;
export const MAX_DEPTH = 32;
export const MAX_NAME_LENGTH = 120;
export const MAX_DOCUMENTS = 2000;

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

export function findItem(items: LibraryItem[], id: string | null | undefined, parentId: string | null = null, depth = 1): ItemLocation | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.id === id) return { item, siblings: items, index, parentId, depth };
    if (item.kind === 'group') {
      const found = findItem(item.children, id, item.id, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function countItems(items: LibraryItem[]): number {
  return items.reduce((count, item) => count + 1 +
    (item.kind === 'group' ? countItems(item.children) : 0), 0);
}

export function countDocuments(items: LibraryItem[]): number {
  return items.reduce((count, item) => count +
    (item.kind === 'group' ? countDocuments(item.children) : 1), 0);
}

export function deleteItem(items: LibraryItem[], id: string): LibraryItem | null {
  const found = findItem(items, id);
  if (!found) return null;
  return found.siblings.splice(found.index, 1)[0];
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

function subtreeDepth(item: LibraryItem): number {
  return item.kind === 'group' && item.children.length
    ? 1 + Math.max(...item.children.map(subtreeDepth)) : 1;
}

function planMove(items: LibraryItem[], sourceId: string, targetId: string | null, position: MovePosition) {
  const source = findItem(items, sourceId);
  const target = targetId ? findItem(items, targetId) : null;
  if (!source || (targetId && !target) || sourceId === targetId) return null;
  if (!['before', 'after', 'inside'].includes(position)) return null;
  if (target && position === 'inside' && target.item.kind !== 'group') return null;

  const parentId = target ? (position === 'inside' ? targetId : target.parentId) : null;
  if (parentId === sourceId || (source.item.kind === 'group' &&
      findItem(source.item.children, parentId))) return null;

  const depth = target ? target.depth + (position === 'inside' ? 1 : 0) : 1;
  if (depth + subtreeDepth(source.item) - 1 > MAX_DEPTH) return null;

  const destination = !target ? items
    : position === 'inside' && target.item.kind === 'group' ? target.item.children : target.siblings;
  const index = !target ? (position === 'before' ? 0 : items.length)
    : position === 'inside' ? destination.length
      : target.index + (position === 'after' ? 1 : 0);

  return { source, destination, index };
}

export function canMove(items: LibraryItem[], sourceId: string, targetId: string | null, position: MovePosition) {
  return Boolean(planMove(items, sourceId, targetId, position));
}

export function moveItem(items: LibraryItem[], sourceId: string, targetId: string | null, position: MovePosition) {
  const plan = planMove(items, sourceId, targetId, position);
  if (!plan) return false;
  let { source, destination, index } = plan;
  if (source.siblings === destination && source.index < index) index -= 1;
  source.siblings.splice(source.index, 1);
  destination.splice(index, 0, source.item);
  return true;
}

export function groupOptions(items: LibraryItem[], excludedId: string | null, trail: string[] = []): GroupOption[] {
  return items.flatMap((item) => {
    if (item.kind !== 'group' || item.id === excludedId) return [];
    const path = [...trail, item.name];
    return [{ id: item.id, label: path.join(' / ') },
      ...groupOptions(item.children, excludedId, path)];
  });
}

export function validateNotebook(value: unknown): asserts value is Notebook {
  if (!isRecord(value) || !Array.isArray(value.items) ||
      Object.keys(value).some((key) => !['items', 'lastSelectedDocumentId'].includes(key))) {
    throw new Error('The Notebook library is invalid.');
  }

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
        validateDocumentData(item.type, item.data);
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
