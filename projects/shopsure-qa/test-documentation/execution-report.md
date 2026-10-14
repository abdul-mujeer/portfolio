# ShopSure — Test Execution Report (pointer)

The authoritative execution reports are generated from real run outputs:

- **Latest report:** [`../test-reports/execution-report-latest.md`](../test-reports/execution-report-latest.md)
- **Machine-readable summary:** [`../test-reports/summary.json`](../test-reports/summary.json)
- **Dated reports:** `../test-reports/execution-report-<YYYY-MM-DD>.md`

## How to regenerate

```powershell
npm run test:all      # runs every suite, then rebuilds the report
npm run docs:report   # rebuild the report from the latest raw results only
```

## What the generated report contains

1. Environment and commit under test.
2. Per-suite counts (Playwright API, Playwright UI, SQL database checks, Postman/Newman) with durations.
3. Manual test-case status summary read from `test-cases.csv`.
4. Requirement coverage read from `traceability-matrix.csv`.
5. Defect summary read from `defect-log.csv` (including seeded-defect counts).
6. Evidence-based risk assessment.
7. Release-readiness recommendation.
8. Known limitations.

The report builder (`scripts/reports/build-report.mjs`) never estimates: if a suite did not run, its row
shows `no` instead of numbers, and the recommendation changes accordingly.
