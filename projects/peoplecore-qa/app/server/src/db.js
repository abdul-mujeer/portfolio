/**
 * SQLite access layer built on Node's built-in `node:sqlite` (DatabaseSync).
 * No native dependencies, no ORM — every statement is parameterized.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const SCHEMA_VERSION = 2;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','HR','MANAGER','EMPLOYEE')),
  department_id INTEGER REFERENCES departments(id),
  position TEXT NOT NULL,
  salary REAL NOT NULL CHECK (salary > 0 AND salary <= 1000000),
  hire_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','ON_LEAVE','TERMINATED')),
  manager_id INTEGER REFERENCES employees(id),
  phone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PRESENT','REMOTE','ABSENT','LEAVE')),
  check_in TEXT,
  check_out TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('ANNUAL','SICK','UNPAID','PARENTAL')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL CHECK (days >= 1 AND days <= 30),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reviewed_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  review_comment TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  email TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Defect HR-BUG-008: without ON DELETE SET NULL, deleting an employee who had ever
  -- performed an audited action failed with a foreign key error (HTTP 500). The audit
  -- row is historical evidence and survives; the actor reference is cleared instead.
  actor_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
`;

const SCHEMA_META_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/** node:sqlite only accepts null | number | bigint | string | Buffer as a bind value. */
export function toParam(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function openDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  return db;
}

export function applySchema(db) {
  db.exec(SCHEMA_META_SQL);
  db.exec(SCHEMA_SQL);
  db.prepare(
    'INSERT INTO schema_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run('schema_version', String(SCHEMA_VERSION));
}

export function all(db, sql, params = []) {
  return db.prepare(sql).all(...params.map(toParam));
}

export function get(db, sql, params = []) {
  return db.prepare(sql).get(...params.map(toParam)) ?? null;
}

export function run(db, sql, params = []) {
  const info = db.prepare(sql).run(...params.map(toParam));
  return {
    changes: Number(info.changes ?? 0),
    lastInsertRowid: info.lastInsertRowid === undefined ? null : Number(info.lastInsertRowid),
  };
}

export function listDatabaseFiles(dbPath) {
  return [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`];
}

/** Deletes the database file (and any journal siblings). */
export function removeDatabase(dbPath) {
  for (const file of listDatabaseFiles(dbPath)) {
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  }
}

/**
 * Creates (or re-creates) the schema for `dbPath` and returns the connection.
 * `fresh: true` deletes the existing file first.
 */
export function bootstrapDatabase(dbPath, { fresh = false } = {}) {
  if (fresh) removeDatabase(dbPath);
  const db = openDatabase(dbPath);
  applySchema(db);
  return db;
}

export function countRows(db, table) {
  const row = get(db, `SELECT COUNT(*) AS total FROM ${table}`);
  return row ? Number(row.total) : 0;
}
