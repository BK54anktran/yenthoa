"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Entrance for a part of a section: it rises 24px and fades in once, the first time it scrolls into view.
// Nothing is hidden until the script runs, and the hidden start only exists when motion is allowed (see .rv in globals.css).
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" | "p" | "h2" | "h3" }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // already on the first screen: leave it as is
    el.classList.add("rv-pre");
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.style.transitionDelay = `${delay}ms`;
        el.classList.remove("rv-pre");
        io.disconnect();
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  const T = Tag as "div";
  return (
    <T ref={ref as React.RefObject<HTMLDivElement>} className={`rv ${className}`}>
      {children}
    </T>
  );
}
