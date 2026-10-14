/**
 * Exploratory testing charters (session-based). Each charter was actually
 * executed during the build; findings are documented in
 * test-documentation/exploratory-testing.md and, where real defects were found,
 * in test-documentation/defect-log.csv.
 */
export const exploratoryCharters = [
  {
    id: 'TASK-EXP-001',
    title: 'Break the write endpoints with hostile input',
    timebox: '45 minutes',
    mission:
      'Try to make the API accept, store or execute data it should not: injection strings, wildcard abuse, extreme payloads, type confusion and malformed content types.',
    areas: ['POST/PATCH tasks & comments', 'query filters', 'auth payloads', 'content-type handling'],
    techniques: 'Error guessing, fuzzing literals, boundary values, request tampering.',
    outcome:
      'No 5xx observed from crafted input; wildcard abuse in the q filter is blocked by LIKE escaping (verified in TASK-TC-037) and mass-assignment probes are rejected (TASK-TC-046). Behavioural gap found: unsupported methods fall through to 404 (no 405 mapping) - documented, not fixed by design.',
  },
  {
    id: 'TASK-EXP-002',
    title: 'Chase authorization across object boundaries (IDOR hunt)',
    timebox: '45 minutes',
    mission:
      'As every seeded persona (member, outsider, no-projects user) hit every resource id and verb and verify the response never leaks or mutates another project.',
    areas: ['projects', 'tasks', 'comments', 'activity', 'reports', 'members'],
    techniques: 'ID enumeration, verb swapping, persona rotation, response-diffing.',
    outcome:
      'Isolation held for all 200+ requests: non-members always receive 404 and no mutation succeeded. The exercise became the scripted sweep in scripts/manual-cases.mjs (TASK-TC-302).',
  },
  {
    id: 'TASK-EXP-003',
    title: 'Time and date torture',
    timebox: '30 minutes',
    mission:
      'Attack the due-date rules: impossible calendar dates, leap years, DST boundaries, due-today and overdue-by-one-minute cases, timezone differences.',
    areas: ['task create/update', 'overdue filter', 'reports/overdue', 'seed offsets'],
    techniques: 'Boundary value analysis, date arithmetic, UTC vs local reasoning.',
    outcome:
      'The strict calendar validator and the UTC day boundary held. One real seed defect was caught by cross-checking SQL vs expectation: due offsets were inverted (TASK-BUG-002 in the defect log).',
  },
  {
    id: 'TASK-EXP-004',
    title: 'Abuse the UI under role and error pressure',
    timebox: '30 minutes',
    mission:
      'Use the console as the wrong role, force API errors, paste hostile strings into fields and check the UI degrades gracefully (banners, focus, state).',
    areas: ['console', 'modal flows', 'error banner', 'permission hiding', 'rendering'],
    techniques: 'Persona switching, state resets, keyboard-only operation, viewport changes.',
    outcome:
      'Three real UI defects were found and fixed on the spot: the console was served from the wrong static path (TASK-BUG-004), the CSS `display` rules defeated the [hidden] attribute so the invisible modal backdrop swallowed every click (TASK-BUG-005) and the error banner sat under the modal backdrop and could not be dismissed (TASK-BUG-006). Stored markup renders as text and hidden actions fail server-side with 403.',
  },
];
