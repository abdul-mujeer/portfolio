/**
 * SQL fragments shared by task listing and reports.
 *
 * SEEDED DEFECT 001 (only when SEED_DEFECTS=1): the overdue rule becomes
 * "due date <= today" so tasks due *today* are reported overdue, violating
 * business rule 7 (due_date < today).
 */
export function overdueCondition(alias = 't') {
  const comparison = process.env.SEED_DEFECTS === '1' ? '<=' : '<';
  return `${alias}.due_date IS NOT NULL AND ${alias}.due_date ${comparison} ? AND ${alias}.status NOT IN ('DONE', 'CANCELED')`;
}

/** Escape LIKE wildcards so user input is matched literally. */
export function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
