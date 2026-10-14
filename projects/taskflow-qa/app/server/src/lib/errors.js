/**
 * Application error type + factories.
 *
 * Every error that reaches the client is converted to the standard envelope:
 *   { "error": { "code": "STRING_CODE", "message": "human readable", "details": [...] } }
 * Stack traces are never sent to clients (see middleware/error.js).
 */
export class AppError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// 400 - request failed schema/type validation
export function badRequest(message = 'Validation failed', details = []) {
  return new AppError(400, 'VALIDATION_ERROR', message, details);
}

// 401 - no or invalid session
export function unauthorized(message = 'Authentication required') {
  return new AppError(401, 'UNAUTHENTICATED', message);
}

// 403 - authenticated but not allowed by role/ownership rules
export function forbidden(message = 'You do not have permission to perform this action') {
  return new AppError(403, 'FORBIDDEN', message);
}

// 404 - missing resource. Also used to hide cross-project resources from outsiders.
export function notFound(message = 'Resource not found') {
  return new AppError(404, 'NOT_FOUND', message);
}

// 409 - duplicate/conflict with current state
export function conflict(code, message) {
  return new AppError(409, code, message);
}

// 422 - request understood but violates a business rule
export function businessRule(code, message, details = []) {
  return new AppError(422, code, message, details);
}
