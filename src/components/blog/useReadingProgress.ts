"use client";

import { useEffect, useState } from "react";

/**
 * Scroll-derived state for the article page: how far down the reader is, and
 * which heading they are under.
 *
 * BlogPost.jsx computed both in one effect on the page component, which worked
 * because the whole page was a Client Component. Here the page is server-rendered
 * and only the three fragments that actually change — the progress bar, the "%
 * read" badge, and the two tables of contents — are Client Components. Left alone
 * that would attach four scroll listeners to do one page's worth of work, so the
 * listener and its animation frame are shared at module scope and the hooks below
 * are subscribers to it.
 */

const subscribers = new Set<() => void>();
let frameId = 0;
let listening = false;

const tick = (): void => {
  cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(() => {
    for (const subscriber of subscribers) subscriber();
  });
};

/** Adds a subscriber, attaching the listener on the first and removing it on the last. */
const subscribe = (onScroll: () => void): (() => void) => {
  subscribers.add(onScroll);
  if (!listening) {
    window.addEventListener("scroll", tick, { passive: true });
    listening = true;
  }

  // Run once so the value is right before the reader has scrolled at all.
  onScroll();

  return () => {
    subscribers.delete(onScroll);
    if (subscribers.size === 0) {
      window.removeEventListener("scroll", tick);
      cancelAnimationFrame(frameId);
      listening = false;
    }
  };
};

/** How far the document has been scrolled, 0–100. */
export function useReadingProgress(): number {
  const [percent, setPercent] = useState(0);

  useEffect(
    () =>
      subscribe(() => {
        const root = document.documentElement;
        const scrollable = root.scrollHeight - root.clientHeight;
        const raw = scrollable <= 0 ? 0 : (root.scrollTop / scrollable) * 100;
        setPercent(Math.min(100, Math.max(0, raw)));
      }),
    [],
  );

  return percent;
}

/**
 * The last heading whose top has passed under the sticky header.
 *
 * `ids` is joined into a dependency key so that a caller passing a fresh array
 * each render does not re-subscribe on every render.
 */
export function useActiveHeading(ids: string[]): string {
  const [activeId, setActiveId] = useState("");
  const key = ids.join("|");

  useEffect(() => {
    const headingIds = key ? key.split("|") : [];
    const first = headingIds[0];
    if (first === undefined) return;

    return subscribe(() => {
      let active = first;
      for (const id of headingIds) {
        const node = document.getElementById(id);
        if (node && node.getBoundingClientRect().top <= 110) active = id;
      }
      setActiveId(active);
    });
  }, [key]);

  return activeId;
}

/** Smooth-scrolls a heading into view, clearing the fixed site header. */
export const scrollToHeading = (id: string): void => {
  const node = document.getElementById(id);
  if (!node) return;

  window.scrollTo({
    top: node.getBoundingClientRect().top + window.scrollY - 96,
    behavior: "smooth",
  });
};
