/** Small framework-free helpers shared by routes and tests. */

/**
 * Half-up rounding to 2 decimals, avoiding binary floating point drift
 * (e.g. 0.1 + 0.2). All monetary values in ShopSure are stored/returned
 * as numbers with at most 2 decimals.
 */
export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export const MAX_LINE_QUANTITY = 10;
export const FREE_SHIPPING_THRESHOLD = 50;
export const SHIPPING_FEE = 5;
export const DISCOUNT_THRESHOLD = 100;
export const DISCOUNT_RATE = 0.1;

/**
 * Pricing rules (decision table in test-documentation/test-scenarios.md):
 *  - subtotal >= 100  -> 10% discount
 *  - subtotal < 50    -> 5.00 shipping, otherwise free
 *  - total = subtotal - discount + shipping
 */
export function priceOrder(subtotal) {
  const normalized = round2(subtotal);
  const discount = normalized >= DISCOUNT_THRESHOLD ? round2(normalized * DISCOUNT_RATE) : 0;
  const shipping = normalized < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;
  return { subtotal: normalized, discount, shipping, total: round2(normalized - discount + shipping) };
}

/** Parse a cookie header into a plain object. Keeps us free of cookie-parser. */
export function parseCookies(header = "") {
  const out = {};
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

/** Order numbers: ORD-00001, ORD-00002 ... (stable, human readable). */
export function formatOrderNumber(sequence) {
  return `ORD-${String(sequence).padStart(5, "0")}`;
}

/** UTC ISO-8601 timestamp. */
export function nowIso() {
  return new Date().toISOString();
}

/** True when the string is a real calendar date in YYYY-MM-DD form. */
export function isValidCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [y, m, d] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Escape LIKE wildcards so user input cannot change a query pattern. */
export function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
