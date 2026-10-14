import "./styles/QASections.css";

const phases = [
  {
    step: "01",
    title: "Requirements & planning",
    text: "Break features into testable requirements with acceptance criteria, define scope, entry/exit criteria and the risks that decide where to spend effort.",
  },
  {
    step: "02",
    title: "Test design",
    text: "Scenarios and detailed cases with unique IDs, decision tables, boundary values, negative paths, permission matrices and exploratory charters — all traced to requirements.",
  },
  {
    step: "03",
    title: "Execution",
    text: "Manual passes, API and UI automation, SQL validation and exploratory sessions. Every run produces raw output that is kept as evidence.",
  },
  {
    step: "04",
    title: "Defect management",
    text: "Reproducible bug reports with severity and priority, root-cause notes, retest and regression results, and a closure rationale — including defects I found in my own code.",
  },
  {
    step: "05",
    title: "Reporting",
    text: "Execution reports generated from real result files: passed/failed/skipped counts, requirement coverage, defect summary, risk assessment and a release recommendation.",
  },
];

const capabilities = [
  { label: "API testing", detail: "Postman collections, Newman CLI runs and Playwright API suites with real sessions — status codes, payloads, authorization boundaries and business-rule errors." },
  { label: "UI automation", detail: "Playwright journeys on the critical paths: purchase, leave approval, task workflow — stable selectors, no arbitrary waits, traces and screenshots on failure." },
  { label: "Database validation", detail: "SQL checks for constraints, uniqueness, referential integrity, pricing consistency and audit trails, run after the functional suites." },
  { label: "Security checks", detail: "Injection attempts, mass assignment, malformed and oversized payloads, cookie flags, brute-force throttling and role-escalation probes." },
  { label: "CI automation", detail: "GitHub Actions workflows per project: install, lint, run suites, publish reports and fail the build when a required test fails." },
  { label: "Evidence discipline", detail: "No fabricated results anywhere: suites either ran and are reported with their real counts, or they are marked as not executed with the exact command to run them." },
];

const TestingApproach = () => {
  return (
    <section className="qa-section" id="testing" aria-labelledby="testing-heading">
      <div className="qa-inner">
        <p className="qa-eyebrow">How I test</p>
        <h2 className="qa-heading" id="testing-heading">
          Testing approach &amp; <span>capabilities</span>
        </h2>
        <p className="qa-lede">
          The software testing lifecycle as I apply it in practice — from breaking requirements into
          testable statements to a release recommendation that is backed by evidence, not opinion.
        </p>

        <ol className="qa-phase-list">
          {phases.map((phase) => (
            <li key={phase.step}>
              <span className="qa-phase-step">{phase.step}</span>
              <div>
                <h3>{phase.title}</h3>
                <p>{phase.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="qa-capability-grid">
          {capabilities.map((capability) => (
            <article key={capability.label} className="qa-capability">
              <h3>{capability.label}</h3>
              <p>{capability.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestingApproach;
