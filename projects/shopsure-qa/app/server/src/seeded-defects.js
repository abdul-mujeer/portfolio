/**
 * Deliberately injected defects for QA demonstration.
 *
 * These are ONLY active when SEED_DEFECTS=1. They exist so the automation can prove that the
 * regression suite really detects them (see test-documentation/seeded-defects.md and
 * tests/api/seeded-defects.spec.ts). By default they are disabled and the same tests pass.
 *
 * IDs use the 1xx range so they can never be confused with defects genuinely found while testing
 * (SHOP-BUG-001..003, documented in test-documentation/defect-log.csv).
 */
export const seededDefectsEnabled = () => process.env.SEED_DEFECTS === "1";

/** SHOP-BUG-101 (SEEDED): cart stock guard is skipped, allowing more units than stock. */
export const skipCartStockCheck = () => seededDefectsEnabled();

/** SHOP-BUG-102 (SEEDED): cancelling an order does not restore product stock. */
export const skipStockRestoreOnCancel = () => seededDefectsEnabled();

/** SHOP-BUG-103 (SEEDED): minPrice filter is exclusive instead of inclusive (boundary defect). */
export const minPriceIsExclusive = () => seededDefectsEnabled();
