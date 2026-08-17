"use client";

/**
 * The 620ms pulse/bump the cart and wishlist icons play when their count moves.
 *
 * The two hooks look alike but their trigger conditions genuinely differ and are
 * preserved separately rather than merged behind a flag:
 *
 *   cart     — fires only when the total *increases* and is above zero, so
 *              removing a line does not celebrate.
 *   wishlist — fires on any change in either direction, but skips the very first
 *              value, because the wishlist arrives asynchronously and would
 *              otherwise animate on page load.
 */

import { useEffect, useRef, useState } from "react";

const PULSE_DURATION_MS = 620;

export interface BadgePulseState {
  isBadgePulsing: boolean;
  isIconBumping: boolean;
}

export function useCartBadgePulse(totalItems: number): BadgePulseState {
  const [isBadgePulsing, setIsBadgePulsing] = useState(false);
  const [isIconBumping, setIsIconBumping] = useState(false);
  const previousTotalItemsRef = useRef(0);

  useEffect(() => {
    const previousTotal = previousTotalItemsRef.current;
    const hasIncremented = totalItems > previousTotal;
    previousTotalItemsRef.current = totalItems;

    if (!hasIncremented || totalItems <= 0) {
      return;
    }

    // Cleared first, then re-set a frame later: restarting a CSS animation
    // requires the class to actually leave the DOM for one frame, otherwise
    // adding it again while it is already present is a no-op.
    setIsBadgePulsing(false);
    setIsIconBumping(false);

    const rafId = requestAnimationFrame(() => {
      setIsBadgePulsing(true);
      setIsIconBumping(true);
    });

    const timerId = setTimeout(() => {
      setIsBadgePulsing(false);
      setIsIconBumping(false);
    }, PULSE_DURATION_MS);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [totalItems]);

  return { isBadgePulsing, isIconBumping };
}

export function useWishlistBadgePulse(totalItems: number): BadgePulseState {
  const [isBadgePulsing, setIsBadgePulsing] = useState(false);
  const [isIconBumping, setIsIconBumping] = useState(false);
  const previousTotalItemsRef = useRef(0);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      previousTotalItemsRef.current = totalItems;
      return;
    }

    const previousTotal = previousTotalItemsRef.current;
    const hasChanged = totalItems !== previousTotal;
    previousTotalItemsRef.current = totalItems;

    if (!hasChanged) {
      return;
    }

    setIsBadgePulsing(false);
    setIsIconBumping(false);

    const rafId = requestAnimationFrame(() => {
      setIsBadgePulsing(true);
      setIsIconBumping(true);
    });

    const timerId = setTimeout(() => {
      setIsBadgePulsing(false);
      setIsIconBumping(false);
    }, PULSE_DURATION_MS);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [totalItems]);

  return { isBadgePulsing, isIconBumping };
}
