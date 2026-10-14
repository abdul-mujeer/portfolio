/**
 * HTTP error type + the single Express error handler.
 *
 * Every failure returns the same envelope:
 *   { "error": { "code": "STRING_CODE", "message": "human readable", "details": [...] } }
 *
 * Stack traces are never sent to clients.
 */
export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, "VALIDATION_ERROR", message, details);
export const unauthorized = (message = "Authentication required.") => new HttpError(401, "UNAUTHENTICATED", message);
export const forbidden = (message = "You do not have permission to perform this action.") => new HttpError(403, "FORBIDDEN", message);
export const notFound = (message = "Resource not found.") => new HttpError(404, "NOT_FOUND", message);
export const conflict = (message, code = "CONFLICT") => new HttpError(409, code, message);
export const unprocessable = (message, code = "BUSINESS_RULE_VIOLATION") => new HttpError(422, code, message);

/** Wraps async route handlers so rejections reach the error middleware (Express 4). */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function notFoundHandler(req, res, next) {
  next(new HttpError(404, "NOT_FOUND", `No route matches ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // body-parser failures arrive as plain errors with a `type` field (SHOP-BUG-002 / SHOP-BUG-003).
  if (err && err.type === "entity.parse.failed") {
    const body = { error: { code: "VALIDATION_ERROR", message: "Request body is not valid JSON." } };
    if (process.env.NODE_ENV !== "test") console.warn(`[shopsure] ${req.method} ${req.originalUrl} -> 400 malformed JSON`);
    return res.status(400).json(body);
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the 100kb limit." },
    });
  }
  if (err && err.type === "encoding.unsupported") {
    return res.status(415).json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Unsupported content encoding." } });
  }

  if (err instanceof HttpError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.details) body.error.details = err.details;
    if (process.env.NODE_ENV !== "test") {
      // keep server logs useful without leaking anything to the client
      console.warn(`[shopsure] ${req.method} ${req.originalUrl} -> ${err.status} ${err.code}: ${err.message}`);
    }
    return res.status(err.status).json(body);
  }

  console.error("[shopsure] unhandled error:", err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Unexpected server error. Please try again." },
  });
}
