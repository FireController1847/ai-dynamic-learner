import { createId, isValidId } from '../../core/ids.ts';
import { DataApiError, type DataCommit, type DataOperation, type IndexedRow } from '../../core/data/indexeddb.ts';
import { emptyWorkspace, validateWorkspaceValue } from '../workspace-format.ts';
import { workspaceRows } from './workspace-mapping.ts';
import { GROUPED_APPS, type GroupedApp } from './library-commands.ts';
import { MAX_DOCUMENTS } from '../../features/notebook/library-model.ts';
import { MAX_WORD_SEARCHES } from '../../features/word-search/library-model.ts';
import { MAX_CROSSWORDS } from '../../features/crossword/library-model.ts';
import { MAX_CARDS } from '../../features/index-cards/card-model.ts';
import type { WorkspaceDataApi } from './data-api.ts';

/**
 * Creates complete validated leaf entries (documents, sets, puzzles, Guides)
 * in a single transaction, including dependent cards/questions/games.
 * The current v1 feature validators remain the authority for payload shape.
 */
export function createEntryCommands(api: Pick<WorkspaceDataApi, 'read' | 'list' | 'commit' | 'workspaceIdentity'>) {
  return {
    createEntry: async (input: {
      app: GroupedApp;
      parentId: string;
      name: string;
      position: number;
      expectedCollectionRevision: number;
      payload: Record<string, unknown>;
    }): Promise<{ id: string; commit: DataCommit }> => {
      const { app, parentId, name, position, payload } = input;
      if (!(GROUPED_APPS as readonly string[]).includes(app)) {
        throw new DataApiError('validation', 'Unknown library application.');
      }
      if (parentId !== '@root' && !isValidId(parentId)) {
        throw new DataApiError('validation', 'Invalid parent group.');
      }
      if (!name.trim() || name.length > 120 || !Number.isSafeInteger(position) || position < 0) {
        throw new DataApiError('validation', 'Invalid library name or position.');
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
          ['id', 'name', 'kind', 'children'].some(key => Object.hasOwn(payload, key))) {
        throw new DataApiError('validation', 'Entry payload must only contain feature-owned content.');
      }
      const kind: Record<GroupedApp, string> = {
        notebook: 'document',
        'index-cards': 'set',
        'word-search': 'word-search',
        crossword: 'crossword',
        guide: 'guide',
        'knowledge-check': 'set',
      };
      const ws = api.workspaceIdentity();
      const parents: DataOperation[] = [];
      const seen = new Set<string>();
      let cursor = parentId;
      while (cursor !== '@root') {
        if (seen.has(cursor) || seen.size >= 32) {
          throw new DataApiError('validation', 'The parent group exceeds the nesting limit or contains a cycle.');
        }
        seen.add(cursor);
        const parent = await api.read<IndexedRow>('libraryNodes', [ws, app, cursor]);
        if (!parent || parent.value.kind !== 'group') {
          throw new DataApiError('not-found', 'The parent group no longer exists.');
        }
        parents.push({ store: 'libraryNodes', type: 'assert',
          key: [ws, app, cursor], expectedRevision: parent.revision });
        cursor = String(parent.value.parentKey);
      }
      if (seen.size + 1 > 32) throw new DataApiError('validation', 'The entry exceeds the maximum group depth.');
      const collection = await api.read<IndexedRow>('collections', [ws, app, parentId]);
      if (!collection || !Array.isArray(collection.value.children)) {
        throw new DataApiError('not-found', 'The destination group is missing.');
      }
      if (collection.revision !== input.expectedCollectionRevision) {
        throw new DataApiError('conflict', 'The destination group changed in another tab.');
      }
      const siblings = collection.value.children as string[];
      if (position > siblings.length) throw new DataApiError('validation', 'Invalid insertion position.');
      const count = (await api.list<IndexedRow>('libraryNodes', row => row.app === app)).length;
      if (count >= 5000) throw new DataApiError('validation', 'The library has reached its item limit.');

      // App-level quotas apply across *all* saved entries, not just the one
      // temporary entry validated below. Import/create operations must not
      // exceed those limits by adding another individually valid record.
      const quotas: Partial<Record<GroupedApp, number>> = {
        notebook: MAX_DOCUMENTS,
        'word-search': MAX_WORD_SEARCHES,
        crossword: MAX_CROSSWORDS,
      };
      const quota = quotas[app];
      if (quota !== undefined) {
        const existing = await api.list<IndexedRow>('libraryNodes',
          row => row.app === app && row.kind !== 'group');
        if (existing.length >= quota) {
          throw new DataApiError('validation', 'The application has reached its saved-entry limit.');
        }
      }
      if (app === 'index-cards') {
        const existing = await api.list<IndexedRow>('indexCards', () => true);
        const imported = Array.isArray(payload.cards) ? payload.cards.length : 0;
        if (existing.length + imported > MAX_CARDS) {
          throw new DataApiError('validation', 'The Index Cards workspace has reached its card limit.');
        }
      }

      const id = createId();
      const draft = emptyWorkspace();
      const entry = { id, kind: kind[app], name, ...payload };
      const feature = draft.features[app] as unknown as { items: unknown[] };
      feature.items.push(entry);
      // Validate all supplied data using the exact feature validators also
      // used for the existing v1 backup format.
      validateWorkspaceValue(draft);
      const rows = workspaceRows(ws, draft).filter(row => {
        if (row.store === 'libraryNodes') return row.value.id === id;
        if (row.store === 'collections') return row.value.parentId === id;
        return row.value.id === id || row.value.setId === id;
      });
      const contentIds = rows.filter(row => row.store === 'indexCards' || row.store === 'reviewQuestions')
        .map(row => String(row.value.id));
      if (contentIds.length) {
        const childStore = app === 'index-cards' ? 'indexCards' : 'reviewQuestions';
        const existing = await api.list<IndexedRow>(childStore,
          row => typeof row.id === 'string' && contentIds.includes(row.id));
        if (existing.length) throw new DataApiError('conflict', 'One of the imported entry IDs already exists.');
      }
      const nextSiblings = [...siblings];
      nextSiblings.splice(position, 0, id);
      const operations: DataOperation[] = [
        ...parents,
        { store: 'collections', type: 'put', key: [ws, app, parentId],
          expectedRevision: collection.revision,
          value: { ...collection.value, children: nextSiblings } },
      ];
      // Update only sibling positions affected by this insertion. Parent
      // collection CAS and each sibling CAS guard concurrent reorders.
      for (let i = position + 1; i < nextSiblings.length; i++) {
        const siblingId = nextSiblings[i]!;
        const sibling = await api.read<IndexedRow>('libraryNodes', [ws, app, siblingId]);
        if (!sibling || sibling.value.parentKey !== parentId) {
          throw new DataApiError('validation', 'A destination sibling is missing or invalid.');
        }
        operations.push({ store: 'libraryNodes', type: 'put',
          key: [ws, app, siblingId], expectedRevision: sibling.revision,
          value: { ...sibling.value, position: i } });
      }
      for (const row of rows) {
        operations.push({
          ...row,
          value: row.store === 'libraryNodes'
            ? { ...row.value, parentKey: parentId, position }
            : row.value,
        });
      }
      const commit = await api.commit(operations, [app, 'library-structure']);
      return { id, commit };
    },
  };
}
