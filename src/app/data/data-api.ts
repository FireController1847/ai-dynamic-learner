import type { Workspace } from '../workspace-format.ts';
import { emptyWorkspace, parseWorkspace } from '../workspace-format.ts';
import { createId, isValidId } from '../../core/ids.ts';
import {
  IndexedDataStore, DataApiError, dataPrimaryKey, type DataChange, type DataCommit,
  type DataOperation, type DataStoreName, type IndexedRow,
} from '../../core/data/indexeddb.ts';
import { hydrateWorkspace, workspaceRows, WORKSPACE_RECORD_STORES } from './workspace-mapping.ts';
import { createLibraryCommands } from './library-commands.ts';
import { createEntryCommands } from './entry-commands.ts';
import { createTodoCommands } from './todo-commands.ts';
import type { DocumentTypeId, DocumentDataByType } from '../../features/notebook/document-types.ts';
import { validateDocumentData } from '../../features/notebook/document-types.ts';
import type { Card } from '../../features/index-cards/card-model.ts';
import { validateCards } from '../../features/index-cards/card-model.ts';
import type { Question } from '../../features/knowledge-check/question-model.ts';
import { validateQuestions } from '../../features/knowledge-check/question-model.ts';
import type { TodoTask } from '../../features/todo-list/task-model.ts';
import { validateSections } from '../../features/todo-list/task-model.ts';
import { validateGame as validateWordGame, type Game as WordGame } from '../../features/word-search/game-model.ts';
import { validateGame as validateCrosswordGame, type Game as CrosswordGame } from '../../features/crossword/game-model.ts';
import { validateGuide, type ListGuideData, type MapGuideData, type MapStudySession } from '../../features/guide/library-model.ts';
import { APP_STATISTICS_METRICS, type StatisticsApp, type StatisticsMetric, type StatisticsCounts } from '../../core/statistics.ts';

export interface Versioned<T> { value: T; revision: number }
export type DataListener = (change: DataChange) => void;

const LEGACY_KEY = 'dynamic-learner.workspace.v1';

/** Order independent object comparison for one-time migration verification. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * The application-facing local data service. Features receive named domains,
 * not native IDB handles. The old Vue-workspace adapter will be migrated to
 * these commands incrementally; no legacy data is erased on initialization.
 */
export class WorkspaceDataApi {
  private readonly store = new IndexedDataStore();
  private workspaceId: string | null = null;
  private initialization: Promise<void> | null = null;

  ready(): Promise<void> {
    if (this.workspaceId) return Promise.resolve();
    if (!this.initialization) {
      this.initialization = this.initialize().catch(error => {
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }

  private async initialize(): Promise<void> {
    await this.store.open();
    let workspaceId = await this.store.activeWorkspaceId();
    if (!workspaceId) {
      // The original localStorage source is read-only during migration.
      // A corrupt copy blocks initialization; never replace it with emptiness.
      let legacy: string | null;
      try { legacy = localStorage.getItem(LEGACY_KEY); }
      catch { throw new DataApiError('unavailable', 'The previous workspace could not be accessed.'); }
      const imported = legacy === null ? emptyWorkspace() : parseWorkspace(legacy);
      const stagedId = createId();
      await this.store.stageRows(workspaceRows(stagedId, imported));
      const hydrated = await hydrateWorkspace(this.store, stagedId);
      if (canonical(imported) !== canonical(hydrated)) {
        throw new DataApiError('validation', 'The imported workspace did not survive the database round-trip.');
      }
      try { await this.store.activate(stagedId, null, new Date().toISOString()); }
      catch (error) {
        if (!(error instanceof DataApiError) || error.code !== 'conflict') throw error;
        // Two new tabs may race the initial import. Respect the winner.
      }
      workspaceId = await this.store.activeWorkspaceId();
    }
    if (!workspaceId) throw new DataApiError('unavailable', 'No active workspace is available.');
    // Check the complete stored model before granting edit access.
    await hydrateWorkspace(this.store, workspaceId);
    this.workspaceId = workspaceId;
  }

  private active(): string {
    if (!this.workspaceId) throw new DataApiError('unavailable', 'The data API is not initialized.');
    return this.workspaceId;
  }

  subscribe(listener: DataListener): () => void {
    return this.store.subscribe(listener);
  }

  subscribeRemote(listener: DataListener): () => void {
    return this.store.subscribeRemote(listener);
  }

  async workspace(): Promise<Workspace> {
    return hydrateWorkspace(this.store, this.active());
  }
  workspaceIdentity(): string { return this.active(); }

  /**
   * Hydrate the UI and capture optimistic revisions from one IDB snapshot.
   * Separate queries could let another tab write after hydration but before
   * we record the initial compare-and-swap revisions.
   */
  async initialSnapshot(followActivePointer = false): Promise<{
    workspace: Workspace;
    revisions: { commitSequence: number; authoredRevision: number };
    records: Array<{ store: DataStoreName; key: IDBValidKey; value: IndexedRow; revision: number }>;
  }> {
    // Only cross-tab refresh is allowed to follow a new active-workspace
    // pointer. A failed refresh must leave the old in-memory view recoverable.
    const workspaceId = followActivePointer
      ? await this.store.activeWorkspaceId() : this.active();
    if (!workspaceId) throw new DataApiError('not-found', 'The active workspace is missing.');
    const stores: DataStoreName[] = [
      ...WORKSPACE_RECORD_STORES, 'collections', 'control', 'workspaceMeta',
    ];
    const snapshot = await this.store.snapshot<IndexedRow>(stores, workspaceId);
    if (snapshot.get('control')?.[0]?.activeWorkspaceId !== workspaceId) {
      throw new DataApiError('conflict', 'The workspace changed while it was being loaded. Reload this tab.');
    }
    const meta = snapshot.get('workspaceMeta')?.find(value => value.id === workspaceId);
    if (typeof meta?.commitSequence !== 'number' || typeof meta.authoredRevision !== 'number') {
      throw new DataApiError('unavailable', 'Workspace revision metadata is missing.');
    }
    const reader = { all: async <T>(store: DataStoreName): Promise<T[]> =>
      (snapshot.get(store) ?? []) as T[] };
    const workspace = await hydrateWorkspace(reader, workspaceId);
    const records = stores.filter(store => !['control', 'workspaceMeta'].includes(store))
      .flatMap(store => (snapshot.get(store) ?? []).filter(value => value.workspaceId === workspaceId)
        .map(value => ({
          store, key: dataPrimaryKey(store, value), value,
          revision: typeof value.revision === 'number' ? value.revision : 0,
        })));
    // Adopt the new pointer only after its complete content has been
    // hydrated and validated from the same consistent snapshot.
    if (followActivePointer) this.workspaceId = workspaceId;
    return {
      workspace,
      revisions: { commitSequence: meta.commitSequence, authoredRevision: meta.authoredRevision },
      records,
    };
  }



  /** Refresh a tab after a missed BroadcastChannel message or page resume.
   * A null journal result means the consumer should reload affected views.
   */
  async refresh(lastSeenCommitSequence: number): Promise<{
    replaced: boolean;
    events: DataChange[] | null;
  }> {
    const current = await this.store.activeWorkspaceId();
    if (!current) throw new DataApiError('unavailable', 'The active workspace could not be found.');
    if (current !== this.workspaceId) {
      // The caller must load/validate and explicitly adopt the replacement.
      // Mutating this.workspaceId here would strand a failed refresh and let
      // old commit sequences hide the pending replacement.
      return { replaced: true, events: null };
    }
    return { replaced: false, events: await this.store.changesAfter(current, lastSeenCommitSequence) };
  }

  async revisions(): Promise<{ commitSequence: number; authoredRevision: number }> {
    const result = await this.store.workspaceRevisions(this.active());
    if (!result) throw new DataApiError('unavailable', 'The active workspace metadata is missing.');
    return result;
  }

  async read<T extends IndexedRow>(store: DataStoreName, key: IDBValidKey): Promise<Versioned<T> | null> {
    const record = await this.store.get<T>(store, key);
    return record ? { value: record, revision: record.revision ?? 0 } : null;
  }

  async list<T extends IndexedRow>(store: DataStoreName, predicate: (row: T) => boolean): Promise<Versioned<T>[]> {
    const workspaceId = this.active();
    // Restrict the scan to this workspace's key range. Inactive staged and
    // previously restored workspaces must not inflate normal list queries.
    const records = (await this.store.snapshot<T>([store], workspaceId)).get(store) ?? [];
    return records.filter(record => record.workspaceId === workspaceId && predicate(record))
      .map(record => ({ value: record, revision: record.revision ?? 0 }));
  }

  private async save(store: DataStoreName, key: IDBValidKey, value: IndexedRow,
    expectedRevision: number | null, scope: string, authored = true): Promise<DataCommit> {
    return this.store.commit(this.active(), [{
      store, key, type: 'put', value: JSON.parse(JSON.stringify(value)) as IndexedRow, expectedRevision,
    }], { authored, scopes: [scope] });
  }

  private async remove(store: DataStoreName, key: IDBValidKey, expectedRevision: number, scope: string): Promise<DataCommit> {
    return this.store.commit(this.active(), [{
      store, key, type: 'delete', expectedRevision,
    }], { authored: true, scopes: [scope] });
  }

  /** Typed structural operations shared by all grouped library applications. */
  readonly library = { ...createLibraryCommands(this), ...createEntryCommands(this) };
  readonly todo = createTodoCommands(this);

  /** Unlike the legacy deep watcher, this writes only the active document body. */
  readonly notebook = {
    getDocument: async (id: string) => {
      if (!isValidId(id)) throw new DataApiError('validation', 'Invalid document ID.');
      return this.read<IndexedRow & { workspaceId: string; id: string; type: DocumentTypeId; data: DocumentDataByType[DocumentTypeId]; revision: number }>(
        'notebookDocuments', [this.active(), id]);
    },
    saveDocument: async (id: string, type: DocumentTypeId, data: DocumentDataByType[DocumentTypeId], expectedRevision: number) => {
      if (!isValidId(id)) throw new DataApiError('validation', 'Invalid document ID.');
      validateDocumentData(type, data);
      const workspaceId = this.active();
      return this.store.commit(workspaceId, [
        { store: 'libraryNodes', type: 'exists', key: [workspaceId, 'notebook', id] },
        { store: 'notebookDocuments', type: 'put', key: [workspaceId, id],
          value: { workspaceId, id, type, data: JSON.parse(JSON.stringify(data)) as DocumentDataByType[DocumentTypeId] },
          expectedRevision },
      ], { authored: true, scopes: ['notebook:' + id] });
    },
  };

  readonly indexCards = {
    getCard: async (setId: string, id: string) =>
      this.read<IndexedRow & Card>('indexCards', [this.active(), setId, id]),
    saveCard: async (setId: string, card: Card, expectedRevision: number, position: number) => {
      if (!Number.isSafeInteger(position) || position < 0) throw new DataApiError('validation', 'Invalid card position.');
      if (!isValidId(setId)) throw new DataApiError('validation', 'Invalid card set ID.');
      validateCards([card], new Set<string>());
      const workspaceId = this.active();
      return this.store.commit(workspaceId, [
        { store: 'indexCardSets', type: 'exists', key: [workspaceId, setId] },
        { store: 'indexCards', type: 'put', key: [workspaceId, setId, card.id],
          value: { workspaceId, setId, ...JSON.parse(JSON.stringify(card)) as Card, position }, expectedRevision },
      ], { authored: true, scopes: ['index-cards:' + setId] });
    },
  };

  readonly todoLists = {
    getTask: async (listId: string, sectionId: string, taskId: string) =>
      this.read<IndexedRow & TodoTask>('todoTasks', [this.active(), listId, sectionId, taskId]),
    saveTask: async (listId: string, sectionId: string, task: TodoTask, expectedRevision: number, position: number) => {
      if (!Number.isSafeInteger(position) || position < 0) throw new DataApiError('validation', 'Invalid task position.');
      if (![listId, sectionId].every(isValidId)) throw new DataApiError('validation', 'Invalid task destination.');
      validateSections([{ id: sectionId, title: '', tasks: [task] }]);
      const workspaceId = this.active();
      return this.store.commit(workspaceId, [
        { store: 'todoSections', type: 'exists', key: [workspaceId, listId, sectionId] },
        { store: 'todoTasks', type: 'put', key: [workspaceId, listId, sectionId, task.id],
          value: { workspaceId, listId, sectionId, ...JSON.parse(JSON.stringify(task)) as TodoTask, position }, expectedRevision },
      ], { authored: true, scopes: ['todo-list:' + listId] });
    },
  };

  readonly review = {
    getQuestion: async (setId: string, id: string) =>
      this.read<IndexedRow & Question>('reviewQuestions', [this.active(), setId, id]),
    saveQuestion: async (setId: string, question: Question, expectedRevision: number, position: number) => {
      if (!Number.isSafeInteger(position) || position < 0) throw new DataApiError('validation', 'Invalid question position.');
      if (!isValidId(setId)) throw new DataApiError('validation', 'Invalid Review set.');
      validateQuestions([question]);
      const workspaceId = this.active();
      return this.store.commit(workspaceId, [
        { store: 'reviewSets', type: 'exists', key: [workspaceId, setId] },
        { store: 'reviewQuestions', type: 'put', key: [workspaceId, setId, question.id],
          value: { workspaceId, setId, ...JSON.parse(JSON.stringify(question)) as Question, position }, expectedRevision },
      ], { authored: true, scopes: ['knowledge-check:' + setId] });
    },
  };

  readonly wordSearch = {
    getPuzzle: async (id: string) => this.read<IndexedRow>('wordSearches', [this.active(), id]),
    getGame: async (id: string) => this.read<IndexedRow & { game: WordGame }>('wordSearchGames', [this.active(), id]),
    saveGame: async (id: string, game: WordGame, expectedRevision: number | null) => {
      const puzzle = await this.read<IndexedRow>('wordSearches', [this.active(), id]);
      if (!puzzle?.value.puzzle) throw new DataApiError('not-found', 'The Word Search puzzle was removed.');
      validateWordGame(puzzle.value.puzzle, game);
      const workspaceId = this.active();
      return this.store.commit(workspaceId, [
        { store: 'wordSearches', type: 'assert', key: [workspaceId, id], expectedRevision: puzzle.revision },
        { store: 'wordSearchGames', type: 'put', key: [workspaceId, id],
          value: { workspaceId, id, game: JSON.parse(JSON.stringify(game)) as WordGame }, expectedRevision },
      ], { authored: true, scopes: ['word-search:' + id] });
    },
  };

  readonly crossword = {
    getPuzzle: async (id: string) => this.read<IndexedRow>('crosswords', [this.active(), id]),
    getGame: async (id: string) => this.read<IndexedRow & { game: CrosswordGame }>('crosswordGames', [this.active(), id]),
    saveGame: async (id: string, game: CrosswordGame, expectedRevision: number | null) => {
      const puzzle = await this.read<IndexedRow>('crosswords', [this.active(), id]);
      if (!puzzle?.value.puzzle) throw new DataApiError('not-found', 'The Crossword puzzle was removed.');
      validateCrosswordGame(puzzle.value.puzzle, game);
      const workspaceId = this.active();
      return this.store.commit(workspaceId, [
        { store: 'crosswords', type: 'assert', key: [workspaceId, id], expectedRevision: puzzle.revision },
        { store: 'crosswordGames', type: 'put', key: [workspaceId, id],
          value: { workspaceId, id, game: JSON.parse(JSON.stringify(game)) as CrosswordGame }, expectedRevision },
      ], { authored: true, scopes: ['crossword:' + id] });
    },
  };

  readonly guide = {
    get: async (id: string) => this.read<IndexedRow>('guides', [this.active(), id]),
    getSession: async (id: string) => this.read<IndexedRow & { session: MapStudySession }>('guideSessions', [this.active(), id]),
    saveList: async (id: string, data: ListGuideData, expectedRevision: number) => {
      validateGuide({ items: [{ id, kind: 'guide', name: 'Guide', mode: 'list', data }] });
      const workspaceId = this.active();
      return this.store.commit(workspaceId, [
        { store: 'libraryNodes', type: 'exists', key: [workspaceId, 'guide', id] },
        { store: 'guides', type: 'put', key: [workspaceId, id],
          value: { workspaceId, id, mode: 'list', data: JSON.parse(JSON.stringify(data)) as ListGuideData },
          expectedRevision },
      ], { authored: true, scopes: ['guide:' + id] });
    },
    saveMap: async (id: string, data: Omit<MapGuideData, 'session'>, expectedRevision: number) => {
      validateGuide({ items: [{ id, kind: 'guide', name: 'Guide', mode: 'map', data }] });
      const workspaceId = this.active();
      return this.store.commit(workspaceId, [
        { store: 'libraryNodes', type: 'exists', key: [workspaceId, 'guide', id] },
        { store: 'guides', type: 'put', key: [workspaceId, id],
          value: { workspaceId, id, mode: 'map', data: JSON.parse(JSON.stringify(data)) as Omit<MapGuideData, 'session'> },
          expectedRevision },
      ], { authored: true, scopes: ['guide:' + id] });
    },
    saveSession: async (id: string, session: MapStudySession, expectedRevision: number | null) => {
      const guide = await this.read<IndexedRow>('guides', [this.active(), id]);
      if (!guide || guide.value.mode !== 'map') throw new DataApiError('not-found', 'The map Guide no longer exists.');
      validateGuide({ items: [{ id, kind: 'guide', name: 'Guide', mode: 'map',
        data: { ...(guide.value.data as object), session } }] });
      const workspaceId = this.active();
      return this.store.commit(workspaceId, [
        { store: 'guides', type: 'assert', key: [workspaceId, id], expectedRevision: guide.revision },
        { store: 'guideSessions', type: 'put', key: [workspaceId, id],
          value: { workspaceId, id, session: JSON.parse(JSON.stringify(session)) as MapStudySession }, expectedRevision },
      ], { authored: true, scopes: ['guide:' + id] });
    },
  };

  readonly statistics = {
    app: async (app: StatisticsApp) =>
      this.read<IndexedRow & { counts: StatisticsCounts }>('statisticsApps', [this.active(), app]),
    entry: async (app: StatisticsApp, id: string) =>
      this.read<IndexedRow & { counts: StatisticsCounts; lastActivityAt: string }>(
        'statisticsEntries', [this.active(), app, id]),
    record: async (app: StatisticsApp, id: string | null, metric: StatisticsMetric, amount = 1) => {
      if (!APP_STATISTICS_METRICS[app]?.includes(metric) || !Number.isSafeInteger(amount) || amount < 1 ||
          (id !== null && !isValidId(id))) {
        throw new DataApiError('validation', 'Invalid learning-activity event.');
      }
      const workspaceId = this.active();
      for (let attempt = 0; attempt < 5; attempt++) {
        const appRecord = await this.read<IndexedRow & { counts: StatisticsCounts }>(
          'statisticsApps', [workspaceId, app]);
        const entryRecord = id !== null
          ? await this.read<IndexedRow & { counts: StatisticsCounts; lastActivityAt: string }>(
            'statisticsEntries', [workspaceId, app, id]) : null;
        const nextCounts = (current: StatisticsCounts | undefined): StatisticsCounts => ({
          ...(current ?? {}), [metric]: Math.min(Number.MAX_SAFE_INTEGER, (current?.[metric] ?? 0) + amount),
        });
        const operations: DataOperation[] = [{
          store: 'statisticsApps', type: 'put', key: [workspaceId, app],
          value: { workspaceId, app, counts: nextCounts(appRecord?.value.counts) },
          expectedRevision: appRecord?.revision ?? null,
        }];
        if (id !== null) operations.push({
          store: 'statisticsEntries', type: 'put', key: [workspaceId, app, id],
          value: { workspaceId, app, id, counts: nextCounts(entryRecord?.value.counts),
            lastActivityAt: new Date().toISOString() },
          expectedRevision: entryRecord?.revision ?? null,
        });
        try { return await this.store.commit(workspaceId, operations, { authored: false, scopes: ['statistics:' + app] }); }
        catch (error) {
          if (!(error instanceof DataApiError) || error.code !== 'conflict' || attempt === 4) throw error;
        }
      }
      throw new DataApiError('conflict', 'Learning activity could not be saved after repeated conflicts.');
    },
  };

  /**
   * General multi-record command for app-owned transactions (group moves,
   * cascading deletes, imports). Callers must validate their domain invariants.
   */
  async commit(operations: readonly DataOperation[], scopes: readonly string[], authored = true): Promise<DataCommit> {
    return this.store.commit(this.active(), operations, { authored, scopes });
  }

  async deleteCard(setId: string, cardId: string, expectedRevision: number): Promise<DataCommit> {
    return this.remove('indexCards', [this.active(), setId, cardId], expectedRevision, 'index-cards:' + setId);
  }

  /**
   * Replacement installs a second verified workspace and flips the active
   * pointer; pending writes from the old workspace are rejected by the store.
   */
  async restoreWorkspace(payload: unknown): Promise<void> {
    // Reuse the same runtime validators as the existing JSON upload path.
    const parsed = parseWorkspace(JSON.stringify(payload));
    // Explicit user-confirmed recovery is allowed when the legacy source was
    // unreadable or a prior active workspace failed validation. No old data
    // is deleted; only a successfully verified new pointer is activated.
    await this.store.open();
    const previous = await this.store.activeWorkspaceId();
    const stagedId = createId();
    await this.store.stageRows(workspaceRows(stagedId, parsed));
    const hydrated = await hydrateWorkspace(this.store, stagedId);
    if (canonical(parsed) !== canonical(hydrated)) {
      throw new DataApiError('validation', 'The restored workspace failed integrity verification.');
    }
    await this.store.activate(stagedId, previous, new Date().toISOString());
    this.workspaceId = stagedId;
  }

  /**
   * The workspace and its authored revision must be captured by one readonly
   * transaction. Otherwise an edit from another tab between two reads might
   * cause us to incorrectly mark newer content as backed up.
   */
  async exportSnapshot(): Promise<{ json: string; workspaceId: string; authoredRevision: number }> {
    const workspaceId = this.active();
    const snapshots = await this.store.snapshot<IndexedRow>(
      [...WORKSPACE_RECORD_STORES, 'control', 'workspaceMeta'], workspaceId);
    const control = snapshots.get('control')?.[0];
    if (control?.activeWorkspaceId !== workspaceId) {
      throw new DataApiError('conflict', 'The workspace was replaced in another tab. Reload before exporting.');
    }
    const meta = snapshots.get('workspaceMeta')?.find(row => row.id === workspaceId);
    if (!meta || typeof meta.authoredRevision !== 'number') {
      throw new DataApiError('unavailable', 'Workspace backup metadata is missing.');
    }
    const reader = {
      all: async <T>(store: DataStoreName): Promise<T[]> =>
        (snapshots.get(store) ?? []) as T[],
    };
    const workspace = await hydrateWorkspace(reader, workspaceId);
    return { json: JSON.stringify(workspace), workspaceId, authoredRevision: meta.authoredRevision };
  }

  async exportWorkspaceJson(): Promise<string> {
    return (await this.exportSnapshot()).json;
  }

  close() { this.store.close(); this.workspaceId = null; this.initialization = null; }
}
