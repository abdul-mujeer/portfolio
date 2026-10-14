# TaskFlow API — Permission Matrix

Expected result for each actor × action, verified by automated tests. `404` is used
deliberately for non-members so existence is never leaked (cross-project isolation).

Role legend: **O** = project OWNER · **A** = project ADMIN · **M** = project MEMBER ·
**NM** = authenticated non-member · **–** = unauthenticated.

| Action | O | A | M | NM | – | Tests |
|--------|---|---|---|---|---|-------|
| Read project / tasks / members / activity | 200 | 200 | 200 | 404 | 401 | TC-009, TC-016, TC-039 |
| Read task / comments | 200 | 200 | 200 | 404 | 401 | TC-039 |
| Create project | 201 (becomes OWNER) | — | — | — | 401 | TC-006 |
| Rename / redescribe project | 200 | 200 | 403 | 404 | 401 | TC-010, TC-012 |
| Delete project | 204 | 403 | 403 | 404 | 401 | TC-011 |
| Archive project | 200 | 200 | 403 | 404 | 401 | TC-012 |
| Re-archive | 409 | 409 | 403 | 404 | 401 | TC-012 |
| Transfer ownership | 200 | 403 | 403 | 404 | 401 | TC-018 |
| Add member | 201 | 201 | 403 | 404 | 401 | TC-013 |
| Change member role | 200 | 200 | 403 | 404 | 401 | TC-017 |
| Remove member (non-owner) | 204 | 204 | 403 | 404 | 401 | TC-016/017 area |
| Remove/demote the OWNER | 409 | 409 | 403 | 404 | 401 | TC-018 |
| Demote the last ADMIN | 409 | 409 | 403 | 404 | 401 | TC-017 |
| Create task | 201 | 201 | 201 | 404 | 401 | TC-013/019 |
| Add comment | 201 | 201 | 201 | 404 | 401 | TC-030 |
| Update task (reporter) | 200 | 200 | 200 | 404 | 401 | TC-025 |
| Update task (assignee) | 200 | 200 | 200 | 404 | 401 | TC-025 |
| Update task (unrelated member) | n/a | n/a | 403 | 404 | 401 | TC-026 |
| Change status (reporter/assignee/admin) | 200 | 200 | 200 | 404 | 401 | TC-027 |
| Change status (unrelated member) | n/a | n/a | 403 | 404 | 401 | TC-026 |
| Delete task (reporter) | 204 | 204 | 204 | 404 | 401 | TC-026 |
| Delete task (assignee, not reporter) | — | — | 403 | 404 | 401 | TC-026 |
| Delete task (admin, not reporter) | 204 | 204 | 403 | 404 | 401 | TC-026 |
| Read overdue report | own scope | own scope | own scope | own scope | 401 | TC-043 |
| Mutations on archived project | 422 | 422 | 403 | 404 | 401 | TC-012 |

## Notes

- **Reporter/assignee right is per-task**, computed from task fields, not the role.
  A MEMBER who is neither reporter nor assignee receives `403` (they *can* see the
  task, so 403 is correct and not a leak).
- **Ownership transfer** is the only way to change the OWNER: role changes to/from
  OWNER via the member endpoints are `400` (assign) or `409` (demote the current owner).
- **Last-ADMIN protection** applies to demotion. Removing the last admin is allowed
  because the OWNER can still manage the project (verified: no `LAST_ADMIN` block on
  delete, only on PATCH role).
- Non-members see the same `404` for existing and non-existing ids, so enumeration
  reveals nothing.
