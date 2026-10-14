# PeopleCore HRMS — test scenarios

Scenarios sit between the requirements and the detailed cases: each one is a goal a real user or
attacker pursues, plus the cases that prove it. Detailed steps live in `test-cases.csv`.

| # | Scenario | Actor | Goal | Test cases | Result |
|---|---|---|---|---|---|
| S-01 | Sign in and stay signed in | any | Reach the dashboard with a valid session, understand the session lifetime | HR-TC-001, 002, 003, 009 | Pass |
| S-02 | Get locked out and recover | any | See the lockout at the 5th failed attempt and be refused until the window expires | HR-TC-007, 010 | Pass |
| S-03 | End the session | any | Sign out so the token is useless afterwards | HR-TC-006 | Pass |
| S-04 | Find a person | ADMIN/HR/MANAGER/EMPLOYEE | Combine search, department/status filters, sorting and paging without losing context | HR-TC-016, 017, 028 | Pass |
| S-05 | Onboard a new employee | ADMIN/HR | Create a record with valid data and see it appear with an audit entry | HR-TC-018, 029 | Pass |
| S-06 | Reject bad onboarding data | ADMIN/HR | Get precise, actionable errors for codes, emails, salary, hire dates, departments | HR-TC-019, 020, 021, 025, 026 | Pass |
| S-07 | Change an existing employee | ADMIN/HR | Update only what may be changed; HR cannot touch roles or ADMIN accounts | HR-TC-024, 030, 065 | Pass |
| S-08 | Remove an employee safely | ADMIN | Delete an employee without breaking references or losing history | HR-TC-022, 023 | Pass |
| S-09 | Record the working day | ADMIN/HR/MANAGER | Create and correct attendance rows, respecting the one-row-per-day and time rules | HR-TC-034, 035, 036, 037, 040 | Pass |
| S-10 | Book leave | EMPLOYEE | Submit a valid request and survive the validation rules | HR-TC-041, 042, 043, 044, 051 | Pass |
| S-11 | Avoid double booking | EMPLOYEE | Be refused when the window overlaps an existing PENDING/APPROVED request | HR-TC-045 | Pass |
| S-12 | Decide a request | MANAGER/HR/ADMIN | Approve or reject with the right comment rules and nobody decisive about their own request | HR-TC-046, 047, 049, 052 | Pass |
| S-13 | Withdraw a request | EMPLOYEE | Cancel an own pending request; reviewed requests stay immutable | HR-TC-048 | Pass |
| S-14 | Leave the company | ADMIN | Terminate an account: no new attendance, no new leave, no decision on old leave, session revoked | HR-TC-038, 050 | Pass |
| S-15 | Prove what happened | ADMIN/HR | Read the audit trail, filter it, inspect before/after payloads | HR-TC-054, 055 | Pass |
| S-16 | Read the HR summary | ADMIN/HR/MANAGER/EMPLOYEE | Get headcount, leave and attendance numbers limited to the caller's scope | HR-TC-056 | Pass |
| S-17 | Attack the authorization model | any role | Reach data outside the role's scope through the API or the UI | HR-TC-059, 060, 061, 064 | Pass |
| S-18 | Attack the session model | anyone | Replay, forge, or keep a terminated account alive | HR-TC-006, 007, 050 | Pass |
| S-19 | Trigger server errors | anyone | Find inputs that produce a 500 instead of a documented status | HR-TC-022, 057 | Pass |
| S-20 | Run the API without Playwright | integration | Prove the collection works end-to-end in another tool | HR-TC-057 | Pass |
| S-21 | Trust the database | DBA/QA | Verify constraints, seed determinism and referential integrity after failures | HR-TC-058 | Pass |
| S-22 | Use it on a phone | any | Complete the main journeys at 390x844 | HR-TC-063 | Pass |
| S-23 | Use it with assistive technology | any | Keyboard, contrast and screen-reader paths | HR-TC-066, 067, 068, 069 | Not Executed |

## Scenario → evidence map

- Executed scenarios point at cases in `test-cases.csv`, whose `EvidenceLink` column names the raw log or screenshot.
- S-19 (server errors) is the reason `HR-BUG-008` exists: the Postman cleanup step produced a 500 before the fix.
- S-17/S-18 combine automated matrices with exploratory charters `HR-EX-01` and `HR-EX-05`.
- S-23 is deliberately left as *Not Executed*: no contrast checker, screen reader or extra browser engine is available in this environment (documented in the README).
