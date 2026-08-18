"use client";

// "use client": IntersectionObserver, via useScrollReveal.

import type { ReactNode } from "react";

import { useScrollReveal } from "@/hooks/useScrollReveal";

/**
 * A `<div>` that gains the `active` class once it scrolls into view.
 *
 * Every section on the home page opened with the same three lines — a
 * `useScrollReveal()` call, a div, and `${visible ? 'active' : ''}` appended to
 * its class list. That is the whole of it, so it is one component here and the
 * markup around it stays server-rendered: the section headings, the About copy
 * and its CTA are all in the initial HTML rather than behind hydration.
 *
 * `className` carries the source's classes verbatim, including the `reveal
 * reveal-left` / `reveal reveal-right` pair that picks the entry direction, and
 * `active` is appended in the same position the template literal put it — so
 * the emitted class attribute is unchanged.
 *
 * Threshold and root margin are the hook's defaults, which is what every
 * reveal on this page used.
 */
export function Reveal({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={ref} className={`${className} ${isVisible ? 'active' : ''}`}>
      {children}
    </div>
  );
}
