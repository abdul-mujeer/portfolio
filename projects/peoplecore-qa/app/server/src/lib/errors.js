/** Error envelope shared by every endpoint: { error: { code, message, details } }. */
export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(code, message, details) {
    return new HttpError(400, code, message, details);
  }

  static unauthenticated(message = 'Authentication required', code = 'UNAUTHENTICATED') {
    return new HttpError(401, code, message);
  }

  static forbidden(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    return new HttpError(403, code, message);
  }

  static notFound(message = 'Resource not found') {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static conflict(code, message) {
    return new HttpError(409, code, message);
  }

  static unprocessable(code, message, details) {
    return new HttpError(422, code, message, details);
  }

  static locked(message = 'Account temporarily locked after too many failed sign-in attempts') {
    return new HttpError(423, 'ACCOUNT_LOCKED', message);
  }

  static internal(message = 'Unexpected server error') {
    return new HttpError(500, 'INTERNAL_ERROR', message);
  }

  toJSON() {
    const error = { code: this.code, message: this.message };
    if (this.details !== undefined) error.details = this.details;
    return { error };
  }
}

export function isForeignKeyViolation(error) {
  const message = String(error?.message ?? '');
  return /FOREIGN KEY constraint failed/i.test(message);
}

export function isUniqueViolation(error) {
  const message = String(error?.message ?? '');
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(message);
}
