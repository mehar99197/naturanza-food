"use client";

import { BookOpen } from "lucide-react";

import { useReadingProgress } from "./useReadingProgress";

/**
 * The hairline progress bar pinned to the top of the viewport.
 *
 * Renders at 0% on the server, which is where every reader starts, so there is
 * nothing for hydration to disagree about.
 */
export function ReadingProgressBar() {
  const percent = useReadingProgress();

  return (
    <div
      className="fixed top-0 left-0 z-[70] h-[3px] bg-gradient-to-r from-emerald-400 to-green-600 transition-all duration-150 ease-out pointer-events-none"
      style={{ width: `${percent}%` }}
      aria-hidden="true"
    />
  );
}

/**
 * "42% read" in the article header.
 *
 * Hidden below 5% and above 99%, as in the original — it has nothing to say when
 * the reader has just arrived or has reached the end.
 */
export function ReadingProgressBadge() {
  const percent = useReadingProgress();

  if (percent <= 5 || percent >= 99) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
      <BookOpen className="h-3.5 w-3.5" />
      {Math.round(percent)}% read
    </span>
  );
}
