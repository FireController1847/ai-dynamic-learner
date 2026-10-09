import { createId, isValidId } from '../../core/ids.ts';
import {
  DataApiError, type DataCommit, type DataOperation, type DataStoreName, type IndexedRow,
} from '../../core/data/indexeddb.ts';
import type { WorkspaceDataApi, Versioned } from './data-api.ts';

/**
 * Typed, transactional operations for the six grouped feature libraries.
 * Todo List has its own flat list/section hierarchy and is not a tree library.
 *
 * All mutations read current revisions and assert them at commit. Calling code
 * provides the revision it displayed to prevent stale UI actions from winning.
 */
export const GROUPED_APPS = [
  'notebook', 'index-cards', 'word-search', 'crossword', 'guide', 'knowledge-check',
] as const;

export type GroupedApp = (typeof GROUPED_APPS)[number];

export interface LibraryNode extends IndexedRow {
  workspaceId: string;
  app: GroupedApp;
  id: string;
  name: string;
  kind: string;
  parentKey: string;
  position: number;
}

interface Collection extends IndexedRow {
  workspaceId: string;
  app: string;
  parentId: string;
  children: string[];
}

type Row<T extends IndexedRow> = Versioned<T>;
const ROOT = '@root';
const MAX_DEPTH = 32;
const MAX_NAME = 120;
const MAX_LIBRARY_ITEMS = 5000;

const invalid = (message: string) => new DataApiError('validation', message);
const missing = (message: string) => new DataApiError('not-found', message);
const conflict = (message: string) => new DataApiError('conflict', message);

function validateApp(value: string): asserts value is GroupedApp {
  if (!(GROUPED_APPS as readonly string[]).includes(value)) throw invalid('Unknown grouped library.');
}
function validateName(name: string): void {
  if (!name.trim() || name.length > MAX_NAME) throw invalid('A library name must be 1–120 characters.');
}
function validateParent(parentId: string): void {
  if (parentId !== ROOT && !isValidId(parentId)) throw invalid('Invalid parent group ID.');
}
function validateIndex(index: number, max: number) {
  if (!Number.isSafeInteger(index) || index < 0 || index > max) {
    throw invalid('The requested sibling position is invalid.');
  }
}
function put(store: DataStoreName, key: IDBValidKey, value: IndexedRow, expectedRevision: number | null): DataOperation {
  return { type: 'put', store, key, value, expectedRevision };
}
function del(store: DataStoreName, key: IDBValidKey, expectedRevision: number): DataOperation {
  return { type: 'delete', store, key, expectedRevision };
}
function assertRev(store: DataStoreName, key: IDBValidKey, expectedRevision: number): DataOperation {
  return { type: 'assert', store, key, expectedRevision };
}
function sameOrder(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id, i) => id === right[i]);
}

export function createLibraryCommands(api: Pick<WorkspaceDataApi, 'read' | 'list' | 'commit' | 'workspaceIdentity'>) {
  const getNode = async (app: GroupedApp, id: string): Promise<Row<LibraryNode>> => {
    if (!isValidId(id)) throw invalid('Invalid library item ID.');
    const item = await api.read<LibraryNode>('libraryNodes', [api.workspaceIdentity(), app, id]);
    if (!item) throw missing('The library item no longer exists.');
    return item;
  };
  const getCollection = async (app: string, parentId: string): Promise<Row<Collection>> => {
    const row = await api.read<Collection>('collections', [api.workspaceIdentity(), app, parentId]);
    if (!row) throw missing('The library collection no longer exists.');
    const ids = row.value.children;
    if (!Array.isArray(ids) || ids.some(id => !isValidId(id)) ||
        new Set(ids).size !== ids.length) {
      throw invalid('The saved library has an invalid or duplicate sibling ID.');
    }
    return row;
  };
  const parentPath = async (app: GroupedApp, parentId: string) => {
    const ancestry: Row<LibraryNode>[] = [];
    const visited = new Set<string>();
    let cursor = parentId;
    while (cursor !== ROOT) {
      if (visited.has(cursor) || ancestry.length >= MAX_DEPTH) {
        throw invalid('The library contains a parent cycle or exceeds the maximum group depth.');
      }
      visited.add(cursor);
      const node = await getNode(app, cursor);
      if (node.value.kind !== 'group') throw invalid('The destination is not a group.');
      ancestry.push(node);
      cursor = node.value.parentKey;
      validateParent(cursor);
    }
    return ancestry;
  };
  const siblingNodes = async (app: GroupedApp, parentId: string, ids: readonly string[]) => {
    const values = await Promise.all(ids.map(id => getNode(app, id)));
    for (const node of values) {
      if (node.value.parentKey !== parentId) {
        throw invalid('Library sibling ordering and parent ownership are inconsistent.');
      }
    }
    return values;
  };
  const updateOrder = async (app: GroupedApp, parentId: string, ids: readonly string[], moved?: string):
    Promise<DataOperation[]> => {
    const nodes = await siblingNodes(app, parentId, ids.filter(id => id !== moved));
    const existing = new Map(nodes.map(row => [row.value.id, row]));
    const changes: DataOperation[] = [];
    ids.forEach((id, position) => {
      if (id === moved) return;
      const node = existing.get(id);
      if (!node) throw invalid('A sibling disappeared while preparing its new order.');
      if (node.value.position !== position) {
        changes.push(put('libraryNodes', [api.workspaceIdentity(), app, id],
          { ...node.value, position }, node.revision));
      }
    });
    return changes;
  };
  const readOptional = async (store: DataStoreName, key: IDBValidKey): Promise<DataOperation[]> => {
    const row = await api.read<IndexedRow>(store, key);
    return row ? [del(store, key, row.revision)] : [];
  };

  return {
    getItem: async (app: GroupedApp, id: string) => {
      validateApp(app);
      return getNode(app, id);
    },

    listChildren: async (app: GroupedApp, parentId = ROOT) => {
      validateApp(app);
      validateParent(parentId);
      const collection = await getCollection(app, parentId);
      // Promise.all preserves the collection's canonical order; sorting with
      // indexOf for every sibling would turn large folders into O(n²) work.
      const nodes = await siblingNodes(app, parentId, collection.value.children);
      return { revision: collection.revision, items: nodes };
    },

    createGroup: async (input: {
      app: GroupedApp; parentId: string; name: string; position: number; expectedCollectionRevision: number;
    }): Promise<{ id: string; commit: DataCommit }> => {
      const { app, parentId, name, position, expectedCollectionRevision } = input;
      validateApp(app);
      validateParent(parentId);
      validateName(name);
      const chain = await parentPath(app, parentId);
      if (chain.length + 1 > MAX_DEPTH) throw invalid('The destination exceeds the maximum group depth.');
      const count = (await api.list<LibraryNode>('libraryNodes', row => row.app === app)).length;
      if (count >= MAX_LIBRARY_ITEMS) throw invalid('The library has reached its item limit.');
      const collection = await getCollection(app, parentId);
      if (collection.revision !== expectedCollectionRevision) throw conflict('The group order changed in another tab.');
      validateIndex(position, collection.value.children.length);
      const id = createId();
      const children = [...collection.value.children];
      children.splice(position, 0, id);
      const ws = api.workspaceIdentity();
      const operations: DataOperation[] = [
        ...chain.map(parent => assertRev('libraryNodes', [ws, app, parent.value.id], parent.revision)),
        put('collections', [ws, app, parentId], { ...collection.value, children }, collection.revision),
        put('libraryNodes', [ws, app, id],
          { workspaceId: ws, app, id, name, kind: 'group', parentKey: parentId, position }, null),
        put('collections', [ws, app, id],
          { workspaceId: ws, app, parentId: id, children: [] }, null),
        ...await updateOrder(app, parentId, children, id),
      ];
      const commit = await api.commit(operations, [app, 'library-structure']);
      return { id, commit };
    },

    renameItem: async (input: {
      app: GroupedApp; id: string; name: string; expectedRevision: number;
    }): Promise<DataCommit> => {
      const { app, id, name, expectedRevision } = input;
      validateApp(app);
      validateName(name);
      const node = await getNode(app, id);
      if (node.revision !== expectedRevision) throw conflict('The item changed in another tab.');
      return api.commit([
        put('libraryNodes', [api.workspaceIdentity(), app, id],
          { ...node.value, name }, node.revision),
      ], [app, 'library-item:' + id]);
    },

    moveItem: async (input: {
      app: GroupedApp; id: string; targetParentId: string; position: number;
      expectedRevision: number; expectedSourceCollectionRevision: number;
      expectedTargetCollectionRevision: number;
    }): Promise<DataCommit> => {
      const { app, id, targetParentId, position } = input;
      validateApp(app);
      validateParent(targetParentId);
      const node = await getNode(app, id);
      if (node.revision !== input.expectedRevision) throw conflict('The item changed in another tab.');
      if (node.value.parentKey === targetParentId && node.value.position === position) {
        throw invalid('The item already occupies that position.');
      }
      const sourceParent = node.value.parentKey;
      validateParent(sourceParent);
      const source = await getCollection(app, sourceParent);
      const target = sourceParent === targetParentId ? source : await getCollection(app, targetParentId);
      if (source.revision !== input.expectedSourceCollectionRevision ||
          target.revision !== input.expectedTargetCollectionRevision) {
        throw conflict('The library order changed in another tab.');
      }
      if (!source.value.children.includes(id)) throw invalid('The item is absent from its source group.');
      const ancestors = await parentPath(app, targetParentId);
      if (ancestors.some(parent => parent.value.id === id)) {
        throw invalid('A group cannot be moved inside itself or its descendants.');
      }
      if (node.value.kind === 'group') {
        let maxRelative = 1;
        const descend = async (groupId: string, depth: number, seen: Set<string>) => {
          if (seen.has(groupId)) throw invalid('The source group contains a cycle.');
          seen.add(groupId);
          maxRelative = Math.max(maxRelative, depth);
          const collection = await getCollection(app, groupId);
          for (const childId of collection.value.children) {
            const child = await getNode(app, childId);
            if (child.value.parentKey !== groupId) throw invalid('Invalid group ownership.');
            maxRelative = Math.max(maxRelative, depth + 1);
            if (child.value.kind === 'group') await descend(childId, depth + 1, seen);
          }
        };
        await descend(id, 1, new Set<string>());
        if (ancestors.length + maxRelative > MAX_DEPTH) {
          throw invalid('Moving this group would exceed the maximum group depth.');
        }
      }
      const ws = api.workspaceIdentity();
      const sourceIds = source.value.children.filter(child => child !== id);
      const targetIds = sourceParent === targetParentId ? sourceIds :
        [...target.value.children];
      validateIndex(position, targetIds.length);
      targetIds.splice(position, 0, id);
      const ops: DataOperation[] = [
        ...ancestors.map(parent => assertRev('libraryNodes', [ws, app, parent.value.id], parent.revision)),
        put('libraryNodes', [ws, app, id],
          { ...node.value, parentKey: targetParentId, position }, node.revision),
      ];
      if (sourceParent === targetParentId) {
        ops.push(put('collections', [ws, app, sourceParent],
          { ...source.value, children: targetIds }, source.revision));
        ops.push(...await updateOrder(app, sourceParent, targetIds, id));
      } else {
        ops.push(
          put('collections', [ws, app, sourceParent],
            { ...source.value, children: sourceIds }, source.revision),
          put('collections', [ws, app, targetParentId],
            { ...target.value, children: targetIds }, target.revision),
          ...await updateOrder(app, sourceParent, sourceIds),
          ...await updateOrder(app, targetParentId, targetIds, id),
        );
      }
      return api.commit(ops, [app, 'library-structure']);
    },

    deleteItem: async (input: {
      app: GroupedApp; id: string; expectedRevision: number; expectedCollectionRevision: number;
    }): Promise<DataCommit> => {
      const { app, id, expectedRevision, expectedCollectionRevision } = input;
      validateApp(app);
      const node = await getNode(app, id);
      if (node.revision !== expectedRevision) throw conflict('The item changed in another tab.');
      const parentId = node.value.parentKey;
      const parent = await getCollection(app, parentId);
      if (parent.revision !== expectedCollectionRevision) throw conflict('The parent group changed in another tab.');
      if (!parent.value.children.includes(id)) throw invalid('The item is not in its claimed parent.');
      const ws = api.workspaceIdentity();
      const remaining = parent.value.children.filter(sibling => sibling !== id);
      const operations: DataOperation[] = [
        put('collections', [ws, app, parentId], { ...parent.value, children: remaining }, parent.revision),
        ...await updateOrder(app, parentId, remaining),
      ];
      const seen = new Set<string>();
      const walk = async (current: Row<LibraryNode>) => {
        const key = current.value.id;
        if (seen.has(key)) throw invalid('A saved library contains a cycle.');
        seen.add(key);
        if (current.value.kind === 'group') {
          const collection = await getCollection(app, key);
          for (const childId of collection.value.children) {
            const child = await getNode(app, childId);
            if (child.value.parentKey !== key) throw invalid('Library parent references are inconsistent.');
            await walk(child);
          }
          operations.push(del('collections', [ws, app, key], collection.revision));
        } else if (app === 'notebook') {
          operations.push(...await readOptional('notebookDocuments', [ws, key]));
        } else if (app === 'index-cards') {
          const collection = await getCollection('index-cards:cards', key);
          const cards = await api.list<IndexedRow>('indexCards', row => row.setId === key);
          if (!sameOrder(collection.value.children, cards.sort((a, b) =>
            Number(a.value.position) - Number(b.value.position)).map(card => String(card.value.id)))) {
            throw invalid('The card set has inconsistent order or missing cards.');
          }
          for (const card of cards) operations.push(del('indexCards', [ws, key, String(card.value.id)], card.revision));
          operations.push(del('collections', [ws, 'index-cards:cards', key], collection.revision));
          operations.push(...await readOptional('indexCardSets', [ws, key]));
        } else if (app === 'knowledge-check') {
          const collection = await getCollection('knowledge-check:questions', key);
          const questions = await api.list<IndexedRow>('reviewQuestions', row => row.setId === key);
          if (!sameOrder(collection.value.children, questions.sort((a, b) =>
            Number(a.value.position) - Number(b.value.position)).map(q => String(q.value.id)))) {
            throw invalid('The Review set has inconsistent question order.');
          }
          for (const question of questions) operations.push(del('reviewQuestions', [ws, key, String(question.value.id)], question.revision));
          operations.push(del('collections', [ws, 'knowledge-check:questions', key], collection.revision));
          operations.push(...await readOptional('reviewSets', [ws, key]));
        } else {
          const stores: DataStoreName[] = app === 'guide'
            ? ['guides', 'guideSessions'] : app === 'word-search'
              ? ['wordSearches', 'wordSearchGames'] : ['crosswords', 'crosswordGames'];
          for (const store of stores) operations.push(...await readOptional(store, [ws, key]));
        }
        // Deleting an entry prunes its detail but retains app lifetime totals.
        operations.push(...await readOptional('statisticsEntries', [ws, app, key]));
        operations.push(del('libraryNodes', [ws, app, key], current.revision));
      };
      await walk(node);
      return api.commit(operations, [app, 'library-structure', 'statistics:' + app]);
    },
  };
}
