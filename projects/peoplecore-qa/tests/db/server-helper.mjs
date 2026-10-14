import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(HERE, '..', '..');

/**
 * Boots the real Express app on a throwaway port/database, runs `callback(baseUrl)`
 * and always stops the server again. Used by the integration-oriented DB checks so a
 * negative API call can be verified against the resulting SQLite file.
 */
export async function withServer(dbPath, callback, { port = 4315, env = {} } = {}) {
  const child = spawn(process.execPath, ['app/server/src/index.js'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
      DB_PATH: dbPath,
      SEED_DEFECTS: '0',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr.on('data', (chunk) => logs.push(String(chunk)));

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  let healthy = false;
  while (Date.now() < deadline && !healthy) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      healthy = response.ok;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!healthy) {
    child.kill();
    throw new Error(`Server did not become healthy on ${baseUrl}\n${logs.join('')}`);
  }

  try {
    return await callback(baseUrl);
  } finally {
    child.kill();
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

export async function apiLogin(baseUrl, email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`login failed for ${email}: ${response.status}`);
  const body = await response.json();
  return body.data.token;
}

export function apiFetch(baseUrl, token, path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}
