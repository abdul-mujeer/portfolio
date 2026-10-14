import { z } from 'zod';
import { hasMaxTwoDecimals, isCalendarDate, isTime, todayIso } from './lib/dates.js';
import { HttpError } from './lib/errors.js';

export const ROLES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];
export const EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED'];
export const ATTENDANCE_STATUSES = ['PRESENT', 'REMOTE', 'ABSENT', 'LEAVE'];
export const LEAVE_TYPES = ['ANNUAL', 'SICK', 'UNPAID', 'PARENTAL'];
export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

const EMPLOYEE_CODE_RE = /^EMP-\d{3,4}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

export const MIN_HIRE_DATE = '1990-01-01';
export const MAX_LEAVE_DAYS = 30;
export const MIN_REASON_LENGTH = 10;
export const MAX_REASON_LENGTH = 500;
export const MIN_REJECT_COMMENT_LENGTH = 5;
export const MAX_SALARY = 1_000_000;

const trimmed = (min, max, label) =>
  z
    .string({ invalid_type_error: `${label} must be a string` })
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const isoDate = (label) =>
  z
    .string({ invalid_type_error: `${label} must be a string in YYYY-MM-DD format` })
    .trim()
    .refine((value) => isCalendarDate(value), `${label} must be a valid calendar date (YYYY-MM-DD)`);

export const optionalIsoDate = (label) => isoDate(label).nullish();

export const timeString = (label) =>
  z.string({ invalid_type_error: `${label} must be a string in HH:MM format` }).trim().refine(isTime, `${label} must be a valid time (HH:MM)`);

export const idNumber = (label) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be an integer`)
    .positive(`${label} must be a positive integer`);

export const passwordSchema = z
  .string({ invalid_type_error: 'password must be a string' })
  .min(8, 'password must be at least 8 characters')
  .max(72, 'password must be at most 72 characters')
  .regex(PASSWORD_RE, 'password must contain at least one letter, one number and one symbol');

export const loginSchema = z
  .object({
    email: z
      .string({ invalid_type_error: 'email must be a string' })
      .trim()
      .min(1, 'email is required')
      .max(254)
      // Defect HR-BUG-003 (found by tests/api/auth.spec.ts): a malformed email used to
      // fall through to the credential check and answer 401 instead of 400.
      .regex(EMAIL_RE, 'email must be a valid email address'),
    password: z.string({ invalid_type_error: 'password must be a string' }).min(1, 'password is required'),
  })
  .strict();

/* ------------------------------------------------------------------ employees */

export const employeeCreateSchema = z
  .object({
    employeeCode: z
      .string({ invalid_type_error: 'employeeCode must be a string' })
      .trim()
      .regex(EMPLOYEE_CODE_RE, 'employeeCode must match EMP-### or EMP-####'),
    firstName: trimmed(1, 60, 'firstName'),
    lastName: trimmed(1, 60, 'lastName'),
    email: z
      .string({ invalid_type_error: 'email must be a string' })
      .trim()
      .max(254, 'email must be at most 254 characters')
      .regex(EMAIL_RE, 'email must be a valid email address'),
    password: passwordSchema,
    role: z.enum(ROLES, { errorMap: () => ({ message: `role must be one of ${ROLES.join(', ')}` }) }),
    departmentId: idNumber('departmentId'),
    position: trimmed(2, 80, 'position'),
    salary: z.number({ invalid_type_error: 'salary must be a number' }),
    hireDate: isoDate('hireDate'),
    status: z
      .enum(EMPLOYEE_STATUSES, { errorMap: () => ({ message: `status must be one of ${EMPLOYEE_STATUSES.join(', ')}` }) })
      .optional(),
    managerId: idNumber('managerId').nullable().optional(),
    phone: z
      .string({ invalid_type_error: 'phone must be a string' })
      .trim()
      .regex(PHONE_RE, 'phone must be a valid phone number')
      .nullable()
      .optional(),
  })
  .strict();

/** PUT accepts a partial payload; role changes are policed in the route (HR may not change roles). */
export const employeeUpdateSchema = employeeCreateSchema
  .extend({ password: passwordSchema.optional() })
  .partial()
  .strict();

export const employeeQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    departmentId: z.coerce.number().int().positive().optional(),
    status: z.enum(EMPLOYEE_STATUSES).optional(),
    role: z.enum(ROLES).optional(),
    managerId: z.coerce.number().int().positive().optional(),
    sort: z
      .enum(['employeeCode', 'firstName', 'lastName', 'email', 'hireDate', 'salary', 'status', 'role', 'department', 'id'])
      .default('employeeCode'),
    order: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();

/* --------------------------------------------------------------- departments */

export const departmentCreateSchema = z
  .object({
    name: trimmed(2, 80, 'name'),
    code: z
      .string({ invalid_type_error: 'code must be a string' })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2,6}$/, 'code must be 2-6 uppercase letters'),
  })
  .strict();

export const departmentUpdateSchema = departmentCreateSchema.partial().strict();

/* ---------------------------------------------------------------- attendance */

export const attendanceCreateSchema = z
  .object({
    employeeId: idNumber('employeeId'),
    workDate: isoDate('workDate'),
    status: z.enum(ATTENDANCE_STATUSES, {
      errorMap: () => ({ message: `status must be one of ${ATTENDANCE_STATUSES.join(', ')}` }),
    }),
    checkIn: timeString('checkIn').nullable().optional(),
    checkOut: timeString('checkOut').nullable().optional(),
    notes: z.string().trim().max(300, 'notes must be at most 300 characters').nullable().optional(),
  })
  .strict();

export const attendanceUpdateSchema = z
  .object({
    status: z
      .enum(ATTENDANCE_STATUSES, { errorMap: () => ({ message: `status must be one of ${ATTENDANCE_STATUSES.join(', ')}` }) })
      .optional(),
    checkIn: timeString('checkIn').nullable().optional(),
    checkOut: timeString('checkOut').nullable().optional(),
    notes: z.string().trim().max(300, 'notes must be at most 300 characters').nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'at least one field must be provided' });

export const attendanceQuerySchema = z
  .object({
    employeeId: z.coerce.number().int().positive().optional(),
    date: isoDate('date').optional(),
    from: isoDate('from').optional(),
    to: isoDate('to').optional(),
    status: z.enum(ATTENDANCE_STATUSES).optional(),
    sort: z.enum(['workDate', 'employeeId', 'status', 'id']).default('workDate'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

/* ------------------------------------------------------------ leave requests */

export const leaveCreateSchema = z
  .object({
    employeeId: idNumber('employeeId').optional(),
    leaveType: z.enum(LEAVE_TYPES, { errorMap: () => ({ message: `leaveType must be one of ${LEAVE_TYPES.join(', ')}` }) }),
    startDate: isoDate('startDate'),
    endDate: isoDate('endDate'),
    reason: trimmed(MIN_REASON_LENGTH, MAX_REASON_LENGTH, 'reason'),
  })
  .strict();

export const leaveQuerySchema = z
  .object({
    status: z.enum(LEAVE_STATUSES).optional(),
    employeeId: z.coerce.number().int().positive().optional(),
    sort: z.enum(['startDate', 'endDate', 'status', 'id', 'createdAt']).default('startDate'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export const leaveReviewSchema = z
  .object({
    comment: z.string().trim().max(300, 'comment must be at most 300 characters').optional(),
  })
  .strict();

export const leaveRejectSchema = z
  .object({
    comment: z
      .string({ invalid_type_error: 'comment must be a string' })
      .trim()
      .min(MIN_REJECT_COMMENT_LENGTH, `comment must be at least ${MIN_REJECT_COMMENT_LENGTH} characters`),
  })
  .strict();

/* ---------------------------------------------------------------- audit logs */

export const auditQuerySchema = z
  .object({
    entityType: z.string().trim().max(40).optional(),
    entityId: z.string().trim().max(40).optional(),
    actorId: z.coerce.number().int().positive().optional(),
    action: z.string().trim().max(60).optional(),
  })
  .strict();

/* --------------------------------------------------------------- pagination */

export const paginationSchema = z
  .object({
    page: z.coerce.number({ invalid_type_error: 'page must be a number' }).int('page must be an integer').min(1, 'page must be >= 1').default(1),
    limit: z.coerce
      .number({ invalid_type_error: 'limit must be a number' })
      .int('limit must be an integer')
      .min(1, 'limit must be between 1 and 100')
      .max(100, 'limit must be between 1 and 100')
      .default(20),
  })
  .strict();

/* ------------------------------------------------------- business rule checks */

export function assertSalaryRules(salary) {
  if (salary <= 0 || salary > MAX_SALARY) {
    throw HttpError.unprocessable('INVALID_SALARY', `salary must be greater than 0 and at most ${MAX_SALARY}`);
  }
  if (!hasMaxTwoDecimals(salary)) {
    throw HttpError.unprocessable('INVALID_SALARY', 'salary must have at most 2 decimal places');
  }
}

export function assertHireDateRules(hireDate) {
  if (hireDate > todayIso()) {
    throw HttpError.unprocessable('INVALID_HIRE_DATE', 'hireDate must not be in the future');
  }
  if (hireDate < MIN_HIRE_DATE) {
    throw HttpError.unprocessable('INVALID_HIRE_DATE', `hireDate must be on or after ${MIN_HIRE_DATE}`);
  }
}

export function assertLeaveRangeRules(startDate, endDate, days) {
  if (endDate < startDate) {
    throw HttpError.unprocessable('INVALID_LEAVE_RANGE', 'endDate must be on or after startDate');
  }
  if (days > MAX_LEAVE_DAYS) {
    throw HttpError.unprocessable('LEAVE_TOO_LONG', `a single leave request may cover at most ${MAX_LEAVE_DAYS} days`);
  }
}

export function assertAttendanceRules({ status, checkIn, checkOut }) {
  if (status === 'LEAVE' && (checkIn || checkOut)) {
    throw HttpError.unprocessable('INVALID_ATTENDANCE_PAYLOAD', 'attendance with status LEAVE must not have checkIn or checkOut');
  }
  if (status === 'ABSENT' && (checkIn || checkOut)) {
    // Defect HR-BUG-002 (found by tests/api/attendance…spec.ts): an ABSENT row used to
    // accept check-in/check-out times, which contradicts the documented rule that only
    // PRESENT/REMOTE rows carry working hours.
    throw HttpError.unprocessable('INVALID_ATTENDANCE_PAYLOAD', 'attendance with status ABSENT must not have checkIn or checkOut');
  }
  if (status !== 'LEAVE' && status !== 'ABSENT' && !checkIn && !checkOut) {
    throw HttpError.unprocessable('INVALID_ATTENDANCE_PAYLOAD', 'PRESENT and REMOTE attendance requires checkIn or checkOut');
  }
  if (checkIn && checkOut && checkOut <= checkIn) {
    throw HttpError.unprocessable('INVALID_TIME_RANGE', 'checkOut must be after checkIn');
  }
}
