import { get, run } from '../db.js';
import {
  assertAttendanceRules,
  assertHireDateRules,
  assertLeaveRangeRules,
  assertSalaryRules,
} from '../validation.js';
import { writeAudit } from './audit.js';
import { daysBetweenInclusive, nowIso } from './dates.js';
import { HttpError, isForeignKeyViolation } from './errors.js';
import { hashPassword } from './passwords.js';
import { findLeaveRequest, findOverlappingLeaves } from './queries.js';
import { canReviewLeave, canViewSalary, canWriteAttendance, findEmployee, toPublicEmployee } from './scope.js';
import { skipOverlapCheck } from './seed-defects.js';

/* ------------------------------------------------------------------ helpers */

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export function employeeDtoForActor(db, actor, row) {
  if (!row) return null;
  const includeSalary = canViewSalary(actor, row.id);
  const dto = toPublicEmployee(row, { includeSalary });
  if (!includeSalary) {
    dto.salaryRedacted = true;
  }
  return dto;
}

export function assertDepartmentExists(db, departmentId) {
  const row = get(db, 'SELECT id, name, code FROM departments WHERE id = ?', [departmentId]);
  if (!row) {
    throw HttpError.unprocessable('UNKNOWN_DEPARTMENT', `Department ${departmentId} does not exist`);
  }
  return row;
}

function assertManagerUsable(db, managerId, employeeId = null) {
  const manager = get(db, 'SELECT id, status, first_name, last_name FROM employees WHERE id = ?', [managerId]);
  if (!manager) throw HttpError.unprocessable('UNKNOWN_MANAGER', `Manager ${managerId} does not exist`);
  if (manager.status === 'TERMINATED') {
    throw HttpError.unprocessable('INVALID_MANAGER', 'A terminated employee cannot be used as a manager');
  }
  if (employeeId !== null && Number(managerId) === Number(employeeId)) {
    throw HttpError.unprocessable('SELF_MANAGER', 'An employee cannot be their own manager');
  }
  if (employeeId !== null) {
    // Walk the manager chain to reject cycles.
    let cursor = Number(managerId);
    const seen = new Set();
    while (cursor) {
      if (cursor === Number(employeeId)) {
        throw HttpError.unprocessable('MANAGER_CYCLE', 'managerId must not create a reporting cycle');
      }
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const parent = get(db, 'SELECT manager_id FROM employees WHERE id = ?', [cursor]);
      cursor = parent?.manager_id ? Number(parent.manager_id) : null;
    }
  }
  return manager;
}

function assertEmployeeCodeAvailable(db, employeeCode, excludeId = null) {
  const row = get(db, 'SELECT id FROM employees WHERE employee_code = ? AND (? IS NULL OR id <> ?)', [
    employeeCode,
    excludeId,
    excludeId,
  ]);
  if (row) throw HttpError.conflict('DUPLICATE_EMPLOYEE_CODE', `employeeCode ${employeeCode} is already in use`);
}

function assertEmailAvailable(db, email, excludeId = null) {
  const row = get(db, 'SELECT id FROM employees WHERE lower(email) = ? AND (? IS NULL OR id <> ?)', [
    email,
    excludeId,
    excludeId,
  ]);
  if (row) throw HttpError.conflict('DUPLICATE_EMAIL', `email ${email} is already in use`);
}

/* ---------------------------------------------------------------- employees */

export function createEmployee(db, actor, payload) {
  assertSalaryRules(payload.salary);
  assertHireDateRules(payload.hireDate);
  if (payload.role === 'ADMIN' && actor.role !== 'ADMIN') {
    throw HttpError.forbidden('Only an ADMIN may create an ADMIN account', 'ROLE_FORBIDDEN');
  }

  assertDepartmentExists(db, payload.departmentId);
  if (payload.managerId) assertManagerUsable(db, payload.managerId);

  const email = normalizeEmail(payload.email);
  assertEmployeeCodeAvailable(db, payload.employeeCode);
  assertEmailAvailable(db, email);

  const { hash, salt } = hashPassword(payload.password);
  const timestamp = nowIso();
  const info = run(
    db,
    `INSERT INTO employees
       (employee_code, first_name, last_name, email, password_hash, salt, role, department_id,
        position, salary, hire_date, status, manager_id, phone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.employeeCode,
      payload.firstName,
      payload.lastName,
      email,
      hash,
      salt,
      payload.role,
      payload.departmentId,
      payload.position,
      payload.salary,
      payload.hireDate,
      payload.status ?? 'ACTIVE',
      payload.managerId ?? null,
      payload.phone ?? null,
      timestamp,
      timestamp,
    ],
  );

  const created = findEmployee(db, info.lastInsertRowid);
  const dto = toPublicEmployee(created, { includeSalary: true });
  writeAudit(db, {
    actorId: actor.id,
    action: 'EMPLOYEE_CREATE',
    entityType: 'EMPLOYEE',
    entityId: created.id,
    before: null,
    after: dto,
  });
  return created;
}

export function updateEmployee(db, actor, id, payload) {
  const existing = findEmployee(db, id);
  if (!existing) throw HttpError.notFound(`Employee ${id} does not exist`);

  if (existing.role === 'ADMIN' && actor.role !== 'ADMIN') {
    throw HttpError.forbidden('Only an ADMIN may modify an ADMIN account', 'ROLE_FORBIDDEN');
  }
  if (payload.role !== undefined && payload.role !== existing.role && actor.role !== 'ADMIN') {
    throw HttpError.forbidden('Only an ADMIN may change an employee role', 'ROLE_CHANGE_FORBIDDEN');
  }
  if (payload.salary !== undefined) assertSalaryRules(payload.salary);
  if (payload.hireDate !== undefined) assertHireDateRules(payload.hireDate);
  if (payload.departmentId !== undefined) assertDepartmentExists(db, payload.departmentId);
  if (payload.managerId !== undefined && payload.managerId !== null) {
    assertManagerUsable(db, payload.managerId, id);
  }
  if (payload.employeeCode !== undefined) assertEmployeeCodeAvailable(db, payload.employeeCode, id);
  if (payload.email !== undefined) assertEmailAvailable(db, normalizeEmail(payload.email), id);

  const before = toPublicEmployee(existing, { includeSalary: true });
  const next = {
    employee_code: payload.employeeCode ?? existing.employee_code,
    first_name: payload.firstName ?? existing.first_name,
    last_name: payload.lastName ?? existing.last_name,
    email: payload.email !== undefined ? normalizeEmail(payload.email) : existing.email,
    role: payload.role ?? existing.role,
    department_id: payload.departmentId ?? existing.department_id,
    position: payload.position ?? existing.position,
    salary: payload.salary ?? existing.salary,
    hire_date: payload.hireDate ?? existing.hire_date,
    status: payload.status ?? existing.status,
    manager_id: payload.managerId === undefined ? existing.manager_id : payload.managerId,
    phone: payload.phone === undefined ? existing.phone : payload.phone,
    updated_at: nowIso(),
  };

  if (payload.password) {
    const { hash, salt } = hashPassword(payload.password);
    next.password_hash = hash;
    next.salt = salt;
  }

  const assignments = Object.keys(next).map((column) => `${column} = ?`);
  run(db, `UPDATE employees SET ${assignments.join(', ')} WHERE id = ?`, [...Object.values(next), id]);

  const updated = findEmployee(db, id);
  const after = toPublicEmployee(updated, { includeSalary: true });
  writeAudit(db, {
    actorId: actor.id,
    action: 'EMPLOYEE_UPDATE',
    entityType: 'EMPLOYEE',
    entityId: id,
    before,
    after,
  });
  return updated;
}

export function deleteEmployee(db, actor, id) {
  const existing = findEmployee(db, id);
  if (!existing) throw HttpError.notFound(`Employee ${id} does not exist`);
  if (Number(actor.id) === Number(id)) {
    throw HttpError.unprocessable('CANNOT_DELETE_SELF', 'An administrator cannot delete their own account');
  }
  const reports = get(db, 'SELECT COUNT(*) AS total FROM employees WHERE manager_id = ?', [id]);
  if (Number(reports?.total ?? 0) > 0) {
    throw HttpError.conflict(
      'MANAGER_HAS_DIRECT_REPORTS',
      'Reassign the direct reports (manager_id) before deleting this employee',
    );
  }

  const before = toPublicEmployee(existing, { includeSalary: true });
  try {
    run(db, 'DELETE FROM employees WHERE id = ?', [id]);
  } catch (error) {
    // Defensive mapping: any remaining FK reference becomes a documented conflict
    // instead of an unhandled 500.
    if (isForeignKeyViolation(error)) {
      throw HttpError.conflict('EMPLOYEE_HAS_DEPENDENCIES', 'This employee is still referenced by other records');
    }
    throw error;
  }
  writeAudit(db, {
    actorId: actor.id,
    action: 'EMPLOYEE_DELETE',
    entityType: 'EMPLOYEE',
    entityId: id,
    before,
    after: null,
  });
  return before;
}

/* -------------------------------------------------------------- departments */

export function createDepartment(db, actor, payload) {
  const duplicateName = get(db, 'SELECT id FROM departments WHERE lower(name) = lower(?)', [payload.name]);
  if (duplicateName) throw HttpError.conflict('DUPLICATE_DEPARTMENT_NAME', `Department name "${payload.name}" already exists`);
  const duplicateCode = get(db, 'SELECT id FROM departments WHERE upper(code) = ?', [payload.code]);
  if (duplicateCode) throw HttpError.conflict('DUPLICATE_DEPARTMENT_CODE', `Department code "${payload.code}" already exists`);

  const info = run(db, 'INSERT INTO departments (name, code, created_at) VALUES (?, ?, ?)', [
    payload.name,
    payload.code,
    nowIso(),
  ]);
  const created = get(db, 'SELECT id, name, code, created_at FROM departments WHERE id = ?', [info.lastInsertRowid]);
  writeAudit(db, {
    actorId: actor.id,
    action: 'DEPARTMENT_CREATE',
    entityType: 'DEPARTMENT',
    entityId: created.id,
    before: null,
    after: { id: created.id, name: created.name, code: created.code },
  });
  return created;
}

export function updateDepartment(db, actor, id, payload) {
  const existing = get(db, 'SELECT id, name, code, created_at FROM departments WHERE id = ?', [id]);
  if (!existing) throw HttpError.notFound(`Department ${id} does not exist`);

  if (payload.name !== undefined) {
    const clash = get(db, 'SELECT id FROM departments WHERE lower(name) = lower(?) AND id <> ?', [payload.name, id]);
    if (clash) throw HttpError.conflict('DUPLICATE_DEPARTMENT_NAME', `Department name "${payload.name}" already exists`);
  }
  if (payload.code !== undefined) {
    const clash = get(db, 'SELECT id FROM departments WHERE upper(code) = ? AND id <> ?', [payload.code, id]);
    if (clash) throw HttpError.conflict('DUPLICATE_DEPARTMENT_CODE', `Department code "${payload.code}" already exists`);
  }

  const next = {
    name: payload.name ?? existing.name,
    code: payload.code ?? existing.code,
  };
  run(db, 'UPDATE departments SET name = ?, code = ? WHERE id = ?', [next.name, next.code, id]);

  const updated = get(db, 'SELECT id, name, code, created_at FROM departments WHERE id = ?', [id]);
  writeAudit(db, {
    actorId: actor.id,
    action: 'DEPARTMENT_UPDATE',
    entityType: 'DEPARTMENT',
    entityId: id,
    before: { id: existing.id, name: existing.name, code: existing.code },
    after: { id: updated.id, name: updated.name, code: updated.code },
  });
  return updated;
}

/* --------------------------------------------------------------- attendance */

export function attendanceDto(row) {
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    employeeCode: row.employee_code ?? null,
    employeeName: row.first_name ? `${row.first_name} ${row.last_name}` : null,
    workDate: row.work_date,
    status: row.status,
    checkIn: row.check_in ?? null,
    checkOut: row.check_out ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
  };
}

export function createAttendance(db, actor, payload) {
  assertAttendanceRules(payload);
  const employee = get(db, 'SELECT id, status FROM employees WHERE id = ?', [payload.employeeId]);
  if (!employee) throw HttpError.unprocessable('UNKNOWN_EMPLOYEE', `Employee ${payload.employeeId} does not exist`);
  if (employee.status === 'TERMINATED') {
    throw HttpError.unprocessable('EMPLOYEE_TERMINATED', 'Attendance cannot be recorded for a terminated employee');
  }
  // Defect HR-BUG-004 (found by tests/api/rbac.spec.ts): this endpoint used to check the
  // caller's permission only when PATCHing a row, so any authenticated role could create
  // attendance for anybody. Authorization is now enforced for creation as well.
  if (!canWriteAttendance(db, actor, payload.employeeId)) {
    throw HttpError.forbidden('You may only record attendance for yourself and your direct reports', 'FORBIDDEN');
  }

  const duplicate = get(db, 'SELECT id FROM attendance WHERE employee_id = ? AND work_date = ?', [
    payload.employeeId,
    payload.workDate,
  ]);
  if (duplicate) {
    throw HttpError.conflict(
      'DUPLICATE_ATTENDANCE',
      `Attendance for employee ${payload.employeeId} on ${payload.workDate} already exists`,
    );
  }

  const info = run(
    db,
    `INSERT INTO attendance (employee_id, work_date, status, check_in, check_out, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.employeeId,
      payload.workDate,
      payload.status,
      payload.checkIn ?? null,
      payload.checkOut ?? null,
      payload.notes ?? null,
      nowIso(),
    ],
  );

  const created = get(
    db,
    `SELECT a.*, e.first_name, e.last_name, e.employee_code FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE a.id = ?`,
    [info.lastInsertRowid],
  );
  const dto = attendanceDto(created);
  writeAudit(db, {
    actorId: actor.id,
    action: 'ATTENDANCE_CREATE',
    entityType: 'ATTENDANCE',
    entityId: created.id,
    before: null,
    after: dto,
  });
  return created;
}

export function updateAttendance(db, actor, id, payload) {
  const existing = get(db, 'SELECT * FROM attendance WHERE id = ?', [id]);
  if (!existing) throw HttpError.notFound(`Attendance record ${id} does not exist`);
  const employee = get(db, 'SELECT id, status FROM employees WHERE id = ?', [existing.employee_id]);
  if (employee?.status === 'TERMINATED') {
    throw HttpError.unprocessable('EMPLOYEE_TERMINATED', 'Attendance of a terminated employee cannot be modified');
  }

  const merged = {
    status: payload.status ?? existing.status,
    checkIn: payload.checkIn === undefined ? existing.check_in : payload.checkIn,
    checkOut: payload.checkOut === undefined ? existing.check_out : payload.checkOut,
  };
  assertAttendanceRules(merged);

  const next = {
    status: merged.status,
    check_in: merged.checkIn ?? null,
    check_out: merged.checkOut ?? null,
    notes: payload.notes === undefined ? existing.notes : payload.notes,
  };
  run(db, 'UPDATE attendance SET status = ?, check_in = ?, check_out = ?, notes = ? WHERE id = ?', [
    next.status,
    next.check_in,
    next.check_out,
    next.notes,
    id,
  ]);

  const updated = get(
    db,
    `SELECT a.*, e.first_name, e.last_name, e.employee_code FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE a.id = ?`,
    [id],
  );
  writeAudit(db, {
    actorId: actor.id,
    action: 'ATTENDANCE_UPDATE',
    entityType: 'ATTENDANCE',
    entityId: id,
    before: attendanceDto(existing),
    after: attendanceDto(updated),
  });
  return updated;
}

/* ----------------------------------------------------------- leave requests */

export function leaveDto(row) {
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    employeeCode: row.employee_code ?? null,
    employeeName: row.first_name ? `${row.first_name} ${row.last_name}` : null,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    days: Number(row.days),
    reason: row.reason,
    status: row.status,
    reviewedBy: row.reviewed_by === null || row.reviewed_by === undefined ? null : Number(row.reviewed_by),
    reviewerName: row.reviewer_name ?? null,
    reviewedAt: row.reviewed_at ?? null,
    reviewComment: row.review_comment ?? null,
    createdAt: row.created_at,
  };
}

export function createLeaveRequest(db, actor, payload) {
  const targetId = payload.employeeId ?? actor.id;
  if (Number(targetId) !== Number(actor.id)) {
    throw HttpError.forbidden('You may only submit leave for yourself', 'FORBIDDEN');
  }
  const employee = get(db, 'SELECT id, status FROM employees WHERE id = ?', [targetId]);
  if (!employee) throw HttpError.unprocessable('UNKNOWN_EMPLOYEE', `Employee ${targetId} does not exist`);
  if (employee.status === 'TERMINATED') {
    throw HttpError.unprocessable('EMPLOYEE_TERMINATED', 'A terminated employee cannot submit leave requests');
  }

  const days = daysBetweenInclusive(payload.startDate, payload.endDate);
  assertLeaveRangeRules(payload.startDate, payload.endDate, days);

  const overlaps = findOverlappingLeaves(db, {
    employeeId: targetId,
    startDate: payload.startDate,
    endDate: payload.endDate,
  });
  // SEEDED DEFECT (SEEDED-02, only when SEED_DEFECTS=1): requests that start on the
  // same day as an existing booking slip past the guard. Clean builds always reject.
  const overlap = skipOverlapCheck(payload.startDate, overlaps) ? null : overlaps[0];
  if (overlap) {
    throw HttpError.conflict(
      'LEAVE_OVERLAP',
      `Request overlaps an existing ${overlap.status} request (#${overlap.id}, ${overlap.start_date} → ${overlap.end_date})`,
    );
  }

  const info = run(
    db,
    `INSERT INTO leave_requests
       (employee_id, leave_type, start_date, end_date, days, reason, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [targetId, payload.leaveType, payload.startDate, payload.endDate, days, payload.reason, nowIso()],
  );

  const created = findLeaveRequest(db, info.lastInsertRowid);
  const dto = leaveDto(created);
  writeAudit(db, {
    actorId: actor.id,
    action: 'LEAVE_CREATE',
    entityType: 'LEAVE_REQUEST',
    entityId: created.id,
    before: null,
    after: dto,
  });
  return created;
}

export function reviewLeaveRequest(db, actor, id, { decision, comment = null }) {
  const request = findLeaveRequest(db, id);
  if (!request) throw HttpError.notFound(`Leave request ${id} does not exist`);
  if (!canReviewLeave(db, actor, request)) {
    throw HttpError.forbidden('You may only review leave requests of your direct reports', 'FORBIDDEN');
  }
  if (request.status !== 'PENDING') {
    throw HttpError.unprocessable(
      'INVALID_STATE_TRANSITION',
      `Only PENDING requests can be ${decision === 'APPROVED' ? 'approved' : 'rejected'} (current status: ${request.status})`,
    );
  }
  if (request.employee_status === 'TERMINATED') {
    throw HttpError.unprocessable('EMPLOYEE_TERMINATED', 'Leave of a terminated employee cannot be reviewed');
  }

  run(
    db,
    'UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, review_comment = ? WHERE id = ?',
    [decision, actor.id, nowIso(), comment, id],
  );

  const updated = findLeaveRequest(db, id);
  writeAudit(db, {
    actorId: actor.id,
    action: decision === 'APPROVED' ? 'LEAVE_APPROVE' : 'LEAVE_REJECT',
    entityType: 'LEAVE_REQUEST',
    entityId: id,
    before: leaveDto(request),
    after: leaveDto(updated),
  });
  return updated;
}

export function cancelLeaveRequest(db, actor, id) {
  const request = findLeaveRequest(db, id);
  if (!request) throw HttpError.notFound(`Leave request ${id} does not exist`);
  if (Number(request.employee_id) !== Number(actor.id)) {
    throw HttpError.forbidden('You may only cancel your own leave requests', 'FORBIDDEN');
  }
  if (request.status !== 'PENDING') {
    throw HttpError.unprocessable(
      'INVALID_STATE_TRANSITION',
      `Only PENDING requests can be cancelled (current status: ${request.status})`,
    );
  }

  run(db, 'UPDATE leave_requests SET status = ?, reviewed_at = ? WHERE id = ?', ['CANCELLED', nowIso(), id]);
  const updated = findLeaveRequest(db, id);
  writeAudit(db, {
    actorId: actor.id,
    action: 'LEAVE_CANCEL',
    entityType: 'LEAVE_REQUEST',
    entityId: id,
    before: leaveDto(request),
    after: leaveDto(updated),
  });
  return updated;
}
