import { useEffect, useRef } from "react";
import "./styles/Cursor.css";

/**
 * Custom cursor.
 *
 * The original implementation ran a requestAnimationFrame loop forever, even when the pointer was
 * still, and pushed every frame id into an array (so the array grew without bound). This version
 * only runs a loop while the cursor is easing towards the pointer and stops as soon as it settles.
 */
const Cursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    // Touch devices do not need a custom cursor at all.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const mousePos = { x: 0, y: 0 };
    const cursorPos = { x: 0, y: 0 };
    let frame = 0;
    let running = false;

    const render = () => {
      const dx = mousePos.x - cursorPos.x;
      const dy = mousePos.y - cursorPos.y;

      if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) {
        cursorPos.x = mousePos.x;
        cursorPos.y = mousePos.y;
        cursor.style.transform = `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`;
        running = false;
        return;
      }

      cursorPos.x += dx / 6;
      cursorPos.y += dy / 6;
      cursor.style.transform = `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`;
      frame = requestAnimationFrame(render);
    };

    const start = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(render);
    };

    const onMouseMove = (event: MouseEvent) => {
      mousePos.x = event.clientX;
      mousePos.y = event.clientY;
      start();
    };

    document.addEventListener("mousemove", onMouseMove, { passive: true });

    // Hover states for elements that ask for a cursor variation.
    const interactive = Array.from(document.querySelectorAll<HTMLElement>("[data-cursor]"));
    const cleanups = interactive.map((element) => {
      const onEnter = () => {
        if (element.dataset.cursor === "icons") cursor.classList.add("cursor-icons");
        if (element.dataset.cursor === "disable") cursor.classList.add("cursor-disable");
      };
      const onLeave = () => cursor.classList.remove("cursor-disable", "cursor-icons");
      element.addEventListener("mouseenter", onEnter);
      element.addEventListener("mouseleave", onLeave);
      return () => {
        element.removeEventListener("mouseenter", onEnter);
        element.removeEventListener("mouseleave", onLeave);
      };
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousemove", onMouseMove);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  return <div className="cursor-main" ref={cursorRef}></div>;
};

export default Cursor;
