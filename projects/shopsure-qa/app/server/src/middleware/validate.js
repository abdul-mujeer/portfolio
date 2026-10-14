import { HttpError } from "../lib/errors.js";

/**
 * zod body validation middleware: replaces req.body with the parsed/normalized value
 * and returns a 400 VALIDATION_ERROR with field details on failure.
 */
export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "(root)",
        message: issue.message,
      }));
      return next(new HttpError(400, "VALIDATION_ERROR", "Request body failed validation.", details));
    }
    req.body = result.data;
    next();
  };
}

/** Validates a positive integer route parameter (e.g. /products/:id). */
export function validateIdParam(name = "id") {
  return (req, _res, next) => {
    const raw = req.params[name];
    if (!/^\d+$/.test(String(raw))) {
      return next(new HttpError(400, "VALIDATION_ERROR", `Parameter "${name}" must be a positive integer.`));
    }
    req.params[name] = Number(raw);
    next();
  };
}

/**
 * Shared list-query parsing: page (>=1), limit (1..max), whitelisted sort/order.
 * Returns { page, limit, offset, sort, order } or throws a 400.
 */
export function parseListQuery(query, { sortable, defaultSort, maxLimit = 50, defaultLimit = 12 }) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    throw new HttpError(400, "VALIDATION_ERROR", "Query parameter \"page\" must be an integer >= 1.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new HttpError(400, "VALIDATION_ERROR", `Query parameter "limit" must be an integer between 1 and ${maxLimit}.`);
  }

  const sort = query.sort === undefined ? defaultSort : String(query.sort);
  if (!sortable[sort]) {
    throw new HttpError(400, "VALIDATION_ERROR", `Unsupported sort field "${sort}". Allowed: ${Object.keys(sortable).join(", ")}.`);
  }
  const order = query.order === undefined ? "asc" : String(query.order).toLowerCase();
  if (order !== "asc" && order !== "desc") {
    throw new HttpError(400, "VALIDATION_ERROR", 'Query parameter "order" must be "asc" or "desc".');
  }

  return { page, limit, offset: (page - 1) * limit, sort: sortable[sort], order };
}
