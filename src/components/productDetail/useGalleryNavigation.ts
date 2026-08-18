"use client";

import { useState, type SyntheticEvent } from "react";

import { FALLBACK_IMAGE } from "./constants";

/**
 * Which gallery image is showing, plus prev/next wrap-around.
 *
 * The SPA kept an effect that reset the index whenever it ran past the end of
 * the list. Here the images arrive as a server prop that cannot change without
 * a navigation — which remounts this hook — so the guard is a derived clamp
 * instead of an effect: same protection, no extra render.
 */
export interface GalleryNavigation {
  activeImage: number;
  setActiveImage: (index: number) => void;
  showPrevious: () => void;
  showNext: () => void;
}

export const useGalleryNavigation = (imageCount: number): GalleryNavigation => {
  const [index, setIndex] = useState(0);
  const activeImage = index < imageCount ? index : 0;

  return {
    activeImage,
    setActiveImage: setIndex,
    showPrevious: () => setIndex((prev) => (prev === 0 ? imageCount - 1 : prev - 1)),
    showNext: () => setIndex((prev) => (prev + 1) % imageCount),
  };
};

/**
 * Swaps a broken photo for the house fallback.
 *
 * PRESERVED AS FOUND: if the fallback itself 404s the browser fires `error`
 * again on the same element and this reassigns the same src, so the request
 * repeats. The original has the same shape; guarding it would be a behaviour
 * change, and the fallback is a checked-in static asset.
 */
export const swapToFallbackImage = (
  event: SyntheticEvent<HTMLImageElement>,
): void => {
  event.currentTarget.src = FALLBACK_IMAGE;
};
