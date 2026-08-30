"use client";

/**
 * The four window/document effects the header owns, split out of Navigation.jsx
 * so the component file stays readable. Each is a faithful port — same
 * thresholds, same listener options, same cleanup.
 */

import { useEffect, useState } from "react";

/**
 * True once the page has scrolled past 24px, which is what collapses the header
 * to its compact padding.
 *
 * The listener is passive (it never calls preventDefault) and the setter bails
 * out when the boolean has not actually flipped, so a long scroll produces two
 * renders rather than hundreds.
 */
export function useIsScrolled(): boolean {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const nextIsScrolled = currentScrollY > 24;

      setIsScrolled((prev) => (prev === nextIsScrolled ? prev : nextIsScrolled));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return isScrolled;
}

/**
 * Escape closes the search modal and the mobile menu, whichever are open.
 *
 * One listener handles both, exactly as the source did. The `closeSearch` and
 * `closeMobileMenu` arguments are `useState` setters at the call site, so
 * including them in the dependency array does not re-register the listener any
 * more often than the original's `[isSearchOpen, isMobileMenuOpen]` did.
 */
export function useCloseOnEscape(
  isSearchOpen: boolean,
  isMobileMenuOpen: boolean,
  closeSearch: () => void,
  closeMobileMenu: () => void,
): void {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isSearchOpen) {
          closeSearch();
        }
        if (isMobileMenuOpen) {
          closeMobileMenu();
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isSearchOpen, isMobileMenuOpen, closeSearch, closeMobileMenu]);
}

/**
 * Freezes the page behind the full-screen mobile menu.
 *
 * `overflow: hidden` alone is not enough on iOS, so the body is also pinned with
 * `position: fixed` and a negative `top` equal to the current scroll offset —
 * which is why the cleanup has to scroll back: unpinning the body would
 * otherwise drop the visitor at the top of the page.
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return undefined;

    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}

/**
 * Drives the fade-in that replaces the auth skeleton.
 *
 * Visibility is flipped inside a `requestAnimationFrame` rather than
 * synchronously so the browser gets one frame with the element still at
 * `opacity-0`; setting it in the same frame as the mount would skip the
 * transition entirely and the account button would pop in.
 *
 * `userId` and `userEmail` are dependencies for the same reason they were in the
 * source: switching accounts without an intervening loading state should still
 * replay the transition.
 */
export function useAuthResolvedVisibility(
  isAuthHydrating: boolean,
  userId: string | number | null | undefined,
  userEmail: string | null | undefined,
): boolean {
  const [isAuthResolvedVisible, setIsAuthResolvedVisible] = useState(true);

  useEffect(() => {
    if (isAuthHydrating) {
      setIsAuthResolvedVisible(false);
      return;
    }

    const frameId = requestAnimationFrame(() => {
      setIsAuthResolvedVisible(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, [isAuthHydrating, userId, userEmail]);

  return isAuthResolvedVisible;
}
