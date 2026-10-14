import { expect, type APIRequestContext } from '@playwright/test';

/** Seeded demo accounts (documented in the README). Synthetic data only. */
export const CREDENTIALS = {
  admin: { email: 'admin@example.com', password: 'Admin#12345' },
  hr: { email: 'hr@example.com', password: 'Hr#1234567' },
  manager: { email: 'manager@example.com', password: 'Manager#12345' },
  employee1: { email: 'employee1@example.com', password: 'Employee#1234' },
  employee2: { email: 'employee2@example.com', password: 'Employee#1234' },
  employee6: { email: 'employee6@example.com', password: 'Employee#1234' },
  employee7: { email: 'employee7@example.com', password: 'Employee#1234' },
} as const;

export type RoleKey = keyof typeof CREDENTIALS;

/** Seeded employee ids used by the assertions. */
export const SEEDED = {
  adminId: 1,
  hrId: 2,
  managerId: 3,
  employee1Id: 4,
  engineeringId: 1,
  hrDepartmentId: 2,
  salesId: 3,
  pendingLeaveForDirectReport: 5,
} as const;

export async function login(request: APIRequestContext, who: RoleKey = 'admin') {
  const response = await request.post('/api/auth/login', { data: CREDENTIALS[who] });
  expect(response.status(), `login as ${who} should succeed`).toBe(200);
  const body = await response.json();
  return body.data as {
    token: string;
    issuedAt: string;
    expiresAt: string;
    user: { id: number; email: string; role: string; fullName: string };
  };
}

let sequence = 0;
export function nextSequence() {
  sequence += 1;
  return sequence;
}

export function uniqueEmail(tag = 'probe') {
  return `${tag}.${Date.now().toString(36)}.${nextSequence()}@example.com`;
}

/**
 * Employee codes must match ^EMP-\d{3,4}$ and stay unique across every test file
 * (Playwright runs each file in its own worker process, so the counter is seeded from
 * the process start time instead of starting at 1).
 */
let codeCounter = Number(String(Date.now()).slice(-3));
export function uniqueEmployeeCode() {
  codeCounter = codeCounter + 1 > 999 ? 100 : codeCounter + 1;
  return `EMP-9${String(codeCounter).padStart(3, '0')}`;
}

export const DEMO_PASSWORD = 'Probe#12345';

/** Payload builder for POST /api/employees with sensible overrides. */
export function employeePayload(overrides: Record<string, unknown> = {}) {
  const seq = nextSequence();
  return {
    employeeCode: uniqueEmployeeCode(),
    firstName: 'Probe',
    lastName: `Tester${seq}`,
    email: uniqueEmail('probe'),
    password: DEMO_PASSWORD,
    role: 'EMPLOYEE',
    departmentId: SEEDED.engineeringId,
    position: 'QA Automation Engineer',
    salary: 61000.5,
    hireDate: '2023-06-01',
    ...overrides,
  };
}

/** Creates an employee through the API as ADMIN and returns the created record. */
export async function createEmployeeViaApi(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
) {
  const payload = employeePayload(overrides);
  const response = await request.post('/api/employees', { data: payload });
  expect(response.status(), `create employee ${payload.employeeCode}`).toBe(201);
  const body = await response.json();
  return body.data as { id: number; employeeCode: string; email: string; role: string; status: string };
}

/** ISO date shifted by `days` relative to today, keeping the API's calendar rules. */
export function isoDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
