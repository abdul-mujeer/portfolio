/**
 * Date/time helpers. All timestamps are ISO-8601 UTC strings; date-only fields
 * use YYYY-MM-DD. `isRealCalendarDate` rejects impossible dates (e.g. 2026-02-30)
 * and honours leap years.
 */

export function nowIso() {
  return new Date().toISOString();
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function addHoursIso(hours) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Strict calendar-date validation: format, month range, day range and a
 * round-trip through Date.UTC (which normalizes 2026-02-30 -> 2026-03-02,
 * so a mismatch means the input was not a real date).
 */
export function isRealCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const roundTrip = new Date(Date.UTC(y, m - 1, d));
  return (
    roundTrip.getUTCFullYear() === y &&
    roundTrip.getUTCMonth() === m - 1 &&
    roundTrip.getUTCDate() === d
  );
}

export function isValidIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}
