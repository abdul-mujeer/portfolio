#!/usr/bin/env node
/**
 * Performance audit of the built portfolio site.
 *
 * Measures, in a real browser:
 *   - frame intervals (FPS, jank) while idle and while the 3D toolbox is on screen
 *   - long tasks (main-thread blocking)
 *   - JS heap usage
 *   - number of WebGL canvases and their backing-store size
 *
 * Usage:
 *   npm run perf:audit                 # headless (software WebGL)
 *   npm run perf:audit -- --headed     # real GPU, closer to a visitor's experience
 *   npm run perf:audit -- --label after
 *
 * Writes test-evidence/performance-audit.md (and a JSON file per label).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = Number(process.env.AUDIT_PORT || 4391);
const BASE = `http://127.0.0.1:${PORT}`;const args = process.argv.slice(2);
const headed = args.includes("--headed");
const dprFlag = args.indexOf("--dpr");
const deviceScaleFactor = dprFlag !== -1 ? Number(args[dprFlag + 1]) : 1;
const urlFlag = args.indexOf("--url");
const targetUrl = urlFlag !== -1 ? args[urlFlag + 1] : `http://127.0.0.1:${PORT}`;
const useLocalBuild = urlFlag === -1;
const labelFlag = args.indexOf("--label");
const label = labelFlag !== -1 ? args[labelFlag + 1] : headed ? "headed" : "headless";
const OUT_DIR = path.join(ROOT, "test-evidence");
const SAMPLE_MS = 4000;

const server = useLocalBuild
  ? spawn(
      process.execPath,
      [path.join(ROOT, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
      { cwd: ROOT, stdio: "ignore" }
    )
  : null;
if (useLocalBuild) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {
      /* keep waiting */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const browser = await chromium.launch({ headless: !headed });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor });

// Collect long tasks from the very first paint onwards.
await page.addInitScript(() => {
  window.__longTasks = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__longTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ entryTypes: ["longtask"] });
  } catch {
    /* longtask unsupported */
  }
});

const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");

const sampleFrames = () =>
  page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now();
        const end = last + duration;
        const loop = (now) => {
          deltas.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(loop);
          else resolve(deltas);
        };
        requestAnimationFrame(loop);
      }),
    SAMPLE_MS
  );

const stats = (deltas) => {
  const sorted = [...deltas].sort((a, b) => a - b);
  const mean = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  return {
    frames: deltas.length,
    avgFps: Number((1000 / mean).toFixed(1)),
    p95FrameMs: Number(p95.toFixed(1)),
    jankyFrames: deltas.filter((value) => value > 50).length,
    worstFrameMs: Number(Math.max(...deltas).toFixed(1)),
  };
};

const heap = async () => (await cdp.send("Runtime.getHeapUsage")).usedSize;

await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".loading-screen", { state: "detached", timeout: 120000 });
await page.waitForTimeout(4000); // let the intro settle

const heapStart = await heap();
const idleDeltas = await sampleFrames();
const heapAfterIdle = await heap();

// CPU used while nothing is happening (the endless rAF loops show up here).
const readMetrics = async () =>
  Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((metric) => [metric.name, metric.value]));
const metricsBefore = await readMetrics();
await page.waitForTimeout(5000);
const metricsAfter = await readMetrics();
const idleCpu = {
  taskMs: Number(((metricsAfter.TaskDuration - metricsBefore.TaskDuration) * 1000).toFixed(0)),
  scriptMs: Number(((metricsAfter.ScriptDuration - metricsBefore.ScriptDuration) * 1000).toFixed(0)),
};

const canvases = await page.evaluate(() =>
  [...document.querySelectorAll("canvas")].map((canvas) => ({
    css: `${canvas.clientWidth}x${canvas.clientHeight}`,
    buffer: `${canvas.width}x${canvas.height}`,
    dpr: Number((canvas.width / Math.max(1, canvas.clientWidth)).toFixed(2)),
  }))
);

const toolboxStateAtIdle = await page.evaluate(() => {
  const anchor = document.querySelector(".techstack-anchor");
  const section = document.querySelector(".techstack");
  return {
    mounted: anchor?.getAttribute("data-mounted") ?? "no anchor",
    active: anchor?.getAttribute("data-active") ?? null,
    sectionTop: section ? Math.round(section.getBoundingClientRect().top) : null,
    scrollY: Math.round(window.scrollY),
  };
});

const glRenderer = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  if (!canvas) return "no canvas";
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) return "no webgl";
  const extension = gl.getExtension("WEBGL_debug_renderer_info");
  return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : "unavailable";
});

// Bring the 3D toolbox on screen (wheel events drive GSAP's smooth scroller).
for (let attempt = 0; attempt < 30; attempt += 1) {
  const top = await page.evaluate(() => Math.round(document.querySelector(".techstack")?.getBoundingClientRect().top ?? 99999));
  if (top <= 200 && top >= -600) break;
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(500);
}
await page.waitForTimeout(3000);
const toolboxDeltas = await sampleFrames();

const longTasks = await page.evaluate(() => window.__longTasks ?? []);
const heapEnd = await heap();

const report = {
  label,
  measuredAt: new Date().toISOString(),
  mode: headed ? "headed (GPU)" : "headless (software WebGL)",
  glRenderer,
  viewport: "1440x900",
  deviceScaleFactor,
  canvases,
  toolboxAtIdle: toolboxStateAtIdle,
  idle: stats(idleDeltas),
  toolboxOnScreen: stats(toolboxDeltas),
  idleCpu,
  longTasks: {
    count: longTasks.length,
    totalMs: Number(longTasks.reduce((sum, task) => sum + task.duration, 0).toFixed(1)),
    worstMs: longTasks.length ? Number(Math.max(...longTasks.map((task) => task.duration)).toFixed(1)) : 0,
  },
  heap: {
    afterLoadMb: Number((heapStart / 1048576).toFixed(1)),
    afterIdleMb: Number((heapAfterIdle / 1048576).toFixed(1)),
    afterScrollMb: Number((heapEnd / 1048576).toFixed(1)),
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, `performance-audit-${label}.json`), JSON.stringify(report, null, 2));
fs.writeFileSync(
  path.join(OUT_DIR, "performance-audit.md"),
  `# Portfolio performance audit (${label})

- Measured: ${report.measuredAt}
- Mode: ${report.mode}
- WebGL renderer: ${report.glRenderer}
- Viewport: ${report.viewport} @ ${report.deviceScaleFactor}x device pixel ratio

| Scenario | Avg FPS | p95 frame | Worst frame | Frames > 50 ms |
|----------|--------:|----------:|------------:|---------------:|
| Idle at the top | ${report.idle.avgFps} | ${report.idle.p95FrameMs} ms | ${report.idle.worstFrameMs} ms | ${report.idle.jankyFrames} / ${report.idle.frames} |
| 3D toolbox on screen | ${report.toolboxOnScreen.avgFps} | ${report.toolboxOnScreen.p95FrameMs} ms | ${report.toolboxOnScreen.worstFrameMs} ms | ${report.toolboxOnScreen.jankyFrames} / ${report.toolboxOnScreen.frames} |

**Main-thread long tasks:** ${report.longTasks.count} tasks, ${report.longTasks.totalMs} ms total, worst ${report.longTasks.worstMs} ms.

**CPU used while idle (5 s window):** ${report.idleCpu.taskMs} ms task time, ${report.idleCpu.scriptMs} ms script time.

**JS heap:** ${report.heap.afterLoadMb} MB after load → ${report.heap.afterIdleMb} MB after idle → ${report.heap.afterScrollMb} MB after scrolling.

**WebGL canvases:** ${canvases.map((canvas) => `${canvas.css} buffer ${canvas.buffer} @${canvas.dpr}x`).join(" · ") || "none"}

> Absolute FPS in headless mode uses software WebGL, so it is not representative of a GPU machine;
> the before/after comparison and the long-task and heap figures are the meaningful signals.
`
);

console.log(JSON.stringify(report, null, 2));
await browser.close();
if (server) server.kill();
process.exit(0);
