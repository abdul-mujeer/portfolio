# PeopleCore HRMS — UI automation

## 1 · Stack and layout

| Item | Value |
|---|---|
| Runner | `@playwright/test` 1.56 (project `ui`, Chromium) |
| App under test | Express + EJS server-rendered pages on `http://127.0.0.1:4200` |
| Specs | `tests/ui/login.spec.ts`, `employees.spec.ts`, `leave.spec.ts`, `rbac.spec.ts` |
| Shared helpers | `tests/ui/helpers.ts` (`loginViaUi`, `UI_CREDENTIALS`, `isoDateOffset`) |
| Server/database | started by `playwright.config.ts` (`webServer`), resets + seeds `.data/peoplecore.test.db` |
| Evidence | `test-evidence/logs/ui.txt`, `test-reports/playwright/ui.json`, screenshots under `test-evidence/screenshots/` |

## 2 · Selector strategy

Every interactive element and every important output carries a stable `data-testid`
(`login-email`, `login-submit`, `login-error`, `login-locked`, `employee-row`, `employee-search`,
`employee-department-filter`, `employee-sort`, `employee-order`, `pagination-next`,
`pagination-current`, `empty-state`, `form-error-<field>`, `leave-form-reason`,
`review-approve-<id>`, `review-reject-<id>`, `audit-row`, `forbidden-page`, `not-found-page`, …).

Consequences:

- no CSS/XPath selectors and therefore no breakage when styling changes,
- no `waitForTimeout`: web-first assertions only (`expect(locator).toHaveText`,
  `toHaveCount`, `toBeVisible`, `waitForURL`),
- dynamic elements are addressed by attribute
  (`[data-testid="review-row"][data-leave-id="5"]`) instead of by position.

## 3 · Test independence

- Each test signs in through the real login form (`loginViaUi`) or opens a fresh
  `BrowserContext`, so no session leaks between roles.
- Data is created through the UI with time-seeded unique values (`ui.probe.<stamp>@example.com`,
  `EMP-7xx`), and destructive actions restore the seeded state where another test depends on it
  (see the HR edit test, which puts back position and status).
- Tests that would influence each other use different dates (attendance probes use today+50 and
  today+45) so a re-run against a stale database still behaves predictably.

## 4 · What the 20 UI tests cover

| File | Tests | Journeys |
|---|---|---|
| `login.spec.ts` | 5 | valid login → role-aware dashboard, invalid credentials, lockout banner, deep-link redirect, sign-out |
| `employees.spec.ts` | 7 | search + department filter + empty state, sorting + pagination, create with inline validation then success, HR edit with disabled role/code, detail tabs (attendance + leave), attendance recording + filtered grid, audit filter + before/after JSON |
| `leave.spec.ts` | 3 | employee submit/cancel with inline validation, manager review queue (short comment refused, then reject + approve), employee never sees the review queue |
| `rbac.spec.ts` | 5 | EMPLOYEE scoping + 403 pages, MANAGER direct-report list, HR cannot delete/change roles, ADMIN full controls, read-only attendance + 404 pages |

Tagged subsets: `@smoke` (7 UI tests, the critical path), `@regression` (5 UI tests).

## 5 · Accessibility coverage (structural only)

Automated assertions cover: the presence of the skip link, `aria-label` on the navigation, labels
bound to inputs via `for`/`id`, semantic `table`/`th` markup, `role="alert"`/`role="status"` on
error and flash messages, `aria-current="page"` on the active tab/pagination entry, and semantic
headings. They do **not** cover keyboard-only operation, colour contrast or screen-reader output —
those cases (HR-TC-066…069) are marked *Not Executed* in `test-cases.csv`.

## 6 · Commands

```bash
npm run test:ui          # whole UI suite (starts its own server on the test database)
npm run test:smoke       # @smoke subset (API + UI)
npm run test:regression  # @regression subset
npm run screenshots      # 12 evidence screenshots (1440x900 + 390x844, JPEG q70)
npx playwright show-report test-reports/playwright/html
```

## 7 · Findings produced by this layer

| Finding | Impact |
|---|---|
| HR-BUG-005 | Signing in after a redirect re-rendered the login page (broken deep links) |
| HR-BUG-006 | The employee list returned a validation error page whenever a filter was submitted empty — the most common action on the page |
| HR-BUG-007 | The header displayed "undefined undefined" instead of the signed-in user's name |

Traces (`retain-on-failure`), a screenshot on failure and the HTML report are always produced, so a
red run can be diagnosed without re-running it locally.
