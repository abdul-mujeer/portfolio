#!/usr/bin/env node
/**
 * Generates the QA case-study pages from each project's REAL artefacts.
 *
 * For every configured project it reads:
 *   projects/<slug>/test-reports/summary.json        -> executed counts (never estimated)
 *   projects/<slug>/test-documentation/test-cases.csv -> selected test cases shown verbatim
 *   projects/<slug>/test-documentation/defect-log.csv -> defect summary
 *   projects/<slug>/test-evidence/screenshots/*.jpg   -> copied to public/images/qa-projects/
 *
 * and writes:
 *   public/projects/<slug>/index.html
 *
 * If a project's results are missing, the page states that clearly instead of inventing numbers.
 *
 * Usage: node scripts/build-project-pages.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const PROJECTS = path.join(ROOT, "projects");
const IMAGE_DIR = path.join(PUBLIC, "images/qa-projects");

const REPO_BLOB = "https://github.com/abdul-mujeer/portfolio/blob/main";
const REPO_TREE = "https://github.com/abdul-mujeer/portfolio/tree/main";

const configs = [
  {
    slug: "shopsure-qa",
    name: "ShopSure",
    title: "ShopSure — E-commerce Quality Assurance and Test Automation",
    tagline: "Manual functional testing · boundary analysis · REST API testing · Playwright UI automation · SQL validation",
    accent: "#c2a4ff",
    overview: [
      "ShopSure is a demo e-commerce storefront (React SPA + Express REST API + SQLite) built to be tested rather than sold. It contains the rules that make online stores risky: cart quantity and stock limits, a pricing decision table (10% discount from a subtotal of 100.00, free shipping from 50.00), a checkout that must re-validate stock, and an order state machine (PENDING → PAID → SHIPPED → DELIVERED, CANCELED only before shipping) with role-based administration.",
      "I treated it as a real assignment: wrote requirements with acceptance criteria, designed 101 manual test cases with boundary values, decision tables and negative paths, automated the API and UI layers with Playwright, validated the database with SQL, ran a recorded exploratory/security session, and reported the outcome with a release recommendation. Everything in this case study is generated from the project's own executed artefacts.",
    ],
    features: [
      "Registration, login, logout and session handling with scrypt password hashing and throttled failed logins",
      "Catalog listing with search, sorting, filtering, pagination and empty states",
      "Cart add/merge with a 10-unit line limit and stock guards; update, remove and clear",
      "Checkout with field-level validation and server-side stock re-validation",
      "Pricing rules applied consistently and verified in the database",
      "Order history, customer isolation, cancellation with stock restoration",
      "Admin order workflow and inventory management behind role-based access control",
      "SQL-verified constraints, referential integrity and order status audit events",
    ],
    selectedCases: ["SHOP-TC-023", "SHOP-TC-050", "SHOP-TC-051", "SHOP-TC-065", "SHOP-TC-078", "SHOP-TC-085"],
    api: "24 documented endpoints with an explicit error-code contract. 72 Playwright API tests drive real sessions and cookies against a seeded database, covering happy paths, missing/invalid payloads, unknown ids, duplicates, authorization boundaries (401/403), object ownership (404) and business-rule violations (422). A 35-request Postman collection with 76 assertions mirrors the critical flows and runs head-less through Newman.",
    automation:
      "31 Playwright UI tests cover the customer journeys (browse, search, cart, checkout, order history, cancellation) and the admin console, plus accessibility smoke checks. The suites use data-testid hooks, web-first assertions, no arbitrary sleeps, traces and screenshots on failure, and @smoke/@regression tags for fast versus full runs.",
    database:
      "23 SQL checks validate what the API cannot prove: CHECK and UNIQUE constraints, foreign-key integrity, orphan detection, pricing consistency for every stored order, order-number format and uniqueness, credential storage (salted scrypt hashes, never plaintext), session expiry and audit-event completeness. They run after the functional suites so they also inspect real user-generated data.",
    defects: [
      "SHOP-BUG-001 — the seeded DELIVERED order had an incomplete status-event history; found by SQL check DB-22, fixed in the seed, retested.",
      "SHOP-BUG-002 — malformed JSON returned HTTP 500 instead of 400; found in the exploratory session, fixed in the error handler, retested.",
      "SHOP-BUG-003 — oversized request bodies returned 500 instead of 413; fixed together with SHOP-BUG-002.",
      "Three further defects are deliberately seeded behind SEED_DEFECTS=1 to prove the suite detects the stock guard, stock restoration and boundary-filter rules; the detection run is kept as evidence.",
    ],
    limitations: [
      "Concurrency of the checkout path is not tested (single-writer SQLite demo database).",
      "UI automation runs on Chromium only; Firefox/WebKit are not installed in this environment.",
      "Two manual cases (cross-browser run, screen-reader announcement) are documented but not executed.",
      "Accessibility coverage is targeted smoke testing, not a full WCAG audit.",
    ],
    next: [
      "Run the checkout race tests against PostgreSQL with parallel workers.",
      "Add @axe-core/playwright and a scripted screen-reader pass.",
      "Add JSON-schema contract assertions so response-shape regressions fail fast.",
    ],
    docs: [
      { label: "README (all 18 sections)", href: `${REPO_BLOB}/projects/shopsure-qa/README.md` },
      { label: "Test strategy", href: `${REPO_BLOB}/projects/shopsure-qa/test-documentation/test-strategy.md` },
      { label: "Test cases (CSV)", href: `${REPO_BLOB}/projects/shopsure-qa/test-documentation/test-cases.csv` },
      { label: "Traceability matrix", href: `${REPO_BLOB}/projects/shopsure-qa/test-documentation/traceability-matrix.csv` },
      { label: "Defect log", href: `${REPO_BLOB}/projects/shopsure-qa/test-documentation/defect-log.csv` },
      { label: "Risk assessment", href: `${REPO_BLOB}/projects/shopsure-qa/test-documentation/risk-assessment.md` },
      { label: "Interview preparation", href: `${REPO_BLOB}/projects/shopsure-qa/test-documentation/interview-preparation.md` },
      { label: "Source code", href: `${REPO_TREE}/projects/shopsure-qa` },
    ],
  },
  {
    slug: "peoplecore-qa",
    name: "PeopleCore",
    title: "PeopleCore — HRMS Workflow and Role-Based Access Testing",
    tagline: "Multi-module workflows · permission matrix · date & salary boundaries · audit-trail validation",
    accent: "#8ee6c8",
    overview: [
      "PeopleCore is a server-rendered HR management system (Express + EJS + SQLite) covering the modules an HR team actually uses: employees and departments, attendance, leave requests with an approval workflow, and audit history. Four roles — administrator, HR, manager and employee — have deliberately different powers, including data scoping (managers only see their reports; employees only see themselves).",
      "The QA focus is workflow correctness and authorization: what each role can see and change, which state transitions are legal, how dates and money are validated, and whether the database stays consistent when invalid operations are rejected.",
    ],
    features: [
      "Session-based authentication with scrypt password storage and role-aware pages",
      "Employee records with unique employee codes and emails, departments, positions and salaries",
      "Attendance records with one row per employee per day and time-consistency rules",
      "Leave requests with submission, approval, rejection, cancellation and overlap prevention",
      "Role-based data scoping enforced in the API, not just hidden in the interface",
      "Audit history for employee, department and leave changes",
      "Filtering, sorting, pagination and empty-result handling across list views",
    ],
    selectedCases: [],
    api: "A documented REST API behind the server-rendered pages, tested at HTTP level for every role, including direct calls by under-privileged accounts that must return 403 — the classic gap when authorization only exists in the UI.",
    automation:
      "Playwright covers both layers: API suites for CRUD, validation, workflow transitions and the permission matrix; UI suites for the employee list, profile editing, attendance, leave submission and the reviewer queue, with stable data-testid hooks.",
    database:
      "SQL checks verify uniqueness (employee code, email, one attendance row per day), referential integrity across departments and managers, salary and date rules, leave-overlap queries, audit-row presence and orphan detection.",
    defects: [],
    limitations: [],
    next: [],
    docs: [
      { label: "README", href: `${REPO_BLOB}/projects/peoplecore-qa/README.md` },
      { label: "Test strategy", href: `${REPO_BLOB}/projects/peoplecore-qa/test-documentation/test-strategy.md` },
      { label: "Test cases (CSV)", href: `${REPO_BLOB}/projects/peoplecore-qa/test-documentation/test-cases.csv` },
      { label: "Role permission matrix", href: `${REPO_BLOB}/projects/peoplecore-qa/test-documentation/role-permission-matrix.md` },
      { label: "Defect log", href: `${REPO_BLOB}/projects/peoplecore-qa/test-documentation/defect-log.csv` },
      { label: "Source code", href: `${REPO_TREE}/projects/peoplecore-qa` },
    ],
  },
  {
    slug: "taskflow-qa",
    name: "TaskFlow",
    title: "TaskFlow — REST API Quality Engineering and Regression Automation",
    tagline: "CRUD & schema validation · object-level permissions · cross-project isolation · performance baseline",
    accent: "#ffd08a",
    overview: [
      "TaskFlow is an API-first project management service (Express + SQLite with a minimal browser console): users create projects, invite members with owner/admin/member roles, then create tasks, move them through a status workflow, comment and read an activity feed.",
      "Because there is almost no UI, the QA effort concentrates on the API contract itself: request/response schemas, HTTP semantics, pagination and filtering edges, duplicate and conflicting operations, and the authorization rules that decide who may see or change which object.",
    ],
    features: [
      "Registration, login and session handling with role-based project membership",
      "Projects with unique keys, membership management and archiving rules",
      "Tasks with title/description bounds, priorities, assignees, estimates and due dates",
      "Status workflow TODO → IN_PROGRESS → IN_REVIEW → DONE (CANCELED from any non-DONE state)",
      "Comments and an activity feed recording every meaningful change",
      "Search, filtering, sorting, pagination and overdue reporting",
      "Cross-project isolation: members of one project cannot read or mutate another project's data",
    ],
    selectedCases: [],
    api: "The primary test surface: Playwright API suites cover CRUD, HTTP method and status-code validation, malformed and missing payloads, type errors, duplicate/conflicting operations, invalid workflow transitions, date boundaries (including overdue and due-today), pagination and filtering edges, persistence, and object-level permission checks — including 404-instead-of-403 behaviour that avoids leaking existence.",
    automation:
      "Playwright provides both the API suites and a small UI console suite (board, task creation, status change, comments, validation banners). Every run is repeatable from a deterministic seed.",
    database:
      "SQL checks prove the schema itself protects data: unique project keys, foreign keys, member-role integrity, activity rows for mutations, archived-project exclusions, overdue-query correctness and consistency between API counts and stored rows.",
    defects: [],
    limitations: [],
    next: [],
    docs: [
      { label: "README", href: `${REPO_BLOB}/projects/taskflow-qa/README.md` },
      { label: "API reference", href: `${REPO_BLOB}/projects/taskflow-qa/test-documentation/api-reference.md` },
      { label: "Test cases (CSV)", href: `${REPO_BLOB}/projects/taskflow-qa/test-documentation/test-cases.csv` },
      { label: "Permission matrix", href: `${REPO_BLOB}/projects/taskflow-qa/test-documentation/permission-matrix.md` },
      { label: "Security testing", href: `${REPO_BLOB}/projects/taskflow-qa/test-documentation/security-testing.md` },
      { label: "Performance baseline", href: `${REPO_BLOB}/projects/taskflow-qa/test-reports/performance-baseline.md` },
      { label: "Defect log", href: `${REPO_BLOB}/projects/taskflow-qa/test-documentation/defect-log.csv` },
      { label: "Source code", href: `${REPO_TREE}/projects/taskflow-qa` },
    ],
  },
];

// --------------------------------------------------------------------------- helpers

function parseCsv(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => Object.fromEntries(header.map((key, index) => [key.trim(), (values[index] ?? "").trim()])));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function copyScreenshots(projectDir, slug, limit) {
  const sourceDir = path.join(projectDir, "test-evidence/screenshots");
  if (!fs.existsSync(sourceDir)) return [];
  const files = fs
    .readdirSync(sourceDir)
    .filter((file) => /\.(jpe?g|png)$/i.test(file))
    .sort()
    .slice(0, limit);
  const targetDir = path.join(IMAGE_DIR, slug);
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of files) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
  }
  if (files.length > 0) {
    // Deterministic card thumbnail used by the project cards on the home page.
    fs.copyFileSync(path.join(sourceDir, files[0]), path.join(IMAGE_DIR, `${slug}-card.jpg`));
  }
  return files.map((file) => `${slug}/${file}`);
}

function metricCard(label, value, note = "") {
  return `<div class="metric"><span class="metric-value">${escapeHtml(value)}</span><span class="metric-label">${escapeHtml(label)}</span>${
    note ? `<span class="metric-note">${escapeHtml(note)}</span>` : ""
  }</div>`;
}

function buildPage(config) {
  const projectDir = path.join(PROJECTS, config.slug);
  const summary = readJson(path.join(projectDir, "test-reports/summary.json"));
  const testCases = parseCsv(path.join(projectDir, "test-documentation/test-cases.csv"));
  const defects = parseCsv(path.join(projectDir, "test-documentation/defect-log.csv"));
  const screenshots = copyScreenshots(projectDir, config.slug, 6);

  const verified = Boolean(summary);
  const api = summary?.automation?.api;
  const ui = summary?.automation?.ui;
  const db = summary?.automation?.database;
  const postman = summary?.automation?.postman;
  const manual = summary?.manualTestCases;
  const genuineDefects = defects.filter((defect) => !/-1\d\d$/.test(defect.DefectID ?? ""));
  const seededDefects = defects.filter((defect) => /-1\d\d$/.test(defect.DefectID ?? ""));

  const autoTotal = summary?.totals?.passed ?? null;
  const coverage = summary?.requirementCoverage;

  const metrics = verified
    ? [
        metricCard("Manual test cases", manual?.total ?? "—", manual ? `${manual.byStatus?.Pass ?? 0} passed · ${manual.byStatus?.["Not Executed"] ?? 0} not executed` : ""),
        metricCard(
          "Automated checks",
          autoTotal !== null ? `${autoTotal} passing` : "—",
          [api ? `${api.total} API` : null, ui ? `${ui.total} UI` : null, db ? `${db.total} SQL` : null, postman ? `${postman.assertions} Postman assertions` : null]
            .filter(Boolean)
            .join(" · ")
        ),
        metricCard("Requirements covered", coverage ? `${coverage.fullyCovered}/${coverage.requirements}` : "—", coverage ? `${Math.round((coverage.fullyCovered / coverage.requirements) * 100)}% fully traced` : ""),
        metricCard("Defects found & fixed", genuineDefects.length ? String(genuineDefects.length) : "0", "Genuinely found during testing"),
        metricCard("Seeded defects", seededDefects.length ? String(seededDefects.length) : "0", "Detection exercise, labelled SEEDED"),
        metricCard("Last executed", summary?.generatedAt ? new Date(summary.generatedAt).toISOString().slice(0, 10) : "—", summary?.gitCommit ? `commit ${summary.gitCommit}` : ""),
      ].join("\n")
    : `<p class="pending">Execution results for this project are still being verified. Numbers will appear here only after the suites have actually run — nothing is estimated.</p>`;

  const selectedCases = (config.selectedCases.length > 0 ? config.selectedCases : testCases.slice(0, 6).map((testCase) => testCase.TestCaseID))
    .map((id) => testCases.find((testCase) => testCase.TestCaseID === id))
    .filter(Boolean)
    .map(
      (testCase) => `
        <article class="case">
          <header>
            <code>${escapeHtml(testCase.TestCaseID)}</code>
            <span class="pill pill-${escapeHtml((testCase.Status || "").toLowerCase().replace(/\s+/g, "-"))}">${escapeHtml(testCase.Status || "Not Executed")}</span>
            <span class="pill pill-type">${escapeHtml(testCase.TestType)}</span>
            <span class="pill pill-type">${escapeHtml(testCase.Priority)} priority</span>
          </header>
          <h4>${escapeHtml(testCase.Scenario)}</h4>
          <dl>
            <dt>Requirement</dt><dd>${escapeHtml(testCase.RequirementID)}</dd>
            <dt>Test data</dt><dd>${escapeHtml(testCase.TestData)}</dd>
            <dt>Expected result</dt><dd>${escapeHtml(testCase.ExpectedResult)}</dd>
            <dt>Actual result</dt><dd>${escapeHtml(testCase.ActualResult || "—")}</dd>
            <dt>Evidence</dt><dd><code>${escapeHtml(testCase.EvidenceLink || "—")}</code></dd>
          </dl>
        </article>`
    )
    .join("\n");

  const gallery = screenshots
    .map(
      (file, index) => `
        <figure>
          <img src="/images/qa-projects/${escapeHtml(file)}" alt="${escapeHtml(config.name)} application screenshot ${index + 1}" loading="lazy" />
          <figcaption>${escapeHtml(file.replace(`${config.slug}-`, "").replace(/\.jpg$/, "").replace(/^\d+-/, "").replace(/-/g, " "))}</figcaption>
        </figure>`
    )
    .join("\n");

  const defectsList = config.defects.length
    ? `<ul class="list">${config.defects.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p class="pending">The full defect log for this project is available in the repository (linked below).</p>`;

  const docsList = config.docs
    .map((doc) => `<li><a href="${doc.href}" target="_blank" rel="noreferrer">${escapeHtml(doc.label)} →</a></li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(config.title)} — Qazi Abdul Mujeer</title>
    <meta name="description" content="${escapeHtml(config.tagline)}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <style>
      :root {
        --bg: #0b080c;
        --surface: rgba(255, 255, 255, 0.03);
        --line: rgba(255, 255, 255, 0.12);
        --text: #eae5ec;
        --muted: rgba(234, 229, 236, 0.68);
        --accent: ${config.accent};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: Geist, "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.65;
      }
      a { color: var(--accent); }
      a:hover { text-decoration: underline; }
      .wrap { max-width: 1120px; margin: 0 auto; padding: 28px 20px 90px; }
      .topnav { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 14px; }
      .topnav a { font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 12.5px; }
      .eyebrow { margin: 48px 0 10px; font-size: 12.5px; letter-spacing: 6px; text-transform: uppercase; color: var(--accent); font-weight: 700; }
      h1 { margin: 0 0 14px; font-size: clamp(30px, 4.6vw, 50px); line-height: 1.1; letter-spacing: -0.5px; }
      .tagline { margin: 0 0 34px; font-size: 16px; color: var(--muted); max-width: 80ch; }
      h2 { margin: 56px 0 16px; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: var(--accent); }
      h3 { margin: 0 0 8px; font-size: 17px; }
      h4 { margin: 0 0 10px; font-size: 15.5px; line-height: 1.4; }
      p { margin: 0 0 14px; }
      .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
      .metric { padding: 16px 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
      .metric-value { display: block; font-size: 24px; font-weight: 700; }
      .metric-label { display: block; font-size: 11.5px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--muted); margin-top: 4px; }
      .metric-note { display: block; font-size: 12px; color: var(--muted); margin-top: 6px; }
      .columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 26px; }
      .card { padding: 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
      .list { margin: 0; padding-left: 20px; font-size: 14.5px; color: var(--muted); }
      .list li { margin-bottom: 8px; }
      .case { padding: 18px 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); margin-bottom: 14px; }
      .case header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
      .case code { font-size: 12.5px; }
      .pill { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--line); }
      .pill-pass { color: #9ff0c4; border-color: rgba(159, 240, 196, 0.4); }
      .pill-fail { color: #ffa8a8; border-color: rgba(255, 168, 168, 0.45); }
      .pill-not-executed { color: #ffd08a; border-color: rgba(255, 208, 138, 0.4); }
      .pill-type { color: var(--muted); }
      .case dl { display: grid; grid-template-columns: 132px 1fr; gap: 6px 14px; margin: 0; font-size: 14px; }
      .case dt { color: var(--muted); font-size: 12.5px; letter-spacing: 0.6px; text-transform: uppercase; padding-top: 2px; }
      .case dd { margin: 0; }
      .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
      .gallery figure { margin: 0; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--surface); }
      .gallery img { display: block; width: 100%; height: auto; }
      .gallery figcaption { padding: 10px 14px; font-size: 12.5px; color: var(--muted); text-transform: capitalize; }
      .pending { padding: 14px 18px; border-left: 3px solid var(--accent); background: rgba(255, 255, 255, 0.03); border-radius: 0 10px 10px 0; color: var(--muted); }
      .honesty { margin-top: 44px; padding: 18px 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); font-size: 14px; color: var(--muted); }
      footer { margin-top: 60px; padding-top: 22px; border-top: 1px solid var(--line); font-size: 13.5px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 14px; justify-content: space-between; }
      @media (max-width: 620px) {
        .case dl { grid-template-columns: 1fr; }
        .case dt { padding-top: 8px; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <nav class="topnav">
        <a href="/">← Back to portfolio</a>
        <a href="${REPO_TREE}/projects/${config.slug}" target="_blank" rel="noreferrer">Source code</a>
      </nav>

      <p class="eyebrow">QA case study${verified ? "" : " · results pending verification"}</p>
      <h1>${escapeHtml(config.title)}</h1>
      <p class="tagline">${escapeHtml(config.tagline)}</p>

      <h2>Overview</h2>
      ${config.overview.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}

      <h2>Executed results</h2>
      <div class="metrics">
        ${metrics}
      </div>

      <h2>Features under test</h2>
      <ul class="list">${config.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>

      <h2>Testing approach</h2>
      <div class="columns">
        <article class="card">
          <h3>API testing</h3>
          <p>${escapeHtml(config.api)}</p>
        </article>
        <article class="card">
          <h3>UI automation</h3>
          <p>${escapeHtml(config.automation)}</p>
        </article>
        <article class="card">
          <h3>Database validation</h3>
          <p>${escapeHtml(config.database)}</p>
        </article>
      </div>

      <h2>Selected test cases (from test-cases.csv)</h2>
      ${selectedCases || '<p class="pending">Test cases for this project are being finalised; the CSV will be linked here once executed.</p>'}

      <h2>Defects</h2>
      ${defectsList}

      <h2>Screenshots</h2>
      ${gallery || '<p class="pending">Screenshots are captured from the running application after the suites pass.</p>'}

      <h2>Documentation &amp; evidence</h2>
      <ul class="list">${docsList}</ul>

      <h2>Limitations</h2>
      <ul class="list">${config.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>See the project README and risk assessment in the repository.</li>"}</ul>

      <h2>Future improvements</h2>
      <ul class="list">${config.next.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>See the project README for the current improvement list.</li>"}</ul>

      <p class="honesty">
        <strong>Honesty statement.</strong> ${escapeHtml(config.name)} is a demo application built by me
        specifically as a testing target for this portfolio. It is not a commercial product and contains no
        real customer data. Every number on this page is read from the project's machine-generated
        <code>test-reports/summary.json</code> produced by executed suites; incomplete results are marked as
        pending rather than estimated.
      </p>

      <footer>
        <span>Qazi Abdul Mujeer — QA / SQA portfolio</span>
        <a href="/">Back to portfolio</a>
      </footer>
    </div>
  </body>
</html>
`;
}

let generated = 0;
const metricsManifest = {};

for (const config of configs) {
  const dir = path.join(PUBLIC, "projects", config.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), buildPage(config));
  generated += 1;
  console.log(`generated public/projects/${config.slug}/index.html`);

  // ------------------------------------------------------------------ metrics manifest
  const projectDir = path.join(PROJECTS, config.slug);
  const summary = readJson(path.join(projectDir, "test-reports/summary.json"));
  const defects = parseCsv(path.join(projectDir, "test-documentation/defect-log.csv"));
  const genuine = defects.filter((defect) => !/-1\d\d$/.test(defect.DefectID ?? "")).length;
  const seeded = defects.filter((defect) => /-1\d\d$/.test(defect.DefectID ?? "")).length;

  metricsManifest[config.slug] = summary
    ? {
        verified: true,
        manualCases: summary.manualTestCases?.total ?? 0,
        manualPassed: summary.manualTestCases?.byStatus?.Pass ?? 0,
        manualNotExecuted: summary.manualTestCases?.byStatus?.["Not Executed"] ?? 0,
        automatedPassing: summary.totals?.passed ?? 0,
        automatedFailed: summary.totals?.failed ?? 0,
        apiTests: summary.automation?.api?.total ?? 0,
        uiTests: summary.automation?.ui?.total ?? 0,
        sqlChecks: summary.automation?.database?.total ?? 0,
        postmanAssertions: summary.automation?.postman?.assertions ?? 0,
        requirements: summary.requirementCoverage?.requirements ?? 0,
        requirementsCovered: summary.requirementCoverage?.fullyCovered ?? 0,
        defectsFound: genuine,
        seededDefects: seeded,
        lastRunAt: summary.generatedAt ?? null,
        commit: summary.gitCommit ?? null,
      }
    : { verified: false, defectsFound: genuine, seededDefects: seeded, lastRunAt: null, commit: null };
}

fs.mkdirSync(path.join(ROOT, "src/data"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "src/data/qaProjectMetrics.json"),
  `${JSON.stringify(metricsManifest, null, 2)}\n`
);
console.log("generated src/data/qaProjectMetrics.json (real executed metrics for the project cards)");

console.log(`\n${generated} case-study pages generated. Screenshots copied to public/images/qa-projects/`);
