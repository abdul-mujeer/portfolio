import "./styles/Career.css";

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
                <h4>Full-Stack Developer</h4>
                <h5>CYPHION</h5>
              </div>
              <h3>2024 2025</h3>
            </div>
            <p>
              At Cyphion, I worked as a Full Stack Developer, building scalable AI-powered web applications using modern technologies including Python, React, Flask, Django, Next.js, and Node.js. I handled both frontend and backend development, API integrations, database systems, and cloud-based deployments while focusing on performance, scalability, and clean architecture.
            </p>
          </div>
          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>FREELANCE</h4>
                <h5>SOFTWARE DEVELOPER (REMOTE)</h5>
              </div>
              <h3>2025 2026</h3>
            </div>
            <p>
              Collaborated with distributed client teams to build and optimize modern web applications leveraging Python and React. Developed high-performance RESTful APIs, seamlessly integrated dynamic frontend components with backend services, and systematically debugged production issues. Delivered clean, maintainable code on strict deadlines while maintaining clear technical communication across asynchronous development workflows.
            </p>
          </div>
          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>QA PRACTICE &amp; TRAINING</h4>
                <h5>MANUAL AND AUTOMATION TESTING (SELF-DIRECTED)</h5>
              </div>
              <h3>CURRENTLY</h3>
            </div>
            <p>
              Building three end-to-end QA portfolio projects: requirements and acceptance criteria,
              237 manual test cases, Playwright API and UI automation, SQL validation, Postman/Newman
              collections and defect reports with retest evidence. Studying manual, automation and
              mobile automation testing through an in-progress Udemy QA course.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Career;
