import crypto from 'node:crypto';

export const SCRYPT_KEYLEN = 64;

export function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
}

export function verifyPassword(password, salt, expectedHash) {
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}
