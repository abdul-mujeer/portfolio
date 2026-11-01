import { spawn } from "node:child_process";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 4393;
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: "ignore" });
for (let i = 0; i < 80; i += 1) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* wait */
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".loading-screen", { state: "detached", timeout: 120000 });
await page.waitForTimeout(2000);

for (let step = 0; step < 14; step += 1) {
  const top = await page.evaluate(() => Math.round(document.querySelector(".techstack")?.getBoundingClientRect().top ?? 99999));
  if (top <= 100 && top >= -400) break;
  await page.mouse.wheel(0, top > 100 ? 520 : -520);
  await page.waitForTimeout(1600);
}
await page.waitForTimeout(3000);

const info = await page.evaluate(async () => {
  const section = document.querySelector(".techstack");
  const anchor = document.querySelector(".techstack-anchor");
  const manual = await new Promise((resolve) => {
    const observer = new IntersectionObserver(
      (entries) => {
        resolve(entries.map((entry) => ({ isIntersecting: entry.isIntersecting, ratio: entry.intersectionRatio })));
        observer.disconnect();
      },
      { rootMargin: "150% 0px 150% 0px" }
    );
    if (anchor) observer.observe(anchor);
    setTimeout(() => resolve("no callback"), 1500);
  });
  return {
    sectionTop: section ? Math.round(section.getBoundingClientRect().top) : null,
    anchorRect: anchor ? JSON.stringify(anchor.getBoundingClientRect()) : null,
    anchorHeight: anchor ? getComputedStyle(anchor).height : null,
    anchorActive: anchor?.getAttribute("data-active") ?? null,
    anchorMounted: anchor?.getAttribute("data-mounted") ?? null,
    manualObserver: manual,
  };
});
console.log(JSON.stringify(info, null, 2));

// Also report what the observer sees over two seconds while stationary.
const samples = await page.evaluate(async (duration) => {
  const anchor = document.querySelector(".techstack-anchor");
  const seen = [];
  const observer = new IntersectionObserver(
    (entries) => seen.push(...entries.map((entry) => ({ t: Math.round(performance.now()), isIntersecting: entry.isIntersecting }))),
    { rootMargin: "150% 0px 150% 0px" }
  );
  if (anchor) observer.observe(anchor);
  await new Promise((resolve) => setTimeout(resolve, duration));
  observer.disconnect();
  return seen;
}, 2000);
console.log("observer samples:", JSON.stringify(samples));

await browser.close();
server.kill();
process.exit(0);
