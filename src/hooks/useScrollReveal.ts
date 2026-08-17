import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface ScrollRevealOptions {
  /** Fraction of the element that must be visible before revealing. */
  threshold?: number;
  /** Margin applied to the root box when computing intersections. */
  rootMargin?: string;
  /** Reveal once and stop observing (default), or track visibility both ways. */
  once?: boolean;
}

export interface ScrollRevealResult<T extends Element> {
  /** Attach to the element that should reveal on scroll. */
  ref: RefObject<T | null>;
  isVisible: boolean;
}

/**
 * Reveals an element when it scrolls into view.
 *
 * Ported from frontend/src/hooks/useScrollReveal.js with identical behaviour:
 * server-side rendering and `prefers-reduced-motion: reduce` both short-circuit
 * to visible, so content is never hidden from users who opted out of motion or
 * from a non-browser render pass.
 *
 * The element type is generic because a `RefObject` is invariant in its
 * element: the default suits `<div>`, and other hosts pass their own type
 * (e.g. `useScrollReveal<HTMLElement>()` for a `<section>`).
 */
export function useScrollReveal<T extends Element = HTMLDivElement>(
  options: ScrollRevealOptions = {},
): ScrollRevealResult<T> {
  const {
    threshold = 0.2,
    rootMargin = "0px 0px -10% 0px",
    once = true,
  } = options;
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsVisible(true);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // IntersectionObserver always delivers at least one entry; the guard
        // exists to satisfy noUncheckedIndexedAccess.
        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.unobserve(entry.target);
          }
          return;
        }

        if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [once, rootMargin, threshold]);

  return { ref, isVisible };
}
