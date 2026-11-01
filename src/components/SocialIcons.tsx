import { FaGithub, FaInstagram, FaLinkedinIn } from "react-icons/fa6";
import { SiLeetcode } from "react-icons/si";
import { TbNotes } from "react-icons/tb";
import { useEffect } from "react";
import HoverLinks from "./HoverLinks";
import "./styles/SocialIcons.css";

/**
 * Fixed social rail.
 *
 * The original version started one requestAnimationFrame loop per icon that ran forever and pushed
 * every frame id into an array (unbounded growth). This version moves the hovered icon directly on
 * pointer movement and lets CSS ease it back — no idle animation loop at all.
 */
const SocialIcons = () => {
  useEffect(() => {
    const social = document.getElementById("social");
    if (!social) return;

    const icons = Array.from(social.querySelectorAll("span")).map((item) => ({
      wrapper: item as HTMLElement,
      link: item.querySelector("a") as HTMLElement | null,
    }));

    const reset = () => {
      icons.forEach(({ link }) => {
        if (!link) return;
        link.style.setProperty("--siLeft", "50%");
        link.style.setProperty("--siTop", "50%");
      });
    };

    const onMouseMove = (event: MouseEvent) => {
      for (const { wrapper, link } of icons) {
        if (!link) continue;
        const rect = wrapper.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const inside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
        link.style.setProperty("--siLeft", inside ? `${x}px` : "50%");
        link.style.setProperty("--siTop", inside ? `${y}px` : "50%");
      }
    };

    social.addEventListener("mousemove", onMouseMove, { passive: true });
    social.addEventListener("mouseleave", reset);
    reset();

    return () => {
      social.removeEventListener("mousemove", onMouseMove);
      social.removeEventListener("mouseleave", reset);
    };
  }, []);

  return (
    <div className="icons-section">
      <div className="social-icons" data-cursor="icons" id="social">
        <span>
          <a href="https://github.com/abdul-mujeer" target="_blank" rel="noreferrer" aria-label="GitHub">
            <FaGithub />
          </a>
        </span>
        <span>
          <a href="https://www.linkedin.com/in/qazi-abdul-mujeer/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
            <FaLinkedinIn />
          </a>
        </span>
        <span>
          <a href="https://leetcode.com/u/Abdul_Mujeer/" target="_blank" rel="noreferrer" aria-label="LeetCode">
            <SiLeetcode />
          </a>
        </span>
        <span>
          <a href="https://www.instagram.com/abdul__mujeer/" target="_blank" rel="noreferrer" aria-label="Instagram">
            <FaInstagram />
          </a>
        </span>
      </div>
      <a className="resume-button" href="/cv/Qazi_Abdul_Mujeer_QA_CV.pdf" target="_blank" rel="noreferrer">
        <HoverLinks text="RESUME" />
        <span>
          <TbNotes />
        </span>
      </a>
    </div>
  );
};

export default SocialIcons;
