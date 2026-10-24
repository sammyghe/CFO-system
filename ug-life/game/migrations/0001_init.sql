-- Ug Life database (Cloudflare D1, SQLite). Apply with:
--   npx wrangler d1 migrations apply ug-life-db --remote
-- Money rules live in functions/api (validated on every sync) and src/game (shared code).

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  tag_json TEXT NOT NULL DEFAULT '{}',
  look_json TEXT NOT NULL DEFAULT '{}',
  level INTEGER NOT NULL DEFAULT 1,
  balance INTEGER NOT NULL DEFAULT 0,
  pos_x REAL NOT NULL DEFAULT 3.5,
  pos_y REAL NOT NULL DEFAULT 11.5,
  kiosk_json TEXT,
  save_json TEXT,
  save_version INTEGER NOT NULL DEFAULT 0,
  ghost INTEGER NOT NULL DEFAULT 0,
  frozen INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_last_seen ON players (last_seen DESC);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  author TEXT NOT NULL,
  area TEXT NOT NULL,
  place TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  featured INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);
CREATE INDEX IF NOT EXISTS photos_status ON photos (status, created_at DESC);
CREATE INDEX IF NOT EXISTS photos_player ON photos (player_id, created_at DESC);

-- Image bytes. Kept apart from the photos table so listing never loads images.
-- Swap for R2 later by changing functions/api/_lib/photostore.ts only.
CREATE TABLE IF NOT EXISTS photo_blobs (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  player_id TEXT,
  category TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'P2',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'escalated', 'closed')),
  reply TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tickets_status ON tickets (status, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT,
  target TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);

-- Economy watchdog findings, written automatically when a sync breaks a rule.
CREATE TABLE IF NOT EXISTS flags (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  player_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, bucket, day)
);

-- Switches the agents and Sammy can flip without a deploy.
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO config (key, value) VALUES
  ('maintenance_mode', 'false'),
  ('uploads_enabled', 'true'),
  ('signups_enabled', 'true'),
  ('announcement', '');

CREATE TABLE IF NOT EXISTS events (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);
