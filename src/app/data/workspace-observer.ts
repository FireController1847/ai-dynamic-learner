import { nextTick, toRaw, watch, watchEffect, type Ref, type WatchStopHandle } from 'vue';
import type { Workspace } from '../workspace-format.ts';
import { workspaceRows } from './workspace-mapping.ts';
import { WorkspaceDataApi } from './data-api.ts';
import type { DataOperation, DataStoreName, IndexedRow } from '../../core/data/indexeddb.ts';

type Plain = Record<string, unknown>;
type RowPut = Extract<DataOperation, { type: 'put' }>;
interface KnownRow { revision: number; serialized: string; store: DataStoreName; key: IDBValidKey }
interface Binding { source: object; stop: WatchStopHandle; build: () => RowPut | null; authored: boolean }
const KEY_DELAY_MS = 140;

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(toRaw(value))) as T;
}
function token(store: DataStoreName, key: IDBValidKey): string {
  return store + '|' + JSON.stringify(key);
}
function valueOf(row: RowPut): string {
  return JSON.stringify(row.value);
}
function asObject(value: unknown): Plain {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Plain : {};
}

/**
 * Compatibility observer for the existing Vue editors. Editors still mutate
 * their feature models; each individual record gets a focused watcher.
 * The whole-tree mapping is used only for structural changes, never typing.
 *
 * Long term, feature components should invoke WorkspaceDataApi commands
 * directly and this bridge can be deleted.
 */
export async function observeWorkspace(
  state: Ref<Workspace>,
  api: WorkspaceDataApi,
  problem: (message: string) => void,
  updated: (authoredRevision: number, commitSequence: number) => void,
  initialRecords: Awaited<ReturnType<WorkspaceDataApi['initialSnapshot']>>['records'],
): Promise<{ flush(): Promise<void>; settle(): Promise<void>; stop(): void; hasPendingChanges(): boolean; hasFailed(): boolean }> {
  const workspaceId = api.workspaceIdentity();
  const known = new Map<string, KnownRow>();
  for (const record of initialRecords) {
    const value = { ...record.value };
    delete value.revision;
    const id = token(record.store, record.key);
    known.set(id, { revision: record.revision, serialized: JSON.stringify(value), store: record.store, key: record.key });
  }

  let closed = false;
  let failed = false;
  let initializing = true;
  let chain: Promise<void> = Promise.resolve();
  let queuedActions = 0;
  let structuralTimer: number | undefined;
  let statisticsTimer: number | undefined;
  let lastStructure = '';
  let lastStatisticsStructure = '';
  const statisticsStores = new Set<DataStoreName>(['statisticsMeta','statisticsApps','statisticsEntries']);
  const bindings = new Map<string, Binding>();
  const timers = new Map<string, number>();
  const pending = new Set<string>();

  const scheduleAction = (action: () => Promise<void>) => {
    queuedActions++;
    chain = chain.then(async () => {
      if (!closed && !failed) await action();
    }).catch(error => {
      failed = true;
      const message = error instanceof Error ? error.message : String(error);
      problem('Saving to IndexedDB stopped: ' + message +
        ' Your unsaved changes remain on screen. Download a backup before reloading.');
    }).finally(() => { queuedActions--; });
  };

  const apply = async (rows: readonly (RowPut | null)[], removeMissing = false,
    authored = true, removedStores?: ReadonlySet<DataStoreName>) => {
    const desired = new Map<string, RowPut>();
    for (const row of rows) {
      if (row) desired.set(token(row.store, row.key), row);
    }
    const operations: DataOperation[] = [];
    const touched: Array<{ id: string; next: string | null; op: DataOperation }> = [];
    for (const [id, row] of desired) {
      const previous = known.get(id);
      const next = valueOf(row);
      if (next === previous?.serialized) continue;
      let op: DataOperation = { ...row, expectedRevision: previous?.revision ?? null,
        value: plain(row.value) };
      if (row.store === 'statisticsApps' || row.store === 'statisticsEntries') {
        const previousRow = previous ? asObject(JSON.parse(previous.serialized)) : {};
        const oldCounts = asObject(previousRow.counts);
        const nextCounts = asObject(row.value.counts);
        const delta: Record<string, number> = {};
        let additive = true;
        for (const metric of new Set([...Object.keys(oldCounts), ...Object.keys(nextCounts)])) {
          const before = typeof oldCounts[metric] === 'number' ? oldCounts[metric] : 0;
          const after = typeof nextCounts[metric] === 'number' ? nextCounts[metric] : 0;
          if (!Number.isSafeInteger(before) || !Number.isSafeInteger(after) || after < before) {
            additive = false;
            break;
          }
          if (after > before) delta[metric] = after - before;
        }
        if (additive) op = {
          store: row.store, type: 'increment', key: row.key,
          value: plain(row.value), delta,
        };
      }
      operations.push(op);
      touched.push({ id, next, op });
    }
    if (removeMissing) {
      for (const [id, previous] of known) {
        if (desired.has(id) || (removedStores && !removedStores.has(previous.store))) continue;
        const op: DataOperation = { store: previous.store, type: 'delete', key: previous.key,
          expectedRevision: previous.revision };
        operations.push(op);
        touched.push({ id, next: null, op });
      }
    }
    if (!operations.length) return;
    const contentChange = operations.some(op => {
      if (op.store.startsWith('statistics')) return false;
      if (op.store !== 'featureState') return true;
      if (op.type !== 'put') return true;
      const previous = known.get(token(op.store, op.key));
      if (!previous) return true;
      const withoutSelection = (value: Plain) => Object.fromEntries(
        Object.entries(value).filter(([key]) => !key.startsWith('lastSelected')));
      return JSON.stringify(withoutSelection(asObject(JSON.parse(previous.serialized)))) !==
        JSON.stringify(withoutSelection(op.value));
    });
    const commit = await api.commit(operations, [...new Set(operations.map(op => op.store))], authored && contentChange);
    for (const change of touched) {
      if (change.next === null) known.delete(change.id);
      else {
        const old = known.get(change.id);
        known.set(change.id, {
          store: change.op.store, key: change.op.key,
          revision: (old?.revision ?? 0) + 1,
          serialized: change.next,
        });
      }
    }
    updated(commit.authoredRevision, commit.commitSequence);
  };

  function put(store: DataStoreName, key: IDBValidKey, value: Plain): RowPut {
    return { type: 'put', store, key, value: { workspaceId, ...plain(value) },
      expectedRevision: null };
  }

  function queueRow(id: string) {
    if (closed || failed || initializing) return;
    const binding = bindings.get(id);
    if (!binding) return;
    // The structural transaction captures this record's latest state too.
    // Do not later replay an older row snapshot after a reorder.
    if (structuralTimer !== undefined) return;
    pending.add(id);
    const existing = timers.get(id);
    if (existing !== undefined) clearTimeout(existing);
    timers.set(id, window.setTimeout(() => {
      timers.delete(id);
      if (!pending.delete(id)) return;
      // Build the changed record after the debounce, not on every keypress.
      const current = bindings.get(id);
      const row = current?.build();
      if (row) scheduleAction(() => apply([row], false, current?.authored ?? true));
      else queueStructure();
    }, KEY_DELAY_MS));
  }

  function attach(store: DataStoreName, key: IDBValidKey, source: object,
    select: () => unknown, build: () => RowPut | null, authored = true, seen: Set<string>) {
    const id = token(store, key);
    seen.add(id);
    const existing = bindings.get(id);
    if (existing?.source === source) {
      existing.build = build;
      return;
    }
    const replaced = !!existing && existing.source !== source;
    existing?.stop();
    const stop = watch(select, () => queueRow(id), { deep: true });
    bindings.set(id, { source, stop, build, authored });
    // Some editors/importers replace an existing object with the same ID.
    // Its key and sibling ordering are unchanged, so no structural signature
    // changes. Persist the new object instead of waiting for another edit.
    if (replaced) queueRow(id);
  }

  const captureTree = (seen: Set<string>, signature: string[], statsSignature: string[]) => {
    const workspace = state.value;
    const features = workspace.features as unknown as Record<string, { items: Plain[]; [name: string]: unknown }>;
    for (const [app, model] of Object.entries(features)) {
      attach('featureState', [workspaceId, app], model,
        () => { const { items: _items, ...settings } = model; return settings; },
        () => {
          const { items: _items, ...settings } = model;
          return put('featureState', [workspaceId, app], { app, ...settings });
        }, true, seen);
    }

    function library(app: string, items: Plain[], parentKey = '@root') {
      signature.push(app + ':' + parentKey + ':' + items.map(item => item.id).join(','));
      items.forEach((item, position) => {
        const id = String(item.id);
        const kind = String(item.kind);
        const nodeKey = [workspaceId, app, id];
        attach('libraryNodes', nodeKey, item,
          () => [item.name, item.kind],
          () => put('libraryNodes', nodeKey, { app, id, kind: item.kind, name: item.name, parentKey, position }), true, seen);
        if (kind === 'group') {
          library(app, item.children as Plain[], id);
          return;
        }
        if (app === 'notebook') {
          attach('notebookDocuments', [workspaceId, id], item,
            () => [item.type, item.data],
            () => put('notebookDocuments', [workspaceId, id],
              { id, type: item.type, data: item.data }), true, seen);
        } else if (app === 'index-cards') {
          attach('indexCardSets', [workspaceId, id], item,
            () => item.mode,
            () => put('indexCardSets', [workspaceId, id],
              { id, ...(Object.hasOwn(item, 'mode') ? { mode: item.mode } : {}) }), true, seen);
          const cards = item.cards as Plain[];
          signature.push('index-cards:' + id + ':' + cards.map(card => card.id).join(','));
          cards.forEach((card, index) => {
            const cardId = String(card.id);
            attach('indexCards', [workspaceId, id, cardId], card,
              () => card,
              () => put('indexCards', [workspaceId, id, cardId],
                { setId: id, ...card, position: index }), true, seen);
          });
        } else if (app === 'word-search' || app === 'crossword') {
          const kindStore = app === 'word-search' ? 'wordSearches' : 'crosswords';
          const gameStore = app === 'word-search' ? 'wordSearchGames' : 'crosswordGames';
          attach(kindStore, [workspaceId, id], item,
            () => [item.puzzle, ...(app === 'word-search' ? [item.boardRotation] : [])],
            () => put(kindStore, [workspaceId, id], {
              id, ...(Object.hasOwn(item, 'puzzle') ? { puzzle: item.puzzle } : {}),
              ...(app === 'word-search' && Object.hasOwn(item, 'boardRotation')
                ? { boardRotation: item.boardRotation } : {}),
            }), true, seen);
          attach(gameStore, [workspaceId, id], item,
            () => item.game,
            () => Object.hasOwn(item, 'game') ? put(gameStore, [workspaceId, id], { id, game: item.game }) : null,
            true, seen);
        } else if (app === 'guide') {
          attach('guides', [workspaceId, id], item,
            () => item.mode === 'map' ?
              [item.mode, asObject(item.data).topics, asObject(item.data).connections, asObject(item.data).startTopicId] :
              [item.mode, asObject(item.data).sections],
            () => {
              const data = { ...asObject(item.data) };
              delete data.session;
              return put('guides', [workspaceId, id], { id, mode: item.mode, data });
            }, true, seen);
          attach('guideSessions', [workspaceId, id], item,
            () => asObject(item.data).session,
            () => Object.hasOwn(asObject(item.data), 'session')
              ? put('guideSessions', [workspaceId, id], { id, session: asObject(item.data).session }) : null,
            true, seen);
        } else if (app === 'knowledge-check') {
          attach('reviewSets', [workspaceId, id], item,
            () => [item.mode, item.options],
            () => put('reviewSets', [workspaceId, id], {
              id, ...(Object.hasOwn(item, 'mode') ? { mode: item.mode } : {}),
              ...(Object.hasOwn(item, 'options') ? { options: item.options } : {}),
            }), true, seen);
          const questions = item.questions as Plain[];
          signature.push('knowledge-check:' + id + ':' + questions.map(q => q.id).join(','));
          questions.forEach((question, index) => {
            const questionId = String(question.id);
            attach('reviewQuestions', [workspaceId, id, questionId], question,
              () => question,
              () => put('reviewQuestions', [workspaceId, id, questionId],
                { setId: id, ...question, position: index }), true, seen);
          });
        }
      });
    }
    for (const app of ['notebook', 'index-cards', 'word-search', 'crossword', 'guide', 'knowledge-check']) {
      library(app, features[app]!.items);
    }

    const lists = features['todo-list']!.items;
    signature.push('todo-lists:' + lists.map(list => list.id).join(','));
    lists.forEach((list, listPosition) => {
      const listId = String(list.id);
      const sections = list.sections as Plain[] | undefined;
      attach('todoLists', [workspaceId, listId], list,
        () => [list.name, list.createdAt, list.sectionSort, Object.hasOwn(list, 'sections')],
        () => {
          const { sections: _sections, ...fields } = list;
          return put('todoLists', [workspaceId, listId],
            { ...fields, position: listPosition, hasSections: Object.hasOwn(list, 'sections') });
        }, true, seen);
      signature.push('todo-sections:' + listId + ':' + (sections ?? []).map(section => section.id).join(','));
      sections?.forEach((section, sectionPosition) => {
        const sectionId = String(section.id);
        attach('todoSections', [workspaceId, listId, sectionId], section,
          () => [section.title, section.priority],
          () => {
            const { tasks: _tasks, ...fields } = section;
            return put('todoSections', [workspaceId, listId, sectionId],
              { listId, ...fields, position: sectionPosition });
          }, true, seen);
        const tasks = section.tasks as Plain[];
        signature.push('todo-tasks:' + sectionId + ':' + tasks.map(task => task.id).join(','));
        tasks.forEach((task, taskPosition) => {
          const taskId = String(task.id);
          attach('todoTasks', [workspaceId, listId, sectionId, taskId], task,
            () => task,
            () => put('todoTasks', [workspaceId, listId, sectionId, taskId],
              { listId, sectionId, ...task, position: taskPosition }), true, seen);
        });
      });
    });

    const stats = workspace.statistics;
    if (stats) {
      attach('statisticsMeta', workspaceId, stats,
        () => [stats.version, stats.startedAt],
        () => put('statisticsMeta', workspaceId, { version: stats.version, startedAt: stats.startedAt }), false, seen);
      statsSignature.push('stats-apps:' + Object.keys(stats.apps).sort().join(','));
      for (const [app, record] of Object.entries(stats.apps)) {
        if (!record) continue;
        attach('statisticsApps', [workspaceId, app], record,
          () => record.counts,
          () => put('statisticsApps', [workspaceId, app], { app, counts: record.counts }), false, seen);
        statsSignature.push('stats-entries:' + app + ':' + Object.keys(record.entries).sort().join(','));
        for (const [id, entry] of Object.entries(record.entries)) {
          attach('statisticsEntries', [workspaceId, app, id], entry,
            () => entry,
            () => put('statisticsEntries', [workspaceId, app, id],
              { app, id, counts: entry.counts, lastActivityAt: entry.lastActivityAt }), false, seen);
        }
      }
    }
  };

  function statisticsRows(): RowPut[] {
    const stats = state.value.statistics;
    if (!stats) return [];
    const rows: RowPut[] = [
      put('statisticsMeta', workspaceId, { version: stats.version, startedAt: stats.startedAt }),
    ];
    for (const [app, record] of Object.entries(stats.apps)) {
      if (!record) continue;
      rows.push(put('statisticsApps', [workspaceId, app], { app, counts: record.counts }));
      for (const [id, entry] of Object.entries(record.entries)) {
        rows.push(put('statisticsEntries', [workspaceId, app, id],
          { app, id, counts: entry.counts, lastActivityAt: entry.lastActivityAt }));
      }
    }
    return rows;
  }

  function queueStatistics() {
    if (closed || failed || initializing) return;
    if (statisticsTimer !== undefined) clearTimeout(statisticsTimer);
    statisticsTimer = window.setTimeout(() => {
      statisticsTimer = undefined;
      scheduleAction(() => apply(statisticsRows(), true, false, statisticsStores));
    }, KEY_DELAY_MS);
  }

  function queueStructure() {
    if (closed || failed || initializing) return;
    if (structuralTimer !== undefined) clearTimeout(structuralTimer);
    structuralTimer = window.setTimeout(() => {
      structuralTimer = undefined;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      pending.clear();
      scheduleAction(async () => {
        // Whole-tree conversion is allowed for rare structural changes
        // (creation, deletion, reordering); ordinary typing uses queueRow.
        const rows = workspaceRows(workspaceId, state.value);
        await apply(rows, true);
      });
    }, KEY_DELAY_MS);
  }

  const stopSkeleton = watchEffect(() => {
    const seen = new Set<string>();
    const signature: string[] = [];
    const statsSignature: string[] = [];
    captureTree(seen, signature, statsSignature);
    for (const [id, binding] of bindings) {
      if (seen.has(id)) continue;
      binding.stop();
      bindings.delete(id);
      const timer = timers.get(id);
      if (timer !== undefined) clearTimeout(timer);
      timers.delete(id);
      pending.delete(id);
    }
    const nextSignature = signature.join('|');
    if (nextSignature !== lastStructure) {
      const previous = lastStructure;
      lastStructure = nextSignature;
      if (previous) queueStructure();
    }
    const nextStats = statsSignature.join('|');
    if (nextStats !== lastStatisticsStructure) {
      const previous = lastStatisticsStructure;
      lastStatisticsStructure = nextStats;
      if (previous) queueStatistics();
    }
  });

  initializing = false;

  async function flush(): Promise<void> {
    await nextTick();
    if (statisticsTimer !== undefined) {
      clearTimeout(statisticsTimer);
      statisticsTimer = undefined;
      scheduleAction(() => apply(statisticsRows(), true, false, statisticsStores));
    }
    if (structuralTimer !== undefined) {
      clearTimeout(structuralTimer);
      structuralTimer = undefined;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      pending.clear();
      const rows = workspaceRows(workspaceId, state.value);
      scheduleAction(() => apply(rows, true));
    }
    for (const [id, timer] of timers) {
      clearTimeout(timer);
      const current = bindings.get(id);
      const row = pending.has(id) ? current?.build() : null;
      if (row) scheduleAction(() => apply([row], false, current?.authored ?? true));
    }
    timers.clear();
    pending.clear();
    await chain;
    if (failed) throw new Error('IndexedDB saving failed. Download a backup before leaving.');
  }

  function stop() {
    closed = true;
    stopSkeleton();
    for (const row of bindings.values()) row.stop();
    bindings.clear();
    if (structuralTimer !== undefined) clearTimeout(structuralTimer);
    if (statisticsTimer !== undefined) clearTimeout(statisticsTimer);
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    pending.clear();
  }
  return {
    flush, stop,
    // Unlike flush, settle does not schedule draft writes after stop().
    // It only waits for any transaction already in progress to finish.
    settle: async () => { await chain; },
    hasPendingChanges: () => failed || queuedActions > 0 || pending.size > 0 ||
      timers.size > 0 || statisticsTimer !== undefined || structuralTimer !== undefined,
    hasFailed: () => failed,
  };
}
