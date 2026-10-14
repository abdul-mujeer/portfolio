import "./styles/QASections.css";

/**
 * Education and learning.
 *
 * Facts come from the owner's CV: BSc Computer Science at Kohat University of Science & Technology
 * (KUST), 2020-2024, CGPA 3.62/4.00, the Bachelor's final year project (Crypto AI Bot) and the
 * in-progress Udemy QA course. Nothing here is invented.
 */
const learning = [
  {
    period: "2020 – 2024",
    title: "BSc Computer Science — Kohat University of Science & Technology (KUST), Pakistan",
    text: "Bachelor of Science in Computer Science. CGPA 3.62 / 4.00. Coursework across programming, databases, software engineering and operating systems.",
  },
  {
    period: "Final year project",
    title: "Crypto AI Bot (Bachelor's Final Year Project, KUST)",
    text: "Built a software application integrating external APIs and handling application data. Debugged issues, validated application behaviour across different scenarios and worked across frontend/backend interaction to understand how components exchange data — the work that led me toward testing.",
  },
  {
    period: "In progress",
    title: "QA — Manual, Automation & Mobile Automation (Udemy, Lucky Trainings)",
    text: "Online course covering manual testing, test automation and mobile automation testing.",
  },
  {
    period: "Self-directed",
    title: "Software testing fundamentals (SDLC / STLC)",
    text: "Test levels and types, test design techniques (boundary value analysis, equivalence partitioning, decision tables), the defect life cycle, severity vs priority and test documentation standards.",
  },
  {
    period: "Practice",
    title: "Three end-to-end QA portfolio projects",
    text: "ShopSure, PeopleCore and TaskFlow: 60+ requirements with acceptance criteria, 237 manual test cases, Playwright API and UI suites, SQL validation checks, Postman/Newman collections, defect logs and executed evidence — all published with the source code.",
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
          Computer Science graduate moving into Software QA: university background, an in-progress QA
          certification and three self-built testing projects that put the theory into practice.
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
          Currently seeking a QA / SQA role where I can apply this testing discipline to real products
          and keep growing with a team.
        </p>
      </div>
    </section>
  );
};

export default Education;
