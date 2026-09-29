// Relational row descriptors and main-thread delta calculation.
// Rows retain references to scalar values (including large strings) so unchanged
// document contents are compared without copying them across the Worker boundary.

export const LIST_TABLES = Object.freeze([
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
]);

export const SINGLETONS = Object.freeze([
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
]);

export const DELETE_ORDER = Object.freeze([
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
]);

function rowKey(row, keys) {
  return keys.map((key) => String(row[key])).join('\u001f');
}

function rowsEqual(left, right, columns) {
  if (left === right) return true;
  if (!left || !right) return left === right;
  return columns.every((column) => left[column] === right[column]);
}

export function createWorkspaceDelta(previous, next) {
  const replace = previous === null;
  const singletonChanges = [];
  const listChanges = [];

  for (const descriptor of SINGLETONS) {
    const before = previous?.[descriptor.source] ?? null;
    const after = next[descriptor.source] ?? null;
    if (replace || !rowsEqual(before, after, descriptor.columns)) {
      singletonChanges.push({ source: descriptor.source, row: after });
    }
  }

  for (const descriptor of LIST_TABLES) {
    const before = previous?.[descriptor.source] ?? [];
    const after = next[descriptor.source] ?? [];
    const beforeByKey = new Map(before.map((row) => [rowKey(row, descriptor.keys), row]));
    const afterKeys = new Set();
    const upserts = [];

    for (const row of after) {
      const key = rowKey(row, descriptor.keys);
      afterKeys.add(key);
      const existing = beforeByKey.get(key);
      if (replace || !existing || !rowsEqual(existing, row, descriptor.columns)) {
        upserts.push(row);
      }
    }

    const deletes = replace ? [] : before
      .filter((row) => !afterKeys.has(rowKey(row, descriptor.keys)))
      .map((row) => descriptor.keys.map((key) => row[key]));

    if (replace || upserts.length || deletes.length) {
      listChanges.push({ source: descriptor.source, upserts, deletes });
    }
  }

  return { replace, singletonChanges, listChanges };
}

export function isWorkspaceDeltaEmpty(delta) {
  return !delta.replace && !delta.singletonChanges.length && !delta.listChanges.length;
}
