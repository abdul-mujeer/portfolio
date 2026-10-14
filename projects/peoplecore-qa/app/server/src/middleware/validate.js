import { HttpError } from '../lib/errors.js';
import { parseOrThrow } from '../lib/validate.js';

export function validateBody(schema, options) {
  return (req, _res, next) => {
    try {
      req.validatedBody = parseOrThrow(schema, req.body ?? {}, options);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * `req.query` is read-only in Express 4, so validated query params are exposed as
 * `req.validatedQuery` and used by the route handlers.
 */
export function validateQuery(schema, options) {
  return (req, _res, next) => {
    try {
      req.validatedQuery = parseOrThrow(schema, req.query ?? {}, options);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function parseIdParam(req, name = 'id') {
  const raw = req.params[name];
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw HttpError.badRequest('VALIDATION_ERROR', `Path parameter ${name} must be a positive integer`, [
      { path: name, code: 'invalid_type', message: `${name} must be a positive integer` },
    ]);
  }
  return value;
}
