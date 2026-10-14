import { Router } from 'express';
import { get } from '../db.js';
import { authenticate, endSession } from '../lib/authenticate.js';
import { addDays, todayIso } from '../lib/dates.js';
import { HttpError } from '../lib/errors.js';
import {
  attendanceSummary,
  listAttendance,
  listAuditLogs,
  listDepartments,
  listEmployees,
  listLeaveRequests,
  pendingReviewCount,
} from '../lib/queries.js';
import { canViewEmployee, canWriteAttendance, employeeScopeIds, findEmployee, isPrivileged } from '../lib/scope.js';
import { parseAuditRow } from '../lib/audit.js';
import {
  attendanceDto,
  cancelLeaveRequest,
  createAttendance,
  createEmployee,
  createLeaveRequest,
  deleteEmployee,
  employeeDtoForActor,
  leaveDto,
  reviewLeaveRequest,
  updateAttendance,
  updateEmployee,
} from '../lib/services.js';
import { clearSessionCookie, htmlLocals, setSessionCookie } from '../middleware/auth.js';
import { coerceFormPayload, dropEmptyQueryValues, parseOrThrow } from '../lib/validate.js';
import {
  ATTENDANCE_STATUSES,
  employeeCreateSchema,
  employeeQuerySchema,
  employeeUpdateSchema,
  LEAVE_TYPES,
  loginSchema,
  MIN_REJECT_COMMENT_LENGTH,
  paginationSchema,
  attendanceCreateSchema,
  attendanceUpdateSchema,
  leaveCreateSchema,
} from '../validation.js';

const employeeListQuerySchema = employeeQuerySchema.merge(paginationSchema);

function pageNumbers(page, totalPages, window = 2) {
  const pages = [];
  const start = Math.max(1, page - window);
  const end = Math.min(totalPages, page + window);
  for (let index = start; index <= end; index += 1) pages.push(index);
  return pages;
}

function issuesToFieldErrors(error) {
  const errors = {};
  for (const detail of error.details ?? []) {
    const key = detail.path === '(root)' ? '_form' : detail.path;
    if (!errors[key]) errors[key] = detail.message;
  }
  return errors;
}

function flashFor(query) {
  const map = {
    created: 'Created successfully.',
    updated: 'Saved successfully.',
    deleted: 'Deleted successfully.',
    submitted: 'Leave request submitted.',
    cancelled: 'Leave request cancelled.',
    approved: 'Leave request approved.',
    rejected: 'Leave request rejected.',
  };
  for (const [key, message] of Object.entries(map)) {
    if (query[key] !== undefined) return message;
  }
  return null;
}

export function pagesRouter({ db, config }) {
  const router = Router();
  router.use(htmlLocals);

  const requirePageAuth = (req, res, next) => {
    if (req.actor) return next();
    const next_ = req.originalUrl && req.originalUrl !== '/login' ? `?next=${encodeURIComponent(req.originalUrl)}` : '';
    return res.redirect(302, `/login${next_}`);
  };

  const requirePageRole = (...roles) => (req, res, next) => {
    if (!req.actor) return res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl)}`);
    if (!roles.includes(req.actor.role)) {
      return res.status(403).render('403', {
        title: 'Forbidden',
        errorCode: 'ROLE_FORBIDDEN',
        errorMessage: `Signed in as ${req.actor.role}: this page requires ${roles.join(' or ')}.`,
      });
    }
    return next();
  };

  const departmentsForForms = () => listDepartments(db).map((row) => ({ id: row.id, name: row.name, code: row.code }));

  const managersForForms = (excludeId = null) =>
    db
      .prepare(
        `SELECT id, employee_code, first_name, last_name, role FROM employees
         WHERE status <> 'TERMINATED' AND role IN ('ADMIN','HR','MANAGER') AND (? IS NULL OR id <> ?)
         ORDER BY first_name ASC`,
      )
      .all(excludeId, excludeId)
      .map((row) => ({ id: Number(row.id), label: `${row.first_name} ${row.last_name} (${row.employee_code})` }));

  /* --------------------------------------------------------------- auth pages */

  router.get('/', (req, res) => res.redirect(302, req.actor ? '/dashboard' : '/login'));

  router.get('/login', (req, res) => {
    if (req.actor) return res.redirect(302, '/dashboard');
    const safeNext = String(req.query.next ?? '').startsWith('/') ? String(req.query.next) : '';
    return res.render('login', {
      title: 'Sign in',
      error: null,
      email: '',
      next: safeNext,
      locked: false,
      demoAccounts: db
        .prepare(
          `SELECT e.email, e.role, d.name AS department FROM employees e
           LEFT JOIN departments d ON d.id = e.department_id
           WHERE e.email IN ('admin@example.com','hr@example.com','manager@example.com','employee1@example.com')
           ORDER BY e.id ASC`,
        )
        .all()
        .map((row) => ({ email: row.email, role: row.role, department: row.department })),
    });
  });

  router.post('/login', (req, res) => {
    const payload = coerceFormPayload(req.body);
    const safeNext = String(req.body.next ?? '').startsWith('/') ? String(req.body.next) : '';
    // Defect HR-BUG-005: the hidden `next` field was rejected by the strict credential
    // schema, so signing in after being redirected never returned to the deep link.
    delete payload.next;
    const renderLogin = (status, error, locked = false) =>
      res.status(status).render('login', {
        title: 'Sign in',
        error,
        email: payload.email ?? '',
        next: safeNext,
        locked,
        demoAccounts: db
          .prepare(
            `SELECT e.email, e.role, d.name AS department FROM employees e
             LEFT JOIN departments d ON d.id = e.department_id
             WHERE e.email IN ('admin@example.com','hr@example.com','manager@example.com','employee1@example.com')
             ORDER BY e.id ASC`,
          )
          .all()
          .map((row) => ({ email: row.email, role: row.role, department: row.department })),
      });

    try {
      const { email, password } = parseOrThrow(loginSchema, payload);
      const { employee, token, expiresAt } = authenticate(db, config, { email, password });
      setSessionCookie(res, config, token, expiresAt);
      const destination = employee.role === 'EMPLOYEE' ? '/dashboard' : '/dashboard';
      return res.redirect(303, safeNext || destination);
    } catch (error) {
      if (error instanceof HttpError && error.status === 423) return renderLogin(423, error.message, true);
      if (error instanceof HttpError && error.status === 403) return renderLogin(403, error.message, true);
      if (error instanceof HttpError && error.status === 401) return renderLogin(401, 'Invalid email or password.');
      return renderLogin(400, 'Enter a valid email address and password.');
    }
  });

  router.get('/logout', (req, res) => {
    endSession(db, req.actor?.sessionToken);
    clearSessionCookie(res, config);
    res.redirect(303, '/login');
  });

  /* ---------------------------------------------------------- dashboard page */

  router.get('/dashboard', requirePageAuth, (req, res) => {
    const scopeIds = employeeScopeIds(db, req.actor);
    const to = todayIso();
    const from = addDays(to, -29);
    const { rows, total } = listEmployees(db, { actor: req.actor, filters: { sort: 'id', order: 'asc' }, page: 1, limit: 100 });
    const myLeave = listLeaveRequests(db, { actor: req.actor, filters: { employeeId: req.actor.id }, page: 1, limit: 100 });
    const todaysAttendance = listAttendance(db, {
      actor: req.actor,
      filters: { employeeId: req.actor.id, date: to },
      page: 1,
      limit: 5,
    }).rows.map(attendanceDto);

    res.render('dashboard', {
      title: 'Dashboard',
      cards: {
        headcount: total,
        active: rows.filter((row) => row.status === 'ACTIVE').length,
        directReports: scopeIds === null ? rows.length : Math.max(0, scopeIds.length - 1),
        pendingLeave: pendingReviewCount(db, req.actor),
        myPendingLeave: myLeave.rows.filter((row) => row.status === 'PENDING').length,
      },
      attendance: attendanceSummary(db, scopeIds, { from, to }),
      todaysAttendance,
      recentAudit: isPrivileged(req.actor)
        ? listAuditLogs(db, { filters: {}, page: 1, limit: 5 }).rows.map((row) => parseAuditRow(row, { includeSalary: true }))
        : [],
      departments: isPrivileged(req.actor) ? listDepartments(db) : [],
    });
  });

  /* --------------------------------------------------------- employees pages */

  router.get('/employees', requirePageAuth, (req, res, next) => {
    try {
      const query = parseOrThrow(employeeListQuerySchema, dropEmptyQueryValues(req.query));
      const { rows, total, page, limit } = listEmployees(db, {
        actor: req.actor,
        filters: query,
        page: query.page,
        limit: query.limit,
      });
      const totalPages = Math.max(1, Math.ceil(total / limit));
      res.render('employees-list', {
        title: 'Employees',
        employees: rows.map((row) => employeeDtoForActor(db, req.actor, row)),
        departments: listDepartments(db),
        filters: query,
        page,
        limit,
        total,
        totalPages,
        pages: pageNumbers(page, totalPages),
        canManage: isPrivileged(req.actor),
        flash: flashFor(req.query),
        queryString(targetPage) {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries({ ...query, page: targetPage })) {
            if (value === undefined || value === null || value === '') continue;
            params.set(key, String(value));
          }
          return params.toString();
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/employees/new', requirePageRole('ADMIN', 'HR'), (req, res) => {
    res.render('employee-form', {
      title: 'New employee',
      mode: 'create',
      employee: { status: 'ACTIVE', role: 'EMPLOYEE', hireDate: todayIso() },
      departments: departmentsForForms(),
      managers: managersForForms(),
      errors: {},
      canEditRole: req.actor.role === 'ADMIN',
      canEditCode: req.actor.role === 'ADMIN',
      canEditSalary: true,
      today: todayIso(),
      isAdmin: req.actor.role === 'ADMIN',
    });
  });

  router.post('/employees', requirePageRole('ADMIN', 'HR'), (req, res) => {
    const payload = coerceFormPayload(req.body);
    try {
      const valid = parseOrThrow(employeeCreateSchema, payload);
      const created = createEmployee(db, req.actor, valid);
      return res.redirect(303, `/employees/${created.id}?created=1`);
    } catch (error) {
      return res.status(error.status ?? 400).render('employee-form', {
        title: 'New employee',
        mode: 'create',
        employee: payload,
        departments: departmentsForForms(),
        managers: managersForForms(),
        errors: error.details ? issuesToFieldErrors(error) : { _form: error.message },
        formError: error.details ? null : error.message,
        canEditRole: req.actor.role === 'ADMIN',
        canEditCode: req.actor.role === 'ADMIN',
        canEditSalary: true,
        today: todayIso(),
        isAdmin: req.actor.role === 'ADMIN',
      });
    }
  });

  router.get('/employees/:id', requirePageAuth, (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const row = Number.isInteger(id) ? findEmployee(db, id) : null;
      if (!row) return res.status(404).render('404', { title: 'Not found', errorCode: 'NOT_FOUND', errorMessage: `Employee ${req.params.id} does not exist.` });
      if (!canViewEmployee(db, req.actor, id)) {
        return res.status(403).render('403', {
          title: 'Forbidden',
          errorCode: 'FORBIDDEN',
          errorMessage: 'Your role may only view your own record and your direct reports.',
        });
      }
      const tab = req.query.tab === 'leave' ? 'leave' : 'attendance';
      const attendance = listAttendance(db, { actor: req.actor, filters: { employeeId: id }, page: 1, limit: 100 }).rows.map(attendanceDto);
      const leave = listLeaveRequests(db, { actor: req.actor, filters: { employeeId: id }, page: 1, limit: 100 }).rows.map(leaveDto);
      return res.render('employee-detail', {
        title: `${row.first_name} ${row.last_name}`,
        employee: employeeDtoForActor(db, req.actor, row),
        attendance,
        leave,
        tab,
        canManage: isPrivileged(req.actor),
        canDelete: req.actor.role === 'ADMIN',
        flash: flashFor(req.query),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/employees/:id/edit', requirePageRole('ADMIN', 'HR'), (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const row = Number.isInteger(id) ? findEmployee(db, id) : null;
      if (!row) return res.status(404).render('404', { title: 'Not found', errorCode: 'NOT_FOUND', errorMessage: `Employee ${req.params.id} does not exist.` });
      if (row.role === 'ADMIN' && req.actor.role !== 'ADMIN') {
        return res.status(403).render('403', {
          title: 'Forbidden',
          errorCode: 'ROLE_FORBIDDEN',
          errorMessage: 'Only an ADMIN may modify an ADMIN account.',
        });
      }
      return res.render('employee-form', {
        title: `Edit ${row.first_name} ${row.last_name}`,
        mode: 'edit',
        employee: {
          id: Number(row.id),
          employeeCode: row.employee_code,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          role: row.role,
          departmentId: Number(row.department_id),
          position: row.position,
          salary: Number(row.salary),
          hireDate: row.hire_date,
          status: row.status,
          managerId: row.manager_id === null ? '' : Number(row.manager_id),
          phone: row.phone ?? '',
        },
        departments: departmentsForForms(),
        managers: managersForForms(Number(row.id)),
        errors: {},
        canEditRole: req.actor.role === 'ADMIN',
        canEditCode: req.actor.role === 'ADMIN',
        canEditSalary: true,
        today: todayIso(),
        isAdmin: req.actor.role === 'ADMIN',
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/employees/:id', requirePageRole('ADMIN', 'HR'), (req, res) => {
    const id = Number(req.params.id);
    const payload = coerceFormPayload(req.body);
    const renderForm = (status, errors, formError = null) =>
      res.status(status).render('employee-form', {
        title: 'Edit employee',
        mode: 'edit',
        employee: { ...payload, id },
        departments: departmentsForForms(),
        managers: managersForForms(id),
        errors,
        formError,
        canEditRole: req.actor.role === 'ADMIN',
        canEditCode: req.actor.role === 'ADMIN',
        canEditSalary: true,
        today: todayIso(),
        isAdmin: req.actor.role === 'ADMIN',
      });

    try {
      const existing = findEmployee(db, id);
      if (!existing) {
        return res.status(404).render('404', { title: 'Not found', errorCode: 'NOT_FOUND', errorMessage: `Employee ${req.params.id} does not exist.` });
      }
      const valid = parseOrThrow(employeeUpdateSchema, payload);
      if (!payload.password) delete valid.password;
      updateEmployee(db, req.actor, id, valid);
      return res.redirect(303, `/employees/${id}?updated=1`);
    } catch (error) {
      return renderForm(error.status ?? 400, error.details ? issuesToFieldErrors(error) : {}, error.details ? null : error.message);
    }
  });

  router.post('/employees/:id/delete', requirePageRole('ADMIN'), (req, res, next) => {
    try {
      const id = Number(req.params.id);
      deleteEmployee(db, req.actor, id);
      return res.redirect(303, '/employees?deleted=1');
    } catch (error) {
      return next(error);
    }
  });

  /* -------------------------------------------------------- attendance page */

  router.get('/attendance', requirePageAuth, (req, res, next) => {
    try {
      const canWrite = req.actor.role !== 'EMPLOYEE';
      const filters = {
        from: typeof req.query.from === 'string' ? req.query.from : '',
        to: typeof req.query.to === 'string' ? req.query.to : '',
        status: ATTENDANCE_STATUSES.includes(req.query.status) ? req.query.status : '',
        employeeId: '',
      };
      const { rows, total } = listAttendance(db, {
        actor: req.actor,
        filters: {
          from: filters.from || undefined,
          to: filters.to || undefined,
          status: filters.status || undefined,
        },
        page: 1,
        limit: 100,
      });
      const scopeIds = employeeScopeIds(db, req.actor);
      const employees = db
        .prepare(`SELECT id, first_name, last_name, employee_code FROM employees ${scopeIds === null ? '' : `WHERE id IN (${scopeIds.map(() => '?').join(', ') || 'NULL'})`} ORDER BY first_name`)
        .all(...(scopeIds ?? []))
        .map((row) => ({ id: Number(row.id), label: `${row.first_name} ${row.last_name} (${row.employee_code})` }));

      return res.render('attendance', {
        title: 'Attendance',
        records: rows.map(attendanceDto),
        total,
        filters,
        employees,
        canWrite,
        statuses: ATTENDANCE_STATUSES,
        today: todayIso(),
        flash: flashFor(req.query),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/attendance', requirePageAuth, (req, res, next) => {
    const payload = coerceFormPayload(req.body);
    try {
      const valid = parseOrThrow(attendanceCreateSchema, payload);
      if (!canWriteAttendance(db, req.actor, valid.employeeId)) {
        return res.status(403).render('403', {
          title: 'Forbidden',
          errorCode: 'FORBIDDEN',
          errorMessage: 'You may only record attendance for yourself and your direct reports.',
        });
      }
      createAttendance(db, req.actor, valid);
      return res.redirect(303, '/attendance?created=1');
    } catch (error) {
      if (error.status && error.status < 500) {
        return res.status(error.status).render('403', {
          title: 'Attendance rejected',
          errorCode: error.code,
          errorMessage: error.message,
        });
      }
      return next(error);
    }
  });

  router.post('/attendance/:id', requirePageAuth, (req, res, next) => {
    const id = Number(req.params.id);
    const payload = coerceFormPayload(req.body);
    try {
      const existing = get(db, 'SELECT id, employee_id FROM attendance WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).render('404', { title: 'Not found', errorCode: 'NOT_FOUND', errorMessage: `Attendance ${id} does not exist.` });
      }
      if (!canWriteAttendance(db, req.actor, existing.employee_id)) {
        return res.status(403).render('403', {
          title: 'Forbidden',
          errorCode: 'FORBIDDEN',
          errorMessage: 'You may only modify attendance for yourself and your direct reports.',
        });
      }
      const valid = parseOrThrow(attendanceUpdateSchema, payload);
      updateAttendance(db, req.actor, id, valid);
      return res.redirect(303, '/attendance?updated=1');
    } catch (error) {
      if (error.status && error.status < 500) {
        return res.status(error.status).render('403', {
          title: 'Attendance update rejected',
          errorCode: error.code,
          errorMessage: error.message,
        });
      }
      return next(error);
    }
  });

  /* ------------------------------------------------------------- leave page */

  router.get('/leave', requirePageAuth, (req, res) => {
    const mine = listLeaveRequests(db, {
      actor: req.actor,
      filters: { employeeId: req.actor.id },
      page: 1,
      limit: 100,
    }).rows.map(leaveDto);

    const reviewQueue =
      req.actor.role === 'EMPLOYEE'
        ? []
        : listLeaveRequests(db, { actor: req.actor, filters: { status: 'PENDING' }, page: 1, limit: 100 })
            .rows.filter((row) => Number(row.employee_id) !== Number(req.actor.id))
            .map(leaveDto);

    res.render('leave', {
      title: 'Leave',
      mine,
      reviewQueue,
      types: LEAVE_TYPES,
      minReason: 10,
      minRejectComment: MIN_REJECT_COMMENT_LENGTH,
      canReview: req.actor.role !== 'EMPLOYEE',
      errors: {},
      values: {},
      flash: flashFor(req.query),
    });
  });

  router.post('/leave', requirePageAuth, (req, res, next) => {
    const payload = coerceFormPayload(req.body);
    const renderErrors = (status, error) => {
      const mine = listLeaveRequests(db, { actor: req.actor, filters: { employeeId: req.actor.id }, page: 1, limit: 100 }).rows.map(leaveDto);
      const reviewQueue =
        req.actor.role === 'EMPLOYEE'
          ? []
          : listLeaveRequests(db, { actor: req.actor, filters: { status: 'PENDING' }, page: 1, limit: 100 })
              .rows.filter((row) => Number(row.employee_id) !== Number(req.actor.id))
              .map(leaveDto);
      return res.status(status).render('leave', {
        title: 'Leave',
        mine,
        reviewQueue,
        types: LEAVE_TYPES,
        minReason: 10,
        minRejectComment: MIN_REJECT_COMMENT_LENGTH,
        canReview: req.actor.role !== 'EMPLOYEE',
        errors: error.details ? issuesToFieldErrors(error) : { _form: error.message },
        values: payload,
        flash: null,
      });
    };

    try {
      const valid = parseOrThrow(leaveCreateSchema, payload);
      createLeaveRequest(db, req.actor, valid);
      return res.redirect(303, '/leave?submitted=1');
    } catch (error) {
      if (error.status && error.status < 500) return renderErrors(error.status, error);
      return next(error);
    }
  });

  router.post('/leave/:id/approve', requirePageRole('ADMIN', 'HR', 'MANAGER'), (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const comment = String(req.body.comment ?? '').trim() || null;
      reviewLeaveRequest(db, req.actor, id, { decision: 'APPROVED', comment });
      return res.redirect(303, '/leave?approved=1');
    } catch (error) {
      if (error.status === 403 || error.status === 422 || error.status === 404) {
        return res.status(error.status).render(error.status === 404 ? '404' : '403', {
          title: error.status === 404 ? 'Not found' : 'Review rejected',
          errorCode: error.code,
          errorMessage: error.message,
        });
      }
      return next(error);
    }
  });

  router.post('/leave/:id/reject', requirePageRole('ADMIN', 'HR', 'MANAGER'), (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const comment = String(req.body.comment ?? '').trim();
      if (comment.length < MIN_REJECT_COMMENT_LENGTH) {
        return res.status(400).render('403', {
          title: 'Rejection rejected',
          errorCode: 'VALIDATION_ERROR',
          errorMessage: `A rejection comment of at least ${MIN_REJECT_COMMENT_LENGTH} characters is required.`,
        });
      }
      reviewLeaveRequest(db, req.actor, id, { decision: 'REJECTED', comment });
      return res.redirect(303, '/leave?rejected=1');
    } catch (error) {
      if (error.status === 403 || error.status === 422 || error.status === 404) {
        return res.status(error.status).render(error.status === 404 ? '404' : '403', {
          title: error.status === 404 ? 'Not found' : 'Review rejected',
          errorCode: error.code,
          errorMessage: error.message,
        });
      }
      return next(error);
    }
  });

  router.post('/leave/:id/cancel', requirePageAuth, (req, res, next) => {
    try {
      cancelLeaveRequest(db, req.actor, Number(req.params.id));
      return res.redirect(303, '/leave?cancelled=1');
    } catch (error) {
      if (error.status === 403 || error.status === 422 || error.status === 404) {
        return res.status(error.status).render(error.status === 404 ? '404' : '403', {
          title: error.status === 404 ? 'Not found' : 'Cancel rejected',
          errorCode: error.code,
          errorMessage: error.message,
        });
      }
      return next(error);
    }
  });

  /* ------------------------------------------------------------- audit page */

  router.get('/audit', requirePageRole('ADMIN', 'HR'), (req, res, next) => {
    try {
      const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : '';
      const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : '';
      const limit = 50;
      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const { rows, total } = listAuditLogs(db, { filters: { entityType: entityType || undefined, entityId: entityId || undefined }, page, limit });
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return res.render('audit', {
        title: 'Audit log',
        entries: rows.map((row) => parseAuditRow(row, { includeSalary: true })),
        entityType,
        entityId,
        page,
        total,
        totalPages,
        pages: pageNumbers(page, totalPages),
        flash: flashFor(req.query),
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
