import { createId, isValidId } from '../../core/ids.ts';
import { DataApiError, type DataCommit, type DataOperation, type IndexedRow } from '../../core/data/indexeddb.ts';
import { MAX_LISTS } from '../../features/todo-list/library-model.ts';
import { MAX_SECTIONS, MAX_TASKS, newSection, newTask, validateSections } from '../../features/todo-list/task-model.ts';
import type { WorkspaceDataApi, Versioned } from './data-api.ts';

interface OrderedCollection extends IndexedRow {
  workspaceId: string;
  app: string;
  parentId: string;
  children: string[];
}

const fail = (code: 'validation' | 'not-found' | 'conflict', message: string): never => {
  throw new DataApiError(code, message);
};
const put = (store: 'collections' | 'todoLists' | 'todoSections' | 'todoTasks',
  key: IDBValidKey, value: IndexedRow, expectedRevision: number | null): DataOperation => ({
    store, type: 'put', key, value, expectedRevision,
  });
const del = (store: 'collections' | 'todoLists' | 'todoSections' | 'todoTasks' | 'statisticsEntries',
  key: IDBValidKey, expectedRevision: number): DataOperation => ({
    store, type: 'delete', key, expectedRevision,
  });

export function createTodoCommands(api: Pick<WorkspaceDataApi, 'read' | 'list' | 'commit' | 'workspaceIdentity'>) {
  const ws = () => api.workspaceIdentity();
  const collection = async (app: string, parentId: string): Promise<Versioned<OrderedCollection>> => {
    const row = await api.read<OrderedCollection>('collections', [ws(), app, parentId]);
    if (!row) return fail('not-found', 'The Todo List collection no longer exists.');
    if (!Array.isArray(row.value.children) ||
        row.value.children.some(id => !isValidId(id)) ||
        new Set(row.value.children).size !== row.value.children.length) {
      return fail('validation', 'The Todo List contains invalid or repeated child IDs.');
    }
    return row;
  };
  const list = async (id: string) => {
    if (!isValidId(id)) return fail('validation', 'Invalid Todo List ID.');
    const row = await api.read<IndexedRow>('todoLists', [ws(), id]);
    if (!row) return fail('not-found', 'The Todo List has been removed.');
    return row;
  };
  const section = async (listId: string, id: string) => {
    if (!isValidId(id)) return fail('validation', 'Invalid Todo section ID.');
    const row = await api.read<IndexedRow>('todoSections', [ws(), listId, id]);
    if (!row) return fail('not-found', 'The Todo section has been removed.');
    return row;
  };
  const children = async (store: 'todoLists' | 'todoSections' | 'todoTasks',
    ids: readonly string[], prefix: readonly string[]) => Promise.all(ids.map(async (id) => {
    const row = await api.read<IndexedRow>(store, [...prefix, id]);
    if (!row) return fail('not-found', 'A Todo List item was removed in another tab.');
    return row;
  }));
  const updatePositions = async (store: 'todoLists' | 'todoSections' | 'todoTasks',
    ids: readonly string[], prefix: readonly string[]) => {
    const rows = await children(store, ids, prefix);
    return rows.flatMap((row, i) =>
      row.value.position === i ? [] : [put(store, [...prefix, ids[i]!],
        { ...row.value, position: i }, row.revision)]);
  };

  return {
    createList: async (input: {
      name: string; expectedCollectionRevision: number;
    }): Promise<{ id: string; commit: DataCommit }> => {
      if (!input.name.trim() || input.name.length > 120) fail('validation', 'Invalid Todo List name.');
      const root = await collection('todo-list', '@root');
      if (root.revision !== input.expectedCollectionRevision) fail('conflict', 'The Todo List order changed in another tab.');
      if (root.value.children.length >= MAX_LISTS) fail('validation', 'The Todo List limit has been reached.');
      const id = createId(), workspaceId = ws();
      const createdAt = new Date().toISOString();
      const commit = await api.commit([
        put('collections', [workspaceId, 'todo-list', '@root'],
          { ...root.value, children: [...root.value.children, id] }, root.revision),
        put('todoLists', [workspaceId, id], {
          workspaceId, id, name: input.name, createdAt, position: root.value.children.length,
          hasSections: false,
        }, null),
      ], ['todo-list', 'todo-list:library']);
      return { id, commit };
    },

    createSection: async (input: {
      listId: string; expectedListRevision: number;
      expectedCollectionRevision: number | null;
    }): Promise<{ id: string; commit: DataCommit }> => {
      const parent = await list(input.listId);
      if (parent.revision !== input.expectedListRevision) fail('conflict', 'The Todo List changed in another tab.');
      const key = [ws(), 'todo-list:sections', input.listId];
      const existing = await api.read<OrderedCollection>('collections', key);
      if ((existing?.revision ?? null) !== input.expectedCollectionRevision) {
        fail('conflict', 'The section order changed in another tab.');
      }
      if (parent.value.hasSections && !existing) fail('validation', 'Todo List sections are missing.');
      if (existing && !parent.value.hasSections) fail('validation', 'Todo List section state is inconsistent.');
      const ids = existing?.value.children ?? [];
      if (ids.length >= MAX_SECTIONS) fail('validation', 'This Todo List has reached its section limit.');
      const fresh = newSection();
      validateSections([fresh]);
      const workspaceId = ws();
      const { tasks, ...fields } = fresh;
      const operations: DataOperation[] = [
        put('todoLists', [workspaceId, input.listId], {
          ...parent.value, hasSections: true,
        }, parent.revision),
        put('collections', key, {
          workspaceId, app: 'todo-list:sections', parentId: input.listId,
          children: [...ids, fresh.id],
        }, existing?.revision ?? null),
        put('todoSections', [workspaceId, input.listId, fresh.id], {
          workspaceId, listId: input.listId, ...fields, position: ids.length,
        }, null),
        put('collections', [workspaceId, 'todo-list:tasks', input.listId + '/' + fresh.id], {
          workspaceId, app: 'todo-list:tasks', parentId: input.listId + '/' + fresh.id,
          children: tasks.map(task => task.id),
        }, null),
        ...tasks.map((task, position): DataOperation =>
          put('todoTasks', [workspaceId, input.listId, fresh.id, task.id], {
            workspaceId, listId: input.listId, sectionId: fresh.id, ...task, position,
          }, null)),
      ];
      const commit = await api.commit(operations, ['todo-list', 'todo-list:' + input.listId]);
      return { id: fresh.id, commit };
    },

    createTask: async (input: {
      listId: string; sectionId: string; expectedCollectionRevision: number;
    }): Promise<{ id: string; commit: DataCommit }> => {
      const parent = await section(input.listId, input.sectionId);
      const key = input.listId + '/' + input.sectionId;
      const members = await collection('todo-list:tasks', key);
      if (members.revision !== input.expectedCollectionRevision) {
        fail('conflict', 'The Todo task order changed in another tab.');
      }
      const total = (await api.list<IndexedRow>('todoTasks', row => row.listId === input.listId)).length;
      if (total >= MAX_TASKS) fail('validation', 'This Todo List has reached its task limit.');
      const task = newTask();
      validateSections([{ id: input.sectionId, title: '', tasks: [task] }]);
      const workspaceId = ws();
      const commit = await api.commit([
        { store: 'todoSections', type: 'assert',
          key: [workspaceId, input.listId, input.sectionId], expectedRevision: parent.revision },
        put('collections', [workspaceId, 'todo-list:tasks', key],
          { ...members.value, children: [...members.value.children, task.id] }, members.revision),
        put('todoTasks', [workspaceId, input.listId, input.sectionId, task.id], {
          workspaceId, listId: input.listId, sectionId: input.sectionId,
          ...task, position: members.value.children.length,
        }, null),
      ], ['todo-list', 'todo-list:' + input.listId]);
      return { id: task.id, commit };
    },

    deleteTask: async (input: {
      listId: string; sectionId: string; id: string;
      expectedRevision: number; expectedCollectionRevision: number;
    }): Promise<DataCommit> => {
      const key = input.listId + '/' + input.sectionId;
      const members = await collection('todo-list:tasks', key);
      if (members.revision !== input.expectedCollectionRevision) fail('conflict', 'The task order changed in another tab.');
      const row = await api.read<IndexedRow>('todoTasks', [ws(), input.listId, input.sectionId, input.id]);
      if (!row || row.revision !== input.expectedRevision ||
          !members.value.children.includes(input.id)) fail('conflict', 'The task changed in another tab.');
      const remaining = members.value.children.filter(id => id !== input.id);
      return api.commit([
        put('collections', [ws(), 'todo-list:tasks', key],
          { ...members.value, children: remaining }, members.revision),
        del('todoTasks', [ws(), input.listId, input.sectionId, input.id], row.revision),
        ...await updatePositions('todoTasks', remaining, [ws(), input.listId, input.sectionId]),
      ], ['todo-list', 'todo-list:' + input.listId]);
    },

    reorderList: async (input: {
      id: string; position: number; expectedRevision: number; expectedCollectionRevision: number;
    }): Promise<DataCommit> => {
      const member = await list(input.id);
      if (member.revision !== input.expectedRevision) fail('conflict', 'The list changed in another tab.');
      const root = await collection('todo-list', '@root');
      if (root.revision !== input.expectedCollectionRevision ||
          !root.value.children.includes(input.id)) fail('conflict', 'The list order changed in another tab.');
      const ids = root.value.children.filter(id => id !== input.id);
      if (!Number.isSafeInteger(input.position) || input.position < 0 || input.position > ids.length) {
        fail('validation', 'Invalid list position.');
      }
      ids.splice(input.position, 0, input.id);
      if (ids.every((id, index) => id === root.value.children[index])) {
        fail('validation', 'The list is already in that position.');
      }
      const workspaceId = ws();
      return api.commit([
        put('collections', [workspaceId, 'todo-list', '@root'], { ...root.value, children: ids }, root.revision),
        put('todoLists', [workspaceId, input.id],
          { ...member.value, position: input.position }, member.revision),
        ...await (async () => {
          const siblings = await children('todoLists', ids.filter(id => id !== input.id), [workspaceId]);
          return siblings.flatMap(row => {
            const position = ids.indexOf(String(row.value.id));
            return position === row.value.position ? [] : [
              put('todoLists', [workspaceId, String(row.value.id)],
                { ...row.value, position }, row.revision),
            ];
          });
        })(),
      ], ['todo-list', 'todo-list:library']);
    },

    moveTask: async (input: {
      listId: string; sectionId: string; targetSectionId: string; id: string; position: number;
      expectedRevision: number; expectedSourceCollectionRevision: number;
      expectedTargetCollectionRevision: number;
    }): Promise<DataCommit> => {
      const sourceSection = await section(input.listId, input.sectionId);
      const destination = input.targetSectionId === input.sectionId
        ? sourceSection : await section(input.listId, input.targetSectionId);
      const sourceKey = input.listId + '/' + input.sectionId;
      const targetKey = input.listId + '/' + input.targetSectionId;
      const source = await collection('todo-list:tasks', sourceKey);
      const target = targetKey === sourceKey ? source : await collection('todo-list:tasks', targetKey);
      if (source.revision !== input.expectedSourceCollectionRevision ||
          target.revision !== input.expectedTargetCollectionRevision) {
        fail('conflict', 'The task order changed in another tab.');
      }
      const task = await api.read<IndexedRow>('todoTasks', [ws(), input.listId, input.sectionId, input.id]);
      if (!task || task.revision !== input.expectedRevision ||
          !source.value.children.includes(input.id)) fail('conflict', 'The task changed in another tab.');
      const sourceIds = source.value.children.filter(id => id !== input.id);
      const targetIds = targetKey === sourceKey ? sourceIds : [...target.value.children];
      if (!Number.isSafeInteger(input.position) || input.position < 0 || input.position > targetIds.length) {
        fail('validation', 'The requested task position is invalid.');
      }
      targetIds.splice(input.position, 0, input.id);
      const workspaceId = ws();
      const operations: DataOperation[] = [
        { store: 'todoSections', type: 'assert',
          key: [workspaceId, input.listId, input.sectionId], expectedRevision: sourceSection.revision },
        ...(targetKey !== sourceKey ? [{
          store: 'todoSections', type: 'assert',
          key: [workspaceId, input.listId, input.targetSectionId],
          expectedRevision: destination.revision,
        } satisfies DataOperation] : []),
      ];
      if (targetKey === sourceKey) {
        operations.push(
          put('collections', [workspaceId, 'todo-list:tasks', sourceKey],
            { ...source.value, children: targetIds }, source.revision),
          put('todoTasks', [workspaceId, input.listId, input.sectionId, input.id],
            { ...task.value, position: input.position }, task.revision),
        );
      } else {
        operations.push(
          put('collections', [workspaceId, 'todo-list:tasks', sourceKey],
            { ...source.value, children: sourceIds }, source.revision),
          put('collections', [workspaceId, 'todo-list:tasks', targetKey],
            { ...target.value, children: targetIds }, target.revision),
          del('todoTasks', [workspaceId, input.listId, input.sectionId, input.id], task.revision),
          put('todoTasks', [workspaceId, input.listId, input.targetSectionId, input.id],
            { ...task.value, sectionId: input.targetSectionId, position: input.position }, null),
        );
        operations.push(...await updatePositions('todoTasks', sourceIds,
          [workspaceId, input.listId, input.sectionId]));
      }
      const siblings = await children('todoTasks', targetIds.filter(id => id !== input.id),
        [workspaceId, input.listId, input.targetSectionId]);
      for (const row of siblings) {
        const position = targetIds.indexOf(String(row.value.id));
        if (row.value.position !== position) operations.push(
          put('todoTasks', [workspaceId, input.listId, input.targetSectionId, String(row.value.id)],
            { ...row.value, position }, row.revision),
        );
      }
      return api.commit(operations, ['todo-list', 'todo-list:' + input.listId]);
    },

    deleteSection: async (input: {
      listId: string; id: string; expectedRevision: number; expectedCollectionRevision: number;
    }): Promise<DataCommit> => {
      const row = await section(input.listId, input.id);
      if (row.revision !== input.expectedRevision) fail('conflict', 'The section changed in another tab.');
      const members = await collection('todo-list:sections', input.listId);
      if (members.revision !== input.expectedCollectionRevision ||
          !members.value.children.includes(input.id)) fail('conflict', 'The section order changed in another tab.');
      const remaining = members.value.children.filter(id => id !== input.id);
      const workspaceId = ws(), taskKey = input.listId + '/' + input.id;
      const taskCollection = await collection('todo-list:tasks', taskKey);
      const operations: DataOperation[] = [
        put('collections', [workspaceId, 'todo-list:sections', input.listId],
          { ...members.value, children: remaining }, members.revision),
        ...await updatePositions('todoSections', remaining, [workspaceId, input.listId]),
      ];
      for (const id of taskCollection.value.children) {
        const task = await api.read<IndexedRow>('todoTasks', [workspaceId, input.listId, input.id, id]);
        if (!task) fail('validation', 'A saved task was missing during section deletion.');
        operations.push(del('todoTasks', [workspaceId, input.listId, input.id, id], task.revision));
      }
      operations.push(
        del('collections', [workspaceId, 'todo-list:tasks', taskKey], taskCollection.revision),
        del('todoSections', [workspaceId, input.listId, input.id], row.revision),
      );
      return api.commit(operations, ['todo-list', 'todo-list:' + input.listId]);
    },

    deleteList: async (input: {
      id: string; expectedRevision: number; expectedCollectionRevision: number;
    }): Promise<DataCommit> => {
      const parent = await list(input.id);
      if (parent.revision !== input.expectedRevision) fail('conflict', 'The list changed in another tab.');
      const root = await collection('todo-list', '@root');
      if (root.revision !== input.expectedCollectionRevision || !root.value.children.includes(input.id)) {
        fail('conflict', 'The Todo List order changed in another tab.');
      }
      const remaining = root.value.children.filter(id => id !== input.id), workspaceId = ws();
      const operations: DataOperation[] = [
        put('collections', [workspaceId, 'todo-list', '@root'],
          { ...root.value, children: remaining }, root.revision),
        ...await updatePositions('todoLists', remaining, [workspaceId]),
      ];
      const sectionCollection = await api.read<OrderedCollection>('collections',
        [workspaceId, 'todo-list:sections', input.id]);
      if (parent.value.hasSections && !sectionCollection) {
        fail('validation', 'Saved Todo List sections are missing.');
      }
      if (sectionCollection) {
        for (const sectionId of sectionCollection.value.children) {
          const group = await section(input.id, sectionId);
          const taskKey = input.id + '/' + sectionId;
          const taskCollection = await collection('todo-list:tasks', taskKey);
          for (const taskId of taskCollection.value.children) {
            const task = await api.read<IndexedRow>('todoTasks', [workspaceId, input.id, sectionId, taskId]);
            if (!task) fail('validation', 'A Todo List task is missing.');
            operations.push(del('todoTasks', [workspaceId, input.id, sectionId, taskId], task.revision));
          }
          operations.push(
            del('collections', [workspaceId, 'todo-list:tasks', taskKey], taskCollection.revision),
            del('todoSections', [workspaceId, input.id, sectionId], group.revision),
          );
        }
        operations.push(del('collections', [workspaceId, 'todo-list:sections', input.id], sectionCollection.revision));
      }
      operations.push(del('todoLists', [workspaceId, input.id], parent.revision));
      const statistics = await api.read<IndexedRow>('statisticsEntries', [workspaceId, 'todo-list', input.id]);
      if (statistics) operations.push(del('statisticsEntries', [workspaceId, 'todo-list', input.id], statistics.revision));
      return api.commit(operations, ['todo-list', 'todo-list:library', 'statistics:todo-list']);
    },
  };
}
