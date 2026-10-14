# TaskFlow API — Requirements

> Single source of truth: `test-data/tests/requirements.mjs` (machine-readable).
> `test-documentation/traceability-matrix.csv` is generated from it together with
> `test-data/tests/test-cases.mjs`, so IDs can never drift.

**Scope:** the TaskFlow REST API (`/api/v1`) and its vanilla-JS console.
**Total requirements:** 20 functional/non-functional requirements, each with 2–4 acceptance criteria (`TASK-REQ-nnn-ACm`).

| ID | Requirement | Acceptance criteria |
|----|-------------|--------------------:|
| TASK-REQ-001 | Authentication and session lifecycle | 4 |
| TASK-REQ-002 | Password policy and hashing | 3 |
| TASK-REQ-003 | Session security (signed opaque tokens, cookie flags, expiry) | 3 |
| TASK-REQ-004 | Project CRUD and key uniqueness | 3 |
| TASK-REQ-005 | Members, roles and object-level permissions | 3 |
| TASK-REQ-006 | Ownership transfer and owner protection | 3 |
| TASK-REQ-007 | Task CRUD and validation | 3 |
| TASK-REQ-008 | Task assignment rules | 2 |
| TASK-REQ-009 | Due date rules (calendar validity, creation bound) | 3 |
| TASK-REQ-010 | Status workflow (linear, terminal, no-op) | 3 |
| TASK-REQ-011 | Comments | 3 |
| TASK-REQ-012 | Activity feed completeness | 3 |
| TASK-REQ-013 | Pagination, filtering and sorting | 3 |
| TASK-REQ-014 | Cross-project isolation (404, never 403) | 3 |
| TASK-REQ-015 | Overdue report and archived exclusion | 3 |
| TASK-REQ-016 | Archived project behaviour | 3 |
| TASK-REQ-017 | Error envelope and HTTP semantics | 3 |
| TASK-REQ-018 | Data integrity and persistence | 3 |
| TASK-REQ-019 | Input safety (SQLi, mass assignment, XSS-as-text) | 3 |
| TASK-REQ-020 | Console journeys and accessibility | 3 |

## Key documented decisions

- **Status workflow is strict:** `TODO → IN_PROGRESS → IN_REVIEW → DONE`; `CANCELED`
  may be entered from any non-DONE state; DONE/CANCELED are terminal. Skipping a
  step (`TODO → DONE`) is a business-rule violation (422), not a validation error.
- **Status changes go through `PATCH /tasks/:id/status` only.** `PATCH /tasks/:id`
  is strict and rejects a `status` field with 400.
- **Non-members always receive 404** — never 403 — so resource existence is not leaked.
- **`page`/`limit`**: `page ≥ 1`, `limit 1..100` (default 20). Out-of-range pages are
  **200 with an empty array** and the true `X-Total-Count` (not 404).
- **Overdue rule:** `due_date IS NOT NULL AND due_date < today (UTC) AND status NOT IN ('DONE','CANCELED')`.
  A task due *today* is not overdue.
- **Archived projects** accept reads (200) but every mutation — including delete and
  re-archive — is rejected: mutations 422 `ARCHIVED_PROJECT`, second archive 409
  `PROJECT_ALREADY_ARCHIVED`.
- **Errors** always use `{ error: { code, message, details } }` with
  `details: []` presented as an array. Stack traces never reach clients.

## Out of scope

Rate limiting/brute-force protection, CSRF tokens, MFA, email verification, password
reset, file attachments, comment editing/deletion, unarchive, webhooks, real-time
updates. See `risk-assessment.md` for the residual-risk view.
