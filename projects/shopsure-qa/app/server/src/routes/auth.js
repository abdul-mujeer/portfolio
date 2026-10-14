import express from "express";
import { z } from "zod";
import { hashPassword, verifyPassword, newSessionToken } from "../lib/passwords.js";
import { nowIso } from "../lib/helpers.js";
import { asyncHandler, conflict, unauthorized, HttpError } from "../lib/errors.js";
import { setSessionCookie, clearSessionCookie, requireAuth, SESSION_TTL_MS } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const emailSchema = z
  .string()
  .trim()
  .min(5, "Email is too short.")
  .max(120, "Email is too long.")
  .regex(/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/, "Email format is invalid.")
  .toLowerCase();

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.")
  .regex(/[A-Za-z]/, "Password must contain at least one letter.")
  .regex(/\d/, "Password must contain at least one digit.");

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(60, "Name must be at most 60 characters."),
  email: emailSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required."),
  password: z.string().min(1, "Password is required."),
});

/** Very small in-memory throttle: 5 failed logins per email+IP within 15 minutes -> 429. */
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function createAuthRouter(db) {
  const router = express.Router();
  const failedAttempts = new Map();

  const insertUser = db.prepare(
    "INSERT INTO users (email, name, password_hash, salt, role, created_at) VALUES (?, ?, ?, ?, 'CUSTOMER', ?)"
  );
  const findUserByEmail = db.prepare("SELECT id, email, name, password_hash, salt, role FROM users WHERE email = ?");
  const insertSession = db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)");
  const deleteSession = db.prepare("DELETE FROM sessions WHERE token = ?");

  function startSession(res, user) {
    const token = newSessionToken();
    insertSession.run(token, user.id, nowIso(), new Date(Date.now() + SESSION_TTL_MS).toISOString());
    setSessionCookie(res, token);
    return token;
  }

  router.post(
    "/register",
    validateBody(registerSchema),
    asyncHandler(async (req, res) => {
      const { name, email, password } = req.body;
      if (findUserByEmail.get(email)) {
        throw conflict("An account with this email already exists.", "EMAIL_ALREADY_REGISTERED");
      }
      const { salt, hash } = hashPassword(password);
      const info = insertUser.run(email, name, hash, salt, nowIso());
      const user = { id: Number(info.lastInsertRowid), email, name, role: "CUSTOMER" };
      startSession(res, user);
      res.status(201).json({ user });
    })
  );

  router.post(
    "/login",
    validateBody(loginSchema),
    asyncHandler(async (req, res) => {
      const { email, password } = req.body;
      const throttleKey = `${req.ip}:${email}`;
      const record = failedAttempts.get(throttleKey);
      if (record && record.count >= MAX_FAILED_ATTEMPTS && Date.now() - record.firstAt < WINDOW_MS) {
        throw new HttpError(429, "TOO_MANY_ATTEMPTS", "Too many failed login attempts. Try again later.");
      }

      const user = findUserByEmail.get(email);
      const ok = user ? verifyPassword(password, user.salt, user.password_hash) : false;
      if (!ok) {
        const now = Date.now();
        if (!record || now - record.firstAt >= WINDOW_MS) {
          failedAttempts.set(throttleKey, { count: 1, firstAt: now });
        } else {
          record.count += 1;
        }
        throw unauthorized("Invalid email or password.");
      }

      failedAttempts.delete(throttleKey);
      startSession(res, user);
      res.status(200).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    })
  );

  router.post(
    "/logout",
    asyncHandler(async (req, res) => {
      if (req.sessionToken) deleteSession.run(req.sessionToken);
      clearSessionCookie(res);
      res.status(204).end();
    })
  );

  router.get(
    "/me",
    requireAuth,
    asyncHandler(async (req, res) => {
      res.status(200).json({ user: req.user });
    })
  );

  return router;
}
