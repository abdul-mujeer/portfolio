import { badRequest } from '../lib/errors.js';

function toDetails(issues) {
  return issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Validates req.body against a zod schema. Schemas are `.strict()`: unknown
 * fields are rejected with 400 (mass-assignment protection is therefore
 * verified in tests/security).
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      throw badRequest('Request body failed validation', toDetails(result.error.issues));
    }
    req.validatedBody = result.data;
    next();
  };
}

/** Validates query-string parameters (page/limit/filters/sort). */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query ?? {});
    if (!result.success) {
      throw badRequest('Query parameters failed validation', toDetails(result.error.issues));
    }
    req.validatedQuery = result.data;
    next();
  };
}
