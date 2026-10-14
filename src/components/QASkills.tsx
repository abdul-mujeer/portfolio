import { qaSkillGroups } from "../data/qaProjects";
import "./styles/QASections.css";

/**
 * QA skills and tools section.
 *
 * Honesty note kept visible on purpose: these are portfolio-practice skills backed by the three
 * projects on this site — not commercial QA employment experience.
 */
const QASkills = () => {
  return (
    <section className="qa-section" id="qa-skills" aria-labelledby="qa-skills-heading">
      <div className="qa-inner">
        <p className="qa-eyebrow">Quality assurance</p>
        <h2 className="qa-heading" id="qa-skills-heading">
          QA skills &amp; <span>tools</span>
        </h2>
        <p className="qa-lede">
          A practical QA toolkit built by testing three real applications end to end — the same
          lifecycle a QA team follows: understand requirements, design risk-based tests, execute them
          manually, automate the critical paths, validate the data and report with evidence.
        </p>

        <div className="qa-skill-grid">
          {qaSkillGroups.map((group) => (
            <article className="qa-skill-card" key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.skills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="qa-note">
          All three applications, their tests and their evidence were created by me for this portfolio.
          No commercial QA experience is claimed — the value here is the demonstrable process.
        </p>
      </div>
    </section>
  );
};

export default QASkills;
