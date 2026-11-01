import { Suspense, lazy, useEffect, useRef, useState } from "react";

const TechStack = lazy(() => import("./TechStack"));

/**
 * Defers the 3D toolbox.
 *
 * The toolbox chunk pulls in three.js, rapier and an HDR environment (~2.4 MB of JavaScript), so it
 * is only imported once the section is within about one and a half viewports. After that the scene
 * stays mounted but stops rendering whenever it is off screen.
 *
 * Visitors who prefer reduced motion never load it at all; a plain spacer keeps the layout stable.
 */
const TechStackSection = () => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [shouldMount, setShouldMount] = useState(false);
  const [active, setActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setShouldMount(true);
          setActive(entry.isIntersecting);
        }
      },
      { rootMargin: "150% 0px 150% 0px" }
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div ref={anchorRef} className="techstack-anchor" data-mounted={shouldMount} data-active={active}>
      {shouldMount && !reducedMotion ? (
        <Suspense fallback={<div className="techstack" aria-hidden="true" />}>
          <TechStack active={active} />
        </Suspense>
      ) : (
        <div className="techstack" aria-hidden="true" />
      )}
    </div>
  );
};

export default TechStackSection;
