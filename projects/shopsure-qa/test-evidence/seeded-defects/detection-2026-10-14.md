# ShopSure — seeded defect detection evidence

- Executed: 2026-10-14T00:04:35.075Z
- Command: `npm run test:seeded-defects` (runs `tests/api/seeded-defects.spec.ts` twice)

## Detection run — `SEED_DEFECTS=1`

- Exit code: **1** (expected: non-zero)
- Duration: 23s
- Failing tests (0):
  - (none — this would mean the suite cannot detect the defects!)

## Control run — `SEED_DEFECTS=0`

- Exit code: **0** (expected: 0)
- Duration: 20s
- Passing tests (3):
  - tests\api\seeded-defects.spec.ts:12:3 › Seeded defect detection › @regression SHOP-BUG-103: minPrice filter includes products priced exactly at the boundary
  - tests\api\seeded-defects.spec.ts:18:3 › Seeded defect detection › @regression SHOP-BUG-101: cart refuses more units than the product has in stock
  - tests\api\seeded-defects.spec.ts:32:3 › Seeded defect detection › @regression SHOP-BUG-102: cancelling an order restores stock

## Verdict

**Detection capability NOT verified.** Review the logs in this folder: the suite behaved unexpectedly in one of the runs.

Raw logs: `2026-10-14-seed-defects-1.log` and `2026-10-14-seed-defects-0.log` in this folder.
