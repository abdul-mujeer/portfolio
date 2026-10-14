import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Project root (folder that owns package.json). */
export const PROJECT_ROOT = path.resolve(HERE, '..', '..', '..');

/** Default database location per the project contract. */
export const DEFAULT_DB_PATH = 'app/server/data/taskflow.db';

export function resolveDbPath(dbPath) {
  const raw = dbPath || process.env.DB_PATH || DEFAULT_DB_PATH;
  return path.isAbsolute(raw) ? path.normalize(raw) : path.join(PROJECT_ROOT, raw);
}

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL UNIQUE
              CHECK (length(key) BETWEEN 2 AND 6 AND key GLOB '[A-Z][A-Z]*' AND key NOT GLOB '*[^A-Z]*'),
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 3 AND 100),
  description TEXT CHECK (description IS NULL OR length(description) <= 500),
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  joined_at  TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description     TEXT CHECK (description IS NULL OR length(description) <= 2000),
  status          TEXT NOT NULL DEFAULT 'TODO'
                  CHECK (status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELED')),
  priority        TEXT NOT NULL DEFAULT 'MEDIUM'
                  CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  assignee_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reporter_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  due_date        TEXT CHECK (due_date IS NULL OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  estimated_hours REAL CHECK (estimated_hours IS NULL OR (estimated_hours >= 0.5 AND estimated_hours <= 100)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body       TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id     INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  actor_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action      TEXT NOT NULL,
  detail_json TEXT NOT NULL CHECK (json_valid(detail_json)),
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_project       ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status        ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date      ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee      ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_comments_task       ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_project    ON activity(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_task       ON activity(task_id);
CREATE INDEX IF NOT EXISTS idx_members_user        ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user       ON sessions(user_id);
`;

/** Open a connection (creates parent folders) with FK enforcement on. */
export function openDb(dbPath) {
  const resolved = resolveDbPath(dbPath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new DatabaseSync(resolved);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

export function ensureSchema(db) {
  db.exec(SCHEMA_SQL);
}

/** Open + ensure schema in one call. */
export function initDb(dbPath) {
  const db = openDb(dbPath);
  ensureSchema(db);
  return db;
}
