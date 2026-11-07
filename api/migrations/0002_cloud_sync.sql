-- Authenticated cloud workspace snapshots; publication is guarded by
-- per-account compare-and-swap revisions. Data remains device-local until
-- the verified account explicitly opts into cloud sync.
CREATE TABLE IF NOT EXISTS cloud_sync_heads (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0,
  upload_id TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cloud_sync_uploads (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expected_revision INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  total_units INTEGER NOT NULL,
  digest TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  published_at INTEGER
);
CREATE INDEX IF NOT EXISTS cloud_sync_uploads_owner_idx ON cloud_sync_uploads(account_id,published_at);
CREATE TABLE IF NOT EXISTS cloud_sync_chunks (
  upload_id TEXT NOT NULL REFERENCES cloud_sync_uploads(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  units INTEGER NOT NULL,
  PRIMARY KEY(upload_id,chunk_index)
);
