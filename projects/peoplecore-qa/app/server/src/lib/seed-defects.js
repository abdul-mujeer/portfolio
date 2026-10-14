/**
 * Deliberately injected defects — OFF by default.
 *
 * Enable with `SEED_DEFECTS=1`. They exist to give the test suites something real to
 * catch and are documented in test-documentation/seeded-defects.md. Every code path
 * below is marked `SEEDED DEFECT` so a reader can see exactly what a clean build does
 * instead. `npm run seeded:evidence` boots the app with SEED_DEFECTS=1 and records the
 * failing assertions under test-evidence/seeded-defects/.
 */
let enabled = false;

export function setSeedDefects(flag) {
  enabled = Boolean(flag);
}

export function seededDefectsEnabled() {
  return enabled;
}

/**
 * SEEDED-01 — broken object level authorization on the employee list.
 * A MANAGER's GET /api/employees silently drops the direct-report scope, so the list
 * returns every employee in the company (the detail endpoint keeps working correctly,
 * which is exactly what makes this kind of bug hard to spot).
 */
export function bypassManagerListScope(actor) {
  return enabled && actor?.role === 'MANAGER';
}

/**
 * SEEDED-02 — off-by-one in the leave overlap guard.
 * When a new request starts on the same calendar day as an existing PENDING/APPROVED
 * request, the overlap check is skipped, so the API accepts a duplicate booking.
 */
export function skipOverlapCheck(startDate, overlappingRequests) {
  return enabled && overlappingRequests.some((request) => request.start_date === startDate);
}
