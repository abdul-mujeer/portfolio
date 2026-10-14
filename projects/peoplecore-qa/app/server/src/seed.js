import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from './config.js';
import { run } from './db.js';
import { addDays, daysBetweenInclusive, nowIso, recentWorkdays, todayIso } from './lib/dates.js';
import { hashPassword } from './lib/passwords.js';

export const SEED_FIXTURES_DIR = path.join(PROJECT_ROOT, 'test-data', 'seed');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(SEED_FIXTURES_DIR, file), 'utf8'));
}

export function loadSeedFixtures() {
  return {
    departments: readJson('departments.json'),
    employees: readJson('employees.json'),
    attendance: readJson('attendance.json'),
    leaveRequests: readJson('leave-requests.json'),
    audit: readJson('audit.json'),
  };
}

/** Wipes every table in FK-safe order and resets the AUTOINCREMENT counters. */
export function truncateAll(db) {
  for (const table of ['audit_logs', 'sessions', 'login_attempts', 'leave_requests', 'attendance', 'employees', 'departments']) {
    run(db, `DELETE FROM ${table}`);
  }
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('departments','employees','attendance','leave_requests','audit_logs')");
}

/**
 * Inserts the deterministic fixture set. `reference` controls relative dates so a
 * run can be reproduced with SEED_AS_OF=YYYY-MM-DD.
 */
export function seedDatabase(db, { reference = new Date(), fixtures = loadSeedFixtures() } = {}) {
  truncateAll(db);

  const today = todayIso(reference);
  const now = nowIso(reference);
  const departmentIdByCode = new Map();

  for (const department of fixtures.departments) {
    run(db, 'INSERT INTO departments (id, name, code, created_at) VALUES (?, ?, ?, ?)', [
      department.id,
      department.name,
      department.code,
      now,
    ]);
    departmentIdByCode.set(department.code, department.id);
  }

  const employeeIdByCode = new Map();
  for (const employee of fixtures.employees) {
    const departmentId = departmentIdByCode.get(employee.departmentCode);
    if (!departmentId) throw new Error(`Unknown departmentCode ${employee.departmentCode} for ${employee.employeeCode}`);
    const { hash } = hashPassword(employee.password, employee.salt);
    const managerId = employee.managerCode ? employeeIdByCode.get(employee.managerCode) : null;
    if (employee.managerCode && !managerId) {
      throw new Error(`Manager ${employee.managerCode} must be seeded before ${employee.employeeCode}`);
    }
    run(
      db,
      `INSERT INTO employees
         (id, employee_code, first_name, last_name, email, password_hash, salt, role, department_id,
          position, salary, hire_date, status, manager_id, phone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee.id,
        employee.employeeCode,
        employee.firstName,
        employee.lastName,
        employee.email.toLowerCase(),
        hash,
        employee.salt,
        employee.role,
        departmentId,
        employee.position,
        employee.salary,
        employee.hireDate,
        employee.status,
        managerId ?? null,
        employee.phone ?? null,
        now,
        now,
      ],
    );
    employeeIdByCode.set(employee.employeeCode, employee.id);
  }

  // 60 attendance rows: one per employee per seeded workday.
  const workdays = recentWorkdays(fixtures.attendance.workdayWindow, reference).reverse(); // most recent first
  let attendanceRows = 0;
  for (const entry of fixtures.attendance.employees) {
    const employeeId = employeeIdByCode.get(entry.employeeCode);
    if (!employeeId) throw new Error(`Unknown employeeCode ${entry.employeeCode} in attendance.json`);
    entry.pattern.forEach((slot, index) => {
      const workDate = workdays[index];
      if (!workDate) return;
      const withTimes = slot.status === 'PRESENT' || slot.status === 'REMOTE';
      run(
        db,
        `INSERT INTO attendance (employee_id, work_date, status, check_in, check_out, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          employeeId,
          workDate,
          slot.status,
          withTimes ? entry.checkIn : null,
          withTimes ? entry.checkOut : null,
          slot.notes ?? null,
          now,
        ],
      );
      attendanceRows += 1;
    });
  }

  let leaveRows = 0;
  for (const request of fixtures.leaveRequests.requests) {
    const employeeId = employeeIdByCode.get(request.employeeCode);
    if (!employeeId) throw new Error(`Unknown employeeCode ${request.employeeCode} in leave-requests.json`);
    const startDate = addDays(today, request.startOffsetDays);
    const endDate = addDays(today, request.endOffsetDays);
    const days = daysBetweenInclusive(startDate, endDate);
    const reviewedById = request.reviewedByCode ? employeeIdByCode.get(request.reviewedByCode) : null;
    const reviewedAt = request.reviewedOffsetDays === null ? null : `${addDays(today, request.reviewedOffsetDays)}T09:00:00.000Z`;
    run(
      db,
      `INSERT INTO leave_requests
         (id, employee_id, leave_type, start_date, end_date, days, reason, status,
          reviewed_by, reviewed_at, review_comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.id,
        employeeId,
        request.leaveType,
        startDate,
        endDate,
        days,
        request.reason,
        request.status,
        reviewedById ?? null,
        reviewedAt,
        request.reviewComment ?? null,
        `${addDays(today, Math.min(-1, request.reviewedOffsetDays ?? -1))}T08:30:00.000Z`,
      ],
    );
    leaveRows += 1;
  }

  let auditRows = 0;
  for (const entry of fixtures.audit.entries) {
    const actorId = employeeIdByCode.get(entry.actorCode);
    run(
      db,
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, before_json, after_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        actorId ?? null,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.before === null ? null : JSON.stringify(entry.before),
        entry.after === null ? null : JSON.stringify(entry.after),
        `${addDays(today, entry.createdOffsetDays)}T10:00:00.000Z`,
      ],
    );
    auditRows += 1;
  }

  return {
    reference: today,
    departments: fixtures.departments.length,
    employees: fixtures.employees.length,
    attendance: attendanceRows,
    leaveRequests: leaveRows,
    auditLogs: auditRows,
  };
}
