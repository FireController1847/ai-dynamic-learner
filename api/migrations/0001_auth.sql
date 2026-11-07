-- Remote identity only. Learning records remain in each browser's IndexedDB.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS password_credentials (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_identities (
  provider TEXT NOT NULL CHECK(provider IN ('google','microsoft')),
  subject TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(provider,subject)
);
CREATE INDEX IF NOT EXISTS oauth_account_idx ON oauth_identities(account_id);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_session_account_idx ON auth_sessions(account_id);
CREATE INDEX IF NOT EXISTS auth_session_expiry_idx ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_actions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('verify','reset')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_action_expiry_idx ON auth_actions(expires_at);
CREATE TABLE IF NOT EXISTS oauth_requests (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('google','microsoft')),
  code_verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_request_expiry_idx ON oauth_requests(expires_at);
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_rate_expiry_idx ON auth_rate_limits(reset_at);
-- Reserved for a future explicit, server-confirmed linking flow.
-- This is NOT a permission to read or sync any workspace.
CREATE TABLE IF NOT EXISTS account_workspace_links (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  local_workspace_id TEXT NOT NULL,
  linked_at INTEGER NOT NULL,
  PRIMARY KEY(account_id,local_workspace_id)
);
