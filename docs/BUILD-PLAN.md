# QA Portfolio Build Plan — Executive Summary and Progress Checklist

> Status: **in progress** · Started: 2026-10-14 · Owner: Qazi Abdul Mujeer (work executed with AI coding agents)
> This file is the living plan + progress tracker for the QA portfolio build. It survives context loss,
> so always read it first when resuming work.

---

## 1. Executive summary

Turn the existing personal portfolio (`abdul-mujeer/portfolio`, React + Vite + GSAP) into a
professional **entry-level QA / SQA engineer** portfolio that showcases three complete,
runnable software-testing projects:

| # | Project | Focus | Location |
|---|---------|-------|----------|
| 1 | **ShopSure** — E-commerce QA & Test Automation | Functional, negative, boundary, API, UI, DB testing | `projects/shopsure-qa/` |
| 2 | **PeopleCore** — HRMS Workflow & RBAC Testing | Multi-module workflows, permissions, audit, SQL | `projects/peoplecore-qa/` |
| 3 | **TaskFlow** — REST API Quality Engineering | API deep-dive, security, pagination, performance baseline | `projects/taskflow-qa/` |

Each project owns its real application, real automated tests, real executed evidence, and a full
QA documentation package (requirements, strategy, plan, test cases, defect log, traceability,
execution report). All data is synthetic. No test result is ever fabricated.

---

## 2. Environment facts (Phase 0 findings)

| Item | Result |
|------|--------|
| OS | Windows 11, PowerShell |
| Git | 2.55.0 (credential manager configured, push verified at publish time) |
| Node.js / npm | v24.21.0 / 11.19.0 |
| Python | 3.12.10 (available, not required by chosen stack) |
| GitHub CLI (`gh`) | **Not installed** → cannot create separate repos; monorepo decision below |
| Deploy CLIs (vercel/netlify/…) | **None installed / not authenticated** → deployment documented, not executed (user-approved) |
| Java (JMeter) | Not installed → performance baseline uses `autocannon` (local, conservative) |
| Docker | Installed (not required by the chosen stack) |
| `node:sqlite` (built-in SQLite) | **Working** → zero native dependencies for all three apps |
| Playwright browsers | Chromium already cached locally (`chromium-1243`) |
| npm registry | Reachable (`registry.npmjs.org`, PONG ~420 ms) |

### Repository facts (before any change)

- Remote: `https://github.com/abdul-mujeer/portfolio` (origin) — **never changed**.
- Branch: `main`, working tree clean at `1f9605a` ("Update portfolio").
- Stack: React 18 + TypeScript + Vite 5, GSAP (ScrollSmoother/SplitText/ScrollTrigger), three.js /
  `@react-three/fiber` 3D character + physics tech-stack spheres, `react-icons`, custom cursor.
- Sections in `src/components`: `Landing`, `About`, `WhatIDo`, `Career`, `Work` (6 existing
  projects, horizontal scroll), `TechStack` (3D), `Contact`; `Navbar`, `SocialIcons`, `Cursor`.
- Deployment: none configured in-repo (Vercel analytics package present only).
- Existing content (must be preserved and kept truthful): CS graduate; QA/SQA + manual testing
  focus statement in `About.tsx`; experience: CYPHION 2024–2025, Freelance 2025–2026; contact
  links; 6 existing projects with images.

### Baseline failures found (recorded before our changes)

| ID | Finding | Resolution |
|----|---------|------------|
| BASE-001 | `npm install` failed: `package-lock.json` resolved `@gsap/react` from the private trial registry `npm.greensock.com` (network timeout). The repo is not installable as-is for third parties. | Fixed: repointed lockfile entry to the public registry (`registry.npmjs.org`). GSAP ≥3.13 ships all plugins free, so no Club registry is needed. Documented in README. |
| BASE-002 | `gsap` was locked to 3.12.7 while `package.json` requests `^3.15.0`; the code imports `gsap/ScrollSmoother` + `gsap/SplitText`, which only ship in the free npm package from 3.13+. | Fixed by lockfile refresh on install; verified imports resolve. |
| BASE-003 | `RESUME` button pointed to `href="#"` (dead link). | Fixed: real `resume.html` generated from information already published in the repo (user approved). |

---

## 3. Architecture decisions

1. **Monorepo.** Because `gh` is not installed/authenticated, the three projects live under
   `projects/` inside the portfolio repo (the fallback the user specified). The README documents how
   to split them into separate repositories later. No nested Git repositories are created.
2. **No build-graph interference.** `tsconfig.app.json` includes only `src`; root `eslint.config.js`
   will be updated to ignore `projects/**`; each project has its own `package.json`,
   `node_modules`, lint config, and `.gitignore` rules merged into the root `.gitignore`.
3. **Stack per project (distinct on purpose):**
   - ShopSure: **React + Vite (TS)** SPA + **Express** REST API + **SQLite** (`node:sqlite`).
   - PeopleCore: **Express + EJS server-rendered** multi-page app + SQLite. Different architecture,
     same test tooling.
   - TaskFlow: **API-first Express** JSON service + minimal vanilla-JS console + SQLite.
4. **Zero native dependencies:** all databases use Node's built-in `node:sqlite` → reproducible on
   Windows and CI without compilers.
5. **One test runner for UI + API:** `@playwright/test` (APIRequestContext for API suites).
6. **Postman collections** executed in CI/local via `newman`, driven by a cross-platform Node
   wrapper (no shell-specific process management).
7. **Real evidence only:** every suite produces machine-readable output → `test-reports/summary.json`
   + a generated Markdown execution report containing **actual** counts. Screenshots are captured
   from the running apps by Playwright.
8. **Seeded defects** (clearly labelled) live behind `SEED_DEFECTS=1` so the default run is clean and
   the detection exercise is reproducible and honest.
9. **Security baseline:** parameterized SQL, scrypt password hashing, DB-backed sessions,
   server-side authorization, zod input validation, no secrets in git, `APP_SECRET` from env with a
   documented dev-only default.

---

## 4. Shared conventions

- Ports: ShopSure **4100**, PeopleCore **4200**, TaskFlow **4300** (each app owns its port space;
  tests use a separate `DB_PATH` so demos are never polluted).
- IDs: `SHOP-REQ/TEST/BUG-nnn`, `HR-…`, `TASK-…`. IDs are generated from a single source of truth
  per project (`test-data/*.mjs`) so CSVs, traceability and reports can never drift.
- Test-case CSV columns: `TestCaseID, RequirementID, Module, Scenario, Preconditions, TestData,
  Steps, ExpectedResult, ActualResult, Status, Priority, TestType, Environment, DefectID,
  EvidenceLink, Notes`.
- Reports: `test-reports/execution-report-<date>.md`, `summary.json`; evidence in `test-evidence/`.
- Every README answers the 18 required questions and links only to things that exist.

---

## 5. Milestones & progress checklist

- [x] **M1 — Inspect repository and prepare implementation plan** *(2026-10-14)*
  - Environment probes, repo clone, source review, baseline build findings, this plan.
- [ ] **M2 — Portfolio: QA-focused sections, project cards, detail pages, SEO/a11y polish** *(in progress)*
  - Added: QA skills, featured QA projects, testing approach, education and footer sections; navbar/footer navigation;
    SEO metadata + favicon; printable résumé page; case-study page generator; real site verification script.
- [ ] **M3 — ShopSure: application + full QA deliverables + executed evidence** *(application, suites, docs and
  evidence complete: 202 automated checks passing, 101 manual cases, 3 defects fixed, 3 seeded defects verified)*
- [ ] **M4 — PeopleCore: application + full QA deliverables + executed evidence** *(delegated, in progress)*
- [ ] **M5 — TaskFlow: application + full QA deliverables + executed evidence** *(delegated, in progress)*
- [ ] **M6 — CI: GitHub Actions workflows per project (lint, tests, artifacts)**
- [ ] **M7 — Screenshots, thumbnails, architecture diagrams, evidence galleries**
- [ ] **M8 — Final functional, accessibility, regression and security checks**
- [ ] **M9 — GitHub polish: READMEs, topics, commit hygiene, push and verify**
- [ ] **M10 — Handover pack: interview prep, run commands, verified URLs/commits**

### Definition of done (tracked)

- [ ] Existing functionality preserved (GSAP animations, 3D character, existing projects/links).
- [ ] Portfolio responsive + accessible, no dead links, no fabricated metrics.
- [ ] Three apps runnable with one documented command each.
- [ ] 40–70 meaningful manual test cases per project, IDs consistent across CSV/traceability/defects.
- [ ] Postman collection + environment template per project; Newman CLI run documented.
- [ ] Playwright UI + API suites executed with real outputs saved.
- [ ] SQL validation scripts executed with results.
- [ ] Execution report per project with actual counts, defects, risk and release recommendation.
- [ ] Screenshots per project captured from the running applications.
- [ ] GitHub Actions workflows committed; status reported honestly (never claim unverified runs).
- [ ] No secrets/credentials/large binaries committed; `.gitignore` verified with `git status`.
- [ ] Commits pushed to `origin/main` (or documented as pending if auth fails) and verified.

---

## 6. Reporting rules (non-negotiable)

- Never state that a test passed unless it was executed and its output captured.
- Never estimate or invent coverage percentages, defect counts, timings or screenshots.
- Distinguish: implemented / executed-passed / executed-failed / not executed / blocked / N/A.
- Seeded defects are labelled **SEEDED** everywhere they appear.
- Remaining failures are disclosed in the final handover, not hidden.
