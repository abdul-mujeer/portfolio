/**
 * Featured QA portfolio projects.
 *
 * The `metrics` shown on the cards are NOT written by hand: they are read from
 * `qaProjectMetrics.json`, which `scripts/build-project-pages.mjs` generates from each project's own
 * machine-generated `test-reports/summary.json` after executed runs. If a project has not been
 * verified yet, the UI says so instead of showing a guessed number.
 */
import metrics from "./qaProjectMetrics.json";

export interface QAProjectMetric {
  label: string;
  value: string;
  note?: string;
}

interface ProjectMetrics {
  verified: boolean;
  manualCases?: number;
  manualPassed?: number;
  manualNotExecuted?: number;
  automatedPassing?: number;
  automatedFailed?: number;
  apiTests?: number;
  uiTests?: number;
  sqlChecks?: number;
  postmanAssertions?: number;
  requirements?: number;
  requirementsCovered?: number;
  defectsFound?: number;
  seededDefects?: number;
  lastRunAt?: string | null;
  commit?: string | null;
}

const metricsBySlug = metrics as Record<string, ProjectMetrics>;

function buildMetrics(slug: string): QAProjectMetric[] {
  const data = metricsBySlug[slug];
  if (!data || !data.verified) {
    return [
      { label: "Manual cases", value: "Verifying…", note: "Numbers appear after the suites run" },
      { label: "Automated checks", value: "Verifying…" },
      { label: "Defects found", value: String(data?.defectsFound ?? 0) },
    ];
  }

  return [
    {
      label: "Manual cases",
      value: String(data.manualCases ?? 0),
      note: `${data.manualPassed ?? 0} executed · ${data.manualNotExecuted ?? 0} not executed`,
    },
    {
      label: "Automated checks",
      value: `${data.automatedPassing ?? 0} passing`,
      note: `${data.apiTests ?? 0} API · ${data.uiTests ?? 0} UI · ${data.sqlChecks ?? 0} SQL · ${data.postmanAssertions ?? 0} Postman`,
    },
    {
      label: "Defects found",
      value: `${data.defectsFound ?? 0} fixed`,
      note: `${data.seededDefects ?? 0} seeded (detection exercise)`,
    },
  ];
}

export interface QAProject {
  slug: string;
  title: string;
  shortTitle: string;
  tagline: string;
  description: string;
  focus: string[];
  tech: string[];
  metrics: QAProjectMetric[];
  caseStudyUrl: string;
  sourceUrl: string;
  screenshot: string;
  screenshotAlt: string;
  accent: string;
}

const REPO = "https://github.com/abdul-mujeer/portfolio/tree/main/projects";

export const qaProjects: QAProject[] = [
  {
    slug: "shopsure-qa",
    title: "ShopSure — E-commerce Quality Assurance and Test Automation",
    shortTitle: "ShopSure",
    tagline: "E-commerce QA · manual, API, UI and database testing",
    description:
      "A demo storefront (React + Express + SQLite) with pricing rules, stock limits and an order workflow — tested end to end: requirements and acceptance criteria, manual test cases with boundary and decision-table design, API and UI automation, SQL validation and three defects found and fixed with evidence.",
    focus: ["Functional & negative testing", "Boundary & decision tables", "REST API testing", "Playwright automation", "SQL validation"],
    tech: ["Node.js", "Express", "SQLite", "React", "Playwright", "Postman", "Newman"],
    metrics: buildMetrics("shopsure-qa"),
    caseStudyUrl: "/projects/shopsure-qa/",
    sourceUrl: `${REPO}/shopsure-qa`,
    screenshot: "/images/qa-projects/shopsure-qa-card.jpg",
    screenshotAlt: "ShopSure storefront catalog with search, filters and product cards",
    accent: "#c2a4ff",
  },
  {
    slug: "peoplecore-qa",
    title: "PeopleCore — HRMS Workflow and Role-Based Access Testing",
    shortTitle: "PeopleCore",
    tagline: "HRMS workflows · permissions matrix · audit validation",
    description:
      "A server-rendered HR management system (Express + EJS + SQLite) covering employees, attendance and leave approval across administrator, HR, manager and employee roles — tested for workflow transitions, permission boundaries, date validation and database consistency.",
    focus: ["Multi-role workflows", "Permission matrix testing", "Workflow state transitions", "Date & salary boundaries", "Audit-trail checks"],
    tech: ["Node.js", "Express", "SQLite", "EJS", "Playwright", "Postman", "Newman"],
    metrics: buildMetrics("peoplecore-qa"),
    caseStudyUrl: "/projects/peoplecore-qa/",
    sourceUrl: `${REPO}/peoplecore-qa`,
    screenshot: "/images/qa-projects/peoplecore-qa-card.jpg",
    screenshotAlt: "PeopleCore HR dashboard with role-aware metrics",
    accent: "#8ee6c8",
  },
  {
    slug: "taskflow-qa",
    title: "TaskFlow — REST API Quality Engineering and Regression Automation",
    shortTitle: "TaskFlow",
    tagline: "API-first QA · object-level permissions · performance baseline",
    description:
      "An API-first project management service (Express + SQLite with a minimal console) covering projects, membership, tasks, comments and activity history — tested with deep API coverage, cross-project isolation checks, security probes and a local performance baseline.",
    focus: ["CRUD & schema validation", "Object-level authorization", "Cross-project isolation", "Pagination & filtering edges", "Performance baseline"],
    tech: ["Node.js", "Express", "SQLite", "Playwright", "Postman", "Newman", "autocannon"],
    metrics: buildMetrics("taskflow-qa"),
    caseStudyUrl: "/projects/taskflow-qa/",
    sourceUrl: `${REPO}/taskflow-qa`,
    screenshot: "/images/qa-projects/taskflow-qa-card.jpg",
    screenshotAlt: "TaskFlow task board with status columns and filters",
    accent: "#ffd08a",
  },
];

export interface QASkillGroup {
  title: string;
  note?: string;
  skills: string[];
}

export const qaSkillGroups: QASkillGroup[] = [
  {
    title: "Test design & execution",
    skills: [
      "Test scenarios & detailed test cases",
      "Equivalence partitioning",
      "Boundary-value analysis",
      "Decision tables",
      "State-transition testing",
      "Negative & error-guessing",
      "Exploratory testing charters",
      "Smoke, sanity & regression suites",
      "Requirement traceability",
    ],
  },
  {
    title: "API & integration testing",
    skills: ["REST API testing", "Postman collections", "Newman CLI runs", "Status codes, headers & schemas", "Authentication & authorization checks", "Error & validation envelopes", "Response-time awareness"],
  },
  {
    title: "UI automation",
    skills: ["Playwright (API + UI)", "Reliable selectors & web-first assertions", "Test isolation & data control", "Traces, screenshots & failure evidence", "Tagged smoke/regression subsets", "Cross-viewport checks"],
  },
  {
    title: "Database & data validation",
    skills: ["SQL SELECT/JOIN queries", "Constraint & uniqueness checks", "Referential integrity", "Business-rule queries", "Persistence verification", "Test data seeding & cleanup"],
  },
  {
    title: "Process & reporting",
    skills: ["SDLC / STLC", "Agile ceremonies", "Risk-based testing", "Defect lifecycle & bug reports", "Severity vs priority", "Test execution reports", "Release-readiness recommendations"],
  },
  {
    title: "Technical foundations",
    skills: ["JavaScript / TypeScript", "Node.js & Express", "Python", "Git & GitHub", "CI with GitHub Actions", "Linux & Windows environments", "Chrome DevTools"],
  },
];
