# QA / SQA Portfolio — Qazi Abdul Mujeer

[![Verify portfolio site](https://github.com/abdul-mujeer/portfolio/actions/workflows/portfolio-site.yml/badge.svg)](https://github.com/abdul-mujeer/portfolio/actions/workflows/portfolio-site.yml)
[![ShopSure QA](https://github.com/abdul-mujeer/portfolio/actions/workflows/shopsure-qa.yml/badge.svg)](https://github.com/abdul-mujeer/portfolio/actions/workflows/shopsure-qa.yml)
[![PeopleCore QA](https://github.com/abdul-mujeer/portfolio/actions/workflows/peoplecore-qa.yml/badge.svg)](https://github.com/abdul-mujeer/portfolio/actions/workflows/peoplecore-qa.yml)
[![TaskFlow QA](https://github.com/abdul-mujeer/portfolio/actions/workflows/taskflow-qa.yml/badge.svg)](https://github.com/abdul-mujeer/portfolio/actions/workflows/taskflow-qa.yml)

This repository contains my personal portfolio plus **three complete, runnable software-testing
projects**. Each project ships a real demo application, a full QA lifecycle documentation package,
automated test suites, executed evidence and a release report.

I am an entry-level QA / SQA candidate: Computer Science graduate, self-taught in software testing, and
the work below is **portfolio practice built on demo applications I wrote myself** — it is not commercial
QA employment experience, and no number in it is estimated.

| Project | Testing focus | Executed results (verified) | Source |
|---------|---------------|------------------|--------|
| **ShopSure** — e-commerce QA | Manual, boundary/decision-table, API, UI automation, SQL validation | 101 manual cases (99 executed) · **202 automated checks passing** (72 API · 31 UI · 23 SQL · 76 Postman assertions) · 3 defects found & fixed · 3 seeded | [`projects/shopsure-qa`](projects/shopsure-qa) |
| **PeopleCore** — HRMS workflow & RBAC | Multi-role workflows, permission matrix, date/salary boundaries, audit trails | 69 manual cases (65 executed) · **189 automated checks passing** (58 API · 20 UI · 12 SQL · 96 Postman assertions · 3 perf targets) · 12 defects found & fixed · 2 seeded | [`projects/peoplecore-qa`](projects/peoplecore-qa) |
| **TaskFlow** — API quality engineering | CRUD/schema validation, object-level authorization, isolation, performance baseline | 67 manual cases (all executed) · **134 automated checks passing** (48 API · 10 UI · 22 SQL · 50 Postman assertions · 4 manual probes) · 6 defects found & fixed · 2 seeded | [`projects/taskflow-qa`](projects/taskflow-qa) |

**Totals: 525 automated checks passing, 0 failing · 237 manual test cases · 21 defects found and fixed · 7 deliberately seeded defects with proven detection.**
Every figure is read from the projects' own generated `test-reports/summary.json` — see
[`docs/HANDOVER.md`](docs/HANDOVER.md) for the generated handover and `npm run docs:handover` to refresh it.

Portfolio case studies (generated from each project's own executed artefacts):
`/projects/shopsure-qa/` · `/projects/peoplecore-qa/` · `/projects/taskflow-qa/`

---

## Repository layout

```
.
├── src/                      # portfolio site (React 18 + TypeScript + Vite + GSAP + three.js)
├── public/
│   ├── projects/<slug>/      # generated QA case-study pages
│   ├── images/qa-projects/   # real application screenshots used as thumbnails
│   └── resume.html           # printable résumé (generated from portfolio content)
├── scripts/
│   ├── build-project-pages.mjs   # case-study pages + metrics from real test-reports/summary.json
│   └── verify-site.mjs           # Playwright verification of the built site
├── projects/
│   ├── shopsure-qa/          # app + tests + QA documentation + evidence + reports
│   ├── peoplecore-qa/
│   └── taskflow-qa/
├── docs/
│   ├── BUILD-PLAN.md         # how this portfolio was built, milestone by milestone
│   └── PROJECT-STANDARD.md   # the shared engineering/QA contract for the three projects
└── .github/workflows/        # CI: site verification + one workflow per QA project
```

## Quick start (portfolio site)

```powershell
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + production build
npm run verify:site    # Playwright verification of the built site (needs `npm run build` first)
npm run build:projects # regenerate case-study pages + card metrics from each project's summary.json
```

## Running the QA projects

Each project is a self-contained Node package (no compilers, no Docker, no external database — SQLite
comes from Node's built-in `node:sqlite`):

```powershell
cd projects/shopsure-qa
npm install
npm run build          # ShopSure only (React SPA)
npm run db:reset       # deterministic synthetic seed data
npm start              # http://127.0.0.1:4100
npm run test:all       # every suite + generated execution report
```

The same shape applies to `projects/peoplecore-qa` (port 4200) and `projects/taskflow-qa` (port 4300);
see each project README for its exact commands, demo credentials and verified results.

## What each QA project contains

Every project follows the shared contract in [`docs/PROJECT-STANDARD.md`](docs/PROJECT-STANDARD.md):

- **Requirements & acceptance criteria** with stable IDs and a traceability matrix.
- **40–110 manual test cases** in Excel-safe CSV with steps, test data, expected/actual results, status,
  priority, type, defect link and evidence link.
- **Automated suites**: Playwright API + UI tests, SQL database validation checks, Postman collections
  executed with Newman, plus a seeded-defect detection exercise.
- **Defect management**: reproducible bug reports with severity, priority, root cause, retest and
  regression results.
- **Executed evidence**: raw logs, machine-generated `summary.json`, screenshots of the running
  applications, and an execution report with actual counts and a release recommendation.
- **Honesty rules**: results that were not executed are labelled `Not Executed` with the exact command to
  reproduce them; deliberately seeded defects are always labelled `SEEDED`.

## Tech stack across the projects

Node.js 24 · Express 4 · `node:sqlite` (SQLite) · Zod · React 18 + Vite 5 (ShopSure SPA) · EJS
(PeopleCore views) · Playwright (UI + API) · Postman + Newman · autocannon (local performance baseline) ·
GitHub Actions.

## Verification and CI

| Workflow | What it does |
|----------|--------------|
| `portfolio-site.yml` | Install, lint, type-check, build the site, run `verify:site`, upload the verification evidence |
| `shopsure-qa.yml` | Install, lint, build the SPA, run API + UI + SQL + Postman suites, prove seeded-defect detection, upload reports |
| `peoplecore-qa.yml` | Install, lint, run API + UI + SQL + Postman + performance suites, upload reports |
| `taskflow-qa.yml` | Install, lint, run API + UI + SQL + Postman suites, run the performance baseline, upload reports |

Local verification status at handover time: portfolio site **24/24 checks passed**
(`npm run verify:site`), and the three projects totalled **525 passed / 0 failed**. Workflow badges above
report the real status of the latest GitHub run; they only show green once that run has happened.

Helper scripts:

```powershell
npm run build:projects   # regenerate case-study pages + card metrics from each project's summary.json
npm run docs:handover    # regenerate docs/HANDOVER.md from real artefacts
```

## Deployment

**Live site: <https://portfolio-abdul-mujeer.vercel.app/>** (Vercel, deployed from this repository —
a push to `main` triggers a production deployment automatically).

Verified after the last push: the home page, all three case-study pages (`/projects/<slug>/`), the
résumé page (`/resume.html`), the favicon and the project thumbnails all return HTTP 200.

To deploy a fresh copy elsewhere:

```powershell
npm run build
npx vercel deploy --prod dist          # or: npx netlify deploy --prod --dir dist
```

## License, attribution and usage

This repository is my personal portfolio, built on top of the open-source portfolio template by
**Moncy Yohannan** ([original repository](https://github.com/moncyy/portfolio)). Credit and thanks to the
original author; parts of the application shell and animation approach come from that template.

Per the template's [Personal Portfolio License (PPL) v1.0](LICENSE):

- Do not clone or replicate this website or its design as your own.
- Do not repost it with minor content changes or use it for commercial/client work.
- If you reuse parts of the code, provide proper credit linking back to the original repository.

The 3D avatar used on the original live site is **not** included here (only a placeholder model), and it
is not open source. GSAP plugins used by this project (`ScrollSmoother`, `SplitText`) are part of the free
public GSAP 3.13+ package — no Club/trial plugins are required.

The QA projects under `projects/` are my own work and are shared for review and learning. All data in
them is synthetic: no real customer, employee or payment data is used anywhere.
