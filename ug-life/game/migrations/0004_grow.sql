-- Billboards, community (ideas, votes, news, events) and mobile money top-ups.
-- Billboards: player rentals (paid in game money) and brand ads booked by the admin.
CREATE TABLE IF NOT EXISTS billboards (
  slot TEXT NOT NULL,
  kind TEXT NOT NULL,
  owner_id TEXT,
  owner_name TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  sub TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL,
  link TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL DEFAULT '',
  paid INTEGER NOT NULL DEFAULT 0,
  until INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (slot, kind)
);

-- Community: player proposals and votes, the admin's news posts, and live events.
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  votes INTEGER NOT NULL DEFAULT 0,
  reports INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS proposals_status ON proposals (status, votes);

CREATE TABLE IF NOT EXISTS votes (
  proposal_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (proposal_id, player_id)
);

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS live_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  reward INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS event_attendance (
  event_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, player_id)
);

-- Mobile money top-ups (one way: no cash-out). Credited only after the provider confirms.
CREATE TABLE IF NOT EXISTS topups (
  ref TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  pack TEXT NOT NULL,
  price INTEGER NOT NULL,
  credit INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX IF NOT EXISTS topups_player ON topups (player_id, status);
