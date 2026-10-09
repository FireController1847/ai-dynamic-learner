/**
 * Browser-native persistence primitives for the Dynamic Learner Data API.
 * No Vue or feature-model dependencies belong in this module.
 *
 * A record's revision is checked in the same readwrite transaction as its
 * update. BroadcastChannel messages only announce committed changes.
 */
export const DATABASE_NAME = 'dynamic-learner-data';
export const DATABASE_VERSION = 2;
export const CHANNEL_NAME = 'dynamic-learner.data.v1';

const definitions = {
  control: { key: 'key' },
  workspaceMeta: { key: 'id' },
  libraryNodes: { key: ['workspaceId', 'app', 'id'], indexes: { siblings: ['workspaceId', 'app', 'parentKey', 'position'] } },
  collections: { key: ['workspaceId', 'app', 'parentId'] },
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
export function dataPrimaryKey(store: DataStoreName, row: IndexedRow): IDBValidKey {
  const keyPath: string | readonly string[] = definitions[store].key;
  const keys = typeof keyPath === 'string' ? [keyPath] : [...keyPath];
  const values = keys.map(key => row[key]);
  if (values.some(value => typeof value !== 'string' && typeof value !== 'number')) {
    throw new DataApiError('validation', 'A database row has an invalid primary key.');
  }
  return typeof keyPath === 'string' ? values[0] as IDBValidKey : values as IDBValidKey;
}

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
  | { store: DataStoreName; type: 'delete'; key: IDBValidKey; expectedRevision: number | null }
  | { store: DataStoreName; type: 'assert'; key: IDBValidKey; expectedRevision: number | null }
  | { store: DataStoreName; type: 'exists'; key: IDBValidKey }
  | { store: 'statisticsApps' | 'statisticsEntries'; type: 'increment';
      key: IDBValidKey; value: IndexedRow; delta: Record<string, number> };

export class DataApiError extends Error {
  readonly code: 'conflict' | 'unavailable' | 'upgrade-blocked' | 'not-found' | 'validation';
  constructor(code: 'conflict' | 'unavailable' | 'upgrade-blocked' | 'not-found' | 'validation', message: string) {
    super(message);
    this.code = code;
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
    let blocked = false;
    request.onblocked = () => {
      blocked = true;
      reject(new DataApiError('upgrade-blocked', 'Close other Dynamic Learner tabs to finish the database upgrade.'));
    };
    request.onerror = () => reject(request.error ?? new DataApiError('unavailable', 'Unable to open IndexedDB.'));
    request.onsuccess = () => {
      if (blocked) request.result.close(); // Avoid leaking an open handle after a rejected upgrade.
      else resolve(request.result);
    };
  });
}

/** A low-level provider; no app feature may access an IDBTransaction directly. */
export class IndexedDataStore {
  private database: IDBDatabase | null = null;
  private channel: BroadcastChannel | null = null;
  private readonly listeners = new Set<(change: DataChange) => void>();
  private readonly remoteListeners = new Set<(change: DataChange) => void>();
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

  subscribeRemote(listener: (change: DataChange) => void): () => void {
    this.remoteListeners.add(listener);
    return () => this.remoteListeners.delete(listener);
  }

  private publish(change: DataChange, broadcast: boolean) {
    // A notification is best-effort and happens after the transaction commits.
    // A subscriber exception must never turn a durable write into a reported
    // failure; callers would otherwise retry using a stale record revision.
    for (const listener of this.listeners) {
      try { listener(change); } catch (error) { console.error('Data change subscriber failed.', error); }
    }
    if (!broadcast) for (const listener of this.remoteListeners) {
      try { listener(change); } catch (error) { console.error('Remote data subscriber failed.', error); }
    }
    if (broadcast) {
      try { this.channel?.postMessage(change); }
      catch (error) { console.warn('Cross-tab notification unavailable; resume reconciliation will recover.', error); }
    }
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

  /**
   * Read every requested store from one snapshot transaction. Separate
   * readonly transactions can observe different commits from other tabs.
   */
  async snapshot<T>(stores: readonly DataStoreName[], workspaceId?: string): Promise<Map<DataStoreName, T[]>> {
    const names = [...new Set(stores)];
    const tx = this.db().transaction(names, 'readonly');
    const completion = transactionDone(tx);
    const data = new Map<DataStoreName, T[]>();
    const results = names.map(async name => {
      const keyPath: string | readonly string[] = definitions[name].key;
      let range: IDBKeyRange | undefined;
      if (workspaceId && keyPath === 'workspaceId') {
        range = IDBKeyRange.only(workspaceId);
      } else if (workspaceId && Array.isArray(keyPath) && keyPath[0] === 'workspaceId') {
        // IndexedDB string keys sort before array keys, so this bounds
        // every composite key beginning with the requested workspaceId.
        range = IDBKeyRange.bound([workspaceId], [workspaceId, []]);
      }
      const records = await requestResult(tx.objectStore(name).getAll(range));
      data.set(name, records as T[]);
    });
    await Promise.all([...results, completion]);
    return data;
  }

  async activeWorkspaceId(): Promise<string | null> {
    const control = await this.get<{ activeWorkspaceId: string }>('control', 'local');
    return control?.activeWorkspaceId ?? null;
  }

  async workspaceRevisions(workspaceId: string): Promise<{ commitSequence: number; authoredRevision: number } | null> {
    const meta = await this.get<{ commitSequence: number; authoredRevision: number }>('workspaceMeta', workspaceId);
    return meta ? { commitSequence: meta.commitSequence, authoredRevision: meta.authoredRevision } : null;
  }

  /** Recover missed messages by reading the durable bounded change journal. */
  async changesAfter(workspaceId: string, sequence: number): Promise<DataChange[] | null> {
    const meta = await this.workspaceRevisions(workspaceId);
    if (!meta) throw new DataApiError('not-found', 'Workspace metadata is missing.');
    if (meta.commitSequence <= sequence) return [];
    const events = await this.all<{
      commitSequence: number; scopes: string[]; authored: boolean;
    }>('changeJournal', IDBKeyRange.bound([workspaceId, sequence + 1], [workspaceId, '\uffff']));
    if (events.length === 0 || events[0]?.commitSequence !== sequence + 1 ||
        events.at(-1)?.commitSequence !== meta.commitSequence) return null;
    return events.map(event => ({ workspaceId, commitSequence: event.commitSequence,
      authoredRevision: meta.authoredRevision, scopes: event.scopes }));
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
      for (const operation of batch) tx.objectStore(operation.store).put({ ...operation.value, revision: 1 });
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
    for (const operation of operations) {
      if (['control', 'workspaceMeta', 'changeJournal'].includes(operation.store)) {
        throw new DataApiError('validation', 'Internal database control records cannot be modified by entity commands.');
      }
      const key = operation.key;
      const scoped = Array.isArray(key) ? key[0] === workspaceId : key === workspaceId;
      if (!scoped) throw new DataApiError('validation', 'The mutation references a different workspace.');
      if ((operation.type === 'put' || operation.type === 'increment') && operation.value.workspaceId !== workspaceId) {
        throw new DataApiError('validation', 'A mutation cannot change the record workspace.');
      }
    }
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
            // Bound on-disk history without scanning the whole journal.
            if (commitSequence > 1000) tx.objectStore('changeJournal').delete([workspaceId, commitSequence - 1000]);
            result = { workspaceId, commitSequence, authoredRevision, scopes };
            return;
          }
          const operation = operations[index]!;
          const store = tx.objectStore(operation.store);
          const req = store.get(operation.key);
          req.onsuccess = () => {
            const existing = req.result as IndexedRow | undefined;
            if (operation.type === 'exists') {
              if (!existing) {
                abort(new DataApiError('not-found', 'The parent entry was removed in another tab.'));
                return;
              }
              run(index + 1);
              return;
            }
            const actualRevision = existing?.revision ?? null;
            if (operation.type === 'increment') {
              const previousCounts = existing?.counts && typeof existing.counts === 'object' &&
                !Array.isArray(existing.counts) ? existing.counts as Record<string, unknown> : {};
              const counts: Record<string, number> = { ...previousCounts } as Record<string, number>;
              for (const [metric, amount] of Object.entries(operation.delta)) {
                if (!Number.isSafeInteger(amount) || amount < 0) {
                  abort(new DataApiError('validation', 'Statistics changes must be nonnegative whole numbers.'));
                  return;
                }
                const previous = counts[metric] ?? 0;
                if (!Number.isSafeInteger(previous) || previous < 0) {
                  abort(new DataApiError('validation', 'Existing statistics are invalid.'));
                  return;
                }
                counts[metric] = Math.min(Number.MAX_SAFE_INTEGER, previous + amount);
              }
              const incoming = operation.value.lastActivityAt;
              const earlier = existing?.lastActivityAt;
              const lastActivityAt = typeof incoming === 'string' && typeof earlier === 'string'
                ? (incoming > earlier ? incoming : earlier)
                : (incoming ?? earlier);
              store.put({ ...(existing ?? {}), ...operation.value, counts,
                ...(lastActivityAt !== undefined ? { lastActivityAt } : {}),
                revision: (actualRevision ?? 0) + 1 });
              run(index + 1);
              return;
            }
            if (actualRevision !== operation.expectedRevision) {
              abort(new DataApiError('conflict', 'The record changed in another tab. Reload before saving.'));
              return;
            }
            if (operation.type === 'delete') store.delete(operation.key);
            else if (operation.type === 'put') store.put({ ...operation.value, revision: (actualRevision ?? 0) + 1 });
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
    this.remoteListeners.clear();
  }
}
