PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_versions (
  version TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  pin_hash_version TEXT NOT NULL,
  pin_hash_parameters TEXT NOT NULL,
  recovery_email TEXT,
  failed_attempt_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS profiles (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT 'moon',
  locale TEXT NOT NULL DEFAULT 'ur-Roman' CHECK(locale IN ('ur-Roman','en')),
  reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK(reduced_motion IN (0,1)),
  accessible_confirmation INTEGER NOT NULL DEFAULT 0 CHECK(accessible_confirmation IN (0,1)),
  text_scale REAL NOT NULL DEFAULT 1.0 CHECK(text_scale BETWEEN 1.0 AND 2.0),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_digest TEXT NOT NULL UNIQUE,
  csrf_digest TEXT NOT NULL,
  active_room_code_hmac TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  invalidated_at INTEGER,
  user_agent_hash TEXT,
  ip_prefix_hash TEXT
);

CREATE TABLE IF NOT EXISTS recovery_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_digest TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS room_codes (
  code_lookup_hmac TEXT PRIMARY KEY,
  lookup_key_version TEXT NOT NULL,
  durable_object_id TEXT NOT NULL UNIQUE,
  creator_account_id TEXT NOT NULL REFERENCES accounts(id),
  invite_digest TEXT NOT NULL,
  invite_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK(status IN ('lobby','active','complete','expired','abandoned')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  failed_join_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS connection_tickets (
  id TEXT PRIMARY KEY,
  ticket_digest TEXT NOT NULL UNIQUE,
  durable_object_id TEXT NOT NULL,
  code_lookup_hmac TEXT NOT NULL REFERENCES room_codes(code_lookup_hmac) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  room_member_id TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  client_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS completed_matches (
  match_id TEXT NOT NULL,
  archive_version TEXT NOT NULL,
  room_code_hmac TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  winner TEXT NOT NULL CHECK(winner IN ('mafia','civilian')),
  rounds INTEGER NOT NULL,
  archive_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(match_id,archive_version)
);

CREATE TABLE IF NOT EXISTS completed_match_players (
  match_id TEXT NOT NULL,
  archive_version TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('mafia','civilian')),
  won INTEGER NOT NULL CHECK(won IN (0,1)),
  outcome_json TEXT NOT NULL,
  PRIMARY KEY(match_id,archive_version,account_id),
  FOREIGN KEY(match_id,archive_version) REFERENCES completed_matches(match_id,archive_version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS completed_public_events (
  match_id TEXT NOT NULL,
  archive_version TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL,
  PRIMARY KEY(match_id,archive_version,sequence),
  FOREIGN KEY(match_id,archive_version) REFERENCES completed_matches(match_id,archive_version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS completed_votes (
  match_id TEXT NOT NULL,
  archive_version TEXT NOT NULL,
  round INTEGER NOT NULL,
  voter_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  runoff INTEGER NOT NULL CHECK(runoff IN (0,1)),
  PRIMARY KEY(match_id,archive_version,round,voter_account_id,runoff),
  FOREIGN KEY(match_id,archive_version) REFERENCES completed_matches(match_id,archive_version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS completed_predictions (
  match_id TEXT NOT NULL,
  archive_version TEXT NOT NULL,
  round INTEGER NOT NULL,
  actor_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('night','vote')),
  target_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  actual_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  correct INTEGER NOT NULL CHECK(correct IN (0,1)),
  PRIMARY KEY(match_id,archive_version,round,actor_account_id,kind),
  FOREIGN KEY(match_id,archive_version) REFERENCES completed_matches(match_id,archive_version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_statistics (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  mafia_games INTEGER NOT NULL DEFAULT 0,
  civilian_games INTEGER NOT NULL DEFAULT 0,
  predictions_correct INTEGER NOT NULL DEFAULT 0,
  predictions_total INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);


CREATE TABLE IF NOT EXISTS statistics_applications (
  match_id TEXT NOT NULL,
  archive_version TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY(match_id,archive_version,account_id),
  FOREIGN KEY(match_id,archive_version) REFERENCES completed_matches(match_id,archive_version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  result TEXT NOT NULL,
  safe_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key_digest TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  blocked_until INTEGER,
  PRIMARY KEY(key_digest,window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_sessions_account_active ON sessions(account_id,expires_at,invalidated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_digest);
CREATE INDEX IF NOT EXISTS idx_recovery_expiry ON recovery_tokens(expires_at,consumed_at);
CREATE INDEX IF NOT EXISTS idx_room_codes_expiry ON room_codes(expires_at,status);
CREATE INDEX IF NOT EXISTS idx_tickets_expiry ON connection_tickets(expires_at,used_at,revoked_at);
CREATE INDEX IF NOT EXISTS idx_match_players_account ON completed_match_players(account_id,match_id);
CREATE INDEX IF NOT EXISTS idx_audit_account_time ON audit_events(account_id,created_at);

INSERT OR IGNORE INTO schema_versions(version,applied_at) VALUES ('0001_initial', unixepoch('now') * 1000);
