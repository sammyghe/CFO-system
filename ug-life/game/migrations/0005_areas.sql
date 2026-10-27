-- Kampala areas: which area a player is in, and which area a message was said in.
ALTER TABLE players ADD COLUMN area TEXT NOT NULL DEFAULT 'wandegeya';
ALTER TABLE talk ADD COLUMN area TEXT NOT NULL DEFAULT 'wandegeya';
CREATE INDEX IF NOT EXISTS players_area ON players (area, last_seen);

-- Friends between real players (a request until the other accepts) and private messages between friends.
CREATE TABLE IF NOT EXISTS friends (
  player_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, friend_id)
);
CREATE INDEX IF NOT EXISTS friends_to ON friends (friend_id, status);

CREATE TABLE IF NOT EXISTS dms (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS dms_pair ON dms (to_id, from_id, created_at);

-- Weekly street chairperson elections, one per area.
CREATE TABLE IF NOT EXISTS candidates (
  week TEXT NOT NULL,
  area TEXT NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slogan TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (week, area, player_id)
);

CREATE TABLE IF NOT EXISTS election_votes (
  week TEXT NOT NULL,
  area TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (week, area, voter_id)
);

-- How each player's life started: 'nepo' (born rich) or 'hustler' (from scratch), picked by the server.
ALTER TABLE players ADD COLUMN start TEXT NOT NULL DEFAULT '';
