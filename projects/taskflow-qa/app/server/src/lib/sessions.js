import crypto from 'node:crypto';
import { nowIso, addHoursIso } from './datetime.js';

export const SESSION_COOKIE = 'tf_session';
export const SESSION_TTL_HOURS = 8;

/**
 * Session tokens are opaque random values signed with APP_SECRET (HMAC-SHA256).
 * Format: <32 random bytes base64url>.<16 byte signature base64url>.
 * The signature lets the server reject tampered tokens before touching the DB.
 */
export function createSessionToken(secret) {
  const raw = crypto.randomBytes(32).toString('base64url');
  return `${raw}.${sign(raw, secret)}`;
}

export function isWellFormedToken(token) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 2 && parts[0].length >= 32 && parts[1].length >= 16;
}

export function verifySessionTokenSignature(token, secret) {
  if (!isWellFormedToken(token)) return false;
  const [raw, signature] = token.split('.');
  const expected = sign(raw, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sign(raw, secret) {
  return crypto.createHmac('sha256', secret).update(raw).digest('base64url').slice(0, 16);
}

export function insertSession(db, userId, secret) {
  const token = createSessionToken(secret);
  db.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, nowIso(), addHoursIso(SESSION_TTL_HOURS));
  return { token, expiresAt: addHoursIso(SESSION_TTL_HOURS) };
}

export function setSessionCookie(res, token, isProduction) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isProduction,
    maxAge: SESSION_TTL_HOURS * 3600 * 1000,
  });
}

export function clearSessionCookie(res, isProduction) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isProduction,
  });
}
