-- Crypto top-ups (USDT on TRON) share the topups table: how it was paid, the exact
-- amount asked for (in millionths of a USDT) and the blockchain transaction, which
-- can only ever credit one top-up.
ALTER TABLE topups ADD COLUMN method TEXT NOT NULL DEFAULT 'mobile';
ALTER TABLE topups ADD COLUMN crypto_micro INTEGER;
ALTER TABLE topups ADD COLUMN tx_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS topups_tx ON topups (tx_id);
CREATE INDEX IF NOT EXISTS topups_pending_crypto ON topups (method, status, created_at);
