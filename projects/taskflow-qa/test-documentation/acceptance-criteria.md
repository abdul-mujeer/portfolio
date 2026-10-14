# TaskFlow API — Acceptance Criteria

Every acceptance criterion is `TASK-REQ-nnn-ACm` and is verified by at least one test
case in `test-cases.csv` / the traceability matrix. Cases marked **[auto]** are executed
by the automated suites referenced in the Case column; **[manual]** runs via
`npm run manual:cases`.

| Acceptance criterion | Statement | Verified by |
|----------------------|-----------|-------------|
| TASK-REQ-001-AC1 | POST /auth/register returns 201, sets a session cookie | TASK-TC-001 [auto] |
| TASK-REQ-001-AC2 | Duplicate email registration returns 409 EMAIL_TAKEN | TASK-TC-002 [auto] |
| TASK-REQ-001-AC3 | Wrong password / unknown email return 401 without revealing which failed | TASK-TC-004, TASK-TC-005 [auto] |
| TASK-REQ-001-AC4 | Logout returns 204 and the session stops working | TASK-TC-005 [auto], TASK-TC-303 [manual] |
| TASK-REQ-002-AC1 | Weak passwords rejected with 400 + policy message | TASK-TC-003 [auto] |
| TASK-REQ-002-AC2 | A 10-character policy-compliant password is accepted | TASK-TC-003 [auto] |
| TASK-REQ-002-AC3 | password_hash/salt never appear in responses | TASK-TC-001 [auto] |
| TASK-REQ-003-AC1 | Cookie carries HttpOnly, SameSite=Lax, Path=/ (no Secure in dev) | TASK-TC-005 [auto] |
| TASK-REQ-003-AC2 | Tampered/garbage tokens are 401 | TASK-TC-005 [auto] |
| TASK-REQ-003-AC3 | Expired session is 401 and the row is removed | TASK-TC-304 [manual] |
| TASK-REQ-004-AC1 | Create project 201 with OWNER role and member row | TASK-TC-006 [auto] |
| TASK-REQ-004-AC2 | Duplicate/malformed keys: 409 / 400 | TASK-TC-007 [auto], TASK-TC-008 [auto] |
| TASK-REQ-004-AC3 | Delete allowed for OWNER only (403 otherwise, 204 on success) | TASK-TC-011 [auto] |
| TASK-REQ-005-AC1 | Add existing member 201; duplicate 409; unknown 404 | TASK-TC-013, TASK-TC-014 [auto] |
| TASK-REQ-005-AC2 | OWNER role cannot be assigned via member endpoints | TASK-TC-015 [auto] |
| TASK-REQ-005-AC3 | Unrelated member 403; non-member 404 everywhere | TASK-TC-026, TASK-TC-039/040 [auto] |
| TASK-REQ-006-AC1 | Owner self-demotion/removal 409 | TASK-TC-018 [auto] |
| TASK-REQ-006-AC2 | Transfer to non-member 404; to member 200 with swapped roles | TASK-TC-018 [auto] |
| TASK-REQ-006-AC3 | After transfer the old owner is ADMIN and can leave | TASK-TC-018 [auto] |
| TASK-REQ-007-AC1 | New tasks default to TODO/MEDIUM with computed fields | TASK-TC-019 [auto], TASK-TC-103 [ui] |
| TASK-REQ-007-AC2 | Boundary violations are 400 with details | TASK-TC-020/021 [auto] |
| TASK-REQ-007-AC3 | Reporter/assignee updates recorded with before/after | TASK-TC-025 [auto] |
| TASK-REQ-008-AC1 | Non-member/unknown assignee 422 | TASK-TC-022 [auto] |
| TASK-REQ-008-AC2 | assigneeId:null unassigns (200) | TASK-TC-022 [auto] |
| TASK-REQ-009-AC1 | Impossible dates 400; 2028-02-29 accepted | TASK-TC-023 [auto] |
| TASK-REQ-009-AC2 | Due before creation 422 on create and update | TASK-TC-023 [auto] |
| TASK-REQ-009-AC3 | Due today allowed; not overdue | TASK-TC-023, TASK-TC-042/205 [auto] |
| TASK-REQ-010-AC1 | Each forward step 200 + TASK_STATUS_CHANGED activity | TASK-TC-027 [auto] |
| TASK-REQ-010-AC2 | Terminal/skipped transitions 422 | TASK-TC-028/029 [auto] |
| TASK-REQ-010-AC3 | Same-status 200 no-op without activity | TASK-TC-029 [auto] |
| TASK-REQ-011-AC1 | Comment 201 with author + COMMENT_ADDED activity | TASK-TC-030 [auto] |
| TASK-REQ-011-AC2 | Empty/whitespace/1001 rejected; 1000 accepted; trimmed | TASK-TC-031 [auto] |
| TASK-REQ-011-AC3 | Archived-project comments 422 while reads 200 | TASK-TC-031 [auto] |
| TASK-REQ-012-AC1 | Create/update/status/comment events with correct details | TASK-TC-033 [auto] |
| TASK-REQ-012-AC2 | Feeds 404 for non-members; page/limit validated | TASK-TC-032/033 [auto] |
| TASK-REQ-012-AC3 | All detail_json values valid JSON (SQL check) | TASK-TC-203/204 [db] |
| TASK-REQ-013-AC1 | Invalid page/limit 400; out-of-range page empty + real total | TASK-TC-035 [auto] |
| TASK-REQ-013-AC2 | Filters narrow; LIKE wildcards escaped | TASK-TC-036/037 [auto] |
| TASK-REQ-013-AC3 | Invalid sort/order 400; pages disjoint and complete | TASK-TC-034/038 [auto] |
| TASK-REQ-014-AC1 | All non-member reads 404 | TASK-TC-039 [auto], TASK-TC-302 [manual] |
| TASK-REQ-014-AC2 | All non-member writes 404 and change nothing | TASK-TC-040 [auto] |
| TASK-REQ-014-AC3 | No-membership user: empty list, empty report | TASK-TC-041 [auto] |
| TASK-REQ-015-AC1 | Owner report: 3 overdue tasks with counts and byProject | TASK-TC-042 [auto] |
| TASK-REQ-015-AC2 | Due-today and archived-project tasks excluded | TASK-TC-042, TASK-TC-205 [auto/db] |
| TASK-REQ-015-AC3 | Report respects membership scope | TASK-TC-043 [auto] |
| TASK-REQ-016-AC1 | Archive 200 + archived=true | TASK-TC-012 [auto] |
| TASK-REQ-016-AC2 | Mutations on archived projects 422 | TASK-TC-012 [auto] |
| TASK-REQ-016-AC3 | Second archive 409 | TASK-TC-012 [auto] |
| TASK-REQ-017-AC1 | Envelope with code/message/details for every error class | TASK-TC-301 [manual], TASK-TC-005/024 [auto] |
| TASK-REQ-017-AC2 | Malformed JSON 400 INVALID_JSON; oversized 413 | TASK-TC-303 [manual] |
| TASK-REQ-017-AC3 | Unknown ids 404 across methods | TASK-TC-024 [auto] |
| TASK-REQ-018-AC1 | UNIQUE/FK enforcement at the DB layer | TASK-TC-201/202 [db] |
| TASK-REQ-018-AC2 | CHECK constraints reject invalid enums/lengths | TASK-TC-203 [db] |
| TASK-REQ-018-AC3 | Reconnect keeps counts; API and SQL counts match | TASK-TC-205 [db] |
| TASK-REQ-019-AC1 | SQLi payloads inert; data intact | TASK-TC-044 [auto], TASK-TC-301 [manual] |
| TASK-REQ-019-AC2 | Privileged fields rejected (strict schemas) | TASK-TC-046 [auto] |
| TASK-REQ-019-AC3 | Stored markup rendered as text, never executed | TASK-TC-045 [auto], TASK-TC-110 [ui] |
| TASK-REQ-020-AC1 | Login, board, create, status, comment journeys work | TASK-TC-101/103/104/105 [ui] |
| TASK-REQ-020-AC2 | Error banner surfaces validation; hidden actions still fail 403 | TASK-TC-106/107 [ui] |
| TASK-REQ-020-AC3 | Modal keyboard operable; labels/ARIA wired | TASK-TC-109 [ui] |
