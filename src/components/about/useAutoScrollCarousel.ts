import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/** Delay before the first step, and the gap between steps after that. */
const START_DELAY_MS = 3000;
const STEP_INTERVAL_MS = 3000;

/**
 * Auto-advances a horizontally scrolling track, one card at a time, on mobile.
 *
 * About.jsx carried two byte-identical copies of this effect — one for the
 * values row, one for the team row — differing only in which ref and which
 * length they closed over. They are one hook here; the behaviour is unchanged,
 * including the mobile-only guard (the desktop layout is a CSS grid with
 * nothing to scroll), the 3s delay before the first step, and the wrap back to
 * the first card.
 *
 * The source also set a `programmaticScrollRef` flag around each `scrollTo` and
 * cleared it 450ms later. Nothing ever read that flag — it was presumably meant
 * to suppress a scroll listener that was never written — so it and its timer are
 * dropped rather than carried across as write-only state.
 *
 * `itemCount` is the dependency, so the timers restart when the track's contents
 * change rather than stepping past the end of a shorter list.
 */
export function useAutoScrollCarousel<T extends HTMLElement>(
  itemCount: number,
): RefObject<T | null> {
  const trackRef = useRef<T | null>(null);

  useEffect(() => {
    // Keep auto-scroll behavior mobile-only.
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      return;
    }

    const track = trackRef.current;
    if (!track) {
      return;
    }

    let autoInterval: number | undefined;
    let currentCardIndex = 0;

    const stepScroll = () => {
      const cards = Array.from(track.children);
      if (cards.length === 0) return;
      currentCardIndex = (currentCardIndex + 1) % cards.length;
      const card = cards[currentCardIndex];
      if (!(card instanceof HTMLElement)) return;
      const targetLeft = card.offsetLeft - (track.clientWidth - card.clientWidth) / 2;
      track.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    };

    const startDelayTimer = window.setTimeout(() => {
      autoInterval = window.setInterval(stepScroll, STEP_INTERVAL_MS);
    }, START_DELAY_MS);

    return () => {
      window.clearTimeout(startDelayTimer);
      if (autoInterval) window.clearInterval(autoInterval);
    };
  }, [itemCount]);

  return trackRef;
}
