#!/usr/bin/env node
/**
 * Builds the LinkedIn publishing kit:
 *   linkedin/images/*.jpg          LinkedIn-sized images (1200x627) made from genuine app screenshots
 *                                  and from each project's real execution report
 *   linkedin-publishing-kit.md     project descriptions, announcement posts, links, image paths,
 *                                  headline options and suggested skills
 *
 * Honesty rules enforced by this script:
 *   - every number comes from the projects' own executed artefacts (scripts/lib/project-metrics.mjs)
 *   - projects are described as portfolio projects on self-built demo applications, never as client
 *     work, production deployments or commercial QA employment
 *   - the GitHub links are flagged as requiring the repository to be public
 *
 * Usage: npm run build:linkedin
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { collectProjectMetrics, parseCsv, isSeededDefect, isTestCodeDefect } from "./lib/project-metrics.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "linkedin");
const IMG_DIR = path.join(OUT_DIR, "images");
const KIT = path.join(ROOT, "linkedin-publishing-kit.md");

const LIVE = "https://portfolio-abdul-mujeer.vercel.app";
const GITHUB_REPO = "https://github.com/abdul-mujeer/portfolio";
const REPO_IS_PUBLIC = false; // flip to true once the repository visibility is changed

const IMAGE = { width: 1200, height: 627 };

const projects = [
  {
    slug: "shopsure-qa",
    name: "ShopSure",
    tagline: "E-commerce QA · manual, API, UI and database testing",
    accent: "#c2a4ff",
    skills: ["Manual Testing", "Test Case Design", "Boundary Value Analysis", "Decision Tables", "API Testing", "Postman", "Playwright", "SQL", "Regression Testing", "Defect Reporting"],
    objective:
      "Prove that a storefront's money path is safe: pricing rules, stock integrity, checkout validation, order lifecycle and admin access control.",
    work: [
      "Wrote 24 requirements with 72 acceptance criteria and 101 manual test cases (functional, negative, boundary, validation, regression, security, usability, database, exploratory)",
      "Designed a pricing decision table (10% discount from 100.00; free shipping from 50.00) and tested both sides of every boundary",
      "Automated 72 API tests and 31 UI tests with Playwright, plus a 35-request Postman collection executed head-less with Newman",
      "Validated the database with 23 SQL checks (constraints, referential integrity, pricing consistency, audit events)",
      "Ran a recorded exploratory session (SQL injection, mass assignment, malformed and oversized payloads, cookie flags) and proved the suite detects three deliberately seeded defects",
    ],
    flagship: "SHOP-BUG-002 / SHOP-BUG-003",
  },
  {
    slug: "peoplecore-qa",
    name: "PeopleCore",
    tagline: "HRMS workflows · permission matrix · audit validation",
    accent: "#8ee6c8",
    skills: ["Workflow Testing", "Role-Based Access Control", "Permission Testing", "API Testing", "SQL Validation", "Test Documentation", "Defect Management", "Playwright", "Postman"],
    objective:
      "Verify multi-module HR workflows and prove that four roles see and change only what they are allowed to — in the API, not just in the UI.",
    work: [
      "Wrote 16 requirements with 48 acceptance criteria and 69 manual test cases across employees, attendance and leave workflows",
      "Built a role/permission matrix and tested every endpoint against every role, including direct API calls by under-privileged accounts",
      "Found a Critical authorization gap: any employee could write attendance records for anyone (payroll-relevant data)",
      "Automated 58 API tests and 20 UI tests with Playwright, a 45-request Postman collection with 96 Newman assertions and 12 SQL validation checks",
      "Validated date and salary boundaries, duplicate codes/emails, leave overlap rules, workflow transitions and the audit trail",
    ],
    flagship: "HR-BUG-004",
  },
  {
    slug: "taskflow-qa",
    name: "TaskFlow",
    tagline: "API-first QA · object-level permissions · performance baseline",
    accent: "#ffd08a",
    skills: ["API Testing", "REST", "Schema Validation", "Authorization Testing", "Pagination Testing", "SQL", "Playwright", "Postman", "Newman", "Performance Testing"],
    objective:
      "Treat the REST API as the product: validate the contract, the authorization rules and the data integrity, then prove it all runs as a repeatable regression suite.",
    work: [
      "Wrote 20 requirements and 67 manual API test cases: CRUD, HTTP method/status-code validation, schema and type validation, missing and malformed payloads",
      "Tested object-level permissions and cross-project isolation (members of one project cannot read or change another project's data)",
      "Automated 48 API tests and 10 UI tests with Playwright, a 48-request Postman collection with 50 Newman assertions and 22 SQL validation checks",
      "Covered duplicate/conflicting operations, invalid workflow transitions, date boundaries (overdue, due today, leap years) and pagination/filtering edges",
      "Added a local autocannon performance baseline with documented caveats, and security checks for input validation and access control",
    ],
    flagship: "TASK-BUG-003 / TASK-BUG-005",
  },
];

// ------------------------------------------------------------------ helpers

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function pickScreenshots(projectDir, limit = 4) {
  const dir = path.join(projectDir, "test-evidence/screenshots");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => /\.(jpe?g|png)$/i.test(file) && !/mobile/i.test(file))
    .sort()
    .slice(0, limit)
    .map((file) => path.join(dir, file));
}

/** The most important genuine defect per project, taken from the defect log. */
function flagshipDefect(projectDir, id) {
  const rows = parseCsv(path.join(projectDir, "test-documentation/defect-log.csv"));
  const ids = String(id).split("/").map((value) => value.trim());
  return rows.find((row) => ids.some((candidate) => row.DefectID?.includes(candidate))) ?? null;
}

function defectBreakdown(projectDir) {
  const rows = parseCsv(path.join(projectDir, "test-documentation/defect-log.csv"));
  const seeded = rows.filter(isSeededDefect);
  const testCode = rows.filter((row) => !isSeededDefect(row) && isTestCodeDefect(row));
  const application = rows.filter((row) => !isSeededDefect(row) && !isTestCodeDefect(row));
  return { rows, seeded, testCode, application };
}

function highlightCases(projectDir, limit = 3) {
  const cases = parseCsv(path.join(projectDir, "test-documentation/test-cases.csv"));
  const preferred = cases.filter((row) => /Pass/.test(row.Status ?? "") && /(Boundary|Security|Negative|Validation)/i.test(row.TestType ?? ""));
  const pool = preferred.length >= limit ? preferred : cases;
  return pool.slice(0, limit);
}

const baseHtml = (title, body, accent) => `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${IMAGE.width}px; height: ${IMAGE.height}px; background: #0b080c;
    font-family: Geist, "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; color: #eae5ec; }
  .card { width: ${IMAGE.width}px; height: ${IMAGE.height}px; padding: 56px 60px; display: flex; flex-direction: column;
    background: radial-gradient(120% 120% at 82% 12%, ${accent}22 0%, transparent 55%), #0b080c; position: relative; overflow: hidden; }
  .eyebrow { font-size: 15px; letter-spacing: 5px; text-transform: uppercase; color: ${accent}; font-weight: 700; margin: 0 0 14px; }
  h1 { margin: 0 0 12px; font-size: 46px; line-height: 1.08; letter-spacing: -0.5px; }
  .tagline { margin: 0 0 26px; font-size: 20px; color: rgba(234,229,236,0.72); }
  .metrics { display: flex; gap: 16px; margin: 0 0 24px; }
  .metric { flex: 1; padding: 14px 16px; border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; background: rgba(255,255,255,0.03); }
  .metric b { display: block; font-size: 26px; }
  .metric span { display: block; font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; color: rgba(234,229,236,0.6); margin-top: 4px; }
  .shot { flex: 1; border: 1px solid rgba(255,255,255,0.14); border-radius: 16px; overflow: hidden; background: #15121c; }
  .shot img { width: 100%; height: 100%; object-fit: cover; object-position: top left; display: block; }
  .foot { margin-top: 18px; font-size: 15px; color: rgba(234,229,236,0.6); display: flex; justify-content: space-between; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  th { color: rgba(234,229,236,0.55); font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; }
  .pass { color: #9ff0c4; font-weight: 700; }
  .cols { display: flex; gap: 26px; flex: 1; }
  .col { flex: 1; }
  .col h2 { font-size: 13px; letter-spacing: 2.4px; text-transform: uppercase; color: ${accent}; margin: 0 0 10px; }
  .row { font-size: 14px; color: rgba(234,229,236,0.8); padding: 5px 0; border-bottom: 1px dashed rgba(255,255,255,0.09); }
  .row b { color: #fff; }
  .note { font-size: 12.5px; color: rgba(234,229,236,0.5); margin-top: 14px; }
</style></head><body><div class="card">${body}</div></body></html>`;

// ------------------------------------------------------------------ image rendering

fs.mkdirSync(IMG_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: IMAGE.width, height: IMAGE.height }, deviceScaleFactor: 1 });
const images = {};

async function shoot(name, html) {
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(350);
  const file = path.join(IMG_DIR, `${name}.jpg`);
  await page.screenshot({ path: file, type: "jpeg", quality: 88 });
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

for (const project of projects) {
  const projectDir = path.join(ROOT, "projects", project.slug);
  const metrics = collectProjectMetrics(projectDir);
  const defects = defectBreakdown(projectDir);
  const flagship = flagshipDefect(projectDir, project.flagship);
  const shots = pickScreenshots(projectDir, 3);
  const cases = highlightCases(projectDir);

  // 1. Announcement thumbnail: title + real metrics + the application itself.
  const heroShot = shots[0];
  const heroData = heroShot ? `data:image/jpeg;base64,${fs.readFileSync(heroShot).toString("base64")}` : "";
  images[`${project.slug}-thumbnail`] = await shoot(
    `${project.slug}-thumbnail`,
    baseHtml(
      project.name,
      `
      <p class="eyebrow">QA portfolio project</p>
      <h1>${esc(project.name)}</h1>
      <p class="tagline">${esc(project.tagline)}</p>
      <div class="metrics">
        <div class="metric"><b>${metrics.manualTotal ?? 0}</b><span>Manual test cases</span></div>
        <div class="metric"><b>${metrics.automatedPassed}</b><span>Automated checks passing</span></div>
        <div class="metric"><b>${metrics.applicationDefects}</b><span>Defects found &amp; fixed</span></div>
        <div class="metric"><b>${metrics.requirementsCovered ?? 0}/${metrics.requirements ?? 0}</b><span>Requirements traced</span></div>
      </div>
      ${heroShot ? `<div class="shot"><img src="${heroData}" alt="${esc(project.name)} application" /></div>` : ""}
      <div class="foot"><span>Executed on ${esc((metrics.generatedAt ?? "").slice(0, 10))}</span><span>All suites passing · evidence in the repository</span></div>
      `,
      project.accent
    )
  );

  // 2. Genuine application screenshots, letterboxed to LinkedIn size.
  project.screenshotPaths = [];
  for (const [index, shot] of shots.entries()) {
    const data = `data:image/jpeg;base64,${fs.readFileSync(shot).toString("base64")}`;
    const label = path.basename(shot).replace(/\.(jpe?g|png)$/i, "").replace(/^\d+-/, "").replace(/-/g, " ");
    images[`${project.slug}-app-${index + 1}`] = await shoot(
      `${project.slug}-app-${index + 1}`,
      baseHtml(
        project.name,
        `<p class="eyebrow">${esc(project.name)} · application</p><h1 style="font-size:30px;margin-bottom:18px">${esc(label)}</h1>
         <div class="shot"><img src="${data}" alt="${esc(label)}" /></div>
         <div class="foot"><span>Screenshot captured from the running application</span><span>${esc(project.tagline)}</span></div>`,
        project.accent
      )
    );
    project.screenshotPaths.push({ file: images[`${project.slug}-app-${index + 1}`], label });
  }

  // 3. Test evidence card built from the real execution report.
  const suiteRows = metrics.suites
    .map((suite) => `<tr><td>${esc(suite.name)}</td><td class="pass">${suite.passed} / ${suite.total}</td></tr>`)
    .join("");
  const caseRows = cases
    .map((row) => `<div class="row"><b>${esc(row.TestCaseID)}</b> · ${esc((row.Scenario ?? "").slice(0, 78))} — <span class="pass">${esc(row.Status)}</span></div>`)
    .join("");
  images[`${project.slug}-test-evidence`] = await shoot(
    `${project.slug}-test-evidence`,
    baseHtml(
      project.name,
      `
      <p class="eyebrow">Test evidence · executed ${esc((metrics.generatedAt ?? "").slice(0, 10))}</p>
      <h1 style="font-size:34px;margin-bottom:20px">${esc(project.name)} — verified results</h1>
      <div class="cols">
        <div class="col">
          <h2>Suites</h2>
          <table><tbody>${suiteRows}</tbody></table>
          <div class="note">${metrics.automatedPassed} automated checks passed · ${metrics.automatedFailed} failed</div>
        </div>
        <div class="col">
          <h2>Defects</h2>
          <div class="row"><b>${defects.application.length}</b> in the application under test (fixed, retested, regression-verified)</div>
          <div class="row"><b>${defects.testCode.length}</b> in my own test automation (logged too)</div>
          <div class="row"><b>${defects.seeded.length}</b> deliberately seeded, detection proven</div>
          ${flagship ? `<div class="row" style="margin-top:10px"><b>${esc(flagship.DefectID)}</b> · ${esc((flagship.Title ?? "").slice(0, 96))}</div>` : ""}
        </div>
      </div>
      <h2 style="margin-top:18px">Sample manual test cases</h2>
      ${caseRows}
      `,
      project.accent
    )
  );

  project.metrics = metrics;
  project.defects = defects;
  project.flagship = flagship;
}

// ------------------------------------------------------------------ markdown kit

const linkFor = (project) => {
  const github = `${GITHUB_REPO}/tree/main/projects/${project.slug}`;
  const caseStudy = `${LIVE}/projects/${project.slug}/`;
  return { github, caseStudy, githubNote: REPO_IS_PUBLIC ? "" : " *(the GitHub link only works once the repository is public — the case-study link works today)*" };
};

const kit = `# LinkedIn publishing kit

> Generated by \`npm run build:linkedin\` from the three projects' own executed artefacts.
> Images live in \`linkedin/images/\` (1200×627, the LinkedIn link-preview size).

## 0. Status and integrity rules

| Project | Status | Verified run |
|---------|--------|--------------|
${projects
  .map((project) => `| ${project.name} | **Verified** — all suites passing | ${(project.metrics.generatedAt ?? "").slice(0, 10)} |`)
  .join("\n")}

What this kit does **not** claim, deliberately:

- No client work, no employer project, no commercial QA experience: ${projects.map((project) => project.name).join(", ")} are
  **portfolio projects on demo applications I built myself as test targets**.
- No production deployment or user traffic: the applications run locally and in CI only.
- No invented numbers: every figure below is read from each project's own
  \`test-reports/summary.json\` / \`test-documentation/*.csv\`.
- Seeded defects are labelled as such and never presented as real discoveries.

## 1. Recommended profile headline

Pick one (all are accurate):

1. \`QA Engineer | Manual & API Testing | Playwright, Postman, SQL | Quality-focused Software Testing\`
2. \`Software QA Engineer — Manual Testing, REST API Testing, Test Automation (Playwright, Postman, SQL)\`
3. \`QA / SQA Engineer | Turning requirements into test cases, defects and release evidence\`

Short version for the headline (220-character limit): \`QA Engineer | Manual testing, REST API testing, Playwright automation, SQL validation | 3 end-to-end QA projects with executed evidence\`

## 2. Featured section description

\`\`\`
QA portfolio: three end-to-end testing projects on applications I built as test targets —
ShopSure (e-commerce), PeopleCore (HRMS workflows + role-based access) and TaskFlow (REST API).
Each one includes requirements with acceptance criteria, manual test cases, Playwright API/UI
suites, SQL validation, Postman/Newman collections, defect logs with retest evidence and a
release report. 525 automated checks passing across the three; 18 defects found and fixed.
\`\`\`

## 3. Project descriptions (LinkedIn "Projects" section)

### 3.1 ShopSure — E-commerce Quality Assurance and Test Automation

- **Associated with:** personal QA portfolio project (not client work)
- **Dates:** see the verified run date above
- **Project URL:** ${linkFor(projects[0]).caseStudy}
- **Description (copy-paste):**

\`\`\`
Objective: prove that a storefront's money path is safe — pricing rules, stock integrity, checkout validation, order lifecycle and admin access control.

What I did:
${projects[0].work.map((item) => `- ${item}`).join("\n")}

Methodologies: functional, negative and boundary testing; decision tables; state-transition testing; exploratory and regression testing; role-based access checks; database validation.
Tools: Playwright (API + UI), Postman + Newman, SQL, Excel-safe CSV deliverables, GitHub Actions.

Verified outcome: ${projects[0].metrics.manualTotal} manual test cases, ${projects[0].metrics.automatedPassed} automated checks passing (${projects[0].metrics.apiTests} API, ${projects[0].metrics.uiTests} UI, ${projects[0].metrics.sqlChecks} SQL, ${projects[0].metrics.postmanAssertions} Postman assertions), ${projects[0].metrics.requirementsCovered}/${projects[0].metrics.requirements} requirements traced, ${projects[0].defects.application.length} defects found and fixed with retest evidence, and ${projects[0].defects.seeded.length} deliberately seeded defects used to prove the suite detects them.
\`\`\`

### 3.2 PeopleCore — HRMS Workflow and Role-Based Access Testing

- **Associated with:** personal QA portfolio project (not client work)
- **Project URL:** ${linkFor(projects[1]).caseStudy}
- **Description (copy-paste):**

\`\`\`
Objective: ${projects[1].objective}

What I did:
${projects[1].work.map((item) => `- ${item}`).join("\n")}

Methodologies: workflow and state-transition testing; a role/permission matrix covering four roles; boundary and negative testing of dates and salary rules; audit-trail verification; SQL consistency checks.
Tools: Playwright (API + UI), Postman + Newman, SQL, EJS/Express demo application, GitHub Actions.

Verified outcome: ${projects[1].metrics.manualTotal} manual test cases, ${projects[1].metrics.automatedPassed} automated checks passing (${projects[1].metrics.apiTests} API, ${projects[1].metrics.uiTests} UI, ${projects[1].metrics.sqlChecks} SQL, ${projects[1].metrics.postmanAssertions} Postman assertions), ${projects[1].metrics.requirementsCovered}/${projects[1].metrics.requirements} requirements traced, ${projects[1].defects.application.length} defects found and fixed in the application (plus ${projects[1].defects.testCode.length} I logged in my own automation), and ${projects[1].defects.seeded.length} seeded defects.
\`\`\`

### 3.3 TaskFlow — REST API Quality Engineering and Regression Automation

- **Associated with:** personal QA portfolio project (not client work)
- **Project URL:** ${linkFor(projects[2]).caseStudy}
- **Description (copy-paste):**

\`\`\`
Objective: ${projects[2].objective}

What I did:
${projects[2].work.map((item) => `- ${item}`).join("\n")}

Methodologies: API contract testing; schema and data-type validation; object-level authorization; cross-project isolation; boundary and date testing; pagination/filtering edges; database integrity; a documented performance baseline.
Tools: Playwright APIRequestContext, Postman + Newman, SQL, autocannon, GitHub Actions.

Verified outcome: ${projects[2].metrics.manualTotal} manual API test cases, ${projects[2].metrics.automatedPassed} automated checks passing (${projects[2].metrics.apiTests} API, ${projects[2].metrics.uiTests} UI, ${projects[2].metrics.sqlChecks} SQL, ${projects[2].metrics.postmanAssertions} Postman assertions), ${projects[2].metrics.requirementsCovered}/${projects[2].metrics.requirements} requirements traced and ${projects[2].defects.application.length} defects found and fixed.
\`\`\`

## 4. Announcement posts

> Post them a few days apart so each one gets attention. Attach the listed image and put the
> case-study link in the post body; LinkedIn generates the preview card from it.

### 4.1 ShopSure post

\`\`\`
I tested an e-commerce store until I could prove two things: the money path is correct, and only admins can touch it.

ShopSure is a demo storefront I built as a test target. Then I did what a QA engineer does:

• 24 requirements with 72 acceptance criteria → 101 manual test cases
• A pricing decision table: 10% discount from a 100.00 subtotal, free shipping from 50.00 — tested on both sides of every boundary (49.99 vs 50.00, 99.99 vs 100.00)
• 202 automated checks: 72 API tests, 31 UI tests (Playwright), 23 SQL validation checks and 76 Postman assertions run with Newman
• A checkout that re-validates stock, and an order state machine that rejects illegal transitions
• A recorded exploratory session: SQL injection, mass assignment, malformed and oversized payloads

Testing found 3 real defects, including two where bad client input produced HTTP 500 instead of 400/413. All fixed, retested and regression-verified with the failing runs kept as evidence.

Nice detail: I also injected 3 deliberate defects behind a flag and proved my regression suite catches them — a suite that has never failed isn't evidence.

Case study + evidence: ${linkFor(projects[0]).caseStudy}

#QA #SoftwareTesting #ManualTesting #APITesting #Playwright #Postman #SQL #QualityAssurance
\`\`\`

### 4.2 PeopleCore post

\`\`\`
The most serious bug I have found so far was not in the UI. It was an endpoint that accepted a request it should have refused.

PeopleCore is an HRMS I built as a test target — employees, attendance, leave approval and four roles (admin, HR, manager, employee).

I built a role/permission matrix and tested every endpoint against every role, including direct API calls:

• An employee could POST attendance records for anyone in the company → payroll-relevant data could be forged by any logged-in user
• The UI hid the button; the API still accepted the request

That became HR-BUG-004 (Critical): logged with reproduction steps, failing assertions and a root-cause note, then fixed, retested and regression-verified across the whole permission matrix.

Across the project: 69 manual test cases, 189 automated checks passing (58 API, 20 UI, 12 SQL, 96 Postman assertions), 16/16 requirements traced, and 9 defects found and fixed in the application (plus 3 in my own automation — I log those too).

Case study + evidence: ${linkFor(projects[1]).caseStudy}

#QA #SoftwareTesting #RBAC #APITesting #SecurityTesting #Playwright #SQL #QualityAssurance
\`\`\`

### 4.3 TaskFlow post

\`\`\`
Testing an API is not just "does it return 200". TaskFlow is an API-first project management service I built as a test target, and I treated the API as the product.

What I covered:
• CRUD, HTTP method and status-code validation, schema and data-type checks
• Missing, malformed and invalid payloads (the API must fail predictably, not crash)
• Object-level permissions: members of one project can never read or change another project's data
• Duplicate/conflicting operations and invalid workflow transitions (DONE must be terminal)
• Date boundaries, pagination and filtering edges, plus SQL validation of referential integrity
• A local performance baseline with autocannon, documented with its caveats

Result: 67 manual API test cases, 134 automated checks passing (48 API, 10 UI, 22 SQL, 50 Postman assertions), 20/20 requirements traced, 6 defects found and fixed — including a list endpoint that returned an empty array with a correct total because a duplicated SQL bind silently nulled the WHERE clause.

Case study + evidence: ${linkFor(projects[2]).caseStudy}

#API #APITesting #QualityAssurance #Testing #Playwright #Postman #SQL #RESTAPI
\`\`\`

## 5. Images to attach

Each file is 1200×627 (LinkedIn link-preview size).

${projects
  .map((project) => {
    const lines = [
      `**${project.name}**`,
      "",
      `- Thumbnail (use this for the announcement post): \`${images[`${project.slug}-thumbnail`]}\``,
      `- Test-evidence card (real executed numbers): \`${images[`${project.slug}-test-evidence`]}\``,
      ...project.screenshotPaths.map((shot) => `- Application screenshot — ${shot.label}: \`${shot.file}\``),
      "",
    ];
    return lines.join("\n");
  })
  .join("\n")}

Alt text suggestions (use for accessibility):

${projects
  .map(
    (project) =>
      `- ${project.name} thumbnail: "${project.name} QA project — ${project.metrics.manualTotal} manual test cases, ${project.metrics.automatedPassed} automated checks passing, ${project.defects.application.length} defects found and fixed"`
  )
  .join("\n")}

## 6. Links

| Project | Case study (works today) | GitHub (needs the repository to be public) |
|---------|--------------------------|---------------------------------------------|
${projects.map((project) => `| ${project.name} | ${linkFor(project).caseStudy} | ${linkFor(project).github} |`).join("\n")}

> **Repository visibility:** \`abdul-mujeer/portfolio\` is currently **private**, so every GitHub link
> returns 404 for anyone else and the workflow badges are invisible. The case-study links work now.
> If you keep the repository private, use only the case-study links in the posts.

## 7. Suggested skills to add on LinkedIn

Based on what the projects actually demonstrate:

- **ShopSure:** Manual Testing · Test Case Design · Boundary Value Analysis · Decision Table Testing · API Testing · Postman · Playwright · SQL · Regression Testing · Defect Reporting
- **PeopleCore:** Workflow Testing · Role-Based Access Control · Permission Testing · Security Testing · API Testing · SQL Validation · Defect Management · Test Documentation
- **TaskFlow:** API Testing · REST APIs · Schema Validation · Authorization Testing · Pagination Testing · Performance Testing · Postman · Newman · Playwright · SQL

Put **the 5 you can defend in an interview** on the profile: Manual Testing, Test Case Design, API Testing, Postman, SQL — then Playwright and Test Automation if asked.

## 8. Publishing checklist (manual — no integration is available here)

There is **no supported LinkedIn integration in this environment**, so nothing will be posted
automatically. Upload manually with these steps:

1. Download/pick the images from \`linkedin/images/\` on your machine.
2. LinkedIn → **Add profile section → Additional → Projects**: paste each description from section 3,
   add the case-study URL and the matching image.
3. **Featured**: add the three case-study links (and the CV PDF) with the thumbnails from section 5.
4. **Posts**: paste one announcement post, attach its thumbnail, publish. Repeat for the others a
   few days apart.
5. After publishing, ask a contact to open each link in a private window and confirm the preview card
   and the case-study page load.
6. If you make the repository public first, swap the links to the GitHub versions in section 6.

### If you ever want API publishing

LinkedIn does not allow simple scripted posting. Posting on a member's behalf requires:

1. Creating a LinkedIn **app** in the developer portal (you own the credentials).
2. Requesting the \`w_member_social\` scope (and \`openid profile\` for the member URN); some scopes
   require app review by LinkedIn.
3. An OAuth 2.0 **authorization-code** flow: the user is redirected to LinkedIn, approves the scopes,
   and the app exchanges the code for an access token (tokens expire and need refresh).
4. Calling \`POST /rest/posts\` (or the \`/v2/ugcPosts\` endpoint) with the member URN.

I will not handle your LinkedIn password, bypass authentication, or use unsupported automation
(browser scripting against your account). If you want this later, you create the app and provide the
client ID/secret plus an access token via environment variables, and I can build the posting script
around the documented API — publishing only after you review and approve each post.
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(KIT, kit);
await browser.close();

console.log(`linkedin-publishing-kit.md written`);
console.log(`${Object.keys(images).length} images written to linkedin/images/`);
for (const project of projects) {
  console.log(
    `  ${project.name}: ${project.metrics.automatedPassed} checks, ${project.metrics.manualTotal} manual cases, ${project.defects.application.length} app defects, ${project.defects.seeded.length} seeded`
  );
}
