import { HttpError } from '../lib/errors.js';

export function notFoundHandler(req, _res, next) {
  next(HttpError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

function wantsJson(req) {
  if (req.originalUrl.startsWith('/api')) return true;
  if (req.path.startsWith('/api')) return true;
  return false;
}

function normalizeError(error) {
  if (error instanceof HttpError) return error;

  if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return HttpError.badRequest('INVALID_JSON', 'Request body is not valid JSON');
  }
  if (error?.type === 'entity.too.large') {
    return HttpError.badRequest('PAYLOAD_TOO_LARGE', 'Request body is larger than the 100kb limit');
  }
  return HttpError.internal();
}

/** eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity. */
export function errorHandler(error, req, res, _next) {
  const normalized = normalizeError(error);
  const status = normalized.status ?? 500;

  if (status >= 500) {
    // Never leak stack traces to clients; log server-side only.
    console.error(`[peoplecore] ${req.method} ${req.originalUrl} → ${status}`, error);
  }

  if (wantsJson(req)) {
    return res.status(status).json(normalized.toJSON());
  }

  const view = status === 403 ? '403' : status === 404 ? '404' : 'error';
  return res.status(status).render(view, {
    title: status === 403 ? 'Forbidden' : status === 404 ? 'Not found' : 'Something went wrong',
    statusCode: status,
    errorCode: normalized.code,
    errorMessage: normalized.message,
    details: normalized.details ?? [],
  });
}
