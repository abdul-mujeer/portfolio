const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Strict calendar validation: 2026-02-30 or 2026-13-01 are invalid (not just malformed). */
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function isTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

/** Local (not UTC) calendar day — matches what a user sees in the browser. */
export function todayIso(reference = new Date()) {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  const day = String(reference.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function nowIso(reference = new Date()) {
  return reference.toISOString();
}

export function addDays(isoDate, amount) {
  const base = new Date(`${isoDate}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + amount);
  return base.toISOString().slice(0, 10);
}

export function addHours(isoTimestamp, hours) {
  const base = new Date(isoTimestamp);
  base.setTime(base.getTime() + hours * 60 * 60 * 1000);
  return base.toISOString();
}

/** Inclusive day difference: 2026-01-01 → 2026-01-01 = 1 day. */
export function daysBetweenInclusive(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

export function isWeekend(isoDate) {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** The most recent `count` weekdays, newest first, starting at `reference`. */
export function recentWorkdays(count, reference = new Date()) {
  const days = [];
  let cursor = todayIso(reference);
  while (days.length < count) {
    if (!isWeekend(cursor)) days.push(cursor);
    cursor = addDays(cursor, -1);
  }
  return days.reverse();
}

export function isBefore(first, second) {
  return Date.parse(`${first}T00:00:00Z`) < Date.parse(`${second}T00:00:00Z`);
}

export function hasMaxTwoDecimals(value) {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-9;
}
