/**
 * Shared helpers for starting/stopping the ShopSure server from test scripts.
 * Keeps process handling in one place so every runner behaves the same on Windows and CI.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Starts scripts/serve.mjs as a child process.
 * @returns {{ child: import('node:child_process').ChildProcess, logs: string[] }}
 */
export function startServer({ port, dbPath, extraEnv = {}, reset = true }) {
  const args = [path.join(PROJECT_ROOT, "scripts/serve.mjs")];
  if (reset) args.push("--reset");

  const child = spawn(process.execPath, args, {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      NODE_ENV: "test",
      APP_SECRET: "e2e-test-secret-not-a-real-secret",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logs = [];
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  return { child, logs };
}

export async function waitForHealth(baseUrl, { timeoutMs = 40_000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return await response.json();
      lastError = new Error(`health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Server did not become healthy at ${baseUrl}/api/health within ${timeoutMs}ms: ${lastError}`);
}

export async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const ended = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  const timer = setTimeout(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  }, 5000);
  await ended;
  clearTimeout(timer);
}

/** Minimal cookie-aware JSON client for smoke checks and Postman-like flows. */
export function createClient(baseUrl) {
  let cookie = "";
  const request = async (method, pathname, body) => {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.getSetCookie?.() ?? [];
    if (setCookie.length > 0) cookie = setCookie.map((value) => value.split(";")[0]).join("; ");
    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }
    return { status: response.status, body: json, headers: response.headers };
  };

  return {
    get: (pathname) => request("GET", pathname),
    post: (pathname, body) => request("POST", pathname, body),
    patch: (pathname, body) => request("PATCH", pathname, body),
    del: (pathname) => request("DELETE", pathname),
    getCookie: () => cookie,
  };
}
