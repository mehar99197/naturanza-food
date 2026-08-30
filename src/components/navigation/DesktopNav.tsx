"use client";

// "use client": every link reports hover/focus back up so the sliding underline
// can follow the pointer, and the container owns an onMouseLeave.

import Link from "next/link";

import { NAV_LINKS } from "./navLinks";
import type { NavIndicatorState } from "./types";

export interface DesktopNavProps {
  navRef: React.RefObject<HTMLDivElement | null>;
  /** Each link registers its DOM node here so the indicator can measure it. */
  linkRefs: React.RefObject<Record<string, HTMLAnchorElement>>;
  indicator: NavIndicatorState;
  /** Suppresses the transition on the first placement — see useNavIndicator. */
  isNavIndicatorReady: boolean;
  /** Current route, for the active-link colour. */
  pathname: string;
  onHoveredNavPathChange: (path: string | null) => void;
}

export function DesktopNav({
  navRef,
  linkRefs,
  indicator,
  isNavIndicatorReady,
  pathname,
  onHoveredNavPathChange,
}: DesktopNavProps) {
  const isActive = (path: string) => pathname === path;

  return (
    <div
      ref={navRef}
      onMouseLeave={() => onHoveredNavPathChange(null)}
      className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-0.5 left-0 h-0.5 rounded-full bg-[#22C55E] ${
          isNavIndicatorReady
            ? "transition-[transform,width,opacity] duration-500"
            : "transition-none"
        }`}
        style={{
          width: `${indicator.width}px`,
          transform: `translateX(${indicator.left}px)`,
          opacity: indicator.opacity,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
      {NAV_LINKS.map((link) => (
        <Link
          key={link.path}
          href={link.path}
          ref={(element) => {
            if (element) {
              linkRefs.current[link.path] = element;
            } else {
              delete linkRefs.current[link.path];
            }
          }}
          onMouseEnter={() => onHoveredNavPathChange(link.path)}
          onFocus={() => onHoveredNavPathChange(link.path)}
          onBlur={() => onHoveredNavPathChange(null)}
          className={`nav-link relative z-10 font-medium text-sm transition-colors duration-300 px-4 py-2 ${
            isActive(link.path)
              ? "text-[#14532D]"
              : "text-[#334155] md:hover:text-[#166534]"
          }`}
        >
          <span className="relative z-10">{link.label}</span>
        </Link>
      ))}
    </div>
  );
}
