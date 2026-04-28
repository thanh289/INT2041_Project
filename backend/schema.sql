-- Minimal schema matching current C# behavior (username-only auth)
-- Relationships:
-- users (1) <-> (1) conversation_histories (unique user_id)
-- conversation_histories (1) <-> (n) messages

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_histories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_history_id INTEGER NOT NULL,
  sender_type INTEGER NOT NULL CHECK (sender_type IN (0, 1)),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_history_id) REFERENCES conversation_histories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_history_created
  ON messages(conversation_history_id, created_at);
