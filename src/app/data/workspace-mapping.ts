import type { Workspace } from '../workspace-format.ts';
import { parseWorkspace } from '../workspace-format.ts';
import type { DataOperation, DataStoreName, IndexedRow, IndexedDataStore } from '../../core/data/indexeddb.ts';

/**
 * Workspace-v1 compatibility mapping. The browser database is deliberately not
 * a serialized Workspace: each document, card, task, question, and puzzle has
 * a separate row. This converter is used for initial migration and backups.
 */
export type DataRow = Extract<DataOperation, { type: 'put' }>;
const LIBRARY_APPS = ['notebook', 'index-cards', 'word-search', 'crossword', 'guide', 'knowledge-check'] as const;

function copy<T>(value: T): T {
  // Imported/exported v1 data is JSON by contract. Avoid transferring Vue
  // proxies to IndexedDB; do not use this for every normal keystroke.
  return JSON.parse(JSON.stringify(value)) as T;
}

export function workspaceRows(workspaceId: string, workspace: Workspace): DataRow[] {
  const rows: DataRow[] = [];
  const add = (store: DataStoreName, key: IDBValidKey, value: IndexedRow) => {
    rows.push({ store, type: 'put', key, value, expectedRevision: null });
  };
  const scoped = (store: DataStoreName, key: IDBValidKey[], value: IndexedRow) =>
    add(store, key, { workspaceId, ...value });
  const features = workspace.features;

  // Feature-state fields are saved separately from the ordered item arrays.
  for (const [app, feature] of Object.entries(features)) {
    const { items: _items, ...settings } = feature as unknown as { items: unknown[]; [key: string]: unknown };
    scoped('featureState', [workspaceId, app], { app, ...copy(settings) });
  }

  function library(app: string, items: readonly Record<string, unknown>[], parentKey = '@root'): void {
    items.forEach((item, position) => {
      const { id, kind, name } = item;
      if (typeof id !== 'string' || typeof kind !== 'string' || typeof name !== 'string') {
        throw new Error('Cannot store a library item without a valid ID, type and name.');
      }
      scoped('libraryNodes', [workspaceId, app, id], { app, id, kind, name, parentKey, position });
      if (kind === 'group') {
        library(app, item.children as Record<string, unknown>[], id);
        return;
      }
      if (app === 'notebook') {
        scoped('notebookDocuments', [workspaceId, id], {
          id, type: item.type, data: copy(item.data),
        });
      } else if (app === 'index-cards') {
        scoped('indexCardSets', [workspaceId, id], {
          id, ...(Object.hasOwn(item, 'mode') ? { mode: item.mode } : {}),
        });
        const cards = item.cards as Record<string, unknown>[];
        cards.forEach((card, cardPosition) => {
          const cardId = String(card.id);
          scoped('indexCards', [workspaceId, id, cardId], { setId: id, ...copy(card), position: cardPosition });
        });
      } else if (app === 'word-search') {
        scoped('wordSearches', [workspaceId, id], {
          id, ...(Object.hasOwn(item, 'puzzle') ? { puzzle: copy(item.puzzle) } : {}),
          ...(Object.hasOwn(item, 'boardRotation') ? { boardRotation: item.boardRotation } : {}),
        });
        if (Object.hasOwn(item, 'game')) scoped('wordSearchGames', [workspaceId, id], { id, game: copy(item.game) });
      } else if (app === 'crossword') {
        scoped('crosswords', [workspaceId, id], {
          id, ...(Object.hasOwn(item, 'puzzle') ? { puzzle: copy(item.puzzle) } : {}),
        });
        if (Object.hasOwn(item, 'game')) scoped('crosswordGames', [workspaceId, id], { id, game: copy(item.game) });
      } else if (app === 'guide') {
        const data = copy(item.data as Record<string, unknown>);
        if (item.mode === 'map' && Object.hasOwn(data, 'session')) {
          scoped('guideSessions', [workspaceId, id], { id, session: data.session });
          delete data.session;
        }
        scoped('guides', [workspaceId, id], { id, mode: item.mode, data });
      } else if (app === 'knowledge-check') {
        scoped('reviewSets', [workspaceId, id], {
          id, ...(Object.hasOwn(item, 'mode') ? { mode: item.mode } : {}),
          ...(Object.hasOwn(item, 'options') ? { options: copy(item.options) } : {}),
        });
        (item.questions as Record<string, unknown>[]).forEach((question, questionPosition) => {
          const questionId = String(question.id);
          scoped('reviewQuestions', [workspaceId, id, questionId], {
            setId: id, ...copy(question), position: questionPosition,
          });
        });
      }
    });
  }

  for (const app of LIBRARY_APPS) {
    library(app, features[app].items as unknown as Record<string, unknown>[]);
  }

  features['todo-list'].items.forEach((list, position) => {
    const { sections, ...fields } = list;
    scoped('todoLists', [workspaceId, list.id], { ...copy(fields), position });
    sections?.forEach((section, sectionPosition) => {
      const { tasks, ...sectionFields } = section;
      scoped('todoSections', [workspaceId, list.id, section.id], {
        listId: list.id, ...copy(sectionFields), position: sectionPosition,
      });
      tasks.forEach((task, taskPosition) => {
        scoped('todoTasks', [workspaceId, list.id, section.id, task.id], {
          listId: list.id, sectionId: section.id, ...copy(task), position: taskPosition,
        });
      });
    });
  });

  if (workspace.statistics) {
    const stats = workspace.statistics;
    scoped('statisticsMeta', [workspaceId], { version: stats.version, startedAt: stats.startedAt });
    for (const [app, record] of Object.entries(stats.apps)) {
      if (!record) continue;
      scoped('statisticsApps', [workspaceId, app], { app, counts: copy(record.counts) });
      for (const [id, entry] of Object.entries(record.entries)) {
        scoped('statisticsEntries', [workspaceId, app, id], {
          app, id, counts: copy(entry.counts), lastActivityAt: entry.lastActivityAt,
        });
      }
    }
  }
  return rows;
}

type Item = Record<string, unknown>;
type Stored = IndexedRow & { id?: string; app?: string; parentKey?: string; position?: number; kind?: string; name?: string };
function own(row: IndexedRow | undefined, field: string): boolean {
  return !!row && Object.hasOwn(row, field);
}
function value<T>(rows: ReadonlyMap<string, IndexedRow>, id: string): T | undefined {
  return rows.get(id) as T | undefined;
}
function indexed(rows: readonly Stored[]): Map<string, IndexedRow> {
  return new Map(rows.filter(r => typeof r.id === 'string').map(r => [r.id as string, r]));
}
const ordering = (a: Stored, b: Stored) => (a.position ?? 0) - (b.position ?? 0);

export async function hydrateWorkspace(store: IndexedDataStore, workspaceId: string): Promise<Workspace> {
  const stores: DataStoreName[] = [
    'featureState', 'libraryNodes', 'notebookDocuments', 'indexCardSets', 'indexCards',
    'wordSearches', 'wordSearchGames', 'crosswords', 'crosswordGames', 'guides', 'guideSessions',
    'reviewSets', 'reviewQuestions', 'todoLists', 'todoSections', 'todoTasks',
    'statisticsMeta', 'statisticsApps', 'statisticsEntries',
  ];
  const data = new Map<DataStoreName, Stored[]>();
  await Promise.all(stores.map(async name => {
    const rows = await store.all<Stored>(name);
    data.set(name, rows.filter(row => row.workspaceId === workspaceId));
  }));
  const getRows = (name: DataStoreName): Stored[] => data.get(name) ?? [];
  const byId = (name: DataStoreName) => indexed(getRows(name));
  const documents = byId('notebookDocuments');
  const indexSets = byId('indexCardSets');
  const wordSearches = byId('wordSearches'), wordGames = byId('wordSearchGames');
  const crosswords = byId('crosswords'), crosswordGames = byId('crosswordGames');
  const guides = byId('guides'), guideSessions = byId('guideSessions');
  const reviewSets = byId('reviewSets');

  const unwrap = (row: Stored, exclusions: readonly string[]): Item => Object.fromEntries(
    Object.entries(row).filter(([key]) => !['workspaceId', 'revision', ...exclusions].includes(key))
  );
  const featureState = new Map(getRows('featureState').map(row => [row.app, unwrap(row, ['app'])]));
  const featureModels: Record<string, Item> = {};
  for (const app of [...LIBRARY_APPS, 'todo-list']) featureModels[app] = { items: [], ...featureState.get(app) };

  const groups = getRows('libraryNodes');
  for (const app of LIBRARY_APPS) {
    const nodes = groups.filter(node => node.app === app);
    const nodeById = new Map<string, Item>();
    for (const row of nodes) {
      const id = row.id!;
      let item: Item = { id, kind: row.kind, name: row.name };
      if (row.kind === 'group') item = { ...item, children: [] };
      else if (app === 'notebook') {
        const body = value<Stored>(documents, id);
        if (!body) throw new Error('The Notebook document body is missing.');
        item = { ...item, type: body.type, data: body.data };
      } else if (app === 'index-cards') {
        const set = value<Stored>(indexSets, id);
        if (!set) throw new Error('An Index Card set is missing.');
        item = { ...item, ...(own(set, 'mode') ? { mode: set.mode } : {}),
          cards: getRows('indexCards').filter(card => card.setId === id).sort(ordering)
            .map(card => unwrap(card, ['setId', 'position'])) };
      } else if (app === 'word-search') {
        const puzzle = value<Stored>(wordSearches, id), game = value<Stored>(wordGames, id);
        if (!puzzle) throw new Error('A Word Search puzzle record is missing.');
        item = { ...item, ...(own(puzzle, 'puzzle') ? { puzzle: puzzle.puzzle } : {}),
          ...(own(puzzle, 'boardRotation') ? { boardRotation: puzzle.boardRotation } : {}),
          ...(own(game, 'game') ? { game: game!.game } : {}) };
      } else if (app === 'crossword') {
        const puzzle = value<Stored>(crosswords, id), game = value<Stored>(crosswordGames, id);
        if (!puzzle) throw new Error('A Crossword puzzle record is missing.');
        item = { ...item, ...(own(puzzle, 'puzzle') ? { puzzle: puzzle.puzzle } : {}),
          ...(own(game, 'game') ? { game: game!.game } : {}) };
      } else if (app === 'guide') {
        const guide = value<Stored>(guides, id), session = value<Stored>(guideSessions, id);
        if (!guide) throw new Error('A Guide body is missing.');
        item = { ...item, mode: guide.mode, data: {
          ...(guide.data as Item), ...(own(session, 'session') ? { session: session!.session } : {}),
        } };
      } else if (app === 'knowledge-check') {
        const set = value<Stored>(reviewSets, id);
        if (!set) throw new Error('A Review set is missing.');
        item = { ...item, ...(own(set, 'mode') ? { mode: set.mode } : {}),
          ...(own(set, 'options') ? { options: set.options } : {}),
          questions: getRows('reviewQuestions').filter(question => question.setId === id).sort(ordering)
            .map(question => unwrap(question, ['setId', 'position'])) };
      }
      nodeById.set(id, item);
    }
    const root: Item[] = [];
    for (const node of [...nodes].sort(ordering)) {
      const parent = node.parentKey === '@root' ? null : nodeById.get(node.parentKey ?? '');
      const target = parent === null ? root : parent?.children;
      if (!Array.isArray(target)) throw new Error('A saved library has an invalid parent.');
      target.push(nodeById.get(node.id!)!);
    }
    featureModels[app]!.items = root;
  }

  const lists = getRows('todoLists').sort(ordering);
  featureModels['todo-list']!.items = lists.map(list => {
    const sections = getRows('todoSections').filter(s => s.listId === list.id).sort(ordering);
    return { ...unwrap(list, ['position']),
      ...(sections.length ? { sections: sections.map(section => ({
        ...unwrap(section, ['listId', 'position']),
        tasks: getRows('todoTasks').filter(task => task.listId === list.id && task.sectionId === section.id)
          .sort(ordering).map(task => unwrap(task, ['listId', 'sectionId', 'position'])),
      })) } : (getRows('todoSections').some(s => s.listId === list.id) ? { sections: [] } : {})),
    };
  });

  const stats = getRows('statisticsMeta')[0];
  const statistics = stats ? {
    version: stats.version, startedAt: stats.startedAt,
    apps: Object.fromEntries(getRows('statisticsApps').map(app => [app.app, {
      counts: app.counts,
      entries: Object.fromEntries(getRows('statisticsEntries')
        .filter(entry => entry.app === app.app)
        .map(entry => [entry.id, { counts: entry.counts, lastActivityAt: entry.lastActivityAt }])),
    }])),
  } : undefined;

  // Reuse the authoritative compatibility validators, including migrations for
  // historical optional fields. The complete JSON exists here only on hydration
  // and during explicit backup/recovery, never as an edit-time storage value.
  return parseWorkspace(JSON.stringify({
    format: 'dynamic-learner', version: 1,
    ...(statistics ? { statistics } : {}),
    features: featureModels,
  }));
}
