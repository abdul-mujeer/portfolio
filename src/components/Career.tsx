import "./styles/Career.css";

const Career = () => {
  return (
    <div className="career-section section-container">
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
                <h5>NOCODEAI.CLOUD</h5>
              </div>
              <h3>2024-2025</h3>
            </div>
            <p>
              At NocodeAI.cloud, I worked as a Full Stack Developer, building scalable AI-powered web applications using modern technologies including Python, React, Flask, Django, Next.js, and Node.js. I handled both frontend and backend development, API integrations, database systems, and cloud-based deployments while focusing on performance, scalability, and clean architecture.
            </p>
          </div>
          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>PYTHON BOOTCAMP</h4>
                <h5>UDEMY COURSE</h5>
              </div>
              <h3>MID 2025 END 2025</h3>
            </div>
            <p>
              Successfully completed the Python Pro Bootcamp course on Udemy, gaining strong practical knowledge in Python programming, backend development, APIs, automation, databases, and full-stack application development. Worked on multiple hands-on projects involving real-world problem solving, web development, and software engineering concepts.
            </p>
          </div>
          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>WORKING ON PROJECT</h4>
                <h5>AI-CRYPTO BOT</h5>
              </div>
              <h3>CURRENTLY</h3>
            </div>
            <p>
              A comprehensive cryptocurrency trading dashboard and analysis platform built with Next.js. This application provides real-time market data, trading signals, technical analysis, and virtual trading capabilities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Career;
