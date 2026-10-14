# TaskFlow API — UI Automation

## 1. What is automated

`tests/ui/` contains 10 Chromium tests (3 files) driving the real console against the
real API on the seeded test database:

| Case | File | Journey |
|------|------|---------|
| TASK-TC-101 | console.spec.ts | Login through the form, session box, logout back to login view |
| TASK-TC-102 | console.spec.ts | Five status columns, page-scoped counts (derived from the same API query), seeded card, pagination next/prev and disabled edges |
| TASK-TC-103 | console.spec.ts | Create task modal: title/description/priority/assignee/due/estimate → card appears with HIGH badge |
| TASK-TC-104 | console.spec.ts | Status select moves the card to the IN_PROGRESS column |
| TASK-TC-105 | console.spec.ts | Comment panel: seeded comments render, posting appends, textarea clears |
| TASK-TC-106 | console.spec.ts | Validation: 2-char title → aria-live banner "Error 400 … Title must be 3-120", modal stays open, banner dismissible |
| TASK-TC-107 | security.spec.ts | MEMBER sees no archive button; direct API call still returns 403 and the project stays active |
| TASK-TC-108 | console.spec.ts | Overdue-only filter → only `data-overdue="true"` cards, counters consistent, reset restores |
| TASK-TC-109 | accessibility.spec.ts | Labels/ARIA (alert + aria-live), dialog role/aria-modal, initial focus, Tab/Shift+Tab cycle, Escape closes and focus returns to the trigger |
| TASK-TC-110 | security.spec.ts | `<script>` title renders as literal text; no script element injected; no dialog fired |

## 2. Selector policy

- Only stable hooks: `data-testid` attributes (`login-email`, `task-card`,
  `task-status-select`, `comment-body`, `error-banner`, `pagination-next`, …).
- No CSS-structure selectors, no text-position assumptions except deliberate
  `filter({ hasText })` on card titles.
- No `waitForTimeout`: everything uses web-first assertions
  (`toBeVisible`, `toHaveText`, `toHaveAttribute`) or `expect.poll` for counters that
  are read as text.

## 3. State management

- Each Playwright test gets a fresh browser context; login happens through the UI.
- Tests that need a specific card position create their data through `page.request`
  (API) so they do not depend on other tests or page ordering.
- The seeded CI task is reached through the status filter (TC-105 reads the task's
  current status via the API first), so it works regardless of what earlier tests did.

## 4. Accessibility notes (verified, not claimed)

- All form controls are label-associated (`getByLabel` resolves; strict-mode ambiguity
  in the tests was resolved by scoping, not by weakening the app).
- The error banner is `role="alert"` + `aria-live="assertive"` and now z-indexed above
  the modal backdrop so validation errors are visible and dismissible while the modal
  is open (defect TASK-BUG-006).
- The modal is `role="dialog"` + `aria-modal="true"`, traps Tab, closes on Escape and
  restores focus to the opener.
- Known gaps: no automated axe-core audit (extra dependency not allowed), colour
  contrast checked manually only, and the board's horizontal scroll on very small
  viewports relies on native scrolling.

## 5. Running

```bash
npm run test:ui          # standalone: Playwright starts the server on a fresh test DB
npm run test:all         # orchestrator: API → UI → DB → Postman + report
npm run screenshots      # evidence JPEGs (desktop 1440×900 + mobile 390×844)
```
