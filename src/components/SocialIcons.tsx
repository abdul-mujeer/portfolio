import {
  FaGithub,
  FaInstagram,
  FaLinkedinIn,
} from "react-icons/fa6";
import { SiLeetcode } from "react-icons/si"; // ✅ LeetCode icon
import "./styles/SocialIcons.css";
import { TbNotes } from "react-icons/tb";
import { useEffect, useRef } from "react";
import HoverLinks from "./HoverLinks";

const SocialIcons = () => {
  const animFrames = useRef<number[]>([]);
  const listeners = useRef<{ handler: (e: MouseEvent) => void }[]>([]);

  useEffect(() => {
    const social = document.getElementById("social") as HTMLElement;

    social.querySelectorAll("span").forEach((item) => {
      const elem = item as HTMLElement;
      const link = elem.querySelector("a") as HTMLElement;

      const rect = elem.getBoundingClientRect();
      let mouseX = rect.width / 2;
      let mouseY = rect.height / 2;
      let currentX = 0;
      let currentY = 0;

      const updatePosition = () => {
        currentX += (mouseX - currentX) * 0.1;
        currentY += (mouseY - currentY) * 0.1;

        link.style.setProperty("--siLeft", `${currentX}px`);
        link.style.setProperty("--siTop", `${currentY}px`);

        const id = requestAnimationFrame(updatePosition);
        animFrames.current.push(id);
      };

      const onMouseMove = (e: MouseEvent) => {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x < 40 && x > 10 && y < 40 && y > 5) {
          mouseX = x;
          mouseY = y;
        } else {
          mouseX = rect.width / 2;
          mouseY = rect.height / 2;
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      listeners.current.push({ handler: onMouseMove });

      updatePosition();
    });

    // ✅ Proper cleanup — runs when component unmounts
    return () => {
      animFrames.current.forEach(cancelAnimationFrame);
      listeners.current.forEach(({ handler }) =>
        document.removeEventListener("mousemove", handler)
      );
    };
  }, []);

  return (
    <div className="icons-section">
      <div className="social-icons" data-cursor="icons" id="social">
        <span>
          <a href="https://github.com/abdul-mujeer" target="_blank" rel="noreferrer">
            <FaGithub />
          </a>
        </span>
        <span>
          <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">
            <FaLinkedinIn />
          </a>
        </span>
        {/* ✅ LeetCode replaces X/Twitter */}
        <span>
          <a href="https://leetcode.com/u/Abdul_Mujeer/" target="_blank" rel="noreferrer">
            <SiLeetcode />
          </a>
        </span>
        <span>
          <a href="https://www.instagram.com/abdul__mujeer/" target="_blank" rel="noreferrer">
            <FaInstagram />
          </a>
        </span>
      </div>
      <a className="resume-button" href="#">
        <HoverLinks text="RESUME" />
        <span>
          <TbNotes />
        </span>
      </a>
    </div>
  );
};

export default SocialIcons;