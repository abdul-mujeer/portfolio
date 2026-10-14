import { STATUS_TRANSITIONS } from './validators.js';

/**
 * Status workflow: TODO -> IN_PROGRESS -> IN_REVIEW -> DONE, CANCELED from any
 * non-DONE state, DONE/CANCELED terminal. Same-status updates are handled by the
 * caller as no-ops.
 *
 * SEEDED DEFECT 002 (only when SEED_DEFECTS=1): DONE is no longer terminal.
 */
export function getAllowedTransitions(status) {
  if (process.env.SEED_DEFECTS === '1' && status === 'DONE') {
    return ['IN_PROGRESS'];
  }
  return STATUS_TRANSITIONS[status] ?? [];
}
