import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // <project>/app/server/src

export const PROJECT_ROOT = path.resolve(HERE, '..', '..', '..');
export const VIEWS_DIR = path.join(PROJECT_ROOT, 'app', 'views');
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'app', 'public');

export const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, 'app', 'server', 'data', 'peoplecore.db');
export const TEST_DB_PATH = path.join(PROJECT_ROOT, '.data', 'peoplecore.test.db');

/** Number of hours an opaque session token stays valid (business rule: 8h). */
export const SESSION_TTL_HOURS = 8;

/** Login throttling: 5 failed attempts lock an account for 15 minutes. */
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export const COOKIE_NAME = 'pc_session';

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

/**
 * Resolves the runtime configuration. Every value can be overridden by the
 * environment (documented in .env.example) or by an explicit override object
 * (used by tests and scripts so they never touch the development database).
 */
export function loadConfig(overrides = {}) {
  const env = { ...process.env, ...overrides.env };
  const rawDbPath = overrides.dbPath ?? env.DB_PATH ?? DEFAULT_DB_PATH;
  const dbPath = path.isAbsolute(rawDbPath)
    ? rawDbPath
    : path.resolve(PROJECT_ROOT, rawDbPath);

  return {
    projectRoot: PROJECT_ROOT,
    viewsDir: VIEWS_DIR,
    publicDir: PUBLIC_DIR,
    nodeEnv: overrides.nodeEnv ?? env.NODE_ENV ?? 'development',
    port: Number(overrides.port ?? env.PORT ?? 4200),
    host: overrides.host ?? env.HOST ?? '127.0.0.1',
    dbPath,
    appSecret: overrides.appSecret ?? env.APP_SECRET ?? 'peoplecore-dev-only-secret',
    sessionTtlHours: Number(overrides.sessionTtlHours ?? env.SESSION_TTL_HOURS ?? SESSION_TTL_HOURS),
    maxLoginAttempts: Number(overrides.maxLoginAttempts ?? env.MAX_LOGIN_ATTEMPTS ?? MAX_LOGIN_ATTEMPTS),
    lockoutMinutes: Number(overrides.lockoutMinutes ?? env.LOCKOUT_MINUTES ?? LOCKOUT_MINUTES),
    cookieName: overrides.cookieName ?? COOKIE_NAME,
    seedDefects: isTruthy(overrides.seedDefects ?? env.SEED_DEFECTS),
    isProduction() {
      return this.nodeEnv === 'production';
    },
  };
}
