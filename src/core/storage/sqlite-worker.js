import sqlite3InitModule from 'https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.53.4-build1/dist/index.mjs';
import { gzipCompress, gzipDecompress } from './gzip.js';
import { SQLITE_SCHEMA, SQLITE_SCHEMA_VERSION } from './sqlite-schema.js';
import { applyWorkspaceDelta, loadWorkspaceFromDatabase } from './workspace-database.js';

const DATABASE_FILENAME = '/dynamic-learner.sqlite3';
const BACKUP_DATABASE_FILENAME = '/dynamic-learner-backup.sqlite3';

let databasePromise = null;
let backupPoolPromise = null;
let deltaRecoveryRequired = false;

async function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = (async () => {
    const sqlite3 = await sqlite3InitModule();
    const pool = await sqlite3.installOpfsSAHPoolVfs({
      directory: '/dynamic-learner',
      initialCapacity: 6,
    });
    const db = new pool.OpfsSAHPoolDb(DATABASE_FILENAME);
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

    return { db, pool, sqlite3, workspaceId, version: sqlite3.version.libVersion };
  })();
  return databasePromise;
}

async function openBackupPool(sqlite3) {
  if (!backupPoolPromise) {
    backupPoolPromise = sqlite3.installOpfsSAHPoolVfs({
      name: 'dynamic-learner-backup-reader',
      directory: '/dynamic-learner-backup-reader',
      initialCapacity: 4,
      clearOnInit: true,
    });
  }
  return backupPoolPromise;
}

async function inspectBackup(sqlite3, compressedBytes) {
  const rawBuffer = await gzipDecompress(compressedBytes);
  const pool = await openBackupPool(sqlite3);
  pool.unlink(BACKUP_DATABASE_FILENAME);

  let db = null;
  try {
    await pool.importDb(BACKUP_DATABASE_FILENAME, new Uint8Array(rawBuffer));
    db = new pool.OpfsSAHPoolDb(BACKUP_DATABASE_FILENAME);
    const integrity = db.selectValue('PRAGMA integrity_check');
    if (integrity !== 'ok') throw new Error('The SQLite backup failed its integrity check.');
    if (db.selectObjects('PRAGMA foreign_key_check').length) {
      throw new Error('The SQLite backup contains broken relational references.');
    }

    const schemaVersion = Number(db.selectValue('PRAGMA user_version') ?? 0);
    if (schemaVersion !== SQLITE_SCHEMA_VERSION) {
      throw new Error(
        `This backup uses SQLite schema version ${schemaVersion}; this build supports version ${SQLITE_SCHEMA_VERSION}.`,
      );
    }

    const workspaceId = db.selectValue(
      "SELECT value FROM storage_metadata WHERE key = 'active_workspace_id' LIMIT 1",
    );
    if (typeof workspaceId !== 'string' || !workspaceId) {
      throw new Error('The SQLite backup does not contain a valid Dynamic Learner workspace identity.');
    }

    const workspace = loadWorkspaceFromDatabase(db, workspaceId);
    if (!workspace) throw new Error('The SQLite backup does not contain a Dynamic Learner workspace.');
    return workspace;
  } finally {
    db?.close();
    pool.unlink(BACKUP_DATABASE_FILENAME);
  }
}

async function handle(type, payload) {
  const { db, pool, sqlite3, workspaceId, version } = await openDatabase();
  switch (type) {
    case 'initialize':
      return { sqliteVersion: version, schemaVersion: SQLITE_SCHEMA_VERSION, workspaceId };
    case 'load':
      return loadWorkspaceFromDatabase(db, workspaceId);
    case 'save-delta':
      if (deltaRecoveryRequired && !payload.delta?.replace) {
        throw new Error('A previous SQLite save failed; a complete workspace retry is required.');
      }
      try {
        applyWorkspaceDelta(db, payload.delta, workspaceId);
        deltaRecoveryRequired = false;
        return null;
      } catch (problem) {
        deltaRecoveryRequired = true;
        throw problem;
      }
    case 'export-backup':
      return gzipCompress(await pool.exportFile(DATABASE_FILENAME));
    case 'inspect-backup':
      return inspectBackup(sqlite3, payload.bytes);
    default:
      throw new Error(`Unsupported SQLite worker operation: ${type}`);
  }
}

// Serialize application-level operations so backup exports cannot race writes and
// a load posted after a save always observes the committed save.
let operationChain = Promise.resolve();

self.onmessage = (event) => {
  const { id, type, payload = {} } = event.data ?? {};
  operationChain = operationChain.then(async () => {
    try {
      const result = await handle(type, payload);
      if (result instanceof ArrayBuffer) {
        self.postMessage({ id, ok: true, result }, [result]);
      } else {
        self.postMessage({ id, ok: true, result });
      }
    } catch (problem) {
      self.postMessage({
        id,
        ok: false,
        error: problem?.message || String(problem),
      });
    }
  });
};
