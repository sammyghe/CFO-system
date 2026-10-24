-- Shared kiosk plots (one owner at a time, seen by everyone) and friend referrals.
ALTER TABLE players ADD COLUMN referred_by TEXT;

CREATE TABLE IF NOT EXISTS plots (
  plot_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  kiosk_json TEXT,
  leased_until INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS plot_claims (
  player_id TEXT NOT NULL,
  plot_id TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, plot_id, day)
);

CREATE TABLE IF NOT EXISTS referrals (
  referred_id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  qualified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS referrals_referrer ON referrals (referrer_id, qualified);
