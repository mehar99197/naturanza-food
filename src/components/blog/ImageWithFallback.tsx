"use client";

import { useState } from "react";

/**
 * An <img> that swaps to a fallback once, if its source fails to load.
 *
 * The smallest possible Client Component: `onError` is a DOM event, so the two
 * places BlogPost.jsx guarded against a missing cover need a listener. Only the
 * tag itself crosses the boundary — the surrounding article is server-rendered.
 *
 * It renders the same single <img> as the original rather than going through
 * OptimizedImage, which would wrap it in a positioned div and change the markup.
 *
 * The original also cleared `onerror` before reassigning `src`, to stop a
 * missing fallback from looping. Here a second failure just sets the same state
 * again, which React discards, so the loop cannot start.
 */
export function ImageWithFallback({
  src,
  alt,
  className,
  fallbackSrc,
  lazy = false,
}: {
  src: string;
  alt: string;
  className: string;
  fallbackSrc: string;
  lazy?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={failed ? fallbackSrc : src}
      alt={alt}
      {...(lazy ? { loading: "lazy" as const } : {})}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
