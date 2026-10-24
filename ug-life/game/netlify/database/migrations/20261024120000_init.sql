-- Ug Life database on Netlify (Postgres). Same tables as migrations/0001_init.sql (D1);
-- photo bytes live in Netlify Blobs instead of a table.

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  tag_json TEXT NOT NULL DEFAULT '{}',
  look_json TEXT NOT NULL DEFAULT '{}',
  level INTEGER NOT NULL DEFAULT 1,
  balance BIGINT NOT NULL DEFAULT 0,
  pos_x DOUBLE PRECISION NOT NULL DEFAULT 3.5,
  pos_y DOUBLE PRECISION NOT NULL DEFAULT 11.5,
  kiosk_json TEXT,
  save_json TEXT,
  save_version INTEGER NOT NULL DEFAULT 0,
  ghost INTEGER NOT NULL DEFAULT 0,
  frozen INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL
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
  created_at BIGINT NOT NULL,
  reviewed_at BIGINT
);
CREATE INDEX IF NOT EXISTS photos_status ON photos (status, created_at DESC);
CREATE INDEX IF NOT EXISTS photos_player ON photos (player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  player_id TEXT,
  category TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'P2',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'escalated', 'closed')),
  reply TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS tickets_status ON tickets (status, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT,
  target TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS flags (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  player_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, bucket, day)
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO config (key, value) VALUES
  ('maintenance_mode', 'false'),
  ('uploads_enabled', 'true'),
  ('signups_enabled', 'true'),
  ('announcement', '')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS events (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);
