# Bug report template — ShopSure QA

Copy this template for every defect. Fields marked *(required)* must never be left empty; use
"unknown" and explain why when information is genuinely unavailable.

---

## Defect header

| Field | Value |
|-------|-------|
| **Defect ID** *(required)* | SHOP-BUG-### |
| **Title** *(required)* | Short, factual, symptom-focused (what is wrong, where) |
| **Module / feature** *(required)* | e.g. Cart, Checkout, Admin orders |
| **Severity** *(required)* | Critical / High / Medium / Low — impact on the business |
| **Priority** *(required)* | Urgent / High / Medium / Low — urgency to fix |
| **Type** *(required)* | Functional / Validation / Boundary / Data integrity / Security / Usability / Seeded |
| **Status** *(required)* | New / Open / In progress / Fixed / Retest / Closed / Reopened |
| **Environment** *(required)* | OS, browser, app version/build, API base URL, database state |
| **Build / commit** *(required)* | e.g. shopsure-qa 1.0.0 @ abc1234 |
| **Detected by / on** *(required)* | Name or suite + date |
| **Related test case** | SHOP-TC-### (must exist in test-cases.csv) |

## Reproduction *(required)*

Preconditions (data, session, seeded state):

1. …
2. …

Steps:

1. …
2. …
3. …

**Reproducibility:** always / intermittent (state frequency) / once (state why it may not repeat)

## Expected vs actual *(required)*

- **Expected result:** what should happen and *why* (link the requirement or acceptance criterion,
  e.g. AC-026 "a cart line holds at most 10 units").
- **Actual result:** what really happens, including exact status codes/messages.

## Evidence *(required)*

- Screenshot / trace / log path (`test-evidence/…`, `test-reports/…`)
- Raw request/response if applicable
- For automated detection: the failing test name and the run log

## Analysis

- **Root cause:** code/design cause once known (file and line where practical).
- **Workaround:** available or none.
- **Impact:** who is affected and what they cannot do.
- **Affected areas / regression risk:** other modules at risk from the same root cause.

## Verification

| Step | Result | Evidence |
|------|--------|----------|
| Retest after fix | Pass / Fail | … |
| Regression suite | Pass / Fail (counts) | … |
| Closed on / by | date, name | … |
| Closure rationale | why it is safe to close | … |

---

## Quality rules for this project

1. One defect per report — never bundle several symptoms.
2. Titles describe the symptom, not the suspected cause.
3. Steps must let a different person reproduce the bug without asking questions.
4. Severity and priority are decided separately and justified.
5. A defect links to at least one test case, and the test case links back to the defect ID.
6. Seeded defects are labelled **SEEDED** in the type field and use the 1xx ID range.
7. Fixes require a retest result and a regression result before closure.
