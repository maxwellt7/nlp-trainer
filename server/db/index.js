import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use /app/storage on Railway (volume mount), fallback to local data dir
const storageRoot = existsSync('/app/storage') ? '/app/storage' : join(__dirname, '..', 'data');
const dbPath = join(storageRoot, 'alignment-engine.db');

// Ensure storage directory exists
if (!existsSync(storageRoot)) {
  mkdirSync(storageRoot, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    created_at    TEXT DEFAULT (datetime('now')),
    onboarding    TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id),
    updated_at    TEXT DEFAULT (datetime('now')),
    context_maps  TEXT DEFAULT '{"map1_health":5,"map2_health":5,"map3_health":5}',
    meta_programs TEXT DEFAULT '{"direction":"unknown","frame":"unknown","chunk":"unknown","relationship":"unknown","action":"unknown","rep_system":"unknown"}',
    capacity_index TEXT DEFAULT '{"suppression":5,"discharge":5,"capacity":5}',
    force_audit   TEXT DEFAULT '{"overt":0,"subtle":5,"clean":5}',
    victim_healer TEXT DEFAULT '{"score":0,"trending":"stable"}',
    nervous_system TEXT DEFAULT '{"dominant_state":"unknown"}',
    congruence    TEXT DEFAULT '{"career":5,"finance":5,"health":5,"relationships":5,"personal_growth":5,"fun":5,"spirituality":5}',
    rep_system    TEXT DEFAULT 'unknown'
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id),
    created_at    TEXT DEFAULT (datetime('now')),
    date_key      TEXT DEFAULT (date('now')),
    chat_messages TEXT DEFAULT '[]',
    chat_summary  TEXT DEFAULT '',
    detected_map  TEXT DEFAULT '',
    detected_state TEXT DEFAULT '',
    key_themes    TEXT DEFAULT '[]',
    script_id     TEXT DEFAULT NULL,
    audio_file    TEXT DEFAULT NULL,
    user_rating   INTEGER DEFAULT NULL,
    user_feedback TEXT DEFAULT '',
    mood_before   INTEGER DEFAULT NULL,
    mood_after    INTEGER DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS scripts (
    id                TEXT PRIMARY KEY,
    session_id        TEXT REFERENCES sessions(id),
    user_id           TEXT NOT NULL REFERENCES users(id),
    title             TEXT NOT NULL,
    duration          TEXT DEFAULT 'full',
    estimated_minutes INTEGER DEFAULT 20,
    script_text       TEXT NOT NULL,
    audio_file        TEXT DEFAULT NULL,
    music_track       TEXT DEFAULT NULL,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS memory_summaries (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id),
    period        TEXT NOT NULL,
    summary       TEXT NOT NULL,
    key_patterns  TEXT DEFAULT '[]',
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS streaks (
    user_id       TEXT PRIMARY KEY REFERENCES users(id),
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_session_date TEXT DEFAULT NULL,
    total_sessions INTEGER DEFAULT 0
  );
`);

export default db;
export { storageRoot };
