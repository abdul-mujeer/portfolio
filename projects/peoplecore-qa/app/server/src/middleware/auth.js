import { run } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { toPublicActor } from '../lib/scope.js';

export function parseCookies(headerValue) {
  const cookies = {};
  if (!headerValue) return cookies;
  for (const part of String(headerValue).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export function setSessionCookie(res, config, token, expiresAt) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction(),
    path: '/',
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(res, config) {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction(),
    path: '/',
  });
}

/**
 * Resolves the opaque session cookie into `req.actor` / `res.locals.user`.
 * Expired sessions are deleted on the spot (8 hour TTL by default).
 */
export function sessionMiddleware({ db, config }) {
  return (req, res, next) => {
    req.actor = null;
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
    const token = bearer ? bearer[1].trim() : parseCookies(req.headers.cookie)[config.cookieName];
    if (!token) return next();

    const row = db
      .prepare(
        `SELECT s.token, s.expires_at, e.*
         FROM sessions s JOIN employees e ON e.id = s.employee_id
         WHERE s.token = ?`,
      )
      .get(token);

    if (!row) return next();

    if (Date.parse(row.expires_at) <= Date.now()) {
      run(db, 'DELETE FROM sessions WHERE token = ?', [token]);
      return next();
    }

    // Defect HR-BUG-012 (found by exploratory charter HR-EX-05): a session issued before
    // the account was terminated stayed valid until it expired. Sessions of terminated
    // employees are revoked on the next request instead.
    if (row.status === 'TERMINATED') {
      run(db, 'DELETE FROM sessions WHERE token = ?', [token]);
      clearSessionCookie(res, config);
      return next();
    }

    req.actor = {
      id: Number(row.id),
      employeeCode: row.employee_code,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      role: row.role,
      departmentId: row.department_id === null ? null : Number(row.department_id),
      status: row.status,
      sessionToken: token,
      sessionExpiresAt: row.expires_at,
    };
    next();
  };
}

export function requireAuth(req, _res, next) {
  if (!req.actor) return next(HttpError.unauthenticated('A valid session cookie is required for this endpoint'));
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.actor) return next(HttpError.unauthenticated('A valid session cookie is required for this endpoint'));
    if (!roles.includes(req.actor.role)) {
      return next(
        HttpError.forbidden(
          `Role ${req.actor.role} is not allowed to perform this action (requires ${roles.join(' or ')})`,
          'ROLE_FORBIDDEN',
        ),
      );
    }
    next();
  };
}

/** Page guard: browsers are redirected to /login instead of receiving a bare 401. */
export function requireAuthPage(req, res, next) {
  if (req.actor) return next();
  const target = req.originalUrl && req.originalUrl !== '/login' ? `?next=${encodeURIComponent(req.originalUrl)}` : '';
  return res.redirect(302, `/login${target}`);
}

export function htmlLocals(req, res, next) {
  res.locals.user = req.actor ? toPublicActor(req.actor) : null;
  res.locals.currentPath = req.path;
  res.locals.query = req.query ?? {};
  res.locals.appName = 'PeopleCore HRMS';
  next();
}
