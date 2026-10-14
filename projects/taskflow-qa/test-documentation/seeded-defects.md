# TaskFlow API — Seeded Defects (labelled)

Two defects are **deliberately injected** behind `SEED_DEFECTS=1` so the detection
exercise can be replayed on demand. Default runs are clean (`SEED_DEFECTS` unset or
`0`), and both defects are labelled `SEEDED` in `defect-log.csv`.

| ID | Behaviour with `SEED_DEFECTS=1` | Violates | Detecting tests |
|----|--------------------------------|----------|-----------------|
| SEEDED-001 | Overdue rule becomes `due_date <= today`, so a task due **today** is reported overdue (`src/lib/queries.js`) | TASK-REQ-015 / business rule 7 | TASK-TC-042, TASK-TC-038, TASK-TC-205 (DB) |
| SEEDED-002 | `DONE` is no longer terminal: `DONE → IN_PROGRESS` is accepted (`src/lib/workflow.js`) | TASK-REQ-010 / rule 4 | TASK-TC-028, TASK-TC-029 |

## Reproducible detection run

```bash
npm run seeded:demo
```

The script creates its own database (`.data/taskflow.seeded.db`, freshly seeded with
`SEED_DEFECTS=0`), boots an in-process server and runs the same probes twice — once
clean, once with `SEED_DEFECTS=1` — then writes evidence to
`test-evidence/seeded-defects/detection-run.json` and `detection-run.txt`.

**Actual output of the last run (2026-10-14):**

```
=== SEEDED DEFECT DETECTION RUN ===
Database: .data/taskflow.seeded.db (freshly seeded, SEED_DEFECTS=0 at seed time)

--- Baseline (SEED_DEFECTS=0): correct behaviour expected ---
overdue count = 3 (SQL strict "<" expectation: 3)
overdue ids = 4,3,10
DONE chain: IN_PROGRESS:200 -> IN_REVIEW:200 -> DONE:200
DONE -> IN_PROGRESS = 422 (expected 422)

--- Defect run (SEED_DEFECTS=1): the same probes now expose the seeded bugs ---
overdue count = 4 (SQL "<=" expectation with the defect: 4)
overdue ids = 4,3,10,12
DONE chain: IN_PROGRESS:200 -> IN_REVIEW:200 -> DONE:200
DONE -> IN_PROGRESS = 200 (expected 200 with the defect: DONE is not terminal)

Detection summary: SEEDED-001 DETECTED, SEEDED-002 DETECTED
```

## Why these two

Both are classic, realistic failure modes a real team ships by accident:

- an **off-by-one comparison** on a date boundary that only shows up on the boundary
  day (the suite's due-today trap exactly);
- a **state machine regression** where a terminal state stops being terminal after a
  refactor.

They also sit in different layers (SQL predicate vs. service logic), proving the
detection story at more than one level.

## Guardrails

- `SEED_DEFECTS` is read at call time; only the demo and a manual `SEED_DEFECTS=1`
  boot enable it. `.env.example` documents it with the "never leave at 1" warning.
- The orchestrator, Playwright config and every suite script do **not** set it.
- The demo uses a separate database file so seeded-defect runs cannot contaminate the
  test/evidence databases.
