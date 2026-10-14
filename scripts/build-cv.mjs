#!/usr/bin/env node
/**
 * Builds the owner's CV from structured data and exports it as:
 *   public/cv/Qazi_Abdul_Mujeer_QA_CV.pdf   (the download linked from the site)
 *   public/resume.html                       (the same CV as a printable web page)
 *   test-evidence/cv-preview.png             (visual evidence of the rendered first page)
 *
 * Content source: the owner's CV (Qazi_Abdul_Mujeer_QA_CV.pdf) plus the three QA portfolio projects
 * built in this repository. Every number quoted for those projects is read from their executed
 * `test-reports/summary.json` through scripts/lib/project-metrics.mjs — nothing is estimated.
 *
 * Usage: npm run build:cv
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { collectProjectMetrics } from "./lib/project-metrics.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_PDF_DIR = path.join(ROOT, "public/cv");
const OUT_PDF = path.join(OUT_PDF_DIR, "Qazi_Abdul_Mujeer_QA_CV.pdf");
const OUT_HTML = path.join(ROOT, "public/resume.html");
const OUT_PREVIEW = path.join(ROOT, "test-evidence/cv-preview.png");

const LIVE = "https://portfolio-abdul-mujeer.vercel.app";
const GITHUB_REPO = "https://github.com/abdul-mujeer/portfolio/tree/main/projects";

// ---------------------------------------------------------------- project metrics (real numbers)
function metricsFor(slug) {
  const data = collectProjectMetrics(path.join(ROOT, "projects", slug));
  return {
    automated: data.automatedPassed,
    api: data.apiTests ?? 0,
    ui: data.uiTests ?? 0,
    sql: data.sqlChecks ?? 0,
    postman: data.postmanAssertions ?? 0,
    manual: data.manualTotal ?? 0,
    defects: data.genuineDefects,
    requirements: data.requirements ?? 0,
    covered: data.requirementsCovered ?? 0,
  };
}

const shopsure = metricsFor("shopsure-qa");
const peoplecore = metricsFor("peoplecore-qa");
const taskflow = metricsFor("taskflow-qa");

const cv = {
  name: "Qazi Abdul Mujeer",
  title: "Junior QA Engineer | Software Tester",
  contact: [
    "Karachi, Pakistan",
    "0316-2454316",
    "abdul.mujeer98@gmail.com",
  ],
  links: [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/qazi-abdul-mujeer/" },
    { label: "GitHub", href: "https://github.com/abdul-mujeer" },
    { label: "Portfolio", href: LIVE },
  ],
  summary:
    "Computer Science graduate with about 1 year of Full Stack Development experience at Cyphion, " +
    "transitioning into Software QA and software testing. Practical knowledge of manual testing " +
    "(functional, regression, smoke, sanity, exploratory), API testing with Postman, and basic SQL " +
    "database validation. Familiar with SDLC/STLC, Agile/Scrum, Jira, and Git/GitHub. Python and SQL " +
    "fundamentals, plus a developer's understanding of how software is built and debugged, which " +
    "supports clear defect reports and communication with engineering teams.",
  skills: [
    ["Manual Testing", "Functional, Regression, Smoke, Sanity, Exploratory, Positive/Negative, UI, End-to-End, Basic Compatibility Testing"],
    ["Test Design", "Test Case Design, Test Scenario Creation, Requirements Analysis, Bug Reporting, Defect Life Cycle"],
    ["Techniques (familiar with)", "Boundary Value Analysis, Equivalence Partitioning, Decision Table Testing, Error Guessing"],
    ["API Testing", "Postman, REST API testing, HTTP methods (GET, POST, PUT, PATCH, DELETE), status codes, JSON and request/response validation, basic negative testing"],
    ["Database", "Basic SQL (SELECT, WHERE, ORDER BY, GROUP BY, basic JOIN concepts), basic database validation"],
    ["Automation (project practice)", "Playwright (API + UI test suites), Postman collections executed with Newman, SQL validation scripts, GitHub Actions CI runs and report artefacts"],
    ["Tools", "Jira, Postman, Playwright, Git/GitHub, Chrome/Browser DevTools"],
    ["Process", "SDLC, STLC, Agile/Scrum fundamentals"],
    ["Programming", "Python (basic), SQL (basic), JavaScript"],
  ],
  experience: [
    {
      role: "Full Stack Developer",
      org: "Cyphion",
      period: "~1 year",
      bullets: [
        "Worked with frontend and backend components of web applications, gaining a working understanding of application behaviour and requirements",
        "Debugged and investigated software issues, and validated fixes",
        "Worked with APIs and databases, including request/response behaviour",
        "Collaborated on software projects within the software development life cycle",
      ],
    },
  ],
  projects: [
    {
      name: "ShopSure — E-commerce Quality Assurance and Test Automation",
      role: "QA portfolio project (manual, API, UI and database testing)",
      links: [
        { label: "GitHub", href: `${GITHUB_REPO}/shopsure-qa` },
        { label: "Case study", href: `${LIVE}/projects/shopsure-qa/` },
      ],
      bullets: [
        `${shopsure.manual} manual test cases and ${shopsure.requirements} requirements with acceptance criteria; boundary-value, decision-table and negative design`,
        `${shopsure.automated} automated checks: ${shopsure.api} API tests, ${shopsure.ui} UI tests, ${shopsure.sql} SQL validation checks and ${shopsure.postman} Postman assertions`,
        `Found and fixed ${shopsure.defects} defects with documented reproduction steps, retest evidence and regression runs`,
      ],
    },
    {
      name: "PeopleCore — HRMS Workflow and Role-Based Access Testing",
      role: "QA portfolio project (workflows, permissions, database validation)",
      links: [
        { label: "GitHub", href: `${GITHUB_REPO}/peoplecore-qa` },
        { label: "Case study", href: `${LIVE}/projects/peoplecore-qa/` },
      ],
      bullets: [
        `${peoplecore.manual} manual test cases covering employee, attendance and leave workflows across four roles`,
        `${peoplecore.automated} automated checks: ${peoplecore.api} API tests, ${peoplecore.ui} UI tests, ${peoplecore.sql} SQL checks and ${peoplecore.postman} Postman assertions`,
        `Tested a role/permission matrix including direct API access by under-privileged accounts; found and fixed ${peoplecore.defects} defects, including a critical missing authorization check on attendance creation`,
      ],
    },
    {
      name: "TaskFlow — REST API Quality Engineering and Regression Automation",
      role: "QA portfolio project (API-first testing, security and performance baseline)",
      links: [
        { label: "GitHub", href: `${GITHUB_REPO}/taskflow-qa` },
        { label: "Case study", href: `${LIVE}/projects/taskflow-qa/` },
      ],
      bullets: [
        `${taskflow.manual} manual API test cases: CRUD, schema and type validation, invalid payloads, pagination and filtering edges`,
        `${taskflow.automated} automated checks: ${taskflow.api} API tests, ${taskflow.ui} UI tests, ${taskflow.sql} SQL checks and ${taskflow.postman} Postman assertions, plus a local performance baseline`,
        `Object-level permission and cross-project isolation testing; found and fixed ${taskflow.defects} defects`,
      ],
    },
    {
      name: "Crypto AI Bot",
      role: "University Final Year Project — Kohat University of Science & Technology (KUST)",
      links: [],
      bullets: [
        "Built Crypto AI Bot as my Bachelor's Final Year Project: a software application integrating external APIs and handling application data",
        "Debugged issues and validated application behaviour across different scenarios",
        "Worked across frontend/backend interaction to understand how components exchange data",
      ],
    },
  ],
  education: {
    degree: "Bachelor of Science in Computer Science",
    school: "Kohat University of Science & Technology (KUST), Pakistan",
    period: "2020 – 2024",
    extra: "CGPA: 3.62 / 4.00",
  },
  certifications: [
    {
      name: "QA — Manual, Automation & Mobile Automation (Udemy, Lucky Trainings)",
      status: "In Progress",
      detail: "Online course covering manual testing, test automation, and mobile automation testing",
    },
  ],
};

// ---------------------------------------------------------------- HTML
const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const skillsHtml = cv.skills
  .map(([group, items]) => `<div class="skill"><span class="skill-label">${esc(group)}:</span> ${esc(items)}</div>`)
  .join("\n");

const experienceHtml = cv.experience
  .map(
    (job) => `
    <div class="entry">
      <div class="entry-head"><h3>${esc(job.role)} | ${esc(job.org)}</h3><span>${esc(job.period)}</span></div>
      <ul>${job.bullets.map((bullet) => `<li>${esc(bullet)}</li>`).join("")}</ul>
    </div>`
  )
  .join("\n");

const projectsHtml = cv.projects
  .map(
    (project) => `
    <div class="entry">
      <div class="entry-head">
        <h3>${esc(project.name)}</h3>
        <span class="links">${project.links
          .map((link) => `<a href="${link.href}">${esc(link.label)}</a>`)
          .join(" <span class='sep'>|</span> ")}</span>
      </div>
      <p class="muted">${esc(project.role)}</p>
      <ul>${project.bullets.map((bullet) => `<li>${esc(bullet)}</li>`).join("")}</ul>
    </div>`
  )
  .join("\n");

const certificationsHtml = cv.certifications
  .map(
    (certificate) => `
    <div class="entry">
      <div class="entry-head"><h3>${esc(certificate.name)}</h3><span>${esc(certificate.status)}</span></div>
      <p class="muted">${esc(certificate.detail)}</p>
    </div>`
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>${esc(cv.name)} — ${esc(cv.title)} — CV</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <style>
      @page { size: A4; margin: 12mm 12mm; }
      :root { --ink: #17151f; --muted: #5c5768; --line: #dcd8e6; --accent: #6b4ee6; }
      * { box-sizing: border-box; }
      body {
        margin: 0; background: #f4f3f8; color: var(--ink);
        font-family: "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
        font-size: 10.2pt; line-height: 1.42;
      }
      .sheet {
        width: 210mm; min-height: 297mm; margin: 10mm auto; background: #fff;
        padding: 12mm 12mm 10mm; box-shadow: 0 12px 40px rgba(20, 18, 26, 0.14);
      }
      header { border-bottom: 2.5px solid var(--accent); padding-bottom: 8px; }
      h1 { margin: 0; font-size: 21pt; letter-spacing: -0.3px; }
      .title { margin: 3px 0 6px; font-size: 10.5pt; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: var(--accent); }
      .contact { font-size: 9.4pt; color: var(--muted); }
      .contact a, .links a { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--line); }
      .contact a:hover, .links a:hover { border-color: var(--accent); }
      h2 {
        margin: 14px 0 6px; font-size: 9.6pt; letter-spacing: 2px; text-transform: uppercase;
        color: var(--accent); border-bottom: 1px solid var(--line); padding-bottom: 3px;
      }
      p { margin: 0 0 6px; }
      .muted { color: var(--muted); font-size: 9.6pt; }
      .skill { margin-bottom: 3px; }
      .skill-label { font-weight: 700; }
      .entry { margin-bottom: 9px; page-break-inside: avoid; }
      .entry-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
      .entry-head h3 { margin: 0; font-size: 10.6pt; }
      .entry-head span { font-size: 9.4pt; color: var(--muted); white-space: nowrap; }
      .links a { font-weight: 600; }
      .sep { color: var(--line); }
      ul { margin: 3px 0 0 16px; padding: 0; }
      li { margin-bottom: 2px; }
      .toolbar { width: 210mm; margin: 10mm auto 0; display: flex; justify-content: flex-end; gap: 8px; }
      .toolbar a, .toolbar button {
        font: inherit; font-size: 9.5pt; font-weight: 600; padding: 8px 14px; border-radius: 8px;
        border: 1px solid var(--accent); background: var(--accent); color: #fff;
        text-decoration: none; cursor: pointer;
      }
      .toolbar a.ghost { background: transparent; color: var(--accent); }
      @media print {
        body { background: #fff; }
        .sheet { margin: 0; width: auto; min-height: 0; padding: 0; box-shadow: none; }
        .toolbar { display: none; }
        a { color: var(--ink) !important; }
      }
      @media (max-width: 800px) {
        .sheet { width: auto; margin: 0; padding: 16px; }
        .toolbar { width: auto; margin: 12px; }
        .entry-head { flex-direction: column; gap: 2px; }
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button type="button" onclick="window.print()">Print / save as PDF</button>
      <a class="ghost" href="/cv/Qazi_Abdul_Mujeer_QA_CV.pdf">Open the PDF version</a>
      <a class="ghost" href="/">Back to portfolio</a>
    </div>

    <main class="sheet">
      <header>
        <h1>${esc(cv.name)}</h1>
        <p class="title">${esc(cv.title)}</p>
        <p class="contact">
          ${cv.contact.map((item) => esc(item)).join(" &nbsp;|&nbsp; ")}
          &nbsp;|&nbsp;
          ${cv.links.map((link) => `<a href="${link.href}">${esc(link.label)}</a>`).join(" &nbsp;|&nbsp; ")}
        </p>
      </header>

      <h2>Professional Summary</h2>
      <p>${esc(cv.summary)}</p>

      <h2>Technical Skills</h2>
      ${skillsHtml}

      <h2>Professional Experience</h2>
      ${experienceHtml}

      <h2>QA &amp; Technical Projects</h2>
      ${projectsHtml}

      <h2>Education</h2>
      <div class="entry">
        <div class="entry-head"><h3>${esc(cv.education.degree)} | ${esc(cv.education.school)}</h3><span>${esc(cv.education.period)}</span></div>
        <p class="muted">${esc(cv.education.extra)}</p>
      </div>

      <h2>Certifications &amp; Training</h2>
      ${certificationsHtml}
    </main>
  </body>
</html>
`;

fs.mkdirSync(OUT_PDF_DIR, { recursive: true });
fs.mkdirSync(path.dirname(OUT_PREVIEW), { recursive: true });
fs.writeFileSync(OUT_HTML, html);
console.log("public/resume.html written");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "load" });
await page.emulateMedia({ media: "print" });
await page.pdf({ path: OUT_PDF, format: "A4", printBackground: true, margin: { top: "12mm", right: "12mm", bottom: "10mm", left: "12mm" } });
await page.emulateMedia({ media: "screen" });
await page.locator(".sheet").screenshot({ path: OUT_PREVIEW, type: "png" });
await browser.close();

const pdfKb = Math.round(fs.statSync(OUT_PDF).size / 1024);
console.log(`public/cv/Qazi_Abdul_Mujeer_QA_CV.pdf written (${pdfKb} KB)`);
console.log("test-evidence/cv-preview.png written (visual evidence)");
console.log(
  `projects quoted: ShopSure ${shopsure.automated} checks / PeopleCore ${peoplecore.automated} / TaskFlow ${taskflow.automated}`
);
