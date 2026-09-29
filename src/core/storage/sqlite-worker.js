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
    db.exec(SQLITE_SCHEMA);
    return { db, version: sqlite3.version.libVersion };
  })();
  return databasePromise;
}

async function handle(type, payload) {
  const { db, version } = await openDatabase();
  switch (type) {
    case 'initialize':
      return { sqliteVersion: version, schemaVersion: SQLITE_SCHEMA_VERSION };
    case 'load':
      return loadWorkspaceFromDatabase(db);
    case 'save':
      saveWorkspaceToDatabase(db, payload.workspace);
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
