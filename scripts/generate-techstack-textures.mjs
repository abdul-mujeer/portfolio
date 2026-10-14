#!/usr/bin/env node
/**
 * Generates the textures used by the floating "toolbox" spheres in the TechStack section.
 *
 * The badges are original graphics (rounded tiles with the tool name) rather than copied logos, so
 * there is no trademark/asset-licensing issue, and the set matches the tools this portfolio actually
 * uses: Postman, SQL, Python, JavaScript, Playwright, Jira, Git and browser DevTools.
 *
 * Rendered with Chromium (already installed for Playwright) and written as PNG to public/images/tech/.
 *
 * Usage: node scripts/generate-techstack-textures.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public/images/tech");

/** label lines, background gradient, text colour */
const TOOLS = [
  { file: "postman", lines: ["Postman"], from: "#ff8a4c", to: "#e8491a", text: "#ffffff" },
  { file: "sql", lines: ["SQL"], from: "#3ba7c4", to: "#00618a", text: "#ffffff" },
  { file: "python", lines: ["Python"], from: "#5aa2d6", to: "#2b5c86", text: "#ffffff" },
  { file: "javascript", lines: ["Java", "Script"], from: "#ffe873", to: "#f0c000", text: "#2b2b2b" },
  { file: "playwright", lines: ["Playwright"], from: "#5fd06a", to: "#1f8a2b", text: "#ffffff" },
  { file: "jira", lines: ["Jira"], from: "#4c9aff", to: "#0747a6", text: "#ffffff" },
  { file: "git", lines: ["Git", "GitHub"], from: "#ff8d6b", to: "#c93a12", text: "#ffffff" },
  { file: "devtools", lines: ["Dev", "Tools"], from: "#79b8ff", to: "#2b6cb0", text: "#ffffff" },
];

const SIZE = 512;

/** Font size that keeps the longest label line inside the tile (bold Geist ≈ 0.62em per character). */
function fontSizeFor(lines) {
  const longest = Math.max(...lines.map((line) => line.length));
  if (longest <= 3) return 150;
  if (longest <= 4) return 132;
  if (longest <= 5) return 120;
  if (longest <= 6) return 106;
  if (longest <= 7) return 94;
  if (longest <= 8) return 84;
  if (longest <= 9) return 76;
  return 70;
}

function html(tool) {
  const base = fontSizeFor(tool.lines);
  const size = tool.lines.length > 1 ? Math.min(base, 96) : base;
  const lines = tool.lines
    .map((line, index) => `<span style="font-size:${size}px;line-height:1.05;${index === 1 ? "opacity:0.92" : ""}">${line}</span>`)
    .join("");
  return `<!doctype html>
  <html><head><meta charset="utf-8" /><style>
    html,body { margin:0; padding:0; width:${SIZE}px; height:${SIZE}px; background:transparent; }
    #badge {
      width:${SIZE}px; height:${SIZE}px; display:flex; flex-direction:column; align-items:center; justify-content:center;
      box-sizing:border-box; padding:30px; text-align:center; overflow:hidden;
      background: radial-gradient(120% 120% at 30% 20%, ${tool.from} 0%, ${tool.to} 100%);
      color:${tool.text};
      font-family: Geist, "Segoe UI", system-ui, Arial, sans-serif;
      font-weight: 800; letter-spacing: 1px;
      border-radius: 96px;
    }
    #badge span { display:block; white-space:nowrap; text-shadow: 0 4px 14px rgba(0,0,0,0.18); }
  </style></head>
  <body><div id="badge">${lines}</div></body></html>`;
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });

for (const tool of TOOLS) {
  await page.setContent(html(tool), { waitUntil: "load" });
  await page.locator("#badge").screenshot({ path: path.join(OUT, `${tool.file}.png`), omitBackground: true });
  console.log(`generated public/images/tech/${tool.file}.png`);
}

await browser.close();
console.log(`\n${TOOLS.length} toolbox textures written to public/images/tech/`);
