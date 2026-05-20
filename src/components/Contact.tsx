import { MdArrowOutward, MdCopyright } from "react-icons/md";
import "./styles/Contact.css";

const Contact = () => {
  return (
    <div className="contact-section section-container" id="contact">
      <div className="contact-container">
        <h3>Contact</h3>
        <div className="contact-flex">
          <div className="contact-box">
            <h4>Email</h4>
            <p>
              <a href="mailto:abdul.mujeer98@gmail.com" data-cursor="disable">
                abdul.mujeer98@gmail.com
              </a>
            </p>
            <h4>Phone</h4>
            <p>
              <a href="tel:+92-316-2454316" data-cursor="disable">
                +92-316-2454316
              </a>
            </p>
          </div>

          <div className="contact-box">
            <h4>Social</h4>
            <a href="https://github.com/abdul-mujeer" target="_blank" rel="noreferrer" data-cursor="disable" className="contact-social">
              Github <MdArrowOutward />
            </a>
            <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" data-cursor="disable" className="contact-social">
              Linkedin <MdArrowOutward />
            </a>
            <a href="https://leetcode.com/u/Abdul_Mujeer/" target="_blank" rel="noreferrer" data-cursor="disable" className="contact-social">
              LeetCode <MdArrowOutward />
            </a>
            <a href="https://www.instagram.com/abdul__mujeer/" target="_blank" rel="noreferrer" data-cursor="disable" className="contact-social">
              Instagram <MdArrowOutward />
            </a>
          </div>

          <div className="contact-box">
            <h2>
              Designed and Developed <br /> by <span>Qazi Abdul Mujeer</span>
            </h2>
            <h5>
              <MdCopyright /> 2025 Qazi Abdul Mujeer. All rights reserved.
            </h5>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Contact;