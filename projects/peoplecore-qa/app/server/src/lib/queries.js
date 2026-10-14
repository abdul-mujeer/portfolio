import { all, get } from '../db.js';
import { employeeScopeIds, scopeClause, EMPLOYEE_SELECT } from './scope.js';
import { bypassManagerListScope } from './seed-defects.js';

const EMPLOYEE_SORT_COLUMNS = {
  id: 'e.id',
  employeeCode: 'e.employee_code',
  firstName: 'e.first_name',
  lastName: 'e.last_name',
  email: 'e.email',
  hireDate: 'e.hire_date',
  salary: 'e.salary',
  status: 'e.status',
  role: 'e.role',
  department: 'd.name',
};

const ATTENDANCE_SORT_COLUMNS = {
  id: 'a.id',
  workDate: 'a.work_date',
  employeeId: 'a.employee_id',
  status: 'a.status',
};

const LEAVE_SORT_COLUMNS = {
  id: 'l.id',
  startDate: 'l.start_date',
  endDate: 'l.end_date',
  status: 'l.status',
  createdAt: 'l.created_at',
};

const AUDIT_SORT_COLUMNS = { id: 'audit.id' };

function orderBy(map, sort, order = 'asc', tieBreaker = 'id') {
  const column = map[sort] ?? map[tieBreaker] ?? 'id';
  const direction = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  if (column === map[tieBreaker]) return `ORDER BY ${column} ${direction}`;
  return `ORDER BY ${column} ${direction}, ${map[tieBreaker]} ASC`;
}

function likePattern(value) {
  return `%${String(value).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function listDepartments(db) {
  return all(
    db,
    `SELECT d.id, d.name, d.code, d.created_at,
            (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id) AS employee_count
     FROM departments d
     ORDER BY d.name ASC`,
  ).map((row) => ({
    id: Number(row.id),
    name: row.name,
    code: row.code,
    createdAt: row.created_at,
    employeeCount: Number(row.employee_count),
  }));
}

/* ------------------------------------------------------------------ employees */

export function listEmployees(db, { actor, filters = {}, page = 1, limit = 20 } = {}) {
  // SEEDED DEFECT (SEEDED-01, only when SEED_DEFECTS=1): a MANAGER loses the
  // direct-report scope on the list endpoint. Clean builds always scope.
  const scopeIds = bypassManagerListScope(actor) ? null : employeeScopeIds(db, actor);
  const where = [];
  const params = [];

  if (filters.q) {
    where.push(`(e.first_name LIKE ? ESCAPE '\\' OR e.last_name LIKE ? ESCAPE '\\' OR e.email LIKE ? ESCAPE '\\' OR e.employee_code LIKE ? ESCAPE '\\')`);
    const pattern = likePattern(filters.q);
    params.push(pattern, pattern, pattern, pattern);
  }
  if (filters.departmentId) {
    where.push('e.department_id = ?');
    params.push(filters.departmentId);
  }
  if (filters.status) {
    where.push('e.status = ?');
    params.push(filters.status);
  }
  if (filters.role) {
    where.push('e.role = ?');
    params.push(filters.role);
  }
  if (filters.managerId) {
    where.push('e.manager_id = ?');
    params.push(filters.managerId);
  }

  const scope = scopeClause(scopeIds, 'e.id');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}${scope.sql}` : scope.sql ? `WHERE 1 = 1${scope.sql}` : '';
  const queryParams = [...params, ...scope.params];

  const totalRow = get(db, `SELECT COUNT(*) AS total FROM employees e ${whereSql}`, queryParams);
  const total = Number(totalRow?.total ?? 0);

  const rows = all(
    db,
    `${EMPLOYEE_SELECT} ${whereSql} ${orderBy(EMPLOYEE_SORT_COLUMNS, filters.sort ?? 'employeeCode', filters.order, 'id')} LIMIT ? OFFSET ?`,
    [...queryParams, limit, (page - 1) * limit],
  );

  return { rows, total, page, limit, scopeIds };
}

/* ---------------------------------------------------------------- attendance */

export function listAttendance(db, { actor, filters = {}, page = 1, limit = 20 } = {}) {
  const scopeIds = employeeScopeIds(db, actor);
  const where = [];
  const params = [];

  if (filters.employeeId) {
    where.push('a.employee_id = ?');
    params.push(filters.employeeId);
  }
  if (filters.date) {
    where.push('a.work_date = ?');
    params.push(filters.date);
  }
  if (filters.from) {
    where.push('a.work_date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('a.work_date <= ?');
    params.push(filters.to);
  }
  if (filters.status) {
    where.push('a.status = ?');
    params.push(filters.status);
  }

  const scope = scopeClause(scopeIds, 'a.employee_id');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}${scope.sql}` : scope.sql ? `WHERE 1 = 1${scope.sql}` : '';
  const queryParams = [...params, ...scope.params];

  const total = Number(get(db, `SELECT COUNT(*) AS total FROM attendance a ${whereSql}`, queryParams)?.total ?? 0);
  const rows = all(
    db,
    `SELECT a.*, e.first_name, e.last_name, e.employee_code
     FROM attendance a JOIN employees e ON e.id = a.employee_id
     ${whereSql} ${orderBy(ATTENDANCE_SORT_COLUMNS, filters.sort ?? 'workDate', filters.order, 'id')}
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, (page - 1) * limit],
  );

  return { rows, total, page, limit, scopeIds };
}

/* ------------------------------------------------------------ leave requests */

export function listLeaveRequests(db, { actor, filters = {}, page = 1, limit = 20 } = {}) {
  const scopeIds = employeeScopeIds(db, actor);
  const where = [];
  const params = [];

  if (filters.status) {
    where.push('l.status = ?');
    params.push(filters.status);
  }
  if (filters.employeeId) {
    where.push('l.employee_id = ?');
    params.push(filters.employeeId);
  }

  const scope = scopeClause(scopeIds, 'l.employee_id');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}${scope.sql}` : scope.sql ? `WHERE 1 = 1${scope.sql}` : '';
  const queryParams = [...params, ...scope.params];

  const total = Number(get(db, `SELECT COUNT(*) AS total FROM leave_requests l ${whereSql}`, queryParams)?.total ?? 0);
  const rows = all(
    db,
    `SELECT l.*, e.first_name, e.last_name, e.employee_code,
            r.first_name || ' ' || r.last_name AS reviewer_name
     FROM leave_requests l
     JOIN employees e ON e.id = l.employee_id
     LEFT JOIN employees r ON r.id = l.reviewed_by
     ${whereSql} ${orderBy(LEAVE_SORT_COLUMNS, filters.sort ?? 'startDate', filters.order, 'id')}
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, (page - 1) * limit],
  );

  return { rows, total, page, limit, scopeIds };
}

export function findLeaveRequest(db, id) {
  return get(
    db,
    `SELECT l.*, e.first_name, e.last_name, e.employee_code, e.status AS employee_status,
            r.first_name || ' ' || r.last_name AS reviewer_name
     FROM leave_requests l
     JOIN employees e ON e.id = l.employee_id
     LEFT JOIN employees r ON r.id = l.reviewed_by
     WHERE l.id = ?`,
    [id],
  );
}

/** "no overlapping PENDING/APPROVED request for the same employee" (business rule 5). */
export function findOverlappingLeaves(db, { employeeId, startDate, endDate, excludeId = null }) {
  return all(
    db,
    `SELECT id, start_date, end_date, status
     FROM leave_requests
     WHERE employee_id = ?
       AND status IN ('PENDING','APPROVED')
       AND start_date <= ?
       AND end_date >= ?
       AND (? IS NULL OR id <> ?)
     ORDER BY start_date ASC`,
    [employeeId, endDate, startDate, excludeId, excludeId],
  );
}

export function findOverlappingLeave(db, options) {
  return findOverlappingLeaves(db, options)[0] ?? null;
}

/* ---------------------------------------------------------------- audit logs */

export function listAuditLogs(db, { filters = {}, page = 1, limit = 20 } = {}) {
  const where = [];
  const params = [];

  if (filters.entityType) {
    where.push('audit.entity_type = ?');
    params.push(filters.entityType);
  }
  if (filters.entityId) {
    where.push('audit.entity_id = ?');
    params.push(filters.entityId);
  }
  if (filters.actorId) {
    where.push('audit.actor_id = ?');
    params.push(filters.actorId);
  }
  if (filters.action) {
    where.push('audit.action = ?');
    params.push(filters.action);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(get(db, `SELECT COUNT(*) AS total FROM audit_logs audit ${whereSql}`, params)?.total ?? 0);
  const rows = all(
    db,
    `SELECT audit.*, a.email AS actor_email, a.first_name || ' ' || a.last_name AS actor_name
     FROM audit_logs audit
     LEFT JOIN employees a ON a.id = audit.actor_id
     ${whereSql} ${orderBy(AUDIT_SORT_COLUMNS, filters.sort ?? 'id', filters.order ?? 'desc', 'id')}
     LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit],
  );

  return { rows, total, page, limit };
}

/* ------------------------------------------------------------------ reports */

export function headcountByDepartment(db, scopeIds) {
  const scope = scopeClause(scopeIds, 'e.id');
  return all(
    db,
    `SELECT d.id AS department_id, d.name AS department, d.code,
            COUNT(e.id) AS total,
            SUM(CASE WHEN e.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN e.status = 'ON_LEAVE' THEN 1 ELSE 0 END) AS on_leave,
            SUM(CASE WHEN e.status = 'TERMINATED' THEN 1 ELSE 0 END) AS terminated
     FROM departments d
     LEFT JOIN employees e ON e.department_id = d.id${scope.sql}
     GROUP BY d.id, d.name, d.code
     ORDER BY d.name ASC`,
    scope.params,
  ).map((row) => ({
    departmentId: Number(row.department_id),
    department: row.department,
    code: row.code,
    total: Number(row.total),
    active: Number(row.active ?? 0),
    onLeave: Number(row.on_leave ?? 0),
    terminated: Number(row.terminated ?? 0),
  }));
}

export function leaveCountByStatus(db, scopeIds) {
  const scope = scopeClause(scopeIds, 'employee_id');
  const rows = all(
    db,
    `SELECT status, COUNT(*) AS total FROM leave_requests WHERE 1 = 1${scope.sql} GROUP BY status ORDER BY status ASC`,
    scope.params,
  );
  const byStatus = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
  for (const row of rows) byStatus[row.status] = Number(row.total);
  return byStatus;
}

export function attendanceSummary(db, scopeIds, { from, to }) {
  const scope = scopeClause(scopeIds, 'employee_id');
  const row = get(
    db,
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status = 'REMOTE' THEN 1 ELSE 0 END) AS remote,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN status = 'LEAVE' THEN 1 ELSE 0 END) AS on_leave
     FROM attendance
     WHERE work_date >= ? AND work_date <= ?${scope.sql}`,
    [from, to, ...scope.params],
  );
  const total = Number(row?.total ?? 0);
  const present = Number(row?.present ?? 0);
  const remote = Number(row?.remote ?? 0);
  return {
    from,
    to,
    records: total,
    present,
    remote,
    absent: Number(row?.absent ?? 0),
    leave: Number(row?.on_leave ?? 0),
    attendanceRate: total === 0 ? 0 : Math.round(((present + remote) / total) * 1000) / 10,
  };
}

export function pendingReviewCount(db, actor) {
  const scopeIds = employeeScopeIds(db, actor);
  const scope = scopeClause(scopeIds, 'employee_id');
  const row = get(
    db,
    `SELECT COUNT(*) AS total FROM leave_requests WHERE status = 'PENDING' AND employee_id <> ?${scope.sql}`,
    [actor.id, ...scope.params],
  );
  return Number(row?.total ?? 0);
}
