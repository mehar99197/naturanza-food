import { useCallback, useEffect, useState } from "react";

/** Time a slide stays on screen before the carousel advances itself. */
const SLIDE_INTERVAL_MS = 3000;
/** Matches the `duration-700` transition on the slides; guards against re-entry. */
const TRANSITION_MS = 700;

export interface HeroCarousel {
  currentSlide: number;
  /** Bumped on every change so the copy can be remounted and re-animated. */
  textKey: number;
  isAnimating: boolean;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  setHovered: (hovered: boolean) => void;
}

/**
 * Slide index and transition state for the hero carousel.
 *
 * Lifted out of Hero.jsx unchanged, including the parts that are load-bearing in
 * non-obvious ways:
 *
 *   - `isAnimating` is both the re-entry guard and an interval switch. While it
 *     is true the auto-advance effect installs no timer at all, so the 3s clock
 *     effectively restarts from the end of each transition rather than running
 *     free. Changing it to a plain guard would speed the carousel up.
 *   - the effect depends on `currentSlide`, so every advance — including a click
 *     — resets the timer. That is why a manual click does not get overtaken 200ms
 *     later by a pending tick.
 *   - `textKey` is separate from `currentSlide` because it keys the copy block;
 *     remounting is what replays the stagger animation.
 *
 * ⚠ PRESERVED AS-IS: the `setTimeout` that clears `isAnimating` is never
 * cancelled. Unmount during a transition (navigating away mid-slide) still fires
 * it. Harmless in React 18+, which no longer warns, but it is the source's
 * behaviour rather than a decision made here.
 */
export function useHeroCarousel(slideCount: number): HeroCarousel {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setHovered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [textKey, setTextKey] = useState(0);

  const beginTransition = useCallback(() => {
    setIsAnimating(true);
    setTextKey((k) => k + 1);
    window.setTimeout(() => setIsAnimating(false), TRANSITION_MS);
  }, []);

  const next = useCallback(() => {
    if (isAnimating || slideCount === 0) return;
    beginTransition();
    setCurrentSlide((prev) => (prev + 1) % slideCount);
  }, [beginTransition, isAnimating, slideCount]);

  const prev = useCallback(() => {
    if (isAnimating || slideCount === 0) return;
    beginTransition();
    setCurrentSlide((previous) => (previous - 1 + slideCount) % slideCount);
  }, [beginTransition, isAnimating, slideCount]);

  const goTo = useCallback(
    (index: number) => {
      if (isAnimating || index === currentSlide) return;
      beginTransition();
      setCurrentSlide(index);
    },
    [beginTransition, currentSlide, isAnimating],
  );

  useEffect(() => {
    if (!isHovered && !isAnimating && slideCount > 1) {
      const interval = window.setInterval(() => {
        next();
      }, SLIDE_INTERVAL_MS);
      return () => window.clearInterval(interval);
    }
    return undefined;
  }, [currentSlide, isHovered, isAnimating, slideCount, next]);

  return { currentSlide, textKey, isAnimating, next, prev, goTo, setHovered };
}
