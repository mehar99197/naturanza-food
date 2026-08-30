"use client";

/**
 * The sliding underline under the desktop nav links.
 *
 * It is a single absolutely-positioned span that is translated and resized to
 * sit under whichever link is hovered, falling back to the active route. That is
 * what produces the continuous slide between links — five separate borders
 * could not animate from one to the next.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { NAV_LINKS } from "./navLinks";
import type { NavIndicatorState } from "./types";

export interface NavIndicatorController {
  /** Attach to the flex row that positions the links; the indicator is offset within it. */
  navRef: React.RefObject<HTMLDivElement | null>;
  /** Populated by each link's ref callback, keyed by href. */
  linkRefs: React.RefObject<Record<string, HTMLAnchorElement>>;
  indicator: NavIndicatorState;
  /**
   * False until the indicator has been positioned once. Suppresses the
   * transition on that first placement so the underline appears in place
   * instead of flying in from the left edge.
   */
  isReady: boolean;
  setHoveredNavPath: (path: string | null) => void;
}

export function useNavIndicator(pathname: string): NavIndicatorController {
  const [indicator, setIndicator] = useState<NavIndicatorState>({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const [isReady, setIsReady] = useState(false);
  const [hoveredNavPath, setHoveredNavPath] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement>>({});

  const updateActiveNavIndicator = useCallback(() => {
    const activePath = NAV_LINKS.some((link) => link.path === pathname)
      ? pathname
      : null;
    const targetPath = hoveredNavPath || activePath;

    if (!navRef.current || !targetPath) {
      setIndicator((prev) => (prev.opacity === 0 ? prev : { ...prev, opacity: 0 }));
      return;
    }

    const targetLink = linkRefs.current[targetPath];
    if (!targetLink) {
      setIndicator((prev) => (prev.opacity === 0 ? prev : { ...prev, opacity: 0 }));
      return;
    }

    const linkLeft = targetLink.offsetLeft;
    const linkWidth = targetLink.offsetWidth;

    setIndicator({
      left: linkLeft,
      width: linkWidth,
      opacity: 1,
    });

    // Functional form rather than the source's `if (!isNavIndicatorReady)`
    // guard: React bails out of a re-render when the value is unchanged, so
    // this is the same one-way latch without capturing the flag in the closure.
    setIsReady((ready) => (ready ? ready : true));
  }, [hoveredNavPath, pathname]);

  // Measured in a rAF so the DOM has settled after the route change — reading
  // offsetLeft during the same commit gives the previous layout's numbers.
  useEffect(() => {
    const animationFrameId = requestAnimationFrame(updateActiveNavIndicator);
    return () => cancelAnimationFrame(animationFrameId);
  }, [updateActiveNavIndicator]);

  useEffect(() => {
    const handleResize = () => updateActiveNavIndicator();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateActiveNavIndicator]);

  return { navRef, linkRefs, indicator, isReady, setHoveredNavPath };
}
