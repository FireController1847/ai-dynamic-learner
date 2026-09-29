// Client-side relational schema for the canonical Dynamic Learner workspace.
// Keep this browser-neutral: the worker owns SQLite initialization and execution.
export const SQLITE_SCHEMA_VERSION = 1;

export const SQLITE_SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;

CREATE TABLE IF NOT EXISTS storage_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL CHECK (format = 'dynamic-learner'),
  format_version INTEGER NOT NULL CHECK (format_version = 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS notebook_state (
  workspace_id TEXT PRIMARY KEY
    REFERENCES workspaces(id) ON DELETE CASCADE,
  selection_present INTEGER NOT NULL DEFAULT 0 CHECK (selection_present IN (0, 1)),
  last_selected_document_id TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS notebook_items (
  workspace_id TEXT NOT NULL
    REFERENCES workspaces(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  parent_id TEXT,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('group', 'document')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  document_type TEXT CHECK (document_type IN ('markdown', 'lined', 'graph')),
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, parent_id)
    REFERENCES notebook_items(workspace_id, id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  CHECK (
    (kind = 'group' AND document_type IS NULL) OR
    (kind = 'document' AND document_type IS NOT NULL)
  )
) STRICT;

CREATE INDEX IF NOT EXISTS ix_notebook_items_parent_order
  ON notebook_items(workspace_id, parent_id, sort_order);

CREATE TABLE IF NOT EXISTS notebook_markdown (
  workspace_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  markdown TEXT NOT NULL,
  PRIMARY KEY (workspace_id, item_id),
  FOREIGN KEY (workspace_id, item_id)
    REFERENCES notebook_items(workspace_id, id) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS index_card_state (
  workspace_id TEXT PRIMARY KEY
    REFERENCES workspaces(id) ON DELETE CASCADE,
  selection_present INTEGER NOT NULL DEFAULT 0 CHECK (selection_present IN (0, 1)),
  last_selected_set_id TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS index_card_items (
  workspace_id TEXT NOT NULL
    REFERENCES workspaces(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  parent_id TEXT,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('group', 'set')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, parent_id)
    REFERENCES index_card_items(workspace_id, id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE INDEX IF NOT EXISTS ix_index_card_items_parent_order
  ON index_card_items(workspace_id, parent_id, sort_order);

CREATE TABLE IF NOT EXISTS index_cards (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  set_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  title TEXT CHECK (title IS NULL OR length(title) <= 120),
  back_title TEXT CHECK (back_title IS NULL OR length(back_title) <= 120),
  front TEXT NOT NULL CHECK (length(front) <= 2000),
  back TEXT NOT NULL CHECK (length(back) <= 2000),
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, set_id)
    REFERENCES index_card_items(workspace_id, id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS ix_index_cards_set_order
  ON index_cards(workspace_id, set_id, sort_order);

CREATE TABLE IF NOT EXISTS index_card_display (
  workspace_id TEXT PRIMARY KEY
    REFERENCES workspaces(id) ON DELETE CASCADE,
  font TEXT NOT NULL CHECK (font IN ('serif', 'sans')),
  text_size INTEGER NOT NULL CHECK (
    text_size BETWEEN 80 AND 130 AND (text_size - 80) % 5 = 0
  ),
  card_size INTEGER NOT NULL CHECK (
    card_size BETWEEN 75 AND 125 AND (card_size - 75) % 5 = 0
  ),
  ink TEXT NOT NULL CHECK (ink IN ('pencil', 'dark', 'black')),
  baseline INTEGER NOT NULL CHECK (baseline BETWEEN -4 AND 6)
) STRICT;

CREATE TABLE IF NOT EXISTS word_search_items (
  workspace_id TEXT NOT NULL
    REFERENCES workspaces(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  parent_id TEXT,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('group', 'word-search')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, parent_id)
    REFERENCES word_search_items(workspace_id, id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE INDEX IF NOT EXISTS ix_word_search_items_parent_order
  ON word_search_items(workspace_id, parent_id, sort_order);

CREATE TABLE IF NOT EXISTS word_search_display (
  workspace_id TEXT PRIMARY KEY
    REFERENCES workspaces(id) ON DELETE CASCADE,
  font TEXT NOT NULL CHECK (font IN ('mono', 'sans', 'serif')),
  weight TEXT CHECK (weight IS NULL OR weight IN ('regular', 'medium', 'semibold', 'bold')),
  text_size INTEGER NOT NULL CHECK (
    text_size BETWEEN 85 AND 125 AND (text_size - 85) % 5 = 0
  ),
  cell_size INTEGER NOT NULL CHECK (
    cell_size = 28 OR (cell_size BETWEEN 30 AND 48 AND (cell_size - 30) % 2 = 0)
  ),
  fit TEXT NOT NULL CHECK (fit IN ('screen', 'preferred')),
  highlight TEXT NOT NULL CHECK (highlight IN ('blue', 'green', 'purple')),
  motion TEXT NOT NULL CHECK (motion IN ('smooth', 'none'))
) STRICT;

CREATE TABLE IF NOT EXISTS word_search_puzzles (
  workspace_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size IN (10, 15, 20, 24)),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  instructions TEXT NOT NULL CHECK (length(instructions) <= 500),
  study_mode TEXT CHECK (study_mode IS NULL OR study_mode IN ('words', 'hints')),
  hints_present INTEGER NOT NULL DEFAULT 0 CHECK (hints_present IN (0, 1)),
  PRIMARY KEY (workspace_id, item_id),
  FOREIGN KEY (workspace_id, item_id)
    REFERENCES word_search_items(workspace_id, id) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS word_search_words (
  workspace_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  word TEXT NOT NULL CHECK (
    length(word) BETWEEN 2 AND 24 AND word NOT GLOB '*[^A-Z]*'
  ),
  sort_order INTEGER NOT NULL CHECK (sort_order BETWEEN 0 AND 39),
  hint TEXT CHECK (hint IS NULL OR length(hint) <= 240),
  PRIMARY KEY (workspace_id, item_id, word),
  UNIQUE (workspace_id, item_id, sort_order),
  FOREIGN KEY (workspace_id, item_id)
    REFERENCES word_search_puzzles(workspace_id, item_id) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS word_search_games (
  workspace_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  PRIMARY KEY (workspace_id, item_id),
  FOREIGN KEY (workspace_id, item_id)
    REFERENCES word_search_puzzles(workspace_id, item_id) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS word_search_game_rows (
  workspace_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  row_index INTEGER NOT NULL CHECK (row_index BETWEEN 0 AND 23),
  letters TEXT NOT NULL CHECK (
    length(letters) BETWEEN 1 AND 24 AND letters NOT GLOB '*[^A-Z]*'
  ),
  PRIMARY KEY (workspace_id, item_id, row_index),
  FOREIGN KEY (workspace_id, item_id)
    REFERENCES word_search_games(workspace_id, item_id) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS word_search_game_placements (
  workspace_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  word TEXT NOT NULL,
  start_cell INTEGER NOT NULL CHECK (start_cell BETWEEN 0 AND 575),
  end_cell INTEGER NOT NULL CHECK (end_cell BETWEEN 0 AND 575),
  PRIMARY KEY (workspace_id, item_id, word),
  FOREIGN KEY (workspace_id, item_id)
    REFERENCES word_search_games(workspace_id, item_id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, item_id, word)
    REFERENCES word_search_words(workspace_id, item_id, word) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS word_search_game_found (
  workspace_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  word TEXT NOT NULL,
  start_cell INTEGER NOT NULL CHECK (start_cell BETWEEN 0 AND 575),
  end_cell INTEGER NOT NULL CHECK (end_cell BETWEEN 0 AND 575),
  PRIMARY KEY (workspace_id, item_id, word),
  FOREIGN KEY (workspace_id, item_id)
    REFERENCES word_search_games(workspace_id, item_id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, item_id, word)
    REFERENCES word_search_words(workspace_id, item_id, word) ON DELETE CASCADE
) STRICT;

PRAGMA user_version = ${SQLITE_SCHEMA_VERSION};
`;
