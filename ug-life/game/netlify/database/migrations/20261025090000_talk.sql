-- Street talk (quick phrases, short messages, emotes, voice hellos) and Kampala land.
CREATE TABLE IF NOT EXISTS talk (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  to_id TEXT,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  reports INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS talk_recent ON talk (created_at);
CREATE INDEX IF NOT EXISTS talk_player ON talk (player_id, created_at);

CREATE TABLE IF NOT EXISTS talk_reports (
  talk_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (talk_id, reporter_id)
);

-- Kampala land: one owner per plot, price fixed by the server when sold.
CREATE TABLE IF NOT EXISTS land (
  area TEXT NOT NULL,
  slot INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  paid INTEGER NOT NULL DEFAULT 0,
  bought_at BIGINT NOT NULL,
  PRIMARY KEY (area, slot)
);
CREATE INDEX IF NOT EXISTS land_owner ON land (player_id);
