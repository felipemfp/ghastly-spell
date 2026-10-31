CREATE TABLE matches (
  id               TEXT PRIMARY KEY,
  home             TEXT NOT NULL,
  away             TEXT NOT NULL,
  home_slug        TEXT NOT NULL,
  away_slug        TEXT NOT NULL,
  competition      TEXT NOT NULL,
  kickoff_date_brt TEXT NOT NULL,
  kickoff_utc      TEXT,
  channels         TEXT NOT NULL,
  first_seen_at    TEXT NOT NULL,
  last_seen_at     TEXT NOT NULL,
  missing_runs     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX matches_home ON matches (home_slug, kickoff_date_brt);
CREATE INDEX matches_away ON matches (away_slug, kickoff_date_brt);

CREATE TABLE channel_overrides (
  match_id         TEXT PRIMARY KEY REFERENCES matches(id),
  channels         TEXT NOT NULL,
  scraped_snapshot TEXT NOT NULL,
  confirmations    INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT NOT NULL
);
