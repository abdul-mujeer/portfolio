# Portfolio site verification

- Executed: 2026-10-14T00:27:17.470Z
- Command: `npm run verify:site` (production build served by `vite preview`, driven by Playwright Chromium)
- Result: **23/24 checks passed**

| ID | Check | Result | Detail |
|----|-------|--------|--------|
| SITE-SEC-ABOUT | section "About" exists (#about) | PASS | found 1 |
| SITE-SEC-QA-SKILLS | section "QA skills" exists (#qa-skills) | PASS | found 1 |
| SITE-SEC-QA-PROJECTS | section "QA projects" exists (#qa-projects) | PASS | found 1 |
| SITE-SEC-TESTING-APPROACH | section "Testing approach" exists (#testing) | PASS | found 1 |
| SITE-SEC-EXPERIENCE | section "Experience" exists (#career) | PASS | found 1 |
| SITE-SEC-WORK | section "Work" exists (#work) | PASS | found 1 |
| SITE-SEC-EDUCATION | section "Education" exists (#education) | PASS | found 1 |
| SITE-SEC-CONTACT | section "Contact" exists (#contact) | PASS | found 1 |
| SITE-SEC-FOOTER | section "Footer" exists (#footer) | PASS | found 1 |
| SITE-01 | Featured QA project cards render | PASS | found 3 cards |
| SITE-02 | Project card thumbnails load (no broken images) | FAIL | [{"src":"/images/qa-projects/shopsure-qa-card.jpg","width":1440},{"src":"/images/qa-projects/peoplecore-qa-card.jpg","width":0},{"src":"/images/qa-projects/taskflow-qa-card.jpg","width":0}] |
| SITE-03 | Case-study links exist | PASS | ["/projects/shopsure-qa/","/projects/shopsure-qa/","/projects/peoplecore-qa/","/projects/peoplecore-qa/","/projects/taskflow-qa/","/projects/taskflow-qa/"] |
| SITE-04 | Navigation targets resolve to real sections | PASS | ["#about","#qa-projects","#work","#contact"] |
| SITE-05 | Résumé button points to the generated resume page (not '#') | PASS | /resume.html |
| SITE-06 | Footer navigation and social links render | PASS | 13 links |
| SITE-07 | Page title reflects the QA positioning | PASS | Qazi Abdul Mujeer — QA / SQA Engineer Portfolio \| Manual & Automation Testing |
| SITE-08 | Meta description present | PASS | Entry-level QA / SQA engineer portfolio: three complete soft |
| SITE-09 | Favicon declared | PASS | /favicon.svg |
| SITE-10 | Résumé page loads with the owner's name | PASS | Qazi Abdul Mujeer |
| SITE-11 | ShopSure case study renders with executed metrics | PASS | 6 metric cards |
| SITE-12 | Mobile viewport renders the project cards | PASS | 3 cards |
| SITE-13 | No uncaught console errors | PASS |  |
| SITE-14 | No failed internal requests (>=400) | PASS |  |
| SITE-15 | Loading screen dismissed and the site is interactive | PASS | loading overlay still present after 90s |

Screenshots captured by this run: `portfolio-home-desktop.jpg`, `portfolio-qa-projects.jpg`,
`portfolio-case-study.jpg`, `portfolio-home-mobile.jpg` (in this folder).
