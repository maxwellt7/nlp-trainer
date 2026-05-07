import initSqlJs from 'sql.js';
import { applySessionMigrations } from './session-migrations.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// sql.js looks up its wasm via fetch/fs. On Vercel the bundler doesn't trace it
// into /var/task/node_modules, so we ship a copy under server/db/ (server/** is
// bundled by vercel.json includeFiles) and point initSqlJs at it.
const bundledWasmPath = join(__dirname, 'sql-wasm.wasm');
const sqlJsConfig = existsSync(bundledWasmPath)
  ? { locateFile: () => bundledWasmPath }
  : undefined;

// Pick a writable storage root:
// - /app/storage on Railway (volume mount)
// - /tmp/alignment-engine on Vercel (only writable path on serverless)
// - server/data locally
const storageRoot = existsSync('/app/storage')
  ? '/app/storage'
  : process.env.VERCEL
    ? '/tmp/alignment-engine'
    : join(__dirname, '..', 'data');
const seedDbPath = join(__dirname, '..', 'data', 'alignment-engine.db');
const dbPath = join(storageRoot, 'alignment-engine.db');

// Ensure storage directory exists (best-effort: read-only fs is fine, sql.js falls back to in-memory)
try {
  if (!existsSync(storageRoot)) {
    mkdirSync(storageRoot, { recursive: true });
  }
} catch (err) {
  console.warn('DB storage root not writable, continuing in-memory:', err.message);
}

// Initialize sql.js synchronously by blocking on the promise
let SQL;
let rawDb;

const initPromise = initSqlJs(sqlJsConfig).then(sqlJs => {
  SQL = sqlJs;
  // Load existing DB from runtime path, falling back to bundled seed (e.g. on Vercel cold start)
  const sourcePath = existsSync(dbPath) ? dbPath : (existsSync(seedDbPath) ? seedDbPath : null);
  if (sourcePath) {
    try {
      const buffer = readFileSync(sourcePath);
      rawDb = new SQL.Database(buffer);
    } catch {
      rawDb = new SQL.Database();
    }
  } else {
    rawDb = new SQL.Database();
  }

  // Create tables
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      created_at    TEXT DEFAULT (datetime('now')),
      onboarding    TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
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
      user_id       TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      date_key      TEXT DEFAULT (date('now')),
      session_type  TEXT DEFAULT 'daily_hypnosis',
      session_status TEXT DEFAULT 'active',
      title         TEXT DEFAULT '',
      last_message_at TEXT DEFAULT (datetime('now')),
      hypnosis_generated_at TEXT DEFAULT NULL,
      locked_at     TEXT DEFAULT NULL,
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
      session_id        TEXT,
      user_id           TEXT NOT NULL,
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
      user_id       TEXT NOT NULL,
      period        TEXT NOT NULL,
      summary       TEXT NOT NULL,
      key_patterns  TEXT DEFAULT '[]',
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS streaks (
      user_id       TEXT PRIMARY KEY,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_session_date TEXT DEFAULT NULL,
      total_sessions INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS values_detected (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      value_name      TEXT NOT NULL,
      rank            INTEGER DEFAULT NULL,
      confidence       REAL DEFAULT 0.5,
      purity_score     REAL DEFAULT 5.0,
      expression       TEXT DEFAULT 'mixed',
      pure_expression  TEXT DEFAULT '',
      distorted_expression TEXT DEFAULT '',
      evidence_count   INTEGER DEFAULT 1,
      first_detected   TEXT DEFAULT (datetime('now')),
      last_updated     TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, value_name)
    );

    CREATE TABLE IF NOT EXISTS value_evidence (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      value_name      TEXT NOT NULL,
      session_id      TEXT,
      evidence_type   TEXT DEFAULT 'conversation',
      quote           TEXT DEFAULT '',
      interpretation  TEXT DEFAULT '',
      detected_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS value_conflicts (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      value_a         TEXT NOT NULL,
      value_b         TEXT NOT NULL,
      conflict_type   TEXT DEFAULT 'direct',
      description     TEXT DEFAULT '',
      detected_at     TEXT DEFAULT (datetime('now')),
      resolved        INTEGER DEFAULT 0,
      UNIQUE(user_id, value_a, value_b)
    );

    CREATE TABLE IF NOT EXISTS identity_statements (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      statement_type  TEXT NOT NULL,
      content         TEXT NOT NULL,
      confidence       REAL DEFAULT 0.5,
      session_id      TEXT,
      detected_at     TEXT DEFAULT (datetime('now')),
      active          INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS identity_scores (
      user_id              TEXT PRIMARY KEY,
      value_clarity        REAL DEFAULT 0,
      value_alignment      REAL DEFAULT 0,
      hierarchy_stability  REAL DEFAULT 0,
      purity_ratio         REAL DEFAULT 0,
      conflict_awareness   REAL DEFAULT 0,
      worthiness_independence REAL DEFAULT 0,
      decision_speed       REAL DEFAULT 0,
      overall_congruence   REAL DEFAULT 0,
      updated_at           TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_xp (
      user_id          TEXT PRIMARY KEY,
      total_xp         INTEGER DEFAULT 0,
      level            INTEGER DEFAULT 1,
      title            TEXT DEFAULT 'Seeker',
      xp_to_next       INTEGER DEFAULT 100,
      sessions_completed INTEGER DEFAULT 0,
      scripts_generated INTEGER DEFAULT 0,
      audios_generated  INTEGER DEFAULT 0,
      vulnerability_bonus INTEGER DEFAULT 0,
      streak_multiplier REAL DEFAULT 1.0,
      updated_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS xp_events (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      event_type       TEXT NOT NULL,
      xp_amount        INTEGER NOT NULL,
      description      TEXT DEFAULT '',
      session_id       TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mystery_boxes (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      session_id       TEXT,
      rarity           TEXT NOT NULL DEFAULT 'common',
      reward_type      TEXT NOT NULL,
      reward_title     TEXT NOT NULL,
      reward_content   TEXT NOT NULL,
      opened           INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now')),
      opened_at        TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      achievement_key  TEXT NOT NULL,
      title            TEXT NOT NULL,
      description      TEXT DEFAULT '',
      icon             TEXT DEFAULT '',
      unlocked_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, achievement_key)
    );

    CREATE TABLE IF NOT EXISTS hypnosis_jobs (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      session_id      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'queued',
      result_json     TEXT DEFAULT NULL,
      error_message   TEXT DEFAULT NULL,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hypnosis_jobs_user_session ON hypnosis_jobs(user_id, session_id);
  `);

  applySessionMigrations(rawDb);

  save();
});

function save() {
  if (rawDb) {
    try {
      const data = rawDb.export();
      const buffer = Buffer.from(data);
      writeFileSync(dbPath, buffer);
    } catch (err) {
      console.error('DB save error:', err.message);
    }
  }
}

// Wrapper that provides a better-sqlite3-compatible API
const db = {
  _ready: false,

  async waitReady() {
    if (this._ready) return;
    await initPromise;
    this._ready = true;
  },

  prepare(sql) {
    return {
      run(...params) {
        if (!rawDb) throw new Error('DB not initialized');
        rawDb.run(sql, params);
        save();
        return { changes: rawDb.getRowsModified() };
      },
      get(...params) {
        if (!rawDb) throw new Error('DB not initialized');
        const stmt = rawDb.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        if (!rawDb) throw new Error('DB not initialized');
        const results = [];
        const stmt = rawDb.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
    };
  },

  exec(sql) {
    if (!rawDb) throw new Error('DB not initialized');
    rawDb.run(sql);
    save();
  },

  pragma(str) {
    // sql.js doesn't support pragmas the same way, silently ignore
  },
};

// Wait for init before exporting
await initPromise;
db._ready = true;

export default db;
export { storageRoot };
