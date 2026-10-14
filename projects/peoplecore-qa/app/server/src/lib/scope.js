import { all, get } from '../db.js';
import { HttpError } from './errors.js';

export const PRIVILEGED_ROLES = ['ADMIN', 'HR'];

export function isPrivileged(actor) {
  return Boolean(actor) && PRIVILEGED_ROLES.includes(actor.role);
}

export function directReportIds(db, managerId) {
  return all(db, 'SELECT id FROM employees WHERE manager_id = ?', [managerId]).map((row) => Number(row.id));
}

export function isDirectReport(db, managerId, employeeId) {
  return Boolean(get(db, 'SELECT id FROM employees WHERE id = ? AND manager_id = ?', [employeeId, managerId]));
}

/** EMPLOYEE: self · MANAGER: self + direct reports · ADMIN/HR: everybody. */
export function canViewEmployee(db, actor, targetId) {
  if (!actor) return false;
  if (isPrivileged(actor)) return true;
  if (Number(actor.id) === Number(targetId)) return true;
  if (actor.role === 'MANAGER') return isDirectReport(db, actor.id, targetId);
  return false;
}

/** ADMIN/HR write attendance for anybody, MANAGER for self + direct reports. */
export function canWriteAttendance(db, actor, targetId) {
  if (!actor) return false;
  if (isPrivileged(actor)) return true;
  if (actor.role === 'MANAGER') {
    return Number(actor.id) === Number(targetId) || isDirectReport(db, actor.id, targetId);
  }
  return false;
}

export function canReviewLeave(db, actor, request) {
  if (!actor) return false;
  if (Number(request.employee_id) === Number(actor.id)) return false; // never review your own request
  if (isPrivileged(actor)) return true;
  if (actor.role === 'MANAGER') return isDirectReport(db, actor.id, request.employee_id);
  return false;
}

export function canManageEmployees(actor) {
  return isPrivileged(actor);
}

export function canDeleteEmployees(actor) {
  return actor?.role === 'ADMIN';
}

export function canChangeEmployeeRole(actor) {
  return actor?.role === 'ADMIN';
}

export function canReadAudit(actor) {
  return isPrivileged(actor);
}

/** Payroll data: the employee themself, or ADMIN/HR. Managers see their team without salary. */
export function canViewSalary(actor, targetId) {
  if (!actor) return false;
  return isPrivileged(actor) || Number(actor.id) === Number(targetId);
}

/**
 * Returns `null` for unrestricted reading (ADMIN/HR) or the list of employee ids a
 * restricted actor may read. List endpoints must always apply this filter — the UI
 * never decides access.
 */
export function employeeScopeIds(db, actor) {
  if (!actor) return [];
  if (isPrivileged(actor)) return null;
  if (actor.role === 'MANAGER') return [Number(actor.id), ...directReportIds(db, actor.id)];
  return [Number(actor.id)];
}

/** Builds "AND <column> IN (?,?,?)" for a restricted scope. */
export function scopeClause(scopeIds, column) {
  if (scopeIds === null) return { sql: '', params: [] };
  if (!scopeIds.length) return { sql: ' AND 1 = 0', params: [] };
  return { sql: ` AND ${column} IN (${scopeIds.map(() => '?').join(', ')})`, params: scopeIds };
}

export function assertCanViewEmployee(db, actor, targetId, { notFound = true, row = undefined } = {}) {
  const exists = row !== undefined ? Boolean(row) : Boolean(get(db, 'SELECT id FROM employees WHERE id = ?', [targetId]));
  if (!exists) throw HttpError.notFound('Employee not found');
  if (!canViewEmployee(db, actor, targetId)) {
    throw HttpError.forbidden(
      notFound ? 'You are not allowed to view this employee' : 'You are not allowed to view this employee',
    );
  }
}

export function toPublicEmployee(row, { includeSalary = false, scopeLabel = null } = {}) {
  if (!row) return null;
  const dto = {
    id: Number(row.id),
    employeeCode: row.employee_code,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    email: row.email,
    role: row.role,
    departmentId: row.department_id === null ? null : Number(row.department_id),
    departmentName: row.department_name ?? null,
    position: row.position,
    hireDate: row.hire_date,
    status: row.status,
    managerId: row.manager_id === null || row.manager_id === undefined ? null : Number(row.manager_id),
    managerName: row.manager_name ?? null,
    phone: row.phone ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeSalary) dto.salary = Number(row.salary);
  if (scopeLabel) dto.scope = scopeLabel;
  return dto;
}

export function toPublicActor(row) {
  if (!row) return null;
  // Accepts both the snake_case database row and the camelCase session actor
  // (Defect HR-BUG-007: the page header rendered "undefined undefined").
  const firstName = row.first_name ?? row.firstName ?? '';
  const lastName = row.last_name ?? row.lastName ?? '';
  return {
    id: Number(row.id),
    employeeCode: row.employee_code ?? row.employeeCode ?? null,
    fullName: `${firstName} ${lastName}`.trim(),
    email: row.email,
    role: row.role,
    departmentId: row.department_id === undefined || row.department_id === null ? null : Number(row.department_id),
    status: row.status,
  };
}

export const EMPLOYEE_SELECT = `
  SELECT e.*, d.name AS department_name, m.first_name || ' ' || m.last_name AS manager_name
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees m ON m.id = e.manager_id
`;

export function findEmployee(db, id) {
  return get(db, `${EMPLOYEE_SELECT} WHERE e.id = ?`, [id]);
}
