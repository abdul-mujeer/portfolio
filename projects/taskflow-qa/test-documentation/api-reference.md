# TaskFlow API — API Reference

Base URL: `http://127.0.0.1:4300/api/v1`. All responses are JSON. Authentication uses the
opaque `tf_session` cookie (HttpOnly; SameSite=Lax; 8 h expiry; `Secure` in production).
Errors always use:

```json
{ "error": { "code": "STRING_CODE", "message": "human readable", "details": [ { "path": "field", "message": "why" } ] } }
```

Status conventions: `200/201/204` success · `400` validation · `401` unauthenticated ·
`403` forbidden (role/ownership) · `404` missing **or hidden** (cross-project isolation) ·
`409` conflict · `413` payload too large · `422` business-rule violation.

List endpoints return `{ data, page, limit, total }` plus an `X-Total-Count` header.

Demo credentials (seeded): `owner@example.com / Owner#12345`,
`admin@example.com / Admin#12345`, `member@example.com / Member#12345`,
`outsider@example.com / Outside#12345`, `noprojects@example.com / Solo#12345`.

---

## GET /health — service health

Auth: none. → `200 { status: "ok", service, version, time, database }`.
The alias `GET /api/health` returns the same payload (used by orchestrators).

```bash
curl -s http://127.0.0.1:4300/api/v1/health
```

## POST /auth/register — create an account (and sign in)

Body: `{ email, display_name, password }` (strict schema).
Password policy: ≥10 chars with upper + lower + digit.
→ `201 { id, email, display_name, created_at }` + `Set-Cookie: tf_session=...`.
Errors: `400` validation/policy/strict-schema · `409 EMAIL_TAKEN`.

```bash
curl -s -c cookies.txt -X POST http://127.0.0.1:4300/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"qa@example.com","display_name":"QA","password":"Fresh#Pass123"}'
```

## POST /auth/login — sign in

Body: `{ email, password }` → `200` public profile + session cookie.
Errors: `400` validation · `401 INVALID_CREDENTIALS` (identical message for wrong
password and unknown email).

## POST /auth/logout — end the session

Auth: session. → `204`, clears the cookie and deletes the server-side session row.
Errors: `401` without a session.

## GET /auth/me — current profile

Auth: session. → `200 { id, email, display_name, created_at }` · `401`.

## GET /projects — my projects

Auth: session. Query: `page`, `limit`, `archived=true|false`.
→ `200 { data: [project], page, limit, total }` + `X-Total-Count`.
Project shape: `{ id, key, name, description, owner_id, created_at, updated_at, archived, my_role, member_count, task_count }`.
Users only ever see projects they are members of.

## POST /projects — create a project

Auth: session. Body: `{ key, name, description? }` where `key` matches `^[A-Z]{2,6}$`.
→ `201` project with `my_role=OWNER` (creates the OWNER membership + `PROJECT_CREATED` activity).
Errors: `400` malformed key/name · `409 PROJECT_KEY_TAKEN`.

```bash
curl -s -b cookies.txt -X POST http://127.0.0.1:4300/api/v1/projects \
  -H "Content-Type: application/json" -d '{"key":"TASK","name":"Demo Project"}'
```

## GET /projects/:id — one project

Auth: member. → `200` project · `404` missing or not a member.

## PATCH /projects/:id — rename / redescribe

Auth: OWNER or ADMIN. Body: `{ name?, description? }` (at least one).
Archived projects: `422 ARCHIVED_PROJECT`.
→ `200` updated project (writes `PROJECT_UPDATED` with before/after) · `403` for MEMBER.

## DELETE /projects/:id — delete a project

Auth: OWNER only. Cascades tasks, comments, members and activity.
→ `204` · `403` for ADMIN/MEMBER · `422` on archived projects.

## POST /projects/:id/archive — archive

Auth: OWNER or ADMIN. → `200 { archived: true }`, activity `PROJECT_ARCHIVED`.
Errors: `409 PROJECT_ALREADY_ARCHIVED` · `422` not applicable (already archived handled as 409).

## POST /projects/:id/transfer — hand over ownership

Auth: OWNER only. Body: `{ userId }` (must already be a member).
→ `200 { project, transferredTo }`; target becomes OWNER, previous owner becomes ADMIN.
Errors: `404` target not a member · `409 ALREADY_OWNER` · `403` for non-owners · `422` archived.

## GET /projects/:id/members — roster

Auth: member → `200 { data: [{ user_id, email, display_name, role, joined_at }], ... }` + `X-Total-Count` · `404` non-member.

## POST /projects/:id/members — add a member

Auth: OWNER or ADMIN. Body: `{ email, role: "ADMIN" | "MEMBER" }`.
→ `201` member row. Errors: `404` unknown email · `409 MEMBER_ALREADY_EXISTS` ·
`400` role OWNER (use transfer) or malformed body · `422` archived.

## PATCH /projects/:id/members/:userId — change a role

Auth: OWNER or ADMIN. Body: `{ role: "ADMIN" | "MEMBER" }`.
→ `200` member row (same role is a 200 no-op, no activity).
Errors: `404` not a member · `409 OWNER_ROLE_LOCKED` (owner), `409 LAST_ADMIN` (last admin) · `422` archived.

## DELETE /projects/:id/members/:userId — remove a member

Auth: OWNER or ADMIN. → `204`.
Errors: `404` not a member · `409 CANNOT_REMOVE_OWNER` (transfer first) · `422` archived.

---

## GET /projects/:id/tasks — list tasks

Auth: member. Query: `page`, `limit` (1..100, default 20), `status`, `priority`,
`assigneeId`, `q` (title/description, case-insensitive, LIKE-escaped),
`dueBefore` (YYYY-MM-DD, exclusive), `overdue=true`, `sort` (`id|created_at|updated_at|due_date|priority|title|status`), `order` (`asc|desc`).
→ `200 { data: [task], page, limit, total }` + `X-Total-Count`.
Task shape: `{ id, project_id, project_key, project_archived, title, description, status, priority, assignee_id, assignee_name, reporter_id, reporter_name, due_date, estimated_hours, created_at, updated_at, comment_count, overdue }`.

```bash
curl -s -b cookies.txt "http://127.0.0.1:4300/api/v1/projects/1/tasks?status=TODO&sort=id&order=asc"
```

## POST /projects/:id/tasks — create a task

Auth: any member. Body: `{ title, description?, priority?, assigneeId?, dueDate?, estimatedHours? }`.
Rules: title 3–120 after trim; description ≤2000; priority enum (default MEDIUM);
assignee must be a member; `dueDate` real calendar date (`YYYY-MM-DD`) not before the
creation date; `estimatedHours` 0.5–100 in 0.5 steps. Status always starts at TODO.
→ `201` task (activity `TASK_CREATED`).
Errors: `400` validation/strict schema · `422 ASSIGNEE_NOT_MEMBER`, `DUE_DATE_BEFORE_CREATION`, `ARCHIVED_PROJECT`.
Unknown fields (e.g. `status`, `reporterId`) are rejected with 400.

## GET /tasks/:id — one task

Auth: member of the task's project → `200` task · `404` missing/hidden.

## PATCH /tasks/:id — update a task

Auth: reporter, assignee, ADMIN or OWNER. Body (all optional, ≥1 required):
`{ title?, description?, priority?, assigneeId?, dueDate?, estimatedHours? }` —
`assigneeId`/`dueDate`/`estimatedHours` accept `null` to clear.
→ `200` task (activity `TASK_UPDATED` with per-field before/after; identical values are a
no-op 200 without activity).
Errors: `400` validation · `403` unrelated member · `422` assignee/date rules, archived · `404` hidden.

## PATCH /tasks/:id/status — workflow transition

Auth: reporter, assignee, ADMIN or OWNER. Body: `{ status }`.
Allowed: `TODO→IN_PROGRESS`, `IN_PROGRESS→IN_REVIEW`, `IN_REVIEW→DONE`, any non-DONE→CANCELED.
DONE/CANCELED are terminal; skipping states is rejected; same status = 200 no-op (no activity).
→ `200` task (activity `TASK_STATUS_CHANGED {from,to}`).
Errors: `400` unknown status · `403` · `422 INVALID_STATUS_TRANSITION` · `422` archived.

## DELETE /tasks/:id — delete a task

Auth: reporter or ADMIN/OWNER. → `204` (activity `TASK_DELETED`), comments cascade.
Errors: `403` (e.g. the assignee is not the reporter) · `422` archived · `404` hidden.

## GET /tasks/:id/comments — list comments

Auth: member. Query: `page`, `limit`. → `200 { data, page, limit, total }`, oldest first, `X-Total-Count`.

## POST /tasks/:id/comments — comment

Auth: any member. Body: `{ body }` (1–1000 after trim).
→ `201 { id, task_id, author_id, author_name, body, created_at }` (activity `COMMENT_ADDED`).
Errors: `400` boundaries · `422` archived.

## GET /projects/:id/activity — project activity feed

Auth: member. Query: `page`, `limit`. Newest first.
→ `200 { data: [{ id, project_id, task_id, task_title, actor_id, actor_name, action, detail, created_at }], ... }` + `X-Total-Count`.
Actions: `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_ARCHIVED`, `PROJECT_OWNER_TRANSFERRED`,
`MEMBER_ADDED`, `MEMBER_ROLE_CHANGED`, `MEMBER_REMOVED`, `TASK_CREATED`, `TASK_UPDATED`,
`TASK_STATUS_CHANGED`, `TASK_DELETED`, `COMMENT_ADDED`.

## GET /tasks/:id/activity — task activity feed

Auth: member. Same shape, filtered to one task. → `200` · `404` hidden.

## GET /reports/overdue — overdue report

Auth: session. Query: `page`, `limit`. Scope: the caller's non-archived projects.
Overdue = `due_date < today (UTC)` and status not DONE/CANCELED.
→ `200 { count, byProject: [{ project_id, project_key, project_name, count }], data: [task+project_key], page, limit, total }` + `X-Total-Count`.

```bash
curl -s -b cookies.txt http://127.0.0.1:4300/api/v1/reports/overdue
```

---

## Behaviour notes worth knowing before integrating

- Non-members receive `404` for every project-scoped resource (existence is hidden).
- `X-Total-Count` is always the **total**, also when a page is out of range (empty `data`).
- Duplicate query parameters (`?status=TODO&status=DONE`) fail enum validation with 400.
- Requests without a `Content-Type: application/json` body are not parsed → validation 400.
- Bodies over 100 KB return `413 PAYLOAD_TOO_LARGE`.
- Unsupported HTTP methods on known paths currently fall through to the 404 handler
  (no 405 mapping) — documented limitation (TASK-TC-303).
