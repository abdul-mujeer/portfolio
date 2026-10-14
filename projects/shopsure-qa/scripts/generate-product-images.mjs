#!/usr/bin/env node
/**
 * Generates the lightweight SVG product images used by the demo store.
 * Deterministic: the same SKU always produces the same artwork, so screenshots and tests are stable.
 *
 * Usage: node scripts/generate-product-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { products } from "../test-data/seed/seed-data.mjs";

const outDir = path.resolve(import.meta.dirname, "../app/public/images/products");
fs.mkdirSync(outDir, { recursive: true });

const PALETTE = {
  electronics: ["#2f5bea", "#0d1b4c"],
  "home-kitchen": ["#c96f3b", "#3d1f10"],
  books: ["#2f8f6b", "#0f2f24"],
  sports: ["#7a4fd0", "#2a1250"],
  toys: ["#d04f8f", "#4c0f30"],
  apparel: ["#3f8fc9", "#11304a"],
};

/** djb2 hash -> stable pseudo-random accents per SKU. */
function hash(text) {
  let value = 5381;
  for (let i = 0; i < text.length; i += 1) value = ((value << 5) + value + text.charCodeAt(i)) >>> 0;
  return value;
}

function initials(name) {
  return name
    .split(" ")
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

let count = 0;
for (const product of products) {
  const [from, to] = PALETTE[product.categorySlug] ?? PALETTE.electronics;
  const seed = hash(product.sku);
  const angle = seed % 360;
  const cx = 80 + (seed % 160);
  const cy = 60 + ((seed >> 3) % 140);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="${product.name}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#g)"/>
  <circle cx="${cx}" cy="${cy}" r="120" fill="#ffffff" opacity="0.08"/>
  <circle cx="${400 - cx}" cy="${300 - cy}" r="70" fill="#ffffff" opacity="0.06"/>
  <text x="200" y="168" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="72" font-weight="700" fill="#ffffff" opacity="0.92">${initials(
    product.name
  )}</text>
  <text x="200" y="216" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" fill="#ffffff" opacity="0.75">${product.sku}</text>
</svg>
`;
  fs.writeFileSync(path.join(outDir, `${product.sku.toLowerCase()}.svg`), svg, "utf8");
  count += 1;
}

console.log(`Generated ${count} product SVG images in ${outDir}`);
