"use client";

import { useEffect } from "react";

/**
 * Entrances for the parts of every section. The hidden start lives in globals.css behind
 * `html.js` and `prefers-reduced-motion: no-preference`, so no-JS and reduced-motion
 * visitors read the finished page.
 */
export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("revealed");

    if (!("IntersectionObserver" in window)) {
      root.classList.remove("js");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-in", "");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );

    for (const el of document.querySelectorAll("[data-reveal]")) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return null;
}
