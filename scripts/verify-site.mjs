#!/usr/bin/env node
/**
 * Portfolio site verification.
 *
 * Serves the production build (`dist/`) and drives it in a real Chromium browser via Playwright:
 *   - every portfolio section renders,
 *   - navigation links point at real anchors,
 *   - project cards link to the generated case-study pages,
 *   - the résumé page loads and is printable,
 *   - no uncaught console errors or failed internal requests,
 *   - responsive smoke check at a mobile viewport,
 *   - a screenshot is captured into test-evidence/.
 *
 * Usage: npm run build && npm run verify:site
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = Number(process.env.VERIFY_PORT || 4319);
const BASE = `http://127.0.0.1:${PORT}`;
const EVIDENCE = path.join(ROOT, "test-evidence");
fs.mkdirSync(EVIDENCE, { recursive: true });

if (!fs.existsSync(path.join(ROOT, "dist/index.html"))) {
  console.error("dist/index.html not found. Run `npm run build` first.");
  process.exit(1);
}

const results = [];
const record = (id, title, passed, detail = "") => {
  results.push({ id, title, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${id}  ${title}${passed ? "" : `  [${detail}]`}`);
};

const server = spawn(
  process.execPath,
  [path.join(ROOT, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
  {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  }
);

async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

let browser;
try {
  if (!(await waitForServer())) throw new Error(`preview server did not start on ${BASE}`);

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error" && !/favicon|net::ERR_ABORTED/i.test(message.text())) consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().startsWith(BASE)) failedRequests.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded" });

  // The site shows a loading screen (progress bar) until the 3D character model has finished
  // loading; it then unmounts itself. Wait for that before asserting or capturing screenshots,
  // otherwise the evidence shows the loading overlay instead of the site.
  let loaderDismissed = false;
  try {
    await page.waitForSelector(".loading-screen", { state: "detached", timeout: 90_000 });
    loaderDismissed = true;
  } catch {
    loaderDismissed = false;
  }
  await page.waitForTimeout(2500); // allow the GSAP intro to settle

  if (!loaderDismissed) {
    console.warn("WARNING: the loading overlay was still present after 90s (headless WebGL may be slow).");
  }

  const sections = [
    ["#about", "About"],
    ["#qa-skills", "QA skills"],
    ["#qa-projects", "QA projects"],
    ["#testing", "Testing approach"],
    ["#career", "Experience"],
    ["#work", "Work"],
    ["#education", "Education"],
    ["#contact", "Contact"],
    ["#footer", "Footer"],
  ];

  for (const [selector, label] of sections) {
    const count = await page.locator(selector).count();
    record(`SITE-SEC-${label.replace(/\s+/g, "-").toUpperCase()}`, `section "${label}" exists (${selector})`, count > 0, `found ${count}`);
  }

  const cards = await page.locator("#qa-projects article").count();
  record("SITE-01", "Featured QA project cards render", cards === 3, `found ${cards} cards`);

  const cardImages = await page.locator("#qa-projects article img").evaluateAll((images) =>
    images.map((image) => ({ src: image.getAttribute("src"), width: image.naturalWidth }))
  );
  record(
    "SITE-02",
    "Project card thumbnails load (no broken images)",
    cardImages.length === 3 && cardImages.every((image) => image.width > 0),
    JSON.stringify(cardImages)
  );

  const caseLinks = await page.locator('#qa-projects a[href^="/projects/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  record("SITE-03", "Case-study links exist", caseLinks.length >= 3, JSON.stringify(caseLinks));

  const navTargets = await page.locator(".header ul a").evaluateAll((links) => links.map((link) => link.getAttribute("data-href")));
  const navValid = navTargets.every((target) => target && sections.some(([selector]) => selector === target));
  record("SITE-04", "Navigation targets resolve to real sections", navValid, JSON.stringify(navTargets));

  const resumeHref = await page.locator(".resume-button").getAttribute("href");
  record("SITE-05", "Résumé button points to the generated resume page (not '#')", resumeHref === "/resume.html", String(resumeHref));

  const footerLinks = await page.locator(".qa-footer a").count();
  record("SITE-06", "Footer navigation and social links render", footerLinks >= 10, `${footerLinks} links`);

  const title = await page.title();
  record("SITE-07", "Page title reflects the QA positioning", /QA/i.test(title), title);

  const description = await page.locator('meta[name="description"]').getAttribute("content");
  record("SITE-08", "Meta description present", Boolean(description && description.length > 40), String(description).slice(0, 60));

  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  record("SITE-09", "Favicon declared", favicon === "/favicon.svg", String(favicon));

  await page.screenshot({ path: path.join(EVIDENCE, "portfolio-home-desktop.jpg"), type: "jpeg", quality: 72, fullPage: false });
  await page.locator("#qa-projects").scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(EVIDENCE, "portfolio-qa-projects.jpg"), type: "jpeg", quality: 72, fullPage: false });

  // Résumé page
  await page.goto(`${BASE}/resume.html`, { waitUntil: "domcontentloaded" });
  const resumeHeading = await page.locator("h1").innerText();
  record("SITE-10", "Résumé page loads with the owner's name", /Qazi Abdul Mujeer/i.test(resumeHeading), resumeHeading);

  // Case-study page
  await page.goto(`${BASE}/projects/shopsure-qa/`, { waitUntil: "domcontentloaded" });
  const caseHeading = await page.locator("h1").innerText();
  const caseMetrics = await page.locator(".metric").count();
  record("SITE-11", "ShopSure case study renders with executed metrics", /ShopSure/i.test(caseHeading) && caseMetrics >= 4, `${caseMetrics} metric cards`);
  await page.screenshot({ path: path.join(EVIDENCE, "portfolio-case-study.jpg"), type: "jpeg", quality: 72 });

  // Mobile viewport
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(BASE, { waitUntil: "domcontentloaded" });
  try {
    await mobile.waitForSelector(".loading-screen", { state: "detached", timeout: 90_000 });
  } catch {
    console.warn("WARNING: mobile viewport capture ran before the loader dismissed.");
  }
  await mobile.waitForTimeout(1500);
  const mobileCards = await mobile.locator("#qa-projects article").count();
  record("SITE-12", "Mobile viewport renders the project cards", mobileCards === 3, `${mobileCards} cards`);
  await mobile.screenshot({ path: path.join(EVIDENCE, "portfolio-home-mobile.jpg"), type: "jpeg", quality: 72 });

  record("SITE-13", "No uncaught console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  record("SITE-14", "No failed internal requests (>=400)", failedRequests.length === 0, failedRequests.slice(0, 3).join(" | "));
  record("SITE-15", "Loading screen dismissed and the site is interactive", loaderDismissed, "loading overlay still present after 90s");

  await browser.close();
} catch (error) {
  record("SITE-ERR", "Verification completed without exceptions", false, String(error));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}

const passed = results.filter((result) => result.passed).length;
const report = [
  "# Portfolio site verification",
  "",
  `- Executed: ${new Date().toISOString()}`,
  `- Command: \`npm run verify:site\` (production build served by \`vite preview\`, driven by Playwright Chromium)`,
  `- Result: **${passed}/${results.length} checks passed**`,
  "",
  "| ID | Check | Result | Detail |",
  "|----|-------|--------|--------|",
  ...results.map((result) => `| ${result.id} | ${result.title} | ${result.passed ? "PASS" : "FAIL"} | ${result.detail.replace(/\|/g, "\\|")} |`),
  "",
  "Screenshots captured by this run: `portfolio-home-desktop.jpg`, `portfolio-qa-projects.jpg`,",
  "`portfolio-case-study.jpg`, `portfolio-home-mobile.jpg` (in this folder).",
  "",
].join("\n");

fs.writeFileSync(path.join(EVIDENCE, "site-verification.md"), report);
console.log(`\n${passed}/${results.length} site checks passed. Evidence: test-evidence/site-verification.md`);
process.exit(passed === results.length ? 0 : 1);
