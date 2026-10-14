import { qaProjects } from "../data/qaProjects";
import "./styles/QASections.css";

/**
 * Featured QA projects — links to the on-site case studies and the source in the monorepo.
 * Metrics shown on the cards come from each project's machine-generated execution summary.
 */
const QAProjects = () => {
  return (
    <section className="qa-section" id="qa-projects" aria-labelledby="qa-projects-heading">
      <div className="qa-inner">
        <p className="qa-eyebrow">Featured work</p>
        <h2 className="qa-heading" id="qa-projects-heading">
          QA <span>projects</span>
        </h2>
        <p className="qa-lede">
          Three applications, three different testing problems. Each one ships with requirements,
          manual test cases, automated suites, executed evidence and a release report — all runnable
          from the repository.
        </p>

        <div className="qa-project-grid">
          {qaProjects.map((project) => (
            <article className="qa-project-card" key={project.slug} style={{ ["--qa-accent" as string]: project.accent }}>
              <a className="qa-project-media" href={project.caseStudyUrl} aria-label={`Open the ${project.shortTitle} case study`}>
                <img src={project.screenshot} alt={project.screenshotAlt} loading="lazy" width={720} height={450} />
              </a>

              <div className="qa-project-body">
                <p className="qa-project-tagline">{project.tagline}</p>
                <h3>{project.title}</h3>
                <p className="qa-project-description">{project.description}</p>

                <ul className="qa-chip-list" aria-label="QA focus areas">
                  {project.focus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <dl className="qa-metrics">
                  {project.metrics.map((metric) => (
                    <div key={metric.label}>
                      <dt>{metric.label}</dt>
                      <dd>{metric.value}</dd>
                    </div>
                  ))}
                </dl>

                <ul className="qa-tech-list" aria-label="Technology stack">
                  {project.tech.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <div className="qa-project-actions">
                  <a className="qa-button qa-button-primary" href={project.caseStudyUrl}>
                    Case study &amp; evidence
                  </a>
                  <a className="qa-button" href={project.sourceUrl} target="_blank" rel="noreferrer">
                    Source code
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default QAProjects;
