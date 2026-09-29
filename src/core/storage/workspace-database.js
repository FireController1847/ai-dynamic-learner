import { rowsToWorkspace } from './workspace-relational.js';
import { DELETE_ORDER, LIST_TABLES, SINGLETONS } from './workspace-delta.js';

const LIST_BY_SOURCE = new Map(LIST_TABLES.map((descriptor) => [descriptor.source, descriptor]));
const LIST_BY_TABLE = new Map(LIST_TABLES.map((descriptor) => [descriptor.table, descriptor]));
const SINGLETON_BY_SOURCE = new Map(SINGLETONS.map((descriptor) => [descriptor.source, descriptor]));

function upsertSql(descriptor) {
  const allColumns = ['workspace_id', ...descriptor.columns];
  const conflict = ['workspace_id', ...descriptor.keys];
  const updates = descriptor.columns.filter((column) => !descriptor.keys.includes(column));
  const placeholders = allColumns.map(() => '?').join(', ');
  const base = `INSERT INTO ${descriptor.table} (${allColumns.join(', ')}) VALUES (${placeholders})`;
  if (!updates.length) return `${base} ON CONFLICT (${conflict.join(', ')}) DO NOTHING`;

  const assignments = updates.map((column) => `${column} = excluded.${column}`).join(', ');
  return `${base} ON CONFLICT (${conflict.join(', ')}) DO UPDATE SET ${assignments}`;
}

function upsertSingleton(db, workspaceId, descriptor, row) {
  if (!row) {
    db.exec({ sql: `DELETE FROM ${descriptor.table} WHERE workspace_id = ?`, bind: [workspaceId] });
    return;
  }

  const columns = ['workspace_id', ...descriptor.columns];
  const updates = descriptor.columns.map((column) => `${column} = excluded.${column}`).join(', ');
  db.exec({
    sql: `INSERT INTO ${descriptor.table} (${columns.join(', ')})
      VALUES (${columns.map(() => '?').join(', ')})
      ON CONFLICT (workspace_id) DO UPDATE SET ${updates}`,
    bind: [workspaceId, ...descriptor.columns.map((column) => row[column])],
  });
}

function upsertRows(db, workspaceId, descriptor, rows) {
  if (!rows.length) return;
  const sql = upsertSql(descriptor);
  for (const row of rows) {
    db.exec({
      sql,
      bind: [workspaceId, ...descriptor.columns.map((column) => row[column])],
    });
  }
}

function deleteRows(db, workspaceId, descriptor, keys) {
  if (!keys.length) return;
  const where = descriptor.keys.map((key) => `${key} = ?`).join(' AND ');
  const sql = `DELETE FROM ${descriptor.table} WHERE workspace_id = ? AND ${where}`;
  for (const values of keys) db.exec({ sql, bind: [workspaceId, ...values] });
}

function writeWorkspaceHeader(db, workspaceId, replace) {
  if (replace) {
    db.exec({ sql: 'DELETE FROM workspaces WHERE id = ?', bind: [workspaceId] });
  }
  db.exec({
    sql: `INSERT INTO workspaces (id, format, format_version)
      VALUES (?, 'dynamic-learner', 1)
      ON CONFLICT (id) DO UPDATE SET
        format = excluded.format,
        format_version = excluded.format_version,
        updated_at = CURRENT_TIMESTAMP`,
    bind: [workspaceId],
  });
}

export function applyWorkspaceDelta(db, delta, workspaceId) {
  db.transaction(() => {
    writeWorkspaceHeader(db, workspaceId, delta.replace);

    for (const change of delta.singletonChanges) {
      const descriptor = SINGLETON_BY_SOURCE.get(change.source);
      if (!descriptor) throw new Error(`Unknown workspace singleton source: ${change.source}`);
      upsertSingleton(db, workspaceId, descriptor, change.row);
    }

    const changesByTable = new Map();
    for (const change of delta.listChanges) {
      const descriptor = LIST_BY_SOURCE.get(change.source);
      if (!descriptor) throw new Error(`Unknown workspace list source: ${change.source}`);
      changesByTable.set(descriptor.table, change);
      upsertRows(db, workspaceId, descriptor, change.upserts);
    }

    if (!delta.replace) {
      for (const table of DELETE_ORDER) {
        const change = changesByTable.get(table);
        if (change?.deletes.length) {
          deleteRows(db, workspaceId, LIST_BY_TABLE.get(table), change.deletes);
        }
      }
    }
  });
}

function selectAll(db, table, workspaceId) {
  return db.selectObjects(`SELECT * FROM ${table} WHERE workspace_id = ?`, [workspaceId]);
}

function selectOne(db, table, workspaceId) {
  return db.selectObjects(`SELECT * FROM ${table} WHERE workspace_id = ? LIMIT 1`, [workspaceId])[0] ?? null;
}

export function loadWorkspaceFromDatabase(db, workspaceId) {
  const header = db.selectObjects(
    'SELECT format, format_version FROM workspaces WHERE id = ? LIMIT 1',
    [workspaceId],
  )[0] ?? null;
  if (!header) return null;
  if (header.format !== 'dynamic-learner' || header.format_version !== 1) {
    throw new Error('The database contains an unsupported Dynamic Learner workspace format.');
  }

  return rowsToWorkspace({
    notebookState: selectOne(db, 'notebook_state', workspaceId),
    notebookItems: selectAll(db, 'notebook_items', workspaceId),
    notebookMarkdown: selectAll(db, 'notebook_markdown', workspaceId),
    indexCardState: selectOne(db, 'index_card_state', workspaceId),
    indexCardItems: selectAll(db, 'index_card_items', workspaceId),
    indexCards: selectAll(db, 'index_cards', workspaceId),
    indexCardDisplay: selectOne(db, 'index_card_display', workspaceId),
    wordSearchItems: selectAll(db, 'word_search_items', workspaceId),
    wordSearchDisplay: selectOne(db, 'word_search_display', workspaceId),
    wordSearchPuzzles: selectAll(db, 'word_search_puzzles', workspaceId),
    wordSearchWords: selectAll(db, 'word_search_words', workspaceId),
    wordSearchGames: selectAll(db, 'word_search_games', workspaceId),
    wordSearchGameRows: selectAll(db, 'word_search_game_rows', workspaceId),
    wordSearchPlacements: selectAll(db, 'word_search_game_placements', workspaceId),
    wordSearchFound: selectAll(db, 'word_search_game_found', workspaceId),
  });
}
