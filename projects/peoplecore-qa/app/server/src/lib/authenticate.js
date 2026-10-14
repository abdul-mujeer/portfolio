import { get, run } from '../db.js';
import { addHours, nowIso } from './dates.js';
import { HttpError } from './errors.js';
import { hashPassword, newSessionToken, verifyPassword } from './passwords.js';

/** Constant-work dummy verification so a missing account cannot be detected by timing. */
export function dummyVerify(password) {
  const salt = 'deadbeefdeadbeefdeadbeefdeadbeef';
  const hash = hashPassword('not-a-real-password', salt).hash;
  return verifyPassword(password, salt, hash);
}

/**
 * Defect HR-BUG-001 (found by tests/api/auth.spec.ts): the counter used to treat a
 * missing `locked_until` as "lock expired" and therefore reset to zero on every attempt,
 * so the 5-attempt lockout never triggered. Only an *expired lock* resets the window.
 */
function nextAttemptState(db, email) {
  const row = get(db, 'SELECT failed_count, locked_until FROM login_attempts WHERE email = ?', [email]);
  if (!row) return 0;
  if (row.locked_until && Date.parse(row.locked_until) <= Date.now()) return 0;
  return Number(row.failed_count ?? 0);
}

/**
 * Shared credential check + session creation used by POST /api/auth/login and the
 * HTML login form. Throws HttpError(401/403/423) on any failure.
 */
export function authenticate(db, config, { email, password }) {
  const normalized = String(email).trim().toLowerCase();

  const locked = get(db, 'SELECT failed_count, locked_until FROM login_attempts WHERE email = ?', [normalized]);
  if (locked?.locked_until && Date.parse(locked.locked_until) > Date.now()) {
    const minutes = Math.max(1, Math.ceil((Date.parse(locked.locked_until) - Date.now()) / 60_000));
    throw HttpError.locked(
      `Account locked after ${config.maxLoginAttempts} failed sign-in attempts. Try again in ${minutes} minute(s).`,
    );
  }

  const employee = get(db, 'SELECT * FROM employees WHERE lower(email) = ?', [normalized]);
  const passwordOk = employee ? verifyPassword(password, employee.salt, employee.password_hash) : dummyVerify(password);

  if (!passwordOk) {
    const failed = nextAttemptState(db, normalized) + 1;
    const lockedUntil = failed >= config.maxLoginAttempts ? addHours(nowIso(), config.lockoutMinutes / 60) : null;
    run(
      db,
      `INSERT INTO login_attempts (email, failed_count, locked_until, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         failed_count = excluded.failed_count,
         locked_until = excluded.locked_until,
         updated_at = excluded.updated_at`,
      [normalized, failed, lockedUntil, nowIso()],
    );
    if (lockedUntil) {
      throw HttpError.locked(
        `Account locked after ${config.maxLoginAttempts} failed sign-in attempts. Try again in ${config.lockoutMinutes} minute(s).`,
      );
    }
    throw HttpError.unauthenticated('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (employee.status === 'TERMINATED') {
    throw HttpError.forbidden('This account is terminated and cannot sign in', 'ACCOUNT_TERMINATED');
  }

  run(db, 'DELETE FROM login_attempts WHERE email = ?', [normalized]);

  const token = newSessionToken();
  const issuedAt = nowIso();
  const expiresAt = addHours(issuedAt, config.sessionTtlHours);
  run(db, 'INSERT INTO sessions (token, employee_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [
    token,
    employee.id,
    issuedAt,
    expiresAt,
  ]);

  return { employee, token, issuedAt, expiresAt };
}

export function endSession(db, token) {
  if (token) run(db, 'DELETE FROM sessions WHERE token = ?', [token]);
}
