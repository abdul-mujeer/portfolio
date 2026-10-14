import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";

const KEY_LENGTH = 64;

/** Hash a plaintext password with scrypt using a fresh random salt. */
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return { salt, hash };
}

/** Constant-time verification of a plaintext password against salt+hash. */
export function verifyPassword(password, salt, hash) {
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, KEY_LENGTH);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** Opaque session token (never stored in plaintext in logs). */
export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function newId() {
  return randomUUID();
}
