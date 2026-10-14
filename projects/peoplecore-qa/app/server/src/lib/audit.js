import { nowIso } from './dates.js';
import { run } from '../db.js';

/**
 * Appends one immutable audit row. `before` / `after` are serialized as JSON so a
 * reader can diff a mutation without extra tables.
 */
export function writeAudit(db, { actorId, action, entityType, entityId, before = null, after = null }) {
  run(
    db,
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, before_json, after_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      actorId ?? null,
      action,
      entityType,
      entityId === null || entityId === undefined ? null : String(entityId),
      before === null ? null : JSON.stringify(before),
      after === null ? null : JSON.stringify(after),
      nowIso(),
    ],
  );
}

/** Salary is payroll data: only ADMIN/HR may read it inside audit rows. */
export const SALARY_REDACTED = '[redacted]';

export function redactSalary(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = { ...payload };
  if ('salary' in clone) clone.salary = SALARY_REDACTED;
  if (clone.before) clone.before = redactSalary(clone.before);
  if (clone.after) clone.after = redactSalary(clone.after);
  return clone;
}

export function parseAuditRow(row, { includeSalary }) {
  const parse = (json) => {
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      return { unparsable: true };
    }
  };
  const before = parse(row.before_json);
  const after = parse(row.after_json);
  return {
    id: Number(row.id),
    actorId: row.actor_id === null ? null : Number(row.actor_id),
    actorEmail: row.actor_email ?? null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    before: includeSalary ? before : redactSalary(before),
    after: includeSalary ? after : redactSalary(after),
    createdAt: row.created_at,
  };
}
