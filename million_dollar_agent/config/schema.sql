-- Maji Safi US$1M campaign store. Mirrors the new Sheet tabs; sits beside the Money Desk.
-- Status is derived from the append-only events table.

CREATE TABLE IF NOT EXISTS targets (
  target_id        TEXT PRIMARY KEY,
  full_name        TEXT NOT NULL,
  role             TEXT,
  organisation     TEXT,
  tier             TEXT CHECK (tier IN ('T1','T2','T3','T4','T5')),
  region_lane      TEXT,          -- US, EU/UK, Gulf, China/HK/SG, India, Africa, Israel
  wealth_band      TEXT,
  wealth_source    TEXT,
  wealth_as_of     DATE,
  preferred_language TEXT DEFAULT 'en',
  language_evidence TEXT,
  narrative        TEXT CHECK (narrative IN ('B','I')),  -- Builder or Impact, never both
  score            INTEGER,
  queue            TEXT,          -- ASK, RESEARCH_MORE, HOLD
  lane             TEXT NOT NULL DEFAULT 'USD1M',
  last_refreshed   DATE
);

CREATE TABLE IF NOT EXISTS evidence (
  evidence_id  TEXT PRIMARY KEY,
  target_id    TEXT REFERENCES targets(target_id),
  kind         TEXT,              -- wealth, investment, gift, hook, role, contact
  claim        TEXT NOT NULL,
  url          TEXT NOT NULL,
  accessed_on  DATE NOT NULL,
  excerpt      TEXT,
  confidence   TEXT CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  is_inference INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contact_routes (
  route_id     TEXT PRIMARY KEY,
  target_id    TEXT REFERENCES targets(target_id),
  address      TEXT NOT NULL,
  route_class  TEXT CHECK (route_class IN
    ('DIRECT_PUBLIC','OFFICE_PUBLIC','INTRODUCTION','FORM','UNVERIFIED','BOUNCED','SUPPRESSED')),
  source_url   TEXT,
  found_on     DATE,
  addressed_to TEXT                -- named person when going through an office
);

CREATE TABLE IF NOT EXISTS events (
  event_id     TEXT PRIMARY KEY,
  target_id    TEXT REFERENCES targets(target_id),
  at           TIMESTAMP NOT NULL,
  kind         TEXT NOT NULL,     -- SENT, FOLLOW_UP, REPLY, BOUNCE, MEETING, REFERRAL, STAGE, LEDGER, SUPPRESS
  actor        TEXT NOT NULL,     -- agent name or 'human:<name>'
  payload      TEXT,              -- JSON
  thread_id    TEXT,
  template_id  TEXT,
  arm_id       TEXT,
  policy_version INTEGER
);

CREATE TABLE IF NOT EXISTS suppression (
  key          TEXT PRIMARY KEY,  -- email address, person id or org domain
  reason       TEXT CHECK (reason IN ('OPT_OUT','DECLINE','HARD_BOUNCE','COMPLAINT','LEGAL')),
  at           TIMESTAMP NOT NULL,
  source_event TEXT
);

CREATE TABLE IF NOT EXISTS funding_cases (
  case_id      TEXT PRIMARY KEY,
  target_id    TEXT REFERENCES targets(target_id),
  instrument   TEXT,
  amount_usd   NUMERIC,
  stage        TEXT,              -- ASKED .. IMPACT_VERIFIED
  conditions   TEXT,
  restricted   INTEGER DEFAULT 0,
  reconciled_by TEXT,             -- human only
  bank_ref     TEXT
);

CREATE TABLE IF NOT EXISTS experiments (
  arm_id       TEXT PRIMARY KEY,
  experiment   TEXT,
  segment      TEXT,              -- tier|lane|route
  sends        INTEGER DEFAULT 0,
  reward_sum   NUMERIC DEFAULT 0,
  failures     INTEGER DEFAULT 0,
  status       TEXT DEFAULT 'TESTING'
);

CREATE TABLE IF NOT EXISTS lessons (
  lesson_id    TEXT PRIMARY KEY,
  at           DATE,
  lesson       TEXT,
  proof        TEXT,
  use_it_how   TEXT,
  status       TEXT CHECK (status IN ('HYPOTHESIS','TESTING','ADOPT','REJECT','INSUFFICIENT_DATA')),
  sample_size  INTEGER
);

CREATE TABLE IF NOT EXISTS impact_ledger (
  entry_id     TEXT PRIMARY KEY,
  site         TEXT,
  measure      TEXT,
  value        NUMERIC,
  evidence     TEXT,
  measured_on  DATE,
  verified_by  TEXT
);
