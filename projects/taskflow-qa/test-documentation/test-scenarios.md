# TaskFlow API — Test Scenarios

High-level scenarios mapped to requirement groups. Detailed steps/cases live in
`test-cases.csv`; this list is the "what are we trying to prove" layer.

## Authentication & session (REQ-001..003)

1. A new user registers, receives a session and can immediately read their profile.
2. Duplicate registration is refused without revealing whether the password matched.
3. Weak passwords are refused with an actionable message; the 10-char boundary is accepted.
4. Login failures are indistinguishable between wrong password and unknown email.
5. Sessions are opaque, signed, flagged HttpOnly/SameSite, die on logout and on expiry.
6. Tampered or garbage tokens never reach the database session lookup as valid.

## Projects & membership (REQ-004..006, 014, 016)

7. Creating a project makes the creator the OWNER with a single owner membership.
8. Keys are unique and strictly formatted; malformed keys never reach storage.
9. Users only ever see their own projects; non-members get 404 for existing resources.
10. Rename/archive are OWNER/ADMIN; delete and transfer are OWNER-only.
11. Membership lifecycle: add/duplicate/unknown, role changes, last-admin guard.
12. The OWNER cannot be removed or demoted — only replaced through transfer, after
    which the previous owner can leave as ADMIN.
13. Archived projects accept reads and reject every mutation, including repeat archive
    (409) and delete (422).

## Tasks & workflow (REQ-007..010)

14. Task creation applies documented defaults and computes derived fields
    (names, comment_count, overdue).
15. Every boundary (title 3/120/121, description 2000/2001, estimate 0.5/100/0.5-steps,
    enums, types) is enforced with 400 and a details array.
16. Due dates are real calendar dates (rejecting 2026-02-30, accepting 2028-02-29) and
    never precede the creation date (422), including on update.
17. Only members can be assignees; null unassigns.
18. Update rights are object-level (reporter/assignee/ADMIN/OWNER) and every change is
    auditable before/after; no-ops write nothing.
19. Delete rights are separate from update rights (reporter or ADMIN/OWNER).
20. The workflow is linear with a cancel hatch; terminals and skipped jumps are 422;
    unknown values are 400; same-status is a silent 200 no-op.

## Conversations & audit (REQ-011..012)

21. Comments are member-only, trimmed, boundary-checked and logged with their id.
22. Activity records every create/update/status/comment with machine-readable details
    and is paginated newest-first; both feeds are invisible to non-members.

## Scale & retrieval (REQ-013, 015)

23. Default and custom pagination return disjoint, complete pages with truthful totals.
24. Filters (status/priority/assignee/q/dueBefore/overdue) and sorts behave as
    documented; wildcard characters are literal.
25. The overdue report aggregates across the caller's active projects only, excluding
    archived ones and anything due today.

## Safety & data (REQ-017..020)

26. Every error class carries the standard envelope; malformed/oversized payloads are
    rejected before business logic.
27. Database constraints back the API rules (UNIQUE, FK, CHECK) and survive reconnection.
28. Injection attempts are inert; privileged fields cannot be mass-assigned; stored
    markup is data, never executed.
29. The console supports the top journeys end-to-end with clear error surfaces, a
    keyboard-operable modal and permission-based hiding that never replaces server-side
    authorization.
