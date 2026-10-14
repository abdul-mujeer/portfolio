# ShopSure — Seeded Defects (detection capability exercise)

> **Scope note:** the defects on this page are *deliberately injected* into the demo application so that
> the automated suite can prove it detects them. They are **not** real defects found in a commercial
> product. They are only active when the server runs with `SEED_DEFECTS=1`.

## Why this exists

An automation suite that has never failed proves nothing. This exercise runs the same regression
assertions against a deliberately broken build: if the suite stays green, the suite is broken, not the
application. The flag keeps demo runs clean while making the detection reproducible.

## The seeded defects

| ID | Defect | Injection point | Detected by |
|----|--------|-----------------|-------------|
| SHOP-BUG-101 | Cart accepts more units than the product has in stock (the stock guard is skipped) | `skipCartStockCheck()` in `app/server/src/seeded-defects.js`, used by `routes/cart.js` | `tests/api/seeded-defects.spec.ts` › SHOP-BUG-101 test, plus `tests/api/cart.spec.ts` stock tests |
| SHOP-BUG-102 | Cancelling an order does not restore stock (silent inventory drift) | `skipStockRestoreOnCancel()` used by `routes/orders.js` | `tests/api/seeded-defects.spec.ts` › SHOP-BUG-102 test, plus `tests/api/orders.spec.ts` cancel test |
| SHOP-BUG-103 | `minPrice` filter is exclusive, so a product priced exactly at the boundary disappears | `minPriceIsExclusive()` used by `routes/products.js` | `tests/api/products.spec.ts` boundary test, plus `tests/api/seeded-defects.spec.ts` › SHOP-BUG-103 test |

## How to reproduce the detection (exact commands)

```powershell
cd projects/shopsure-qa
npm run test:seeded-defects     # see package.json: boots the API with SEED_DEFECTS=1 and runs the suites
```

The script `scripts/seeded-defects-run.mjs`:

1. starts the server with `SEED_DEFECTS=1` against a dedicated database,
2. runs the seeded-defect spec and the affected regression specs,
3. **expects failures** (a green run is treated as a script error, because it would mean the defects were
   never injected or the assertions do not really test the rule),
4. saves the raw output under `test-evidence/seeded-defects/`.

Afterwards, `npm run test:api` (flag off) must be fully green again — that contrast is the proof.

## Expected result of the detection run

| Test | Clean build | `SEED_DEFECTS=1` |
|------|-------------|------------------|
| SHOP-BUG-101 stock guard test | PASS | **FAIL** (cart accepted 4 units with stock 3) |
| SHOP-BUG-102 stock restore test | PASS | **FAIL** (stock stayed 8 instead of 10) |
| SHOP-BUG-103 minPrice boundary test | PASS | **FAIL** (product priced 50.00 missing) |

## Honest reporting rules used here

1. Every seeded defect is labelled `SEEDED` in `defect-log.csv` and uses IDs ≥ 101 so it can never be
   confused with a defect genuinely found during testing (001–099).
2. The detection run's failures are stored as evidence; they are never presented as defects of the
   delivered application.
3. The default configuration (`SEED_DEFECTS` unset or `0`) is always the correct, defensible build.

## Relationship to real findings

Defects **SHOP-BUG-001..003** in `defect-log.csv` *were* genuinely found while testing this project
(they are not seeded): an incomplete seed event history, and two incorrect 5xx responses for bad client
input. Those have fix, retest and regression evidence. Keeping both categories side by side, clearly
labelled, is deliberate.
