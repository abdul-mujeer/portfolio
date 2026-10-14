import { Router } from 'express';
import { todayIso, addDays } from '../lib/dates.js';
import {
  attendanceSummary,
  headcountByDepartment,
  leaveCountByStatus,
  listEmployees,
} from '../lib/queries.js';
import { employeeScopeIds } from '../lib/scope.js';
import { requireAuth } from '../middleware/auth.js';

export function reportsRouter({ db }) {
  const router = Router();

  router.get('/summary', requireAuth, (req, res) => {
    const scopeIds = employeeScopeIds(db, req.actor);
    const to = todayIso();
    const from = addDays(to, -29);

    const { rows: employeeRows, total: totalEmployees } = listEmployees(db, {
      actor: req.actor,
      filters: { sort: 'id', order: 'asc' },
      page: 1,
      limit: 100,
    });

    res.json({
      data: {
        generatedAt: new Date().toISOString(),
        scope: scopeIds === null ? 'ALL' : req.actor.role === 'MANAGER' ? 'TEAM' : 'SELF',
        scopeEmployeeIds: scopeIds,
        headcount: {
          total: totalEmployees,
          active: employeeRows.filter((row) => row.status === 'ACTIVE').length,
          onLeave: employeeRows.filter((row) => row.status === 'ON_LEAVE').length,
          terminated: employeeRows.filter((row) => row.status === 'TERMINATED').length,
        },
        headcountByDepartment: headcountByDepartment(db, scopeIds),
        leaveByStatus: leaveCountByStatus(db, scopeIds),
        attendance: attendanceSummary(db, scopeIds, { from, to }),
      },
    });
  });

  return router;
}
