import { HttpError } from './errors.js';

/** Turns a zod result into a 400 payload with field-level details. */
export function formatIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    code: issue.code,
    message: issue.message,
  }));
}

export function parseOrThrow(schema, payload, { code = 'VALIDATION_ERROR', message = 'Request payload failed validation', status = 400 } = {}) {
  const result = schema.safeParse(payload);
  if (result.success) return result.data;
  throw new HttpError(status, code, message, formatIssues(result.error));
}

/** Guard for early-return style route code as well as thrown errors. */
export function assertOrThrow(condition, error) {
  if (!condition) throw error;
}

const NUMERIC_FORM_FIELDS = new Set([
  'departmentId',
  'managerId',
  'employeeId',
  'salary',
  'id',
  'actorId',
]);

/**
 * HTML forms always submit strings. The API stays strict (JSON numbers only), while
 * pages coerce the documented numeric fields before handing the payload to zod.
 * Empty strings are dropped so optional fields behave like "not supplied".
 */
export function coerceFormPayload(body, numericFields = NUMERIC_FORM_FIELDS) {
  const payload = {};
  for (const [key, rawValue] of Object.entries(body ?? {})) {
    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    if (value === '' || value === undefined || value === null) continue;
    if (numericFields.has(key) && typeof value === 'string') {
      const asNumber = Number(value);
      payload[key] = Number.isFinite(asNumber) ? asNumber : value;
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

/**
 * HTML forms submit every control, including the unfilled ones — an empty `departmentId=`
 * must mean "no filter", not "0". Defect HR-BUG-006: the employee list page answered 400
 * whenever the default "All departments" option was submitted.
 */
export function dropEmptyQueryValues(query) {
  const payload = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === '' || value === undefined || value === null) continue;
    payload[key] = value;
  }
  return payload;
}

export function readString(value) {
  return typeof value === 'string' ? value : undefined;
}
