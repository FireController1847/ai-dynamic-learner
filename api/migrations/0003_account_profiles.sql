-- Account-owned, synchronized profile metadata. Authentication email is separate
-- from optional profile contact email and cannot be changed here.
CREATE TABLE IF NOT EXISTS account_profiles (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  about TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  avatar_data_url TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
