import { qaProjects } from "../data/qaProjects";
import "./styles/About.css";

/**
 * About section.
 *
 * The copy is deliberately specific: every number comes from the three projects' own executed
 * test reports (see docs/HANDOVER.md), and no claim is made about commercial QA employment.
 */
const About = () => {
  return (
    <div className="about-section" id="about">
      <div className="about-me">
        <h3 className="title">About Me</h3>

        <p className="para">
          I don't just find bugs — I prove software is ready to ship.
        </p>

        <p className="about-detail">
          Computer Science graduate (Kohat University of Science &amp; Technology, CGPA 3.62/4.00)
          and former full-stack developer at Cyphion, where I built and debugged web applications.
          That background is my advantage in QA: I trace a defect to the layer that causes it,
          reproduce it through the API, and write a report an engineer can act on immediately.
        </p>

        <p className="about-detail">
          To demonstrate the discipline rather than describe it, I ran the full testing lifecycle on
          three applications built as test targets: 60 requirements with acceptance criteria, 237
          manual test cases, 525 executed automated checks (Playwright API and UI suites, SQL
          validation, Postman collections run with Newman), a requirements traceability matrix and an
          evidence-based release report. I found, fixed and regression-verified 21 defects — including
          a critical authorization gap that let any employee write attendance records for anyone.
        </p>

        <div className="about-proof">
          <h4>Proof of work</h4>
          <ul>
            {qaProjects.map((project) => (
              <li key={project.slug}>
                <span className="about-proof-name">{project.shortTitle}</span>
                <span className="about-proof-focus">{project.tagline}</span>
                <span className="about-proof-links">
                  <a href={project.caseStudyUrl}>Case study</a>
                  <a href={project.sourceUrl} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default About;
