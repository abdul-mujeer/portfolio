import "./styles/Career.css";

/**
 * Experience timeline, kept in sync with the owner's CV.
 * Professional roles are listed chronologically; the last entry is clearly labelled as self-directed
 * portfolio work so it is never mistaken for employment.
 */
const Career = () => {
  return (
    <div className="career-section section-container" id="career">
      <div className="career-container">
        <h2>
          My career <span>&</span>
          <br /> experience
        </h2>
        <div className="career-info">
          <div className="career-timeline">
            <div className="career-dot"></div>
          </div>

          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>SQA Engineer</h4>
                <h5>CYPHION</h5>
              </div>
              <h3 className="career-period">JUN 2024 — JUL 2025</h3>
            </div>
            <p>
              Created and executed test cases to verify application functionality, and validated fixes
              through retesting and regression checks. I investigated and reported defects with clear
              reproduction steps, expected versus actual results and supporting evidence, tested web
              application workflows including API request/response behaviour and database validation,
              and worked closely with developers to clarify requirements, confirm fixes and support
              stable releases.
            </p>
          </div>

          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>SQA Engineer</h4>
                <h5>APPEARLS</h5>
              </div>
              <h3 className="career-period">JUL 2025 — SEP 2026</h3>
            </div>
            <p>
              Designed and executed test cases to verify functionality and quality across the
              company's software products. I identified, documented and reported defects with clear
              details so they could be reproduced and resolved, and helped ensure the quality and
              reliability of software releases through consistent, structured testing.
            </p>
          </div>

          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>QA PORTFOLIO &amp; LEARNING</h4>
                <h5>SELF-DIRECTED (NOT EMPLOYMENT)</h5>
              </div>
              <h3 className="career-period">2026 — NOW</h3>
            </div>
            <p>
              Built and tested three end-to-end QA projects — ShopSure, PeopleCore and TaskFlow:
              60 requirements with acceptance criteria, 237 manual test cases, 525 automated checks
              (Playwright API and UI suites, SQL validation, Postman/Newman collections) and 18
              defects found and fixed with retest evidence. Currently studying manual, automation and
              mobile automation testing through an in-progress Udemy QA course.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Career;
