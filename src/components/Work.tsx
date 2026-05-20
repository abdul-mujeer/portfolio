import "./styles/Work.css";
import WorkImage from "./WorkImage";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// ✅ Define your projects here
const projects = [
  {
    name: "AI-POWERED CRYPTO TRADING",
    category: "Full-Stack AI",
    tools: "Python, Flask, Nextjs, GCP, Docker, JWT, REST API",
    image: "/images/PROJECT1.png",
  },
  {
    name: "Hybrid Legal Text Summarization System ",
    category: "Natural Language Processing (NLP)",
    tools: "Python, NLTK, Scikit-learn, Transformers, NumPy",
    image: "/images/project2.png",
  },
  {
    name: "Real-Time Human Detection and Pose Estimation",
    category: "Artificial Intelligence (AI)",
    tools: "Python, Yolov5, Pytorch, MoviePy",
    image: "/images/project3.png",
  },
  {
    name: "Responsive Shopify-Clone",
    category: "AI Deep Learning",
    tools: "Python, Keras(CNN), Numpy, Tensorflow",
    image: "/images/project5.png",
  },
  {
    name: "Responsive Shopify-Clone",
    category: "Frontend",
    tools: "HTMl, CSS , JavaScript",
    image: "/images/project4.png",
  },
];

const Work = () => {
  useGSAP(() => {
    let translateX: number = 0;

    function setTranslateX() {
      const box = document.getElementsByClassName("work-box");
      const rectLeft = document
        .querySelector(".work-container")!
        .getBoundingClientRect().left;
      const rect = box[0].getBoundingClientRect();
      const parentWidth = box[0].parentElement!.getBoundingClientRect().width;
      let padding: number =
        parseInt(window.getComputedStyle(box[0]).padding) / 2;
      translateX = rect.width * box.length - (rectLeft + parentWidth) + padding;
    }

    setTranslateX();

    let timeline = gsap.timeline({
      scrollTrigger: {
        trigger: ".work-section",
        start: "top top",
        end: `+=${translateX}`,
        scrub: true,
        pin: true,
        id: "work",
      },
    });

    timeline.to(".work-flex", {
      x: -translateX,
      ease: "none",
    });

    return () => {
      timeline.kill();
      ScrollTrigger.getById("work")?.kill();
    };
  }, []);

  return (
    <div className="work-section" id="work">
      <div className="work-container section-container">
        <h2>
          My <span>Work</span>
        </h2>
        <div className="work-flex">
          {/* ✅ Now each project has its own data */}
          {projects.map((project, index) => (
            <div className="work-box" key={index}>
              <div className="work-info">
                <div className="work-title">
                  <h3>0{index + 1}</h3>
                  <div>
                    <h4>{project.name}</h4>
                    <p>{project.category}</p>
                  </div>
                </div>
                <h4>Tools and features</h4>
                <p>{project.tools}</p>
              </div>
              <WorkImage image={project.image} alt={project.name} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Work;