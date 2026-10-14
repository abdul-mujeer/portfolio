import { SESSION_COOKIE, verifySessionTokenSignature } from '../lib/sessions.js';
import { nowIso } from '../lib/datetime.js';
import { unauthorized } from '../lib/errors.js';

/** Tiny cookie parser (keeps the dependency list to express + zod). */
export function cookieParser(req, res, next) {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    for (const part of header.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const key = part.slice(0, eq).trim();
      if (!key) continue;
      try {
        req.cookies[key] = decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        req.cookies[key] = part.slice(eq + 1).trim();
      }
    }
  }
  next();
}

/**
 * Resolves the session cookie into req.user. Rejects (401) when:
 * - the cookie is missing or malformed,
 * - the HMAC signature does not match APP_SECRET (tampering),
 * - the session is unknown or expired.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) throw unauthorized();
  if (!verifySessionTokenSignature(token, req.app.locals.secret)) {
    throw unauthorized('Invalid session token');
  }
  const row = req.app.locals.db
    .prepare(
      `SELECT s.token, s.expires_at, u.id, u.email, u.display_name, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token);
  if (!row) throw unauthorized('Session not found');
  if (row.expires_at <= nowIso()) {
    req.app.locals.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    throw unauthorized('Session expired');
  }
  req.user = {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    created_at: row.created_at,
  };
  next();
}
