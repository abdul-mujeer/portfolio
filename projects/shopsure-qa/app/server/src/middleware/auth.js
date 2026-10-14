import { parseCookies } from "../lib/helpers.js";
import { unauthorized, forbidden } from "../lib/errors.js";

export const SESSION_COOKIE = "shopsure_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Populates req.cookies without pulling in the cookie-parser dependency. */
export function cookieParser(req, _res, next) {
  req.cookies = parseCookies(req.headers.cookie || "");
  next();
}

/**
 * Loads req.user from the session cookie when present. Never fails the request:
 * route-level guards decide whether authentication is required.
 */
export function attachUser(db) {
  const findSession = db.prepare(
    `SELECT s.token, s.expires_at, u.id, u.email, u.name, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`
  );
  return (req, _res, next) => {
    req.user = null;
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      const row = findSession.get(token);
      if (row && new Date(row.expires_at).getTime() > Date.now()) {
        req.user = { id: row.id, email: row.email, name: row.name, role: row.role };
        req.sessionToken = token;
      }
    }
    next();
  };
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== "ADMIN") return next(forbidden("Administrator role required."));
  next();
}

export function setSessionCookie(res, token, ttlMs = SESSION_TTL_MS) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ttlMs,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
}
