import "./styles/QASections.css";

/**
 * Education and learning.
 *
 * Only information already published in this portfolio is stated. Specific institution, degree title
 * and dates are intentionally omitted until the owner of this portfolio supplies them — see the
 * QA-BUILD checklist in docs/BUILD-PLAN.md.
 */
const learning = [
  {
    period: "Foundations",
    title: "Computer Science studies",
    text: "Graduated in Computer Science, covering programming, data structures, databases, software engineering and operating systems — the base I build on for testing.",
  },
  {
    period: "Self-directed",
    title: "Software testing fundamentals (SDLC / STLC)",
    text: "Studied the software development and testing lifecycles, test levels and types, test design techniques, defect lifecycle, severity vs priority and test documentation standards.",
  },
  {
    period: "Practice",
    title: "API, database and automation skills",
    text: "Hands-on practice with REST API testing (Postman, Newman), SQL validation queries, Playwright automation for UI and API suites, Git/GitHub workflows and CI with GitHub Actions.",
  },
  {
    period: "Practice",
    title: "Three end-to-end QA portfolio projects",
    text: "Requirements, test strategy, 200+ manual test cases, four automated suites per project, defect logs, traceability matrices and executed evidence — all published in the repository.",
  },
];

const Education = () => {
  return (
    <section className="qa-section" id="education" aria-labelledby="education-heading">
      <div className="qa-inner">
        <p className="qa-eyebrow">Background</p>
        <h2 className="qa-heading" id="education-heading">
          Education &amp; <span>learning</span>
        </h2>
        <p className="qa-lede">
          Computer Science graduate with a Software Quality Assurance focus. The learning below is
          either academic background or self-directed study — it is not claimed as employment.
        </p>

        <div className="qa-timeline">
          {learning.map((item) => (
            <article key={item.title} className="qa-timeline-item">
              <p className="qa-timeline-period">{item.period}</p>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>

        <p className="qa-note">
          Currently seeking an entry-level QA / SQA role where I can apply this testing discipline to
          real products and keep growing with a team.
        </p>
      </div>
    </section>
  );
};

export default Education;
