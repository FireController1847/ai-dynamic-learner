import { GUEST_ID, IDENTITY_DIRECTORY_KEY, MAX_IDENTITY_LABEL, MAX_LOCAL_IDENTITIES,
  readIdentityDirectory, selectedIdentity, type IdentityDirectory } from './local-identities.ts';

/**
 * Browser-native persistence primitives for the Dynamic Learner Data API.
 * No Vue or feature-model dependencies belong in this module.
 *
 * A record's revision is checked in the same readwrite transaction as its
 * update. BroadcastChannel messages only announce committed changes.
 */
export const DATABASE_NAME = 'dynamic-learner-data';
export const DATABASE_VERSION = 3;
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
  solveItTaskSets: { key: ['workspaceId', 'id'] },
  solveItTasks: { key: ['workspaceId', 'setId', 'id'], indexes: { ordered: ['workspaceId', 'setId', 'category', 'position'] } },
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


/**
 * Schema v1 existed during the early preview of this PR without collection
 * rows. Backfill them during the v2 upgrade transaction so a prior preview
 * cannot appear corrupted or become an empty editable workspace.
 */
function backfillV1Collections(transaction: IDBTransaction): void {
  const sources = [
    'workspaceMeta', 'libraryNodes', 'indexCardSets', 'indexCards',
    'reviewSets', 'reviewQuestions', 'todoLists', 'todoSections', 'todoTasks',
  ] as const;
  const data = new Map<string, IndexedRow[]>();
  let outstanding = sources.length;
  for (const source of sources) {
    const request = transaction.objectStore(source).getAll();
    request.onsuccess = () => {
      data.set(source, request.result as IndexedRow[]);
      if (--outstanding !== 0) return;
      try {
        const rows = (name: typeof sources[number], id: string) =>
          (data.get(name) ?? []).filter(row => row.workspaceId === id);
        const store = transaction.objectStore('collections');
        const apps = ['notebook', 'index-cards', 'word-search', 'crossword',
          'guide', 'knowledge-check'];
        const write = (workspaceId: string, app: string, parentId: string, children: string[]) => {
          store.put({ workspaceId, app, parentId, children, revision: 1 });
        };
        const ordered = (values: IndexedRow[]) => values.sort((left, right) =>
          Number(left.position ?? 0) - Number(right.position ?? 0))
          .map(row => String(row.id));
        for (const meta of data.get('workspaceMeta') ?? []) {
          if (typeof meta.id !== 'string') continue;
          const workspaceId = meta.id;
          const nodes = rows('libraryNodes', workspaceId);
          for (const app of apps) {
            const tree = nodes.filter(node => node.app === app);
            const parents = ['@root', ...tree.filter(node => node.kind === 'group').map(node => String(node.id))];
            for (const parent of parents) {
              write(workspaceId, app, parent,
                ordered(tree.filter(node => node.parentKey === parent)));
            }
          }
          for (const entry of rows('indexCardSets', workspaceId)) {
            write(workspaceId, 'index-cards:cards', String(entry.id),
              ordered(rows('indexCards', workspaceId).filter(card => card.setId === entry.id)));
          }
          for (const entry of rows('reviewSets', workspaceId)) {
            write(workspaceId, 'knowledge-check:questions', String(entry.id),
              ordered(rows('reviewQuestions', workspaceId).filter(question => question.setId === entry.id)));
          }
          const lists = rows('todoLists', workspaceId);
          const sections = rows('todoSections', workspaceId);
          const tasks = rows('todoTasks', workspaceId);
          write(workspaceId, 'todo-list', '@root', ordered(lists));
          for (const list of lists) {
            const listSections = sections.filter(section => section.listId === list.id);
            if (list.hasSections || listSections.length) {
              write(workspaceId, 'todo-list:sections', String(list.id), ordered(listSections));
            }
            for (const section of listSections) {
              write(workspaceId, 'todo-list:tasks', String(list.id) + '/' + String(section.id),
                ordered(tasks.filter(task => task.listId === list.id && task.sectionId === section.id)));
            }
          }
        }
      } catch (error) {
        console.error('IndexedDB collection backfill failed; v1 database remains intact.', error);
        transaction.abort();
      }
    };
  }
}

export function openDataDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new DataApiError('unavailable', 'IndexedDB is not available in this browser.'));
  }
  const attempt = (version?: number): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(DATABASE_NAME)
      : indexedDB.open(DATABASE_NAME, version);
    request.onupgradeneeded = event => {
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
      if (event.oldVersion === 1 && request.transaction) {
        backfillV1Collections(request.transaction);
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
  return attempt(DATABASE_VERSION).catch(error => {
    // Browsers refuse version downgrades. Read an existing higher-version
    // database without requesting a schema change, but never create/write
    // with a newer schema using this build.
    if (error instanceof DOMException && error.name === 'VersionError') return attempt();
    throw error;
  });
}

async function captureRawData(database: IDBDatabase): Promise<{
  format: 'dynamic-learner-raw-indexeddb-rescue';
  version: number;
  exportedAt: string;
  stores: Array<{ name: string; keyPath: string | string[] | null;
    keys: IDBValidKey[]; rows: unknown[] }>;
}> {
  const names = Array.from(database.objectStoreNames);
  const tx = database.transaction(names, 'readonly');
  const completion = transactionDone(tx);
  const contents = names.map(async name => {
    const store = tx.objectStore(name);
    const keyPath = store.keyPath;
    const [keys, rows] = await Promise.all([
      requestResult(store.getAllKeys()),
      requestResult(store.getAll()),
    ]);
    return { name, keyPath, keys, rows };
  });
  const stores = await Promise.all(contents);
  await completion;
  return { format: 'dynamic-learner-raw-indexeddb-rescue',
    version: database.version, exportedAt: new Date().toISOString(), stores };
}

/** Rescue bypasses typed schema checks; all stored keys and rows are retained. */
export async function exportRawIndexedDb(): Promise<Awaited<ReturnType<typeof captureRawData>>> {
  const database = await openDataDatabase();
  try { return await captureRawData(database); }
  finally { database.close(); }
}

/** A low-level provider; no app feature may access an IDBTransaction directly. */
export class IndexedDataStore {
  private database: IDBDatabase | null = null;
  private channel: BroadcastChannel | null = null;
  private readonly listeners = new Set<(change: DataChange) => void>();
  private readonly remoteListeners = new Set<(change: DataChange) => void>();
  private readonly unavailableListeners = new Set<(message: string) => void>();
  private closed = false;
  // This connection's last confirmed identity. Blocks stale tabs from writing
  // after another tab transfers ownership without changing workspaceId.
  private observedIdentityId: string | null = null;

  async open(): Promise<void> {
    if (this.closed) throw new DataApiError('unavailable', 'This data connection is closed.');
    if (this.database) return;
    const database = await openDataDatabase();
    if (this.closed) { database.close(); return; }
    // A future build may change the shape of an existing store. In that case
    // even read-only reconstruction with old keys is unsafe to assume.
    for (const [name, definition] of Object.entries(definitions)) {
      if (!database.objectStoreNames.contains(name)) {
        database.close();
        throw new DataApiError('unavailable', 'The database schema is missing a required store: ' + name +
          '. Saved data has not been changed.');
      }
      const tx = database.transaction(name, 'readonly');
      const expected = JSON.stringify(definition.key);
      if (JSON.stringify(tx.objectStore(name).keyPath) !== expected) {
        database.close();
        throw new DataApiError('unavailable', 'The database uses an incompatible key format in ' + name +
          '. Saved data has not been changed.');
      }
    }
    database.onversionchange = () => {
      // Another tab opened a newer schema. This connection cannot accept
      // writes anymore; notify the current editor before closing it.
      for (const listener of this.unavailableListeners) {
        try { listener('Another Dynamic Learner tab upgraded the database. Download your unsaved draft, then reload this page.'); }
        catch (error) { console.error('Database-upgrade listener failed.', error); }
      }
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

  get databaseVersion(): number { return this.db().version; }

  /**
   * Capture ALL existing stores, including ones introduced by a newer branch.
   * This is a forensic backup, not an importable v1 workspace. It never
   * filters unknown fields, inactive workspaces, or extra object stores.
   */
  async rawRescue(): Promise<Awaited<ReturnType<typeof captureRawData>>> {
    return captureRawData(this.db());
  }

  subscribe(listener: (change: DataChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeRemote(listener: (change: DataChange) => void): () => void {
    this.remoteListeners.add(listener);
    return () => this.remoteListeners.delete(listener);
  }

  subscribeUnavailable(listener: (message: string) => void): () => void {
    this.unavailableListeners.add(listener);
    return () => this.unavailableListeners.delete(listener);
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


  /** One-time, lossless adoption of the old single workspace into the guest identity. */
  async ensureIdentityDirectory(): Promise<IdentityDirectory> {
    if (this.databaseVersion > DATABASE_VERSION) {
      const existing = await this.get<unknown>('control', IDENTITY_DIRECTORY_KEY);
      if (existing) return readIdentityDirectory(existing);
      throw new DataApiError('unavailable', 'A newer database must be opened by a compatible build before identities can be initialized.');
    }
    const tx = this.db().transaction(['control', 'workspaceMeta'], 'readwrite');
    const completion = transactionDone(tx);
    const controls = tx.objectStore('control');
    const metadata = tx.objectStore('workspaceMeta');
    let failure: Error | null = null;
    let result: IdentityDirectory | null = null;
    const abort = (reason: string) => {
      failure = new DataApiError('validation', reason);
      tx.abort();
    };
    const pointerRequest = controls.get('local');
    pointerRequest.onsuccess = () => {
      const pointer = (pointerRequest.result as { activeWorkspaceId?: unknown } | undefined)?.activeWorkspaceId;
      if (typeof pointer !== 'string') {
        abort('The active workspace pointer is missing. Existing data has not been modified.');
        return;
      }
      const directoryRequest = controls.get(IDENTITY_DIRECTORY_KEY);
      directoryRequest.onsuccess = () => {
        if (directoryRequest.result !== undefined) {
          try {
            const found = readIdentityDirectory(directoryRequest.result);
            if (selectedIdentity(found).workspaceId !== pointer) {
              abort('The active workspace does not match the selected identity. Reload before editing.');
              return;
            }
            result = found;
          } catch (error) {
            abort(error instanceof Error ? error.message : 'Invalid identity directory.');
          }
          return;
        }
        const allRequest = metadata.getAll();
        allRequest.onsuccess = () => {
          const rows = allRequest.result as Array<{ id: string; ownerId?: unknown }>;
          if (!rows.some(row => row.id === pointer)) {
            abort('The active workspace has no metadata. Saved records remain untouched.');
            return;
          }
          if (rows.some(row => row.ownerId !== undefined && row.ownerId !== GUEST_ID)) {
            abort('Unrecognized existing workspace ownership; no identity migration was applied.');
            return;
          }
          result = { key: IDENTITY_DIRECTORY_KEY, version: 1, activeIdentityId: GUEST_ID,
            identities: [{ id: GUEST_ID, kind: 'guest', label: 'Guest', workspaceId: pointer }] };
          for (const row of rows) metadata.put({ ...row, ownerId: GUEST_ID });
          controls.put(result);
        };
      };
    };
    try { await completion; } catch (error) { throw failure ?? error; }
    const initialized = result as IdentityDirectory | null;
    if (!initialized) throw new DataApiError('unavailable', 'Local identity initialization did not finish.');
    this.observedIdentityId = initialized.activeIdentityId;
    return initialized;
  }

  async identityDirectory(): Promise<IdentityDirectory> {
    const value = await this.get<unknown>('control', IDENTITY_DIRECTORY_KEY);
    if (!value) throw new DataApiError('not-found', 'The local identity directory is missing.');
    return readIdentityDirectory(value);
  }

  adoptIdentityContext(directory: IdentityDirectory): void {
    this.observedIdentityId = selectedIdentity(directory).id;
  }

  /** A single atomic pointer and identity change. Never switch while a local editor is dirty. */
  async selectIdentity(identityId: string, expectedWorkspaceId: string): Promise<IdentityDirectory> {
    if (this.databaseVersion > DATABASE_VERSION) throw new DataApiError('validation', 'This database is newer than this build.');
    const tx = this.db().transaction(['control', 'workspaceMeta'], 'readwrite');
    const completion = transactionDone(tx);
    const controls = tx.objectStore('control');
    const metadata = tx.objectStore('workspaceMeta');
    let failure: Error | null = null;
    let result: IdentityDirectory | null = null;
    const abort = (message: string) => { failure = new DataApiError('conflict', message); tx.abort(); };
    const pointerRequest = controls.get('local');
    pointerRequest.onsuccess = () => {
      const pointer = pointerRequest.result as { key: string; activeWorkspaceId?: string } | undefined;
      if (pointer?.activeWorkspaceId !== expectedWorkspaceId) {
        abort('Another tab switched workspaces. Reload before switching identities.');
        return;
      }
      const directoryRequest = controls.get(IDENTITY_DIRECTORY_KEY);
      directoryRequest.onsuccess = () => {
        let directory: IdentityDirectory;
        try { directory = readIdentityDirectory(directoryRequest.result); }
        catch (error) { abort(error instanceof Error ? error.message : 'Invalid identity directory.'); return; }
        if (selectedIdentity(directory).workspaceId !== expectedWorkspaceId) {
          abort('The selected identity does not own the current workspace.');
          return;
        }
        const target = directory.identities.find(item => item.id === identityId);
        if (!target) { abort('That local identity no longer exists.'); return; }
        const metaRequest = metadata.get(target.workspaceId);
        metaRequest.onsuccess = () => {
          const meta = metaRequest.result as { id: string; ownerId?: string } | undefined;
          if (!meta || meta.ownerId !== target.id) {
            abort('The destination workspace ownership is invalid.');
            return;
          }
          result = { ...directory, activeIdentityId: identityId };
          controls.put({ ...pointer, activeWorkspaceId: target.workspaceId });
          controls.put(result);
        };
      };
    };
    try { await completion; } catch (error) { throw failure ?? error; }
    if (!result) throw new DataApiError('unavailable', 'The identity switch did not complete.');
    const selected = selectedIdentity(result);
    this.observedIdentityId = selected.id;
    const revisions = await this.workspaceRevisions(selected.workspaceId);
    this.publish({ workspaceId: selected.workspaceId, commitSequence: revisions?.commitSequence ?? 0,
      authoredRevision: revisions?.authoredRevision ?? 0,
      scopes: ['identity-changed', 'workspace-replaced'] }, true);
    return result;
  }

  /** Add a device-local identity, optionally transferring the existing guest workspace to it. */
  async createLocalIdentity(
    identityId: string, label: string, stagedWorkspaceId: string,
    expectedWorkspaceId: string, transferGuest: boolean,
  ): Promise<IdentityDirectory> {
    if (this.databaseVersion > DATABASE_VERSION) throw new DataApiError('validation', 'This database is newer than this build.');
    if (identityId === GUEST_ID || !identityId || label.trim().length < 1 ||
      label.length > MAX_IDENTITY_LABEL || stagedWorkspaceId === expectedWorkspaceId) {
      throw new DataApiError('validation', 'Invalid local identity details.');
    }
    const tx = this.db().transaction(['control', 'workspaceMeta'], 'readwrite');
    const completion = transactionDone(tx);
    const controls = tx.objectStore('control');
    const metadata = tx.objectStore('workspaceMeta');
    let failure: Error | null = null;
    let result: IdentityDirectory | null = null;
    let selectedWorkspaceId = stagedWorkspaceId;
    const abort = (message: string) => { failure = new DataApiError('conflict', message); tx.abort(); };
    const pointerRequest = controls.get('local');
    pointerRequest.onsuccess = () => {
      const pointer = pointerRequest.result as { key: string; activeWorkspaceId?: string } | undefined;
      if (pointer?.activeWorkspaceId !== expectedWorkspaceId) {
        abort('Another tab changed the active workspace. Reload before creating an identity.');
        return;
      }
      const directoryRequest = controls.get(IDENTITY_DIRECTORY_KEY);
      directoryRequest.onsuccess = () => {
        let directory: IdentityDirectory;
        try { directory = readIdentityDirectory(directoryRequest.result); }
        catch (error) { abort(error instanceof Error ? error.message : 'Invalid identity directory.'); return; }
        if (selectedIdentity(directory).workspaceId !== expectedWorkspaceId ||
          directory.identities.length >= MAX_LOCAL_IDENTITIES ||
          directory.identities.some(item => item.id === identityId || item.workspaceId === stagedWorkspaceId)) {
          abort('Local identity directory changed or is full.');
          return;
        }
        if (transferGuest && directory.activeIdentityId !== GUEST_ID) {
          abort('Only the active guest workspace can be transferred.');
          return;
        }
        const metaRequest = metadata.getAll();
        metaRequest.onsuccess = () => {
          const rows = metaRequest.result as Array<{ id: string; ownerId?: string; commitSequence?: number; authoredRevision?: number }>;
          if (rows.some(row => row.id === stagedWorkspaceId) ||
            !rows.some(row => row.id === expectedWorkspaceId && row.ownerId === directory.activeIdentityId)) {
            abort('The workspace ownership has changed.');
            return;
          }
          const now = new Date().toISOString();
          const ownerId = transferGuest ? GUEST_ID : identityId;
          metadata.put({ id: stagedWorkspaceId, ownerId, createdAt: now, commitSequence: 0,
            authoredRevision: 0, restoreEpoch: Date.now(), legacyMigration: false });
          const identities = directory.identities.map(item => ({ ...item }));
          if (transferGuest) {
            const guest = identities.find(item => item.id === GUEST_ID);
            if (!guest) { abort('The guest identity is missing.'); return; }
            guest.workspaceId = stagedWorkspaceId;
            for (const row of rows) {
              if (row.ownerId === GUEST_ID) metadata.put({ ...row, ownerId: identityId });
            }
            selectedWorkspaceId = expectedWorkspaceId;
          }
          identities.push({ id: identityId, kind: 'local', label: label.trim(), workspaceId: selectedWorkspaceId });
          result = { ...directory, activeIdentityId: identityId, identities };
          controls.put({ ...pointer, activeWorkspaceId: selectedWorkspaceId });
          controls.put(result);
        };
      };
    };
    try { await completion; } catch (error) { throw failure ?? error; }
    if (!result) throw new DataApiError('unavailable', 'Local identity creation did not complete.');
    this.observedIdentityId = identityId;
    const revisions = await this.workspaceRevisions(selectedWorkspaceId);
    this.publish({ workspaceId: selectedWorkspaceId, commitSequence: revisions?.commitSequence ?? 0,
      authoredRevision: revisions?.authoredRevision ?? 0,
      scopes: ['identity-changed', 'workspace-replaced'] }, true);
    return result;
  }


  /** Rename only a local identity label; the workspace and profile are unchanged. */
  async renameLocalIdentity(id: string, label: string, expectedLabel: string,
    activeWorkspaceId: string): Promise<IdentityDirectory> {
    if (this.databaseVersion > DATABASE_VERSION) throw new DataApiError('validation', 'A newer database cannot be modified.');
    const name = label.trim();
    if (id === GUEST_ID || !name || name.length > MAX_IDENTITY_LABEL) {
      throw new DataApiError('validation', 'Enter a local identity name of up to 64 characters.');
    }
    const tx = this.db().transaction('control', 'readwrite');
    const done = transactionDone(tx);
    const control = tx.objectStore('control');
    let result: IdentityDirectory | null = null;
    let failure: Error | null = null;
    const abort = (message: string) => { failure = new DataApiError('conflict', message); tx.abort(); };
    const pointer = control.get('local');
    pointer.onsuccess = () => {
      if ((pointer.result as { activeWorkspaceId?: string } | undefined)?.activeWorkspaceId !== activeWorkspaceId) {
        abort('Another tab switched workspaces. Reload before renaming.');
        return;
      }
      const request = control.get(IDENTITY_DIRECTORY_KEY);
      request.onsuccess = () => {
        let directory: IdentityDirectory;
        try { directory = readIdentityDirectory(request.result); }
        catch (error) { abort(error instanceof Error ? error.message : 'Invalid identity directory.'); return; }
        if (directory.activeIdentityId !== this.observedIdentityId ||
            selectedIdentity(directory).workspaceId !== activeWorkspaceId) {
          abort('The selected identity changed in another tab.');
          return;
        }
        const identity = directory.identities.find(item => item.id === id);
        if (!identity || identity.kind !== 'local' || identity.label !== expectedLabel) {
          abort('This identity was renamed or removed in another tab.');
          return;
        }
        result = { ...directory, identities: directory.identities.map(item =>
          item.id === id ? { ...item, label: name } : item) };
        control.put(result);
      };
    };
    try { await done; } catch (error) { throw failure ?? error; }
    const directory = result as IdentityDirectory | null;
    if (!directory) throw new DataApiError('unavailable', 'The identity rename did not complete.');
    const revisions = await this.workspaceRevisions(activeWorkspaceId);
    this.publish({ workspaceId: activeWorkspaceId, commitSequence: revisions?.commitSequence ?? 0,
      authoredRevision: revisions?.authoredRevision ?? 0, scopes: ['identity-directory-changed'] }, true);
    return directory;
  }

  /** Permanently delete an inactive non-Guest identity and only its known workspace generations. */
  async deleteLocalIdentity(id: string, expectedTargetWorkspaceId: string,
    activeWorkspaceId: string): Promise<IdentityDirectory> {
    if (id === GUEST_ID || id === this.observedIdentityId ||
        this.databaseVersion !== DATABASE_VERSION ||
        this.db().objectStoreNames.length !== Object.keys(definitions).length) {
      throw new DataApiError('validation', 'This identity cannot safely be deleted.');
    }
    const stores = Object.keys(definitions) as DataStoreName[];
    const tx = this.db().transaction(stores, 'readwrite');
    const done = transactionDone(tx);
    const control = tx.objectStore('control');
    const meta = tx.objectStore('workspaceMeta');
    let result: IdentityDirectory | null = null;
    let failure: Error | null = null;
    const abort = (message: string) => { failure = new DataApiError('conflict', message); tx.abort(); };
    const pointer = control.get('local');
    pointer.onsuccess = () => {
      if ((pointer.result as { activeWorkspaceId?: string } | undefined)?.activeWorkspaceId !== activeWorkspaceId) {
        abort('Another tab switched workspaces. Reload before deleting.');
        return;
      }
      const request = control.get(IDENTITY_DIRECTORY_KEY);
      request.onsuccess = () => {
        let directory: IdentityDirectory;
        try { directory = readIdentityDirectory(request.result); }
        catch (error) { abort(error instanceof Error ? error.message : 'Invalid identity directory.'); return; }
        if (directory.activeIdentityId !== this.observedIdentityId ||
            selectedIdentity(directory).workspaceId !== activeWorkspaceId) {
          abort('The active identity changed in another tab.');
          return;
        }
        const target = directory.identities.find(item => item.id === id);
        if (!target || target.kind !== 'local' || target.id === directory.activeIdentityId ||
          target.workspaceId !== expectedTargetWorkspaceId) {
          abort('This identity changed in another tab. Reload before deleting.');
          return;
        }
        const requestMetas = meta.getAll();
        requestMetas.onsuccess = () => {
          const all = requestMetas.result as Array<{ id: string; ownerId?: string }>;
          const owned = all.filter(row => row.ownerId === id).map(row => row.id);
          if (!owned.includes(target.workspaceId) ||
              all.some(row => row.id === target.workspaceId && row.ownerId !== id)) {
            abort('The identity workspace ownership is inconsistent. Nothing was deleted.');
            return;
          }
          for (const workspaceId of owned) {
            for (const storeName of stores) {
              if (storeName === 'control') continue;
              const store = tx.objectStore(storeName);
              if (storeName === 'workspaceMeta' || storeName === 'statisticsMeta') store.delete(workspaceId);
              else store.delete(IDBKeyRange.bound([workspaceId], [workspaceId, []]));
            }
          }
          result = { ...directory, identities: directory.identities.filter(item => item.id !== id) };
          control.put(result);
        };
      };
    };
    try { await done; } catch (error) { throw failure ?? error; }
    const directory = result as IdentityDirectory | null;
    if (!directory) throw new DataApiError('unavailable', 'The identity removal did not finish.');
    const revisions = await this.workspaceRevisions(activeWorkspaceId);
    this.publish({ workspaceId: activeWorkspaceId, commitSequence: revisions?.commitSequence ?? 0,
      authoredRevision: revisions?.authoredRevision ?? 0, scopes: ['identity-directory-changed'] }, true);
    return directory;
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
      const dirRequest = controlStore.get(IDENTITY_DIRECTORY_KEY);
      dirRequest.onsuccess = () => {
        let ownerId = GUEST_ID;
        if (dirRequest.result !== undefined) {
          let directory: IdentityDirectory;
          try { directory = readIdentityDirectory(dirRequest.result); }
          catch (error) {
            failure = error instanceof Error ? error : new Error('Invalid identity directory.');
            tx.abort(); return;
          }
          const active = selectedIdentity(directory);
          if (active.workspaceId !== expectedWorkspaceId) {
            failure = new DataApiError('conflict', 'The identity changed while restoring the workspace.');
            tx.abort(); return;
          }
          ownerId = active.id;
          controlStore.put({ ...directory, identities: directory.identities.map(item =>
            item.id === ownerId ? { ...item, workspaceId } : item) });
        }
        controlStore.put({ key: 'local', activeWorkspaceId: workspaceId });
        tx.objectStore('workspaceMeta').put({
          id: workspaceId, ownerId, createdAt: initializedAt, commitSequence: 0,
          authoredRevision: 0, restoreEpoch: Date.now(), legacyMigration: true,
        });
      };
    };
    try { await completion; }
    catch (error) { throw failure ?? error; }
    this.publish({ workspaceId, commitSequence: 0, authoredRevision: 0, scopes: ['workspace-replaced'] }, true);
  }

  /**
   * User-confirmed destructive reset for the selected identity only. Clear its
   * workspace generations in the transaction that installs a new empty workspace.
   * Other identities and unrecognized records are preserved on failure or success.
   */
  async clearAndActivate(
    workspaceId: string, expectedWorkspaceId: string | null,
    rows: readonly Extract<DataOperation, { type: 'put' }>[],
  ): Promise<void> {
    if (this.databaseVersion > DATABASE_VERSION ||
        this.db().objectStoreNames.length !== Object.keys(definitions).length) {
      throw new DataApiError('validation', 'A newer or unrecognized database cannot be cleared by this build.');
    }
    for (const row of rows) {
      if (row.value.workspaceId !== workspaceId ||
          ['control', 'workspaceMeta', 'changeJournal'].includes(row.store)) {
        throw new DataApiError('validation', 'The empty workspace contains an invalid storage row.');
      }
    }
    const names = Object.keys(definitions) as DataStoreName[];
    const tx = this.db().transaction(names, 'readwrite');
    const completion = transactionDone(tx);
    let failure: Error | null = null;
    const request = tx.objectStore('control').get('local');
    request.onsuccess = () => {
      const current = (request.result as { activeWorkspaceId?: string } | undefined)?.activeWorkspaceId ?? null;
      if (current !== expectedWorkspaceId) {
        failure = new DataApiError('conflict', 'Another tab replaced the workspace. Reload before clearing it.');
        tx.abort();
        return;
      }
      const dirRequest = tx.objectStore('control').get(IDENTITY_DIRECTORY_KEY);
      dirRequest.onsuccess = () => {
        let directory: IdentityDirectory;
        try { directory = readIdentityDirectory(dirRequest.result); }
        catch (error) {
          failure = error instanceof Error ? error : new Error('Invalid identity directory.');
          tx.abort(); return;
        }
        const active = selectedIdentity(directory);
        if (active.workspaceId !== expectedWorkspaceId) {
          failure = new DataApiError('conflict', 'The selected identity changed. Reload before clearing.');
          tx.abort(); return;
        }
        const metaRequest = tx.objectStore('workspaceMeta').getAll();
        metaRequest.onsuccess = () => {
          const metas = metaRequest.result as Array<{ id: string; ownerId?: string }>;
          const owned = metas.filter(meta => meta.ownerId === active.id).map(meta => meta.id);
          if (!expectedWorkspaceId || !owned.includes(expectedWorkspaceId)) {
            failure = new DataApiError('validation', 'The active workspace is not owned by this identity.');
            tx.abort(); return;
          }
          // Delete this identity's generations only. Never wipe other identities
          // or unknown/orphan records while performing an ordinary reset.
          for (const id of owned) {
            for (const name of names) {
              if (name === 'control') continue;
              const store = tx.objectStore(name);
              if (name === 'workspaceMeta' || name === 'statisticsMeta') store.delete(id);
              else store.delete(IDBKeyRange.bound([id], [id, []]));
            }
          }
          for (const row of rows) tx.objectStore(row.store).put({ ...row.value, revision: 1 });
          tx.objectStore('control').put({ key: 'local', activeWorkspaceId: workspaceId });
          tx.objectStore('control').put({ ...directory, identities: directory.identities.map(item =>
            item.id === active.id ? { ...item, workspaceId } : item) });
          tx.objectStore('workspaceMeta').put({
            id: workspaceId, ownerId: active.id, createdAt: new Date().toISOString(), commitSequence: 0,
            authoredRevision: 0, restoreEpoch: Date.now(), legacyMigration: false,
          });
        };
      };
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
    if (this.databaseVersion > DATABASE_VERSION) {
      throw new DataApiError('validation', 'This database was upgraded by a newer build; editing is disabled.');
    }
    if (!operations.length) throw new DataApiError('validation', 'A transaction needs at least one operation.');
    for (const operation of operations) {
      if (['control', 'workspaceMeta', 'changeJournal'].includes(operation.store)) {
        throw new DataApiError('validation', 'Internal database control records cannot be modified by entity commands.');
      }
      const key = operation.key;
      const scoped = Array.isArray(key) ? key[0] === workspaceId : key === workspaceId;
      if (!scoped) throw new DataApiError('validation', 'The mutation references a different workspace.');
      if (operation.type === 'put' || operation.type === 'increment') {
        if (operation.value.workspaceId !== workspaceId) {
          throw new DataApiError('validation', 'A mutation cannot change the record workspace.');
        }
        // Object stores use inline keyPaths; put(value) derives its key from
        // the value. Guard against checking one row's revision and silently
        // writing a different row when a command supplies mismatched fields.
        const embeddedKey = dataPrimaryKey(operation.store, operation.value);
        if (JSON.stringify(embeddedKey) !== JSON.stringify(key)) {
          throw new DataApiError('validation', 'A record primary key does not match its mutation target.');
        }
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
      const identityRequest = tx.objectStore('control').get(IDENTITY_DIRECTORY_KEY);
      identityRequest.onsuccess = () => {
        let directory: IdentityDirectory;
        try { directory = readIdentityDirectory(identityRequest.result); }
        catch (error) {
          abort(error instanceof Error ? error : new Error('Invalid identity directory.'));
          return;
        }
        if (directory.activeIdentityId !== this.observedIdentityId ||
          selectedIdentity(directory).workspaceId !== workspaceId) {
          abort(new DataApiError('conflict', 'The active identity changed in another tab.'));
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
    this.unavailableListeners.clear();
  }
}
