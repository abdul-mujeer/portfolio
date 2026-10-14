import { AppError } from '../lib/errors.js';

const envelope = (code, message, details = []) => ({ error: { code, message, details } });

/** 404 for anything that did not match a route. */
export function notFoundHandler(req, res) {
  if (req.path.startsWith('/api/')) {
    res.status(404).json(envelope('NOT_FOUND', `No handler for ${req.method} ${req.path}`));
    return;
  }
  res.status(404).type('text/plain').send('Not found');
}

/** Central error handler - never leaks stack traces. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    res.status(err.status).json(envelope(err.code, err.message, err.details));
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json(envelope('INVALID_JSON', 'Request body is not valid JSON'));
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json(envelope('PAYLOAD_TOO_LARGE', 'Request body is too large'));
    return;
  }
  console.error('[taskflow] unhandled error:', err);
  res.status(500).json(envelope('INTERNAL_ERROR', 'Unexpected server error'));
}
