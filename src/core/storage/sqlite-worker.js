import sqlite3InitModule from 'https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.53.4-build1/dist/index.mjs';
import { SQLITE_SCHEMA, SQLITE_SCHEMA_VERSION } from './sqlite-schema.js';
import { loadWorkspaceFromDatabase, saveWorkspaceToDatabase } from './workspace-database.js';

let databasePromise = null;

async function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = (async () => {
    const sqlite3 = await sqlite3InitModule();
    const pool = await sqlite3.installOpfsSAHPoolVfs({
      directory: '/dynamic-learner',
      initialCapacity: 6,
    });
    const db = new pool.OpfsSAHPoolDb('/dynamic-learner.sqlite3');
    const storedSchemaVersion = Number(db.selectValue('PRAGMA user_version') ?? 0);
    if (storedSchemaVersion !== 0 && storedSchemaVersion !== SQLITE_SCHEMA_VERSION) {
      db.close();
      throw new Error(
        `This workspace database uses schema version ${storedSchemaVersion}; this build supports version ${SQLITE_SCHEMA_VERSION}.`,
      );
    }
    db.exec(SQLITE_SCHEMA);

    let workspaceId = db.selectValue(
      "SELECT value FROM storage_metadata WHERE key = 'active_workspace_id' LIMIT 1",
    );
    if (!workspaceId) {
      workspaceId = crypto.randomUUID();
      db.exec({
        sql: 'INSERT INTO storage_metadata (key, value) VALUES (?, ?)',
        bind: ['active_workspace_id', workspaceId],
      });
    }

    return { db, workspaceId, version: sqlite3.version.libVersion };
  })();
  return databasePromise;
}

async function handle(type, payload) {
  const { db, workspaceId, version } = await openDatabase();
  switch (type) {
    case 'initialize':
      return { sqliteVersion: version, schemaVersion: SQLITE_SCHEMA_VERSION, workspaceId };
    case 'load':
      return loadWorkspaceFromDatabase(db, workspaceId);
    case 'save':
      saveWorkspaceToDatabase(db, payload.workspace, workspaceId);
      return null;
    default:
      throw new Error(`Unsupported SQLite worker operation: ${type}`);
  }
}

// Serialize application-level operations even though message handlers may await.
// This also guarantees that a load posted after a save sees the committed save.
let operationChain = Promise.resolve();

self.onmessage = (event) => {
  const { id, type, payload = {} } = event.data ?? {};
  operationChain = operationChain
    .then(async () => {
      try {
        const result = await handle(type, payload);
        self.postMessage({ id, ok: true, result });
      } catch (problem) {
        self.postMessage({
          id,
          ok: false,
          error: problem?.message || String(problem),
        });
      }
    });
};
