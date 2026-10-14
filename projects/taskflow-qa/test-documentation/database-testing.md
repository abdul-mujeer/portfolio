# TaskFlow API — Database Testing

## 1. Schema under test

SQLite file database via Node's built-in `node:sqlite` (`DatabaseSync`), schema created
idempotently in `app/server/src/db.js`:

| Table | Key constraints |
|-------|-----------------|
| `users` | `email` UNIQUE; NOT NULLs |
| `sessions` | `token` PK; FK → users (CASCADE); `expires_at` enforced by app |
| `projects` | `key` UNIQUE + CHECK `^[A-Z]{2,6}$`; name 3–100; `archived IN (0,1)`; FK owner RESTRICT |
| `project_members` | PK `(project_id,user_id)`; role CHECK in (OWNER,ADMIN,MEMBER); FKs CASCADE |
| `tasks` | FK project CASCADE; title 3–120 CHECK; status/priority CHECK enums; `estimated_hours` CHECK 0.5–100; `due_date` GLOB date shape; assignee FK SET NULL |
| `comments` | FK task CASCADE; body 1–1000 CHECK |
| `activity` | FK project CASCADE; FK task SET NULL; `detail_json` CHECK `json_valid` |

Indexes: tasks(project_id/status/due_date/assignee), comments(task_id),
activity(project_id/task_id), members(user_id), sessions(user_id).

## 2. Checks executed (`npm run test:db`)

22 checks across two modules; each check runs in a rolled-back transaction where it
probes constraint rejection, so the database is never polluted.

| Area | Checks |
|------|--------|
| UNIQUE keys | duplicate `users.email`, duplicate `projects.key` rejected with row counts unchanged |
| Foreign keys | `PRAGMA foreign_keys = 1`; `PRAGMA foreign_key_check` empty; inserting a task with `project_id 999999` rejected; orphan queries for tasks/comments/members/activity all 0 |
| CHECK constraints | status enum, short title, estimate below range, oversized comment, lowercase project key, non-JSON `detail_json` — all rejected; all stored `detail_json` valid |
| Activity completeness | every DONE/CANCELED task has a `TASK_STATUS_CHANGED` row reaching that status; every task has `TASK_CREATED`; only documented action names exist |
| Ownership integrity | exactly one OWNER membership per project; `projects.owner_id` matches it (31 projects checked on suite-generated state) |
| Archived exclusion | 2 archived overdue tasks stay out of the active scope; active ≥ 3 seeded |
| Overdue correctness | due-today boundary: strict `<` gives 3, `<=` would give 4 (the trap the seeded defect exploits) |
| API ↔ SQL parity | `/reports/overdue` count equals the SQL predicate; `X-Total-Count` equals `COUNT(*)` for every accessible project; computed `comment_count` equals `COUNT(comments)` |
| Persistence | closing/reopening the database file preserves counts |

## 3. Results (last orchestrator run)

**[TEST-DB] 22/22 checks passed.** Raw output: `test-reports/db-results.json` and
`test-evidence/logs/db-suite.txt`.

## 4. Notes and limitations

- The suite runs against whatever state the API/UI suites produced (parity-based checks
  are state-agnostic by design); when run standalone it seeds `.data/taskflow.test.db`
  if missing.
- No migration framework: the schema is created with `CREATE TABLE IF NOT EXISTS`;
  adding columns to an existing file requires `npm run db:reset` (documented).
- SQLite is single-writer; concurrency behaviour beyond "one Node process" is not
  validated (see risk assessment).
- Backup/restore and WAL behaviour are not exercised; the demo uses the default
  rollback journal so `db:reset` can delete the file plus sidecars safely.
