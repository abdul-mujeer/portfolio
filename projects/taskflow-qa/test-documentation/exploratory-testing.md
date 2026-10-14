# TaskFlow API — Exploratory Testing

> Charters are defined in `test-data/tests/exploratory-charters.mjs`.
> The findings below are real: every defect listed was observed in a run of this build,
> logged in `defect-log.csv`, fixed and retested.

## Sessions

| Charter | Timebox | Focus |
|---------|---------|-------|
| TASK-EXP-001 | 45 min | Hostile input on write endpoints and filters (injection, wildcards, payloads, types) |
| TASK-EXP-002 | 45 min | IDOR / authorization chase with every seeded persona |
| TASK-EXP-003 | 30 min | Time and date torture (impossible dates, leap years, due-today, UTC) |
| TASK-EXP-004 | 30 min | Console under role/error pressure (permission hiding, banners, keyboard, rendering) |

## Findings from the sessions (all fixed and retested)

| Finding | Charter | Defect | Resolution |
|---------|---------|--------|------------|
| `GET /reports/overdue` returned **500** ("no such column: ua.display_name") whenever a report row existed | started as a write-endpoint session, surfaced while probing reports | TASK-BUG-001 | Missing assignee join added; reports suite now green (TC-042/205) |
| Seeded **due-date offsets were inverted** (negative offsets landed in the future), so "3 overdue" fixtures did not match their intent | TASK-EXP-003 (cross-checking SQL against expectations) | TASK-BUG-002 | `seedDate(-dueDays)` fix; overdue fixture verified 3 + due-today 1 |
| `GET /projects` returned `{ data: [] }` with a correct `total` — the list was effectively empty for every user | TASK-EXP-002 persona setup (the IDOR session could not enumerate scope) | TASK-BUG-003 | Duplicate user-filter placeholder removed from the route; TC-006/008/048 green |
| Console 404'd: static files looked up in `app/server/public` | TASK-EXP-004 | TASK-BUG-004 | `PUBLIC_DIR` corrected to `app/public` |
| Invisible modal backdrop swallowed **all clicks** (login impossible): CSS `display` rules overrode the `[hidden]` attribute | TASK-EXP-004 (first click of the first journey) | TASK-BUG-005 | Global `[hidden] { display: none !important; }` |
| Error banner rendered **behind** the modal backdrop → validation message visible only by luck, dismiss button unclickable | TASK-EXP-004 | TASK-BUG-006 | Banner raised above the backdrop (`z-index: 100`) |

## Deliberate probes that found no problems

- SQLi payloads in `q`, titles, login email and keys: inert, no 5xx, tables intact
  (now scripted as TC-044/TC-301).
- IDOR sweep: 3 projects × 18 task ids × 5 endpoint families as `outsider` and
  `noprojects` → 0 mismatches, 0 accidental 403s (scripted as TC-302).
- Unicode/emoji round-trip and expired-session cleanup (TC-304).
- Oversized payload (413), text/plain (400), duplicate query params (400),
  malformed JSON (400 INVALID_JSON).
- Unsuitable methods on known paths: `PUT /tasks/1` → 404. **No 405 mapping exists**;
  recorded as a documented limitation rather than a defect (no requirement covers it).

## How this differs from scripted suites

Exploration was timeboxed and unscripted; every confirmed failure was converted into a
regression case (see the Defect column above) so the finding cannot silently return.
New charters for a future session: CSP/security headers, long-running session rotation,
concurrent writers on SQLite, screen-reader passes.
