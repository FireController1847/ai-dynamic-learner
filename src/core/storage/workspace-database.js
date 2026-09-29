import { workspaceToRows, rowsToWorkspace } from './workspace-relational.js';


const LIST_TABLES = [
  {
    table: 'notebook_items',
    source: 'notebookItems',
    columns: ['id', 'parent_id', 'sort_order', 'kind', 'name', 'document_type'],
    keys: ['id'],
  },
  {
    table: 'notebook_markdown',
    source: 'notebookMarkdown',
    columns: ['item_id', 'markdown'],
    keys: ['item_id'],
  },
  {
    table: 'index_card_items',
    source: 'indexCardItems',
    columns: ['id', 'parent_id', 'sort_order', 'kind', 'name'],
    keys: ['id'],
  },
  {
    table: 'index_cards',
    source: 'indexCards',
    columns: ['id', 'set_id', 'sort_order', 'title', 'back_title', 'front', 'back'],
    keys: ['id'],
  },
  {
    table: 'word_search_items',
    source: 'wordSearchItems',
    columns: ['id', 'parent_id', 'sort_order', 'kind', 'name', 'board_rotation'],
    keys: ['id'],
  },
  {
    table: 'word_search_puzzles',
    source: 'wordSearchPuzzles',
    columns: ['item_id', 'size', 'difficulty', 'instructions', 'study_mode', 'hints_present'],
    keys: ['item_id'],
  },
  {
    table: 'word_search_words',
    source: 'wordSearchWords',
    columns: ['item_id', 'word', 'sort_order', 'hint'],
    keys: ['item_id', 'word'],
  },
  {
    table: 'word_search_games',
    source: 'wordSearchGames',
    columns: ['item_id'],
    keys: ['item_id'],
  },
  {
    table: 'word_search_game_rows',
    source: 'wordSearchGameRows',
    columns: ['item_id', 'row_index', 'letters'],
    keys: ['item_id', 'row_index'],
  },
  {
    table: 'word_search_game_placements',
    source: 'wordSearchPlacements',
    columns: ['item_id', 'word', 'sort_order', 'start_cell', 'end_cell'],
    keys: ['item_id', 'word'],
  },
  {
    table: 'word_search_game_found',
    source: 'wordSearchFound',
    columns: ['item_id', 'word', 'sort_order', 'start_cell', 'end_cell'],
    keys: ['item_id', 'word'],
  },
];

const DELETE_ORDER = [
  'word_search_game_found',
  'word_search_game_placements',
  'word_search_game_rows',
  'word_search_games',
  'word_search_words',
  'word_search_puzzles',
  'word_search_items',
  'index_cards',
  'index_card_items',
  'notebook_markdown',
  'notebook_items',
];

const SINGLETONS = [
  {
    table: 'notebook_state',
    source: 'notebookState',
    columns: ['selection_present', 'last_selected_document_id'],
  },
  {
    table: 'index_card_state',
    source: 'indexCardState',
    columns: ['selection_present', 'last_selected_set_id'],
  },
  {
    table: 'index_card_display',
    source: 'indexCardDisplay',
    columns: ['font', 'text_size', 'card_size', 'ink', 'baseline'],
  },
  {
    table: 'word_search_display',
    source: 'wordSearchDisplay',
    columns: ['font', 'weight', 'text_size', 'cell_size', 'fit', 'highlight', 'motion'],
  },
];

function keyFor(row, columns) {
  return columns.map((column) => String(row[column])).join('\u001f');
}

function keyExpression(columns) {
  return columns.map((column) => `CAST(${column} AS TEXT)`).join(" || char(31) || ");
}

function upsertSql(descriptor) {
  const allColumns = ['workspace_id', ...descriptor.columns];
  const conflict = ['workspace_id', ...descriptor.keys];
  const updates = descriptor.columns.filter((column) => !descriptor.keys.includes(column));
  const placeholders = allColumns.map(() => '?').join(', ');
  const base = `INSERT INTO ${descriptor.table} (${allColumns.join(', ')}) VALUES (${placeholders})`;
  if (!updates.length) return `${base} ON CONFLICT (${conflict.join(', ')}) DO NOTHING`;

  const assignments = updates.map((column) => `${column} = excluded.${column}`).join(', ');
  const changed = updates
    .map((column) => `${descriptor.table}.${column} IS NOT excluded.${column}`)
    .join(' OR ');
  return `${base} ON CONFLICT (${conflict.join(', ')}) DO UPDATE SET ${assignments} WHERE ${changed}`;
}

function upsertSingleton(db, workspaceId, descriptor, row) {
  if (!row) {
    db.exec({ sql: `DELETE FROM ${descriptor.table} WHERE workspace_id = ?`, bind: [workspaceId] });
    return;
  }
  const columns = ['workspace_id', ...descriptor.columns];
  const updates = descriptor.columns.map((column) => `${column} = excluded.${column}`).join(', ');
  const changed = descriptor.columns
    .map((column) => `${descriptor.table}.${column} IS NOT excluded.${column}`)
    .join(' OR ');
  db.exec({
    sql: `INSERT INTO ${descriptor.table} (${columns.join(', ')})
      VALUES (${columns.map(() => '?').join(', ')})
      ON CONFLICT (workspace_id) DO UPDATE SET ${updates} WHERE ${changed}`,
    bind: [workspaceId, ...descriptor.columns.map((column) => row[column])],
  });
}

function writeList(db, workspaceId, descriptor, list) {
  const sql = upsertSql(descriptor);
  for (const row of list) {
    db.exec({
      sql,
      bind: [workspaceId, ...descriptor.columns.map((column) => row[column])],
    });
    db.exec({
      sql: 'INSERT OR IGNORE INTO save_seen (table_name, row_key) VALUES (?, ?)',
      bind: [descriptor.table, keyFor(row, descriptor.keys)],
    });
  }
}

function deleteMissing(db, workspaceId, descriptor) {
  db.exec({
    sql: `DELETE FROM ${descriptor.table}
      WHERE workspace_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM save_seen
          WHERE table_name = ?
            AND row_key = ${keyExpression(descriptor.keys)}
        )`,
    bind: [workspaceId, descriptor.table],
  });
}

export function saveWorkspaceToDatabase(db, workspace, workspaceId) {
  const rows = workspaceToRows(workspace);
  const descriptorsByTable = new Map(LIST_TABLES.map((descriptor) => [descriptor.table, descriptor]));

  db.transaction(() => {
    db.exec({
      sql: `INSERT INTO workspaces (id, format, format_version)
        VALUES (?, 'dynamic-learner', 1)
        ON CONFLICT (id) DO UPDATE SET
          format = excluded.format,
          format_version = excluded.format_version,
          updated_at = CURRENT_TIMESTAMP`,
      bind: [workspaceId],
    });

    db.exec(`CREATE TEMP TABLE IF NOT EXISTS save_seen (
      table_name TEXT NOT NULL,
      row_key TEXT NOT NULL,
      PRIMARY KEY (table_name, row_key)
    ) WITHOUT ROWID`);
    db.exec('DELETE FROM save_seen');

    for (const descriptor of SINGLETONS) {
      upsertSingleton(db, workspaceId, descriptor, rows[descriptor.source]);
    }
    for (const descriptor of LIST_TABLES) {
      writeList(db, workspaceId, descriptor, rows[descriptor.source]);
    }
    for (const table of DELETE_ORDER) {
      deleteMissing(db, workspaceId, descriptorsByTable.get(table));
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
