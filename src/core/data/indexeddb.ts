/**
 * Browser-native persistence primitives for the Dynamic Learner Data API.
 * No Vue or feature-model dependencies belong in this module.
 *
 * A record's revision is checked in the same readwrite transaction as its
 * update. BroadcastChannel messages only announce committed changes.
 */
export const DATABASE_NAME = 'dynamic-learner-data';
export const DATABASE_VERSION = 1;
export const CHANNEL_NAME = 'dynamic-learner.data.v1';

const definitions = {
  control: { key: 'key' },
  workspaceMeta: { key: 'id' },
  libraryNodes: { key: ['workspaceId', 'app', 'id'], indexes: { siblings: ['workspaceId', 'app', 'parentKey', 'position'] } },
  featureState: { key: ['workspaceId', 'app'] },
  notebookDocuments: { key: ['workspaceId', 'id'] },
  todoLists: { key: ['workspaceId', 'id'], indexes: { ordered: ['workspaceId', 'position'] } },
  todoSections: { key: ['workspaceId', 'listId', 'id'], indexes: { ordered: ['workspaceId', 'listId', 'position'] } },
  todoTasks: { key: ['workspaceId', 'listId', 'sectionId', 'id'], indexes: { ordered: ['workspaceId', 'listId', 'sectionId', 'position'] } },
  indexCardSets: { key: ['workspaceId', 'id'] },
  indexCards: { key: ['workspaceId', 'setId', 'id'], indexes: { ordered: ['workspaceId', 'setId', 'position'] } },
  wordSearches: { key: ['workspaceId', 'id'] },
  wordSearchGames: { key: ['workspaceId', 'id'] },
  crosswords: { key: ['workspaceId', 'id'] },
  crosswordGames: { key: ['workspaceId', 'id'] },
  guides: { key: ['workspaceId', 'id'] },
  guideSessions: { key: ['workspaceId', 'id'] },
  reviewSets: { key: ['workspaceId', 'id'] },
  reviewQuestions: { key: ['workspaceId', 'setId', 'id'], indexes: { ordered: ['workspaceId', 'setId', 'position'] } },
  statisticsMeta: { key: 'workspaceId' },
  statisticsApps: { key: ['workspaceId', 'app'] },
  statisticsEntries: { key: ['workspaceId', 'app', 'id'], indexes: { app: ['workspaceId', 'app'] } },
  changeJournal: { key: ['workspaceId', 'commitSequence'] },
} as const;

export type DataStoreName = keyof typeof definitions;
export type IndexedRow = { workspaceId?: string; revision?: number; [property: string]: unknown };
export type ReadKey = IDBValidKey;
export type DataChange = {
  workspaceId: string;
  commitSequence: number;
  authoredRevision: number;
  scopes: readonly string[];
};
export type DataCommit = DataChange;
export type DataOperation =
  | { store: DataStoreName; type: 'put'; key: IDBValidKey; value: IndexedRow; expectedRevision: number | null }
  | { store: DataStoreName; type: 'delete'; key: IDBValidKey; expectedRevision: number | null };

export class DataApiError extends Error {
  constructor(public readonly code: 'conflict' | 'unavailable' | 'upgrade-blocked' | 'not-found' | 'validation', message: string) {
    super(message);
    this.name = 'DataApiError';
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

export function openDataDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new DataApiError('unavailable', 'IndexedDB is not available in this browser.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const [name, definition] of Object.entries(definitions)) {
        if (database.objectStoreNames.contains(name)) continue;
        const store = database.createObjectStore(name, { keyPath: definition.key as string | string[] });
        if ('indexes' in definition) {
          for (const [index, keys] of Object.entries(definition.indexes)) {
            store.createIndex(index, keys as string[]);
          }
        }
      }
    };
    request.onblocked = () => reject(new DataApiError('upgrade-blocked', 'Close other Dynamic Learner tabs to finish the database upgrade.'));
    request.onerror = () => reject(request.error ?? new DataApiError('unavailable', 'Unable to open IndexedDB.'));
    request.onsuccess = () => resolve(request.result);
  });
}

/** A low-level provider; no app feature may access an IDBTransaction directly. */
export class IndexedDataStore {
  private database: IDBDatabase | null = null;
  private channel: BroadcastChannel | null = null;
  private readonly listeners = new Set<(change: DataChange) => void>();
  private closed = false;

  async open(): Promise<void> {
    if (this.closed) throw new DataApiError('unavailable', 'This data connection is closed.');
    if (this.database) return;
    const database = await openDataDatabase();
    if (this.closed) { database.close(); return; }
    database.onversionchange = () => {
      this.database = null;
      database.close();
      this.close();
    };
    this.database = database;
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        const value = event.data;
        if (!value || typeof value !== 'object') return;
        const message = value as Partial<DataChange>;
        if (typeof message.workspaceId !== 'string' || typeof message.commitSequence !== 'number' ||
            typeof message.authoredRevision !== 'number' || !Array.isArray(message.scopes)) return;
        this.publish(message as DataChange, false);
      };
    }
  }

  private db(): IDBDatabase {
    if (!this.database || this.closed) throw new DataApiError('unavailable', 'The data connection is not available.');
    return this.database;
  }

  subscribe(listener: (change: DataChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(change: DataChange, broadcast: boolean) {
    for (const listener of this.listeners) listener(change);
    if (broadcast) this.channel?.postMessage(change);
  }

  async get<T>(store: DataStoreName, key: ReadKey): Promise<T | undefined> {
    const tx = this.db().transaction(store, 'readonly');
    const completion = transactionDone(tx);
    const value = await requestResult(tx.objectStore(store).get(key));
    await completion;
    return value as T | undefined;
  }

  async all<T>(store: DataStoreName, range?: IDBKeyRange): Promise<T[]> {
    const tx = this.db().transaction(store, 'readonly');
    const completion = transactionDone(tx);
    const value = await requestResult(tx.objectStore(store).getAll(range));
    await completion;
    return value as T[];
  }

  async activeWorkspaceId(): Promise<string | null> {
    const control = await this.get<{ activeWorkspaceId: string }>('control', 'local');
    return control?.activeWorkspaceId ?? null;
  }

  /**
   * Stages rows into an inactive workspace in short transactions. No pointers
   * change here. The caller validates hydration before calling activate().
   */
  async stageRows(operations: readonly Extract<DataOperation, { type: 'put' }>[], maxBatch = 400): Promise<void> {
    for (let start = 0; start < operations.length; start += maxBatch) {
      const batch = operations.slice(start, start + maxBatch);
      const stores = [...new Set(batch.map(row => row.store))];
      const tx = this.db().transaction(stores, 'readwrite');
      const completion = transactionDone(tx);
      for (const operation of batch) tx.objectStore(operation.store).put(operation.value);
      await completion;
    }
  }

  /**
   * Activates a fully validated staging workspace. If an active ID is already
   * set, callers must supply it as the expected pointer for restore.
   */
  async activate(workspaceId: string, expectedWorkspaceId: string | null, initializedAt: string): Promise<void> {
    const tx = this.db().transaction(['control', 'workspaceMeta'], 'readwrite');
    const completion = transactionDone(tx);
    const controlStore = tx.objectStore('control');
    let failure: Error | null = null;
    const request = controlStore.get('local');
    request.onsuccess = () => {
      const current = (request.result as { activeWorkspaceId?: string } | undefined)?.activeWorkspaceId ?? null;
      if (current !== expectedWorkspaceId) {
        failure = new DataApiError('conflict', 'Another tab changed the active workspace.');
        tx.abort();
        return;
      }
      controlStore.put({ key: 'local', activeWorkspaceId: workspaceId });
      tx.objectStore('workspaceMeta').put({
        id: workspaceId, createdAt: initializedAt, commitSequence: 0,
        authoredRevision: 0, restoreEpoch: Date.now(), legacyMigration: true,
      });
    };
    try { await completion; }
    catch (error) { throw failure ?? error; }
    this.publish({ workspaceId, commitSequence: 0, authoredRevision: 0, scopes: ['workspace-replaced'] }, true);
  }

  /**
   * Compare-and-swap in a single transaction across records, metadata and the
   * active-workspace pointer. All requests are issued from IDB event callbacks
   * so async pauses cannot cause an auto-committed transaction.
   */
  async commit(workspaceId: string, operations: readonly DataOperation[],
    options: { authored: boolean; scopes: readonly string[] }): Promise<DataCommit> {
    if (!operations.length) throw new DataApiError('validation', 'A transaction needs at least one operation.');
    const stores: DataStoreName[] = [...new Set<DataStoreName>(
      ['control', 'workspaceMeta', 'changeJournal', ...operations.map(operation => operation.store)]
    )];
    const tx = this.db().transaction(stores, 'readwrite');
    const completion = transactionDone(tx);
    let failure: Error | null = null;
    let result: DataCommit | null = null;
    const abort = (error: Error) => { failure = error; tx.abort(); };
    const metaStore = tx.objectStore('workspaceMeta');
    const controlRequest = tx.objectStore('control').get('local');
    controlRequest.onsuccess = () => {
      if ((controlRequest.result as { activeWorkspaceId?: string } | undefined)?.activeWorkspaceId !== workspaceId) {
        abort(new DataApiError('conflict', 'The active workspace changed in another tab.'));
        return;
      }
      const metaRequest = metaStore.get(workspaceId);
      metaRequest.onsuccess = () => {
        const meta = metaRequest.result as { id: string; commitSequence: number; authoredRevision: number } | undefined;
        if (!meta) { abort(new DataApiError('not-found', 'Workspace metadata is missing.')); return; }
        const run = (index: number) => {
          if (index === operations.length) {
            const commitSequence = meta.commitSequence + 1;
            const authoredRevision = meta.authoredRevision + (options.authored ? 1 : 0);
            metaStore.put({ ...meta, commitSequence, authoredRevision });
            const scopes = [...new Set(options.scopes)];
            tx.objectStore('changeJournal').put({
              workspaceId, commitSequence, scopes, createdAt: Date.now(), authored: options.authored,
            });
            result = { workspaceId, commitSequence, authoredRevision, scopes };
            return;
          }
          const operation = operations[index]!;
          const store = tx.objectStore(operation.store);
          const req = store.get(operation.key);
          req.onsuccess = () => {
            const existing = req.result as IndexedRow | undefined;
            const actualRevision = existing?.revision ?? null;
            if (actualRevision !== operation.expectedRevision) {
              abort(new DataApiError('conflict', 'The record changed in another tab. Reload before saving.'));
              return;
            }
            if (operation.type === 'delete') store.delete(operation.key);
            else store.put({ ...operation.value, revision: (actualRevision ?? 0) + 1 });
            run(index + 1);
          };
        };
        run(0);
      };
    };
    try { await completion; }
    catch (error) { throw failure ?? error; }
    if (!result) throw new DataApiError('unavailable', 'The transaction produced no committed result.');
    this.publish(result, true);
    return result;
  }

  close(): void {
    this.closed = true;
    this.channel?.close();
    this.channel = null;
    this.database?.close();
    this.database = null;
    this.listeners.clear();
  }
}
