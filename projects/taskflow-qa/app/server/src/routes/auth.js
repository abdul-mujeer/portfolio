import { Router } from 'express';
import { registerSchema, loginSchema } from '../lib/validators.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { hashPassword, makeSalt, verifyPassword } from '../lib/password.js';
import { insertSession, setSessionCookie, clearSessionCookie, SESSION_COOKIE } from '../lib/sessions.js';
import { nowIso } from '../lib/datetime.js';
import { AppError, conflict } from '../lib/errors.js';

export const authRouter = Router();

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    created_at: row.created_at,
  };
}

/** POST /api/v1/auth/register */
authRouter.post('/register', validateBody(registerSchema), (req, res) => {
  const db = req.app.locals.db;
  const { display_name: displayName, password } = req.validatedBody;
  const email = req.validatedBody.email.toLowerCase();

  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
  }

  const salt = makeSalt();
  const createdAt = nowIso();
  const info = db
    .prepare(
      'INSERT INTO users (email, display_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(email, displayName, hashPassword(password, salt), salt, createdAt);
  const userId = Number(info.lastInsertRowid);

  const { token } = insertSession(db, userId, req.app.locals.secret);
  setSessionCookie(res, token, req.app.locals.isProduction);

  res.status(201).json({
    id: userId,
    email,
    display_name: displayName,
    created_at: createdAt,
  });
});

/** POST /api/v1/auth/login */
authRouter.post('/login', validateBody(loginSchema), (req, res) => {
  const db = req.app.locals.db;
  const email = req.validatedBody.email.toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !verifyPassword(req.validatedBody.password, user.salt, user.password_hash)) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  const { token } = insertSession(db, user.id, req.app.locals.secret);
  setSessionCookie(res, token, req.app.locals.isProduction);
  res.status(200).json(publicUser(user));
});

/** POST /api/v1/auth/logout */
authRouter.post('/logout', requireAuth, (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  req.app.locals.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  clearSessionCookie(res, req.app.locals.isProduction);
  res.status(204).end();
});

/** GET /api/v1/auth/me */
authRouter.get('/me', requireAuth, (req, res) => {
  res.status(200).json(publicUser(req.user));
});
