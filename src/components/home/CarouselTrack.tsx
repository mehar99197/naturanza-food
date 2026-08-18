"use client";

// "use client": both variants own a DOM ref that is scrolled from an effect,
// and RevealTrack additionally runs an IntersectionObserver.

import { useCallback } from "react";
import type { CSSProperties, ReactNode } from "react";

import { useAutoScrollCarousel } from "@/components/about/useAutoScrollCarousel";
import { useScrollReveal } from "@/hooks/useScrollReveal";

/**
 * The horizontal card track the home sections share.
 *
 * Features, FeaturedProducts and Categories each carried their own copy of the
 * same effect: on viewports under 768px, wait 3s, then centre the next card
 * every 3s and wrap at the end. Desktop is a CSS grid with nothing to scroll, so
 * the effect bails there. That effect already exists as `useAutoScrollCarousel`
 * (written for the About page's two identical copies) and is reused rather than
 * written a fourth time.
 *
 * Two variants because the sources differ in exactly one way: the Features and
 * Categories tracks are *also* scroll-reveal targets, and FeaturedProducts' is
 * not. Everything else — the class list, the scrollbar-hiding style — comes from
 * the caller so each section keeps its own markup byte for byte.
 *
 * NOTE ON WHAT WAS DROPPED: all three sources also set a `programmaticScrollRef`
 * flag around each `scrollTo` and cleared it 450ms later. Nothing ever read it,
 * in any of the three. See useAutoScrollCarousel for the same note.
 */

/**
 * Hides the scrollbar in the engines Tailwind's `scrollbar-hide` does not reach.
 * Hoisted so the object identity is stable and the two variants cannot drift.
 */
const HIDE_SCROLLBAR: CSSProperties = {
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  WebkitOverflowScrolling: 'touch',
};

/** Threshold the two revealing tracks used; looser than the headings' 0.2. */
const TRACK_REVEAL_THRESHOLD = 0.15;

interface TrackProps {
  /**
   * Number of cards in the track. Restarts the timers when the list changes, so
   * a shorter list cannot be stepped past its end.
   */
  itemCount: number;
  className: string;
  children: ReactNode;
}

/** Auto-scrolling track with no reveal animation (FeaturedProducts). */
export function AutoScrollTrack({ itemCount, className, children }: TrackProps) {
  const trackRef = useAutoScrollCarousel<HTMLDivElement>(itemCount);

  return (
    <div ref={trackRef} className={className} style={HIDE_SCROLLBAR}>
      {children}
    </div>
  );
}

/** Auto-scrolling track that also reveals on scroll (Features, Categories). */
export function RevealTrack({ itemCount, className, children }: TrackProps) {
  const { ref: revealRef, isVisible } = useScrollReveal<HTMLDivElement>({
    threshold: TRACK_REVEAL_THRESHOLD,
  });
  const trackRef = useAutoScrollCarousel<HTMLDivElement>(itemCount);

  // One node, two hooks that each want a ref — the same `setTrackNode` callback
  // the sources used. A callback ref runs during commit, before either hook's
  // effect reads `.current`, so both see the node.
  const setTrackNode = useCallback(
    (node: HTMLDivElement | null) => {
      revealRef.current = node;
      trackRef.current = node;
    },
    [revealRef, trackRef],
  );

  return (
    <div
      ref={setTrackNode}
      className={`${className} ${isVisible ? 'active' : ''}`}
      style={HIDE_SCROLLBAR}
    >
      {children}
    </div>
  );
}
