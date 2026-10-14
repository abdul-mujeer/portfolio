# TaskFlow API — Security Testing

All checks below were **executed** on the seeded test database (see
`test-evidence/logs/`). Nothing in this document is a claim without a raw result behind
it; the "How verified" column names the exact suite/case.

## 1. Authentication & session handling

| # | Check | How verified | Result |
|---|-------|--------------|--------|
| 1 | Password storage: scrypt + per-user random salt, timing-safe compare | Code review + response inspection (no `password_hash`/`salt` in any payload) — TC-001 | PASS |
| 2 | Password policy ≥10 chars with upper+lower+digit | TC-003 (5 weak variants 400; 10-char compliant 201) | PASS |
| 3 | Session cookie flags `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Secure` in dev | TC-005 (header assertions) + Postman assertion | PASS |
| 4 | Token tampering (flipped signature byte) rejected | TC-005 → 401 | PASS |
| 5 | Garbage cookie rejected without DB lookup side effects | TC-005 → 401 | PASS |
| 6 | Logout invalidates server-side session immediately | TC-005 → 204 then 401 | PASS |
| 7 | Expired session rejected and row deleted | TC-304 (SQL back-dating of `expires_at`) → 401, row gone | PASS |
| 8 | Unauthenticated sweep over protected resources | TC-005 covers 5 endpoints; TC-302/303 cover more | PASS (401 everywhere) |
| 9 | Login error does not reveal which field failed | TC-004/005 compare messages for wrong-password vs unknown-email — identical | PASS |

## 2. Authorization / IDOR

| # | Check | How verified | Result |
|---|-------|--------------|--------|
| 10 | Non-member reads of projects/tasks/comments/activity → 404 (not 403) | TC-039 (7 endpoints), TC-302 (IDOR sweep: 3 projects + all 18 seeded tasks, 0 mismatches, 0 ×403) | PASS |
| 11 | Non-member writes across 10 mutation endpoints → 404 and no state change | TC-040 (re-read confirms unchanged title/status/project name) | PASS |
| 12 | Role-based blocks return 403 (unrelated member update/delete; MEMBER admin ops) | TC-026, TC-010, TC-011, TC-012; Postman folder 04 | PASS |
| 13 | Ownership protection (self-demote/remove, last admin) | TC-017/018 → 409 | PASS |
| 14 | Users with no memberships see an empty scope, no 403 side channels | TC-041, TC-302 | PASS |

## 3. Injection

| # | Check | How verified | Result |
|---|-------|--------------|--------|
| 15 | SQL injection in `q` filter (`' OR 1=1 --`, `%'; DROP TABLE tasks;--`, `' UNION SELECT …`) | TC-044 + TC-301 (manual): all 200, 0 rows, no 500; tables intact afterwards | PASS |
| 16 | SQL-looking title stored verbatim (parameterized writes) | TC-044/TC-301 → 201, exact string returned | PASS |
| 17 | SQL injection in structured fields (login email, project key) | TC-044/TC-301 → 400 by validation | PASS |
| 18 | LIKE wildcard abuse (`%`, `_`) — wildcard injection | TC-037: `%` matches 0 rows, `_` matches exactly the one seeded literal (`detail_json`) → escaping works | PASS |
| 19 | Mass assignment of privileged fields (`ownerId`, `owner_id`, `reporterId`, `reporter_id`, `project_id`, extra keys on register/member-add) | TC-046 + TC-001/015: all 400 (strict schemas); state re-read unchanged | PASS |
| 20 | Stored XSS: `<script>`/`<img onerror>` in task/comment text | TC-045 (API returns verbatim JSON text), TC-110 (DOM shows literal text, no script element, no dialog fired) | PASS |

## 4. Transport / payload hygiene

| # | Check | How verified | Result |
|---|-------|--------------|--------|
| 21 | Oversized body (>100 KB) | TC-303 → 413 `PAYLOAD_TOO_LARGE` | PASS |
| 22 | Unparsed content type (text/plain JSON) | TC-303 → 400 validation (body not parsed) | PASS |
| 23 | Malformed JSON | TC-301 → 400 `INVALID_JSON` | PASS |
| 24 | Duplicate query params (`status=TODO&status=BOGUS`) | TC-303 → 400 | PASS |
| 25 | Error envelopes leak no stack traces / SQL / internals | Code review of `middleware/error.js` + all negative tests assert only `{code,message,details}`; 500 handler returns generic `INTERNAL_ERROR` | PASS |

## 5. Documented gaps / accepted risks (not defects — no requirement covers them)

- **No rate limiting / lockout** on login or any endpoint (brute-force feasible in a
  real deployment). Out of scope; documented in `risk-assessment.md`.
- **No CSRF tokens.** Mitigated structurally: session cookie is `SameSite=Lax` and the
  API only accepts JSON bodies (`application/json`), which blocks simple cross-site
  form posts; a determined same-site XSS would still be able to act.
- **No `Secure` cookie flag in dev/test** by design (`NODE_ENV=production` sets it);
  verified the flag is present only in production configuration.
- **No security headers** (CSP, X-Frame-Options…). The console uses `textContent`
  everywhere, so stored XSS is contained, but headers remain a hardening opportunity.
- **No password reset / email verification / MFA** — not implemented, therefore not
  tested.
- **HTTP only** in the demo (no TLS termination tested).

## 6. How to re-run the security evidence

```bash
npm run test:api        # TC-037/039/040/044/045/046 + cookie/tamper probes
npm run manual:cases    # TC-301..304 (injection, IDOR sweep, payload edges, expiry)
npm run test:postman    # HTTP-level negative assertions
```
Raw output is captured in `test-evidence/logs/` and summarised in
`test-reports/execution-report-*.md`.
