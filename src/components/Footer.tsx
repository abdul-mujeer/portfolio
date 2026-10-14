import { FaGithub, FaInstagram, FaLinkedinIn } from "react-icons/fa6";
import { SiLeetcode } from "react-icons/si";
import { MdArrowOutward } from "react-icons/md";
import "./styles/QASections.css";

const navLinks = [
  { href: "#about", label: "About" },
  { href: "#qa-skills", label: "QA skills" },
  { href: "#qa-projects", label: "QA projects" },
  { href: "#testing", label: "Testing approach" },
  { href: "#career", label: "Experience" },
  { href: "#education", label: "Education" },
  { href: "#contact", label: "Contact" },
];

const socialLinks = [
  { href: "https://github.com/abdul-mujeer", label: "GitHub", icon: <FaGithub /> },
  { href: "https://www.linkedin.com/in/qazi-abdul-mujeer/", label: "LinkedIn", icon: <FaLinkedinIn /> },
  { href: "https://leetcode.com/u/Abdul_Mujeer/", label: "LeetCode", icon: <SiLeetcode /> },
  { href: "https://www.instagram.com/abdul__mujeer/", label: "Instagram", icon: <FaInstagram /> },
];

const Footer = () => {
  return (
    <footer className="qa-footer" id="footer" aria-label="Site footer">
      <div className="qa-inner">
        <div className="qa-footer-grid">
          <div>
            <p className="qa-footer-brand">Qazi Abdul Mujeer</p>
            <p className="qa-footer-role">Aspiring QA / SQA Engineer · Manual &amp; Automation Testing</p>
            <p className="qa-footer-meta">
              Entry-level QA portfolio built on three self-made demo applications. All test results on this
              site were produced by executed runs and are documented in the repository.
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <h2 className="qa-footer-title">Sections</h2>
            <ul className="qa-footer-links">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="qa-footer-title">Elsewhere</h2>
            <ul className="qa-footer-socials">
              {socialLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer">
                    {link.icon}
                    <span>{link.label}</span>
                    <MdArrowOutward aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            <a className="qa-footer-resume" href="/cv/Qazi_Abdul_Mujeer_QA_CV.pdf" target="_blank" rel="noreferrer">
              Download CV (PDF)
            </a>
          </div>
        </div>

        <p className="qa-footer-legal">
          © {new Date().getFullYear()} Qazi Abdul Mujeer. Portfolio projects are educational demos built with
          synthetic data — no real customer, employee or payment data is used anywhere.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
