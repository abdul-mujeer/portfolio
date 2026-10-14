import { useEffect, useRef } from "react";
import "./styles/WhatIDo.css";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const WhatIDo = () => {
  const containerRef = useRef<(HTMLDivElement | null)[]>([]);
  const setRef = (el: HTMLDivElement | null, index: number) => {
    containerRef.current[index] = el;
  };
  useEffect(() => {
    if (ScrollTrigger.isTouch) {
      containerRef.current.forEach((container) => {
        if (container) {
          container.classList.remove("what-noTouch");
          container.addEventListener("click", () => handleClick(container));
        }
      });
    }
    return () => {
      containerRef.current.forEach((container) => {
        if (container) {
          container.removeEventListener("click", () => handleClick(container));
        }
      });
    };
  }, []);
  return (
    <div className="whatIDO">
      <div className="what-box">
        <h2 className="title">
          W<span className="hat-h2">HAT</span>
          <div>
            I<span className="do-h2"> DO</span>
          </div>
        </h2>
      </div>
      <div className="what-box">
        <div className="what-box-in">
          <div className="what-border2">
            <svg width="100%">
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="100%"
                stroke="white"
                strokeWidth="2"
                strokeDasharray="7,7"
              />
              <line
                x1="100%"
                y1="0"
                x2="100%"
                y2="100%"
                stroke="white"
                strokeWidth="2"
                strokeDasharray="7,7"
              />
            </svg>
          </div>
          <div
            className="what-content what-noTouch"
            ref={(el) => setRef(el, 0)}
          >
            <div className="what-border1">
              <svg height="100%">
                <line
                  x1="0"
                  y1="0"
                  x2="100%"
                  y2="0"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="6,6"
                />
                <line
                  x1="0"
                  y1="100%"
                  x2="100%"
                  y2="100%"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="6,6"
                />
              </svg>
            </div>
            <div className="what-corner"></div>

            <div className="what-content-in">
              <h3>Manual QA</h3>
              <h4>Description</h4>
              <p>
                Designing and executing manual tests on real applications: test cases with
                preconditions, steps and expected results; smoke, sanity, regression and exploratory
                sessions; and defect reports with reproduction steps, severity and evidence.
              </p>
              <h5>Skills &amp; techniques</h5>
              <div className="what-content-flex">
                <div className="what-tags">Test Case Design</div>
                <div className="what-tags">Test Scenarios</div>
                <div className="what-tags">Functional Testing</div>
                <div className="what-tags">Regression Testing</div>
                <div className="what-tags">Smoke &amp; Sanity</div>
                <div className="what-tags">Exploratory Testing</div>
                <div className="what-tags">Boundary Value Analysis</div>
                <div className="what-tags">Equivalence Partitioning</div>
                <div className="what-tags">Decision Tables</div>
                <div className="what-tags">Negative Testing</div>
                <div className="what-tags">Defect Life Cycle</div>
                <div className="what-tags">Jira</div>
              </div>
              <div className="what-arrow"></div>
            </div>
          </div>
          <div
            className="what-content what-noTouch"
            ref={(el) => setRef(el, 1)}
          >
            <div className="what-border1">
              <svg height="100%">
                <line
                  x1="0"
                  y1="100%"
                  x2="100%"
                  y2="100%"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="6,6"
                />
              </svg>
            </div>
            <div className="what-corner"></div>
            <div className="what-content-in">
              <h3>Automation QA</h3>
              <h4>Description</h4>
              <p>
                Automating the critical paths of those projects: Playwright API and UI suites with
                reliable selectors and explicit assertions, Postman collections executed through
                Newman, SQL validation queries, and CI workflows that run everything and publish the
                reports. Python and SQL at a basic level.
              </p>
              <h5>Tools &amp; languages</h5>
              <div className="what-content-flex">
                <div className="what-tags">Playwright</div>
                <div className="what-tags">API Testing</div>
                <div className="what-tags">Postman</div>
                <div className="what-tags">Newman</div>
                <div className="what-tags">SQL</div>
                <div className="what-tags">JavaScript</div>
                <div className="what-tags">Python (basic)</div>
                <div className="what-tags">Git &amp; GitHub</div>
                <div className="what-tags">GitHub Actions</div>
                <div className="what-tags">Chrome DevTools</div>
              </div>
              <div className="what-arrow"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatIDo;

function handleClick(container: HTMLDivElement) {
  container.classList.toggle("what-content-active");
  container.classList.remove("what-sibling");
  if (container.parentElement) {
    const siblings = Array.from(container.parentElement.children);

    siblings.forEach((sibling) => {
      if (sibling !== container) {
        sibling.classList.remove("what-content-active");
        sibling.classList.toggle("what-sibling");
      }
    });
  }
}
