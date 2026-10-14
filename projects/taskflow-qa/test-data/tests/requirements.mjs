/**
 * Requirements - single source of truth for TASK-REQ-nnn ids used by the
 * traceability matrix, test-cases.csv and the documentation set.
 */
export const requirements = [
  {
    id: 'TASK-REQ-001',
    title: 'Authentication and session lifecycle',
    summary:
      'Users can register with a unique email, log in with email + password, obtain an opaque HttpOnly session cookie, read their own profile via GET /auth/me and log out. All protected endpoints return 401 without a valid session.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-001-AC1', text: 'POST /auth/register returns 201 with the public profile and sets a session cookie.' },
      { id: 'TASK-REQ-001-AC2', text: 'Duplicate email registration returns 409 EMAIL_TAKEN.' },
      { id: 'TASK-REQ-001-AC3', text: 'Login with a wrong password or unknown email returns 401 INVALID_CREDENTIALS without revealing which input failed.' },
      { id: 'TASK-REQ-001-AC4', text: 'Logout returns 204 and the session stops working immediately.' },
    ],
  },
  {
    id: 'TASK-REQ-002',
    title: 'Password policy and hashing',
    summary:
      'Passwords must be at least 10 characters and contain an uppercase letter, a lowercase letter and a digit. Only scrypt hashes with a per-user salt are stored; the hash/salt never appear in responses.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-002-AC1', text: 'Weak passwords are rejected with 400 and the documented policy message.' },
      { id: 'TASK-REQ-002-AC2', text: 'A 10-character password satisfying all classes is accepted.' },
      { id: 'TASK-REQ-002-AC3', text: 'password_hash and salt are absent from every API response.' },
    ],
  },
  {
    id: 'TASK-REQ-003',
    title: 'Session security',
    summary:
      'Session tokens are random + HMAC-signed, delivered as HttpOnly; SameSite=Lax cookies (Secure in production), expire after 8 hours and are invalidated server-side on logout. Tampered or expired tokens are 401.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-003-AC1', text: 'The login cookie carries HttpOnly, SameSite=Lax and Path=/ (no Secure in dev/test).' },
      { id: 'TASK-REQ-003-AC2', text: 'A tampered signature or garbage token is rejected with 401.' },
      { id: 'TASK-REQ-003-AC3', text: 'An expired session row is rejected with 401 and removed from the database.' },
    ],
  },
  {
    id: 'TASK-REQ-004',
    title: 'Project CRUD and key uniqueness',
    summary:
      'Any authenticated user can create a project with a key matching ^[A-Z]{2,6}$ and becomes its OWNER. Keys are globally unique. Only OWNER/ADMIN can rename; only OWNER can delete.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-004-AC1', text: 'POST /projects returns 201 and the caller has my_role=OWNER with a matching OWNER member row.' },
      { id: 'TASK-REQ-004-AC2', text: 'Duplicate or malformed keys return 409 / 400 respectively.' },
      { id: 'TASK-REQ-004-AC3', text: 'DELETE /projects/:id is allowed for the OWNER only (403 for ADMIN/MEMBER) and returns 204.' },
    ],
  },
  {
    id: 'TASK-REQ-005',
    title: 'Members, roles and object-level permissions',
    summary:
      'OWNER > ADMIN > MEMBER. OWNER/ADMIN manage members; every member can create tasks and comments; task update/status requires reporter, assignee, ADMIN or OWNER; delete requires reporter or ADMIN/OWNER. Cross-project access is hidden with 404.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-005-AC1', text: 'Adding an existing user by email returns 201; duplicates 409; unknown emails 404.' },
      { id: 'TASK-REQ-005-AC2', text: 'Assigning the OWNER role via member endpoints is rejected.' },
      { id: 'TASK-REQ-005-AC3', text: 'Unrelated members receive 403 for task update/status/delete; non-members receive 404 everywhere.' },
    ],
  },
  {
    id: 'TASK-REQ-006',
    title: 'Ownership transfer and owner protection',
    summary:
      'The OWNER cannot be removed or demoted. POST /projects/:id/transfer hands ownership to an existing member (target becomes OWNER, previous owner becomes ADMIN) after which the previous owner may leave.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-006-AC1', text: 'Self-demotion and self-removal of the OWNER return 409.' },
      { id: 'TASK-REQ-006-AC2', text: 'Transfer to a non-member is 404; to a member it is 200 with ownership swapped.' },
      { id: 'TASK-REQ-006-AC3', text: 'After transfer the previous owner is ADMIN and can remove themselves.' },
    ],
  },
  {
    id: 'TASK-REQ-007',
    title: 'Task CRUD and validation',
    summary:
      'Members create tasks (title 3-120 trimmed, description <= 2000, strict enum priority, estimatedHours 0.5-100 in 0.5 steps). Update rules: title/description/priority/assignee/dueDate/estimatedHours with strict schemas; unknown fields are 400.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-007-AC1', text: 'New tasks default to status TODO and priority MEDIUM with computed fields (names, comment_count, overdue).' },
      { id: 'TASK-REQ-007-AC2', text: 'Boundary values outside the documented ranges are 400 with a details array.' },
      { id: 'TASK-REQ-007-AC3', text: 'Reporter and assignee can update; the update is recorded in the activity feed with before/after values.' },
    ],
  },
  {
    id: 'TASK-REQ-008',
    title: 'Task assignment rules',
    summary: 'assigneeId must reference a project member (422 ASSIGNEE_NOT_MEMBER otherwise); null clears the assignee.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-008-AC1', text: 'Assigning a non-member or unknown user returns 422.' },
      { id: 'TASK-REQ-008-AC2', text: 'assigneeId:null unassigns the task with 200.' },
    ],
  },
  {
    id: 'TASK-REQ-009',
    title: 'Due date rules',
    summary:
      'due_date must be a real calendar date (leap years honoured, 2026-02-30 rejected) and must not be before the task creation date (422). null clears the date.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-009-AC1', text: 'Impossible dates return 400; 2028-02-29 (leap) is accepted.' },
      { id: 'TASK-REQ-009-AC2', text: 'A due date before the creation date returns 422 on create and update.' },
      { id: 'TASK-REQ-009-AC3', text: 'A task due today is allowed and is NOT overdue.' },
    ],
  },
  {
    id: 'TASK-REQ-010',
    title: 'Status workflow',
    summary:
      'TODO -> IN_PROGRESS -> IN_REVIEW -> DONE with CANCELED from any non-DONE state. DONE and CANCELED are terminal. Same-status updates are 200 no-ops without activity; invalid transitions are 422; unknown values are 400.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-010-AC1', text: 'Each forward step returns 200 and writes a TASK_STATUS_CHANGED activity row.' },
      { id: 'TASK-REQ-010-AC2', text: 'Any transition out of DONE/CANCELED, or a skipped jump, returns 422 INVALID_STATUS_TRANSITION.' },
      { id: 'TASK-REQ-010-AC3', text: 'A same-status request returns 200 and does not create an activity row.' },
    ],
  },
  {
    id: 'TASK-REQ-011',
    title: 'Comments',
    summary:
      'Any member can comment on a task (body 1-1000 trimmed). Comments are listed oldest-first with X-Total-Count; archived projects reject new comments with 422 while reads stay 200.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-011-AC1', text: 'POST returns 201 with author identity and writes COMMENT_ADDED activity.' },
      { id: 'TASK-REQ-011-AC2', text: 'Empty/whitespace/over-1000 bodies are 400; exactly 1000 chars are accepted.' },
      { id: 'TASK-REQ-011-AC3', text: 'Comments on archived projects are 422; the list still returns 200.' },
    ],
  },
  {
    id: 'TASK-REQ-012',
    title: 'Activity feed completeness',
    summary:
      'Every create/update/status change/comment writes an activity row with a valid JSON detail payload (machine-readable before/after values). Feeds are newest-first and paginated.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-012-AC1', text: 'TASK_CREATED, TASK_UPDATED, TASK_STATUS_CHANGED and COMMENT_ADDED appear with correct details.' },
      { id: 'TASK-REQ-012-AC2', text: 'Project and task feeds are 404 for non-members and support page/limit.' },
      { id: 'TASK-REQ-012-AC3', text: 'All stored detail_json values are valid JSON (SQL json_valid check).' },
    ],
  },
  {
    id: 'TASK-REQ-013',
    title: 'Pagination, filtering and sorting',
    summary:
      'List endpoints support page (>=1) and limit (1..100, default 20) with X-Total-Count. Filters: status, priority, assigneeId, q (case-insensitive, LIKE-escaped), dueBefore, overdue. Sort whitelist with order asc/desc.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-013-AC1', text: 'Invalid page/limit values return 400; out-of-range pages return an empty array with the real total.' },
      { id: 'TASK-REQ-013-AC2', text: 'Filters narrow results as documented; wildcard characters in q are escaped.' },
      { id: 'TASK-REQ-013-AC3', text: 'Unknown sort/order values return 400; pages never repeat or skip rows.' },
    ],
  },
  {
    id: 'TASK-REQ-014',
    title: 'Cross-project isolation',
    summary:
      'A member of project A must never read or mutate project B resources. Non-members always receive 404 (never 403) so existence is not leaked; users only see their own project scope.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-014-AC1', text: 'All reads (project, tasks, members, activity, comments) return 404 for non-members.' },
      { id: 'TASK-REQ-014-AC2', text: 'All writes (task/comment/project/member/archive/transfer) return 404 for non-members and change nothing.' },
      { id: 'TASK-REQ-014-AC3', text: 'A user with no memberships sees an empty project list and an empty overdue report.' },
    ],
  },
  {
    id: 'TASK-REQ-015',
    title: 'Overdue report and archived exclusion',
    summary:
      'GET /reports/overdue returns counts + task list across the caller\'s non-archived projects. Overdue = due_date < today AND status NOT IN (DONE, CANCELED).',
    acceptanceCriteria: [
      { id: 'TASK-REQ-015-AC1', text: 'The seed produces 3 overdue tasks for the owner with counts and byProject data.' },
      { id: 'TASK-REQ-015-AC2', text: 'Task 12 (due today) and archived-project tasks are excluded.' },
      { id: 'TASK-REQ-015-AC3', text: 'The report respects membership scope (admin 3, outsider 0, no-projects 0).' },
    ],
  },
  {
    id: 'TASK-REQ-016',
    title: 'Archived project behaviour',
    summary:
      'Archiving is OWNER/ADMIN only. Archived projects stay readable (200) for members but every mutation returns 422 ARCHIVED_PROJECT; re-archiving returns 409.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-016-AC1', text: 'POST /projects/:id/archive returns 200 and sets archived=true.' },
      { id: 'TASK-REQ-016-AC2', text: 'Task create/update/status/delete, comments, member changes and project rename return 422.' },
      { id: 'TASK-REQ-016-AC3', text: 'A second archive request returns 409 PROJECT_ALREADY_ARCHIVED.' },
    ],
  },
  {
    id: 'TASK-REQ-017',
    title: 'Error envelope and HTTP semantics',
    summary:
      'Every error uses { error: { code, message, details } } with 400 validation, 401 unauthenticated, 403 forbidden, 404 hidden/missing, 409 conflict, 422 business rule. Stack traces are never leaked.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-017-AC1', text: 'Error responses for every status class carry the envelope with a non-empty message.' },
      { id: 'TASK-REQ-017-AC2', text: 'Malformed JSON returns 400 INVALID_JSON; oversized bodies return 413.' },
      { id: 'TASK-REQ-017-AC3', text: 'Unknown ids return 404 consistently across methods.' },
    ],
  },
  {
    id: 'TASK-REQ-018',
    title: 'Data integrity and persistence',
    summary:
      'SQLite schema enforces UNIQUE keys, FOREIGN KEYs (with PRAGMA foreign_keys=ON), CHECK constraints, no orphan rows, one OWNER per project, and data persists in the file across reconnects.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-018-AC1', text: 'Duplicate email/key inserts fail at the database level; FK violations are rejected.' },
      { id: 'TASK-REQ-018-AC2', text: 'CHECK constraints reject invalid enums, short titles and bad estimate values.' },
      { id: 'TASK-REQ-018-AC3', text: 'Reopening the database file preserves counts; API and SQL counts match.' },
    ],
  },
  {
    id: 'TASK-REQ-019',
    title: 'Input safety',
    summary:
      'SQL is fully parameterized (injection attempts are inert), schemas are strict (mass assignment is rejected with 400) and stored markup is returned as data, never rendered server-side.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-019-AC1', text: 'SQLi payloads in query params/bodies produce normal responses and leave data intact.' },
      { id: 'TASK-REQ-019-AC2', text: 'Privileged fields (ownerId, reporterId, role escalation) are rejected by strict schemas.' },
      { id: 'TASK-REQ-019-AC3', text: '<script> content is stored verbatim and rendered as text in the console without execution.' },
    ],
  },
  {
    id: 'TASK-REQ-020',
    title: 'UI console journeys and accessibility',
    summary:
      'The vanilla-JS console covers login, project switching, the status board, task create/edit, comments, activity, filters, pagination and error banners. All controls expose data-testid hooks and the modal is keyboard operable.',
    acceptanceCriteria: [
      { id: 'TASK-REQ-020-AC1', text: 'Login, board load, create, status change and comment journeys work against the real API.' },
      { id: 'TASK-REQ-020-AC2', text: 'Validation errors surface in an aria-live error banner; hidden actions still fail with 403 server-side.' },
      { id: 'TASK-REQ-020-AC3', text: 'The modal traps focus, closes with Escape and returns focus; inputs are label-associated.' },
    ],
  },
];
